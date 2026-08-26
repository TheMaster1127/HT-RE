import os
import subprocess
import threading
import queue
import socket
import re
import shutil
import time
from backend.utils import run_cmd, validate

debug_sessions = {}

def get_free_port():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(('', 0))
    port = s.getsockname()[1]
    s.close()
    return port

def gdb_stream_reader(pipe, out_queue, session_dict=None):
    reg_pattern = re.compile(r'~"([a-zA-Z0-9_]+)\s+(0x[0-9a-fA-F]+|[0-9]+)')
    try:
        for line in iter(pipe.readline, ''):
            if not line:
                break

            # Live backend register parsing from GDB output stream
            if session_dict is not None and '~"' in line:
                clean = line.replace('\\n', '').replace('\\t', ' ')
                m = reg_pattern.search(clean)
                if m:
                    reg_name = m.group(1).lower()
                    reg_val = m.group(2)
                    session_dict['registers'][reg_name] = reg_val
                    # Suppress raw info registers output from polluting the main log
                    continue

            out_queue.put(line)
    except:
        pass
    finally:
        try: pipe.close()
        except: pass

def pipe_reader(pipe, target_queue):
    try:
        for line in iter(pipe.readline, ''):
            if not line:
                break
            target_queue.put(line)
    except:
        pass
    finally:
        try: pipe.close()
        except: pass

def get_qemu_binary(arch):
    if arch == "aarch64":
        return "qemu-aarch64"
    elif arch == "arm":
        return "qemu-arm"
    return "qemu-x86_64"

def get_gdb_binary():
    if shutil.which("gdb-multiarch"):
        return "gdb-multiarch"
    elif shutil.which("gdb"):
        return "gdb"
    return None

def format_breakpoint_target(target):
    target = target.strip()
    if not target:
        return ""
    clean = target.replace("*", "")
    if re.match(r'^(0x)?[0-9a-fA-F]+$', clean):
        addr_hex = clean if clean.startswith("0x") else f"0x{clean}"
        return f"*{addr_hex}"
    return target

def handle_debug_start(data):
    binary_path = data.get('binary_path')
    arch = data.get('arch', 'x86-64')
    use_qemu = data.get('use_qemu', True)
    breakpoints = data.get('breakpoints', [])
    trace_syscalls = data.get('trace_syscalls', True)
    trace_network = data.get('trace_network', True)

    if not validate(binary_path):
        return {'error': 'Invalid binary path.'}
    
    handle_debug_stop(data)

    gdb_bin = get_gdb_binary()
    if not gdb_bin:
        return {'error': 'GDB not found on system (please install gdb or gdb-multiarch).'}

    qemu_proc = None
    port = None
    stdout_queue = queue.Queue()
    trace_queue = queue.Queue()

    if use_qemu:
        qemu_bin = get_qemu_binary(arch)
        if not shutil.which(qemu_bin):
            return {'error': f'QEMU emulator binary "{qemu_bin}" not found on system.'}
        
        port = get_free_port()
        qemu_cmd = [qemu_bin, "-g", str(port)]
        
        if trace_syscalls or trace_network:
            qemu_cmd.append("-strace")

        qemu_cmd.append(binary_path)

        try:
            # Capture stdout for program terminal output and stderr for -strace syscalls
            qemu_proc = subprocess.Popen(
                qemu_cmd, 
                stdout=subprocess.PIPE, 
                stderr=subprocess.PIPE, 
                text=True, 
                bufsize=1
            )
            qemu_stdout_thread = threading.Thread(target=pipe_reader, args=(qemu_proc.stdout, stdout_queue), daemon=True)
            qemu_stdout_thread.start()

            qemu_trace_thread = threading.Thread(target=pipe_reader, args=(qemu_proc.stderr, trace_queue), daemon=True)
            qemu_trace_thread.start()
        except Exception as e:
            return {'error': f'Failed to start QEMU: {str(e)}'}

    try:
        gdb_args = [
            gdb_bin, 
            "--interpreter=mi3", 
            "-q", 
            "-ex", "set debuginfod enabled off",
            "-ex", "set pagination off",
            "-ex", "set confirm off",
            binary_path
        ]
        gdb_proc = subprocess.Popen(
            gdb_args, 
            stdin=subprocess.PIPE, 
            stdout=subprocess.PIPE, 
            stderr=subprocess.STDOUT, 
            text=True, 
            bufsize=1
        )
        
        session_info = {
            'gdb_proc': gdb_proc,
            'qemu_proc': qemu_proc,
            'queue': queue.Queue(),
            'stdout_queue': stdout_queue,
            'trace_queue': trace_queue,
            'registers': {},
            'arch': arch,
            'use_qemu': use_qemu
        }

        reader_thread = threading.Thread(
            target=gdb_stream_reader, 
            args=(gdb_proc.stdout, session_info['queue'], session_info), 
            daemon=True
        )
        reader_thread.start()

        if use_qemu:
            gdb_proc.stdin.write(f"-target-select remote localhost:{port}\n")
            gdb_proc.stdin.flush()

        for bp in breakpoints:
            fmt_bp = format_breakpoint_target(bp)
            if fmt_bp:
                gdb_proc.stdin.write(f"-break-insert {fmt_bp}\n")

        # Initial register query to immediately populate UI
        gdb_proc.stdin.write('-interpreter-exec console "info registers"\n')
        gdb_proc.stdin.flush()

        debug_sessions[binary_path] = session_info
        return {'status': 'started', 'port': port, 'use_qemu': use_qemu}

    except Exception as e:
        if qemu_proc:
            try: qemu_proc.kill()
            except: pass
        return {'error': f'Failed to start GDB session: {str(e)}'}

def handle_debug_cmd(data):
    binary_path = data.get('binary_path')
    cmd = data.get('cmd', '').strip()
    session = debug_sessions.get(binary_path)
    if not session or session['gdb_proc'].poll() is not None:
        return {'error': 'Debugger session is not currently running.'}
    
    if cmd.startswith("-break-insert "):
        target = cmd.replace("-break-insert ", "").strip()
        cmd = f"-break-insert {format_breakpoint_target(target)}"

    try:
        session['gdb_proc'].stdin.write(cmd + '\n')
        if any(cmd.startswith(prefix) for prefix in ['-exec-step', '-exec-next', '-exec-continue', 'step', 'next', 'continue', 'si', 'ni']):
            session['gdb_proc'].stdin.write('-interpreter-exec console "info registers"\n')
        session['gdb_proc'].stdin.flush()
        return {'status': 'ok'}
    except Exception as e:
        return {'error': str(e)}

def handle_debug_poll(data):
    binary_path = data.get('binary_path')
    session = debug_sessions.get(binary_path)
    if not session:
        return {'lines': [], 'trace_lines': [], 'stdout_lines': [], 'registers': {}, 'running': False}
    
    lines = []
    try:
        while True:
            lines.append(session['queue'].get_nowait())
    except queue.Empty:
        pass

    trace_lines = []
    try:
        while True:
            trace_lines.append(session['trace_queue'].get_nowait())
    except queue.Empty:
        pass

    stdout_lines = []
    try:
        while True:
            stdout_lines.append(session['stdout_queue'].get_nowait())
    except queue.Empty:
        pass
    
    running = session['gdb_proc'].poll() is None
    return {
        'lines': lines, 
        'trace_lines': trace_lines, 
        'stdout_lines': stdout_lines,
        'registers': session['registers'], 
        'running': running
    }

def handle_debug_registers(data):
    binary_path = data.get('binary_path')
    session = debug_sessions.get(binary_path)
    if not session or session['gdb_proc'].poll() is not None:
        return {'registers': {}}
    
    try:
        session['gdb_proc'].stdin.write('-interpreter-exec console "info registers"\n')
        session['gdb_proc'].stdin.flush()
        time.sleep(0.05)
        return {'registers': session.get('registers', {})}
    except Exception as e:
        return {'error': str(e)}

def handle_debug_set_reg(data):
    binary_path = data.get('binary_path')
    reg = data.get('reg')
    val = data.get('val')
    session = debug_sessions.get(binary_path)
    if not session or session['gdb_proc'].poll() is not None:
        return {'error': 'Debugger session not active.'}
    
    try:
        cmd = f'-interpreter-exec console "set ${reg} = {val}"'
        session['gdb_proc'].stdin.write(cmd + '\n')
        session['gdb_proc'].stdin.write('-interpreter-exec console "info registers"\n')
        session['gdb_proc'].stdin.flush()
        return {'status': 'ok'}
    except Exception as e:
        return {'error': str(e)}

def handle_debug_stop(data):
    binary_path = data.get('binary_path')
    session = debug_sessions.pop(binary_path, None)
    if session:
        try:
            if session['gdb_proc']: session['gdb_proc'].kill()
            if session['qemu_proc']: session['qemu_proc'].kill()
        except:
            pass
    return {'status': 'stopped'}

def handle_trace_run(data):
    binary_path = data.get('binary_path')
    arch = data.get('arch', 'x86-64')
    use_qemu = data.get('use_qemu', True)
    trace_syscalls = data.get('trace_syscalls', True)
    trace_network = data.get('trace_network', True)

    if not validate(binary_path):
        return {'error': 'Invalid binary path.'}
    
    if use_qemu:
        qemu_bin = get_qemu_binary(arch)
        cmd = f'timeout 10 {qemu_bin} -strace "{binary_path}" 2>&1'
    else:
        filter_args = ""
        if trace_network and not trace_syscalls:
            filter_args = "-e trace=network"
        cmd = f'timeout 10 strace -f -x {filter_args} "{binary_path}" 2>&1'

    out, _, _ = run_cmd(cmd)

    network_activity = []
    syscall_lines = []
    net_pattern = re.compile(r'\b(socket|connect|sendto|recvfrom|bind|listen|accept|send|recv|getpeername|getsockname)\b', re.IGNORECASE)

    for line in out.splitlines():
        clean_l = line.strip()
        if not clean_l:
            continue
        if net_pattern.search(clean_l):
            network_activity.append(clean_l)
        if trace_syscalls:
            syscall_lines.append(clean_l)

    return {
        'output': '\n'.join(syscall_lines) if trace_syscalls else "Syscall tracing disabled in options.",
        'network': network_activity
    }

def handle_binwalk(data):
    binary_path = data.get('binary_path')
    extract = data.get('extract', False)
    entropy = data.get('entropy', False)
    
    if not validate(binary_path):
        return {'error': 'Invalid binary path.'}
    
    if not shutil.which("binwalk"):
        return {'error': 'binwalk utility not installed on system.'}

    args = []
    if extract: args.append('-e --matryoshka')
    if entropy: args.append('-E')
    
    cmd = f'binwalk {" ".join(args)} "{binary_path}"'
    out, err, _ = run_cmd(cmd)
    
    tree_out = ""
    extracted_dir = f"{binary_path}.extracted"
    if extract and os.path.exists(extracted_dir):
        t_out, _, _ = run_cmd(f'tree -a "{extracted_dir}"')
        tree_out = t_out or "Directory extracted, tree empty."

    return {'output': (out + "\n" + err).strip(), 'tree': tree_out}
