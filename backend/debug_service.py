import os
import subprocess
import threading
import queue
import socket
import re
from backend.utils import run_cmd, validate

# Persistent GDB/MI sessions mapped by binary_path
debug_sessions = {}

def get_free_port():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(('', 0))
    port = s.getsockname()[1]
    s.close()
    return port

def stream_reader(proc, out_queue):
    for line in iter(proc.stdout.readline, ''):
        out_queue.put(line)
    proc.stdout.close()

def handle_debug_start(data):
    binary_path = data.get('binary_path')
    arch = data.get('arch', 'x86-64')
    use_qemu = data.get('use_qemu', True)

    if not validate(binary_path):
        return {'error': 'Invalid binary path.'}
    
    handle_debug_stop(data)

    qemu_proc = None
    port = get_free_port()

    if use_qemu:
        qemu_bin = "qemu-x86_64"
        if arch == "aarch64": qemu_bin = "qemu-aarch64"
        elif arch == "arm": qemu_bin = "qemu-arm"
        
        try:
            qemu_proc = subprocess.Popen([qemu_bin, "-g", str(port), binary_path], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception as e:
            return {'error': f'Failed to start QEMU: {str(e)}'}

    try:
        gdb_bin = "gdb-multiarch" if os.system("which gdb-multiarch > /dev/null 2>&1") == 0 else "gdb"
        gdb_args = [gdb_bin, "--interpreter=mi3", binary_path]
        
        gdb_proc = subprocess.Popen(gdb_args, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
        out_queue = queue.Queue()
        reader_thread = threading.Thread(target=stream_reader, args=(gdb_proc, out_queue), daemon=True)
        reader_thread.start()

        if use_qemu:
            gdb_proc.stdin.write(f"-target-select remote localhost:{port}\n")
            gdb_proc.stdin.flush()

        debug_sessions[binary_path] = {
            'gdb_proc': gdb_proc,
            'qemu_proc': qemu_proc,
            'queue': out_queue,
            'thread': reader_thread
        }
        return {'status': 'started', 'port': port if use_qemu else None}

    except Exception as e:
        if qemu_proc: qemu_proc.kill()
        return {'error': f'Failed to start GDB: {str(e)}'}

def handle_debug_cmd(data):
    binary_path = data.get('binary_path')
    cmd = data.get('cmd')
    session = debug_sessions.get(binary_path)
    if not session or not session['gdb_proc'].poll() is None:
        return {'error': 'Debugger not running.'}
    
    try:
        session['gdb_proc'].stdin.write(cmd + '\n')
        session['gdb_proc'].stdin.flush()
        return {'status': 'ok'}
    except Exception as e:
        return {'error': str(e)}

def handle_debug_poll(data):
    binary_path = data.get('binary_path')
    session = debug_sessions.get(binary_path)
    if not session:
        return {'lines': [], 'running': False}
    
    lines = []
    try:
        while True:
            lines.append(session['queue'].get_nowait())
    except queue.Empty:
        pass
    
    running = session['gdb_proc'].poll() is None
    return {'lines': lines, 'running': running}

def handle_debug_stop(data):
    binary_path = data.get('binary_path')
    session = debug_sessions.pop(binary_path, None)
    if session:
        try:
            if session['gdb_proc']: session['gdb_proc'].kill()
            if session['qemu_proc']: session['qemu_proc'].kill()
        except: pass
    return {'status': 'stopped'}

def handle_trace_run(data):
    binary_path = data.get('binary_path')
    if not validate(binary_path):
        return {'error': 'Invalid binary path.'}
    
    # Run with a 10s timeout so the backend doesn't hang forever if binary blocks on stdin
    cmd = f'timeout 10 strace -f -x -e trace=all "{binary_path}" 2>&1'
    out, _, _ = run_cmd(cmd)

    # Simple network extractor logic
    network_activity = []
    net_pattern = re.compile(r'(socket|connect|sendto|recvfrom|bind|listen|accept)\(.*?')
    for line in out.splitlines():
        if net_pattern.search(line):
            network_activity.append(line.strip())
            
    return {'output': out, 'network': network_activity}

def handle_binwalk(data):
    binary_path = data.get('binary_path')
    extract = data.get('extract', False)
    entropy = data.get('entropy', False)
    
    if not validate(binary_path):
        return {'error': 'Invalid binary path.'}
    
    args = []
    if extract: args.append('-e')
    if entropy: args.append('-E')
    
    cmd = f'binwalk {" ".join(args)} "{binary_path}"'
    out, err, _ = run_cmd(cmd)
    
    tree_out = ""
    extracted_dir = f"{binary_path}.extracted"
    if extract and os.path.exists(extracted_dir):
        t_out, _, _ = run_cmd(f'tree "{extracted_dir}"')
        tree_out = t_out

    return {'output': out + "\n" + err, 'tree': tree_out}
