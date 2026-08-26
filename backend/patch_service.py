import os
import re
import tempfile
import subprocess
import time
import shutil
import json
from backend.utils import validate, get_as_cmd, get_objcopy_cmd, get_objdump_cmd

def handle_binpatch(data):
    path = data.get('binary_path', '')
    mode = data.get('mode', '')
    if not validate(path):
        return {'error': 'Binary invalid.'}

    cmd = ['binpatch', path]
    if mode == 'write':
        dir_name = os.path.dirname(path)
        base_name = os.path.basename(path)
        
        orig_path = os.path.join(dir_name, base_name + "_original_")
        if not os.path.exists(orig_path):
            try: shutil.copy2(path, orig_path)
            except: pass
            
        if data.get('backup'):
            timestamp = int(time.time())
            backup_path = os.path.join(dir_name, f"{base_name}_backup_{timestamp}")
            try: shutil.copy2(path, backup_path)
            except: pass

        cmd.append('-va' if data.get('is_va') else '-o')
        cmd.append(data.get('offset', ''))
        cmd.extend(['-h', data.get('hex', '')])
        
    elif mode == 'find':
        cmd.append('-fh' if data.get('heuristic') else '-f')
        cmd.append(data.get('hex', ''))
        if data.get('all'):
            cmd.append('-a')
        elif data.get('size'):
            cmd.extend(['-s', data.get('size')])
    elif mode == 'resolve':
        target = data.get('target', '')
        if target in ('-m', '-e'):
            cmd.append(target)
        else:
            cmd.append('-va' if data.get('is_va') else '-o')
            cmd.append(target)
        cmd.append('-d') 
        if data.get('size'):
            cmd.extend(['-s', data.get('size')])
        if data.get('until_ret'):
            cmd.append('-r')

    try:
        res = subprocess.run(cmd, capture_output=True, text=True)
        return {'output': (res.stdout + '\n' + res.stderr).strip()}
    except Exception as e:
        return {'error': f'Failed to run binpatch: {str(e)}'}

def handle_assemble(data):
    asm_code = data.get('asm', '').strip()
    arch = data.get('arch', 'x86-64')
    if not asm_code: return {'error': 'No assembly provided.'}

    as_cmd = get_as_cmd(arch)
    objcopy_cmd = get_objcopy_cmd(arch)

    prefix = ".text\n"
    if arch == 'x86-64' and '.intel_syntax' not in asm_code:
        prefix = ".intel_syntax noprefix\n.text\n"
    
    if '.text' not in asm_code:
        asm_code = prefix + asm_code

    with tempfile.TemporaryDirectory() as tmpdir:
        s_file = os.path.join(tmpdir, 'code.s')
        o_file = os.path.join(tmpdir, 'code.o')
        bin_file = os.path.join(tmpdir, 'code.bin')

        with open(s_file, 'w') as f: 
            f.write(asm_code)

        res = subprocess.run(f'{as_cmd} -o {o_file} {s_file}', shell=True, capture_output=True, text=True)
        if res.returncode != 0:
            return {'error': f'Assembler Error:\n{res.stderr.strip()}'}

        res2 = subprocess.run(f'{objcopy_cmd} -O binary -j .text {o_file} {bin_file}', shell=True, capture_output=True, text=True)
        if res2.returncode != 0:
            return {'error': f'Objcopy Error:\n{res2.stderr.strip()}'}

        with open(bin_file, 'rb') as f: 
            raw_bytes = f.read()

        hex_str = ' '.join(f'{b:02x}' for b in raw_bytes)
        return {'hex': hex_str, 'output': 'Assembly successful.'}

def handle_disassemble_raw(data):
    hex_str = data.get('hex', '').replace(' ', '').replace('0x', '').replace(',', '').replace('\\x', '').strip()
    arch = data.get('arch', 'x86-64')
    if not hex_str: return {'error': 'No hex provided.'}

    arch_map = {'x86-64': 'i386:x86-64', 'arm': 'arm', 'aarch64': 'aarch64'}
    m_arch = arch_map.get(arch, 'i386:x86-64')
    objdump_cmd = get_objdump_cmd(arch)

    try:
        raw_bytes = bytes.fromhex(hex_str)
    except ValueError:
        return {'error': 'Invalid hex string. Please provide valid hexadecimal values.'}

    with tempfile.TemporaryDirectory() as tmpdir:
        bin_file = os.path.join(tmpdir, 'code.bin')
        with open(bin_file, 'wb') as f: 
            f.write(raw_bytes)

        syntax_flag = '-M intel' if arch == 'x86-64' else ''
        cmd = f'{objdump_cmd} -D -b binary -m {m_arch} {syntax_flag} {bin_file}'
        
        res = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        if res.returncode != 0:
            return {'error': f'Objdump Error:\n{res.stderr.strip()}'}

        lines = res.stdout.splitlines()
        asm_lines = []
        
        for line in lines:
            if '0:\t' in line or re.match(r'^\s*[0-9a-f]+:\s+', line):
                parts = line.split('\t', 2)
                if len(parts) >= 3:
                    asm_lines.append(parts[2].strip())
                elif len(parts) >= 2:
                    asm_lines.append(parts[1].strip())
        
        if not asm_lines:
            return {'error': 'Could not disassemble the provided bytes.'}

        return {'asm': '\n'.join(asm_lines), 'output': 'Disassembly successful.'}

def handle_compile(data):
    code = data.get('code', '')
    lang = data.get('lang', 'c') 
    compiler = data.get('compiler', 'gcc')
    options = data.get('options', '')
    
    # Safely construct universal upload directory in OS Temp to bypass permission errors
    UPLOAD_DIR = os.path.join(tempfile.gettempdir(), "htre_uploads")
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    
    timestamp = int(time.time())
    out_name = f"compiled_{timestamp}.bin"
    final_out_path = os.path.join(UPLOAD_DIR, out_name)

    # Use an isolated temp directory to prevent any "Permission Denied" for source.c
    with tempfile.TemporaryDirectory() as tmpdir:
        src_filename = "source.c" if lang == 'c' else ("source.cpp" if lang == 'cpp' else "source.asm")
        src_file = os.path.join(tmpdir, src_filename)
        tmp_out = os.path.join(tmpdir, "a.out")
        
        with open(src_file, 'w') as f:
            f.write(code)
            
        if lang in ['c', 'cpp']:
            cmd = f"{compiler} {options} \"{src_file}\" -o \"{tmp_out}\""
        else: # asm
            if compiler == 'nasm':
                cmd = f"nasm {options} -f elf64 \"{src_file}\" -o \"{tmpdir}/out.o\" && ld \"{tmpdir}/out.o\" -o \"{tmp_out}\""
            elif compiler == 'fasm':
                cmd = f"fasm \"{src_file}\" \"{tmp_out}\""
            elif compiler == 'gas' or compiler == 'as':
                cmd = f"as {options} \"{src_file}\" -o \"{tmpdir}/out.o\" && ld \"{tmpdir}/out.o\" -o \"{tmp_out}\""
            elif compiler == 'arm-linux-gnueabihf-as':
                cmd = f"arm-linux-gnueabihf-as {options} \"{src_file}\" -o \"{tmpdir}/out.o\" && arm-linux-gnueabihf-ld \"{tmpdir}/out.o\" -o \"{tmp_out}\""
            elif compiler == 'aarch64-linux-gnu-as':
                cmd = f"aarch64-linux-gnu-as {options} \"{src_file}\" -o \"{tmpdir}/out.o\" && aarch64-linux-gnu-ld \"{tmpdir}/out.o\" -o \"{tmp_out}\""
            else:
                # Custom fallback
                cmd = f"{compiler} {options} \"{src_file}\" -o \"{tmp_out}\""

        res = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        
        # Intelligent Output Detection: If tmp_out doesn't exist, maybe it ignored the -o flag.
        if not os.path.exists(tmp_out):
            new_files = [f for f in os.listdir(tmpdir) if f != src_filename and not f.endswith('.o')]
            if new_files:
                tmp_out = os.path.join(tmpdir, new_files[0])
        
        # Copy to the final directory and ensure executable rights
        if os.path.exists(tmp_out):
            shutil.copy2(tmp_out, final_out_path)
            try:
                os.chmod(final_out_path, 0o755)
            except:
                pass
            return {'path': final_out_path, 'output': f"Compiled successfully: {final_out_path}\n{res.stdout}\n{res.stderr}"}
        else:
            return {'error': f"Failed to generate output file.\n{res.stderr}\n{res.stdout}"}

def get_patch_history(data):
    path = data.get('binary_path', '')
    if not os.path.exists(path):
        return {'history': []}
    
    dir_name = os.path.dirname(path)
    base_name = os.path.basename(path)
    history = []
    
    for f in os.listdir(dir_name):
        if f.startswith(base_name + "_original_") or f.startswith(base_name + "_backup_"):
            history.append(os.path.join(dir_name, f))
            
    history.sort()
    return {'history': history}

def restore_patch(data):
    target = data.get('binary_path', '')
    backup = data.get('backup_path', '')
    if os.path.exists(backup) and os.path.exists(target):
        try:
            shutil.copy2(backup, target)
            return {'success': True}
        except Exception as e:
            return {'error': str(e)}
    return {'error': 'File not found'}

def track_action(data):
    try:
        if not os.path.exists('tracking.json'):
            with open('tracking.json', 'w') as f:
                json.dump([], f)
        with open('tracking.json', 'r') as f:
            tracking = json.load(f)
        tracking.append(data)
        with open('tracking.json', 'w') as f:
            json.dump(tracking, f)
    except Exception:
        pass
    return {'status': 'ok'}
