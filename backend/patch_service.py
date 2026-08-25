import os
import re
import tempfile
import subprocess
from backend.utils import validate, get_as_cmd, get_objcopy_cmd, get_objdump_cmd

def handle_binpatch(data):
    path = data.get('binary_path', '')
    mode = data.get('mode', '')
    if not validate(path):
        return {'error': 'Binary invalid.'}

    cmd = ['binpatch', path]
    if mode == 'write':
        cmd.append('-va' if data.get('is_va') else '-o')
        cmd.append(data.get('offset', ''))
        cmd.extend(['-h', data.get('hex', '')])
        if data.get('backup'):
            cmd.append('-b')
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

    # Ensure instructions fall properly into text space and force intel syntax on x86 by default
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
