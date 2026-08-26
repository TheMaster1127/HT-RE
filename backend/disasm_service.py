import re
from backend.utils import run_cmd, get_objdump_cmd

def resolve_strings(disasm_text, binary_path):
    s_out, _, _ = run_cmd(f'strings -a -t x "{binary_path}"')
    str_map = {
        int(p.strip().split(maxsplit=1)[0], 16): p.strip().split(maxsplit=1)[1]
        for p in s_out.splitlines()
        if len(p.strip().split(maxsplit=1)) == 2
    }
    new_lines = []
    rip_rel = re.compile(r'#\s*([0-9a-fA-F]+)\s*<')
    for line in disasm_text.splitlines():
        m = rip_rel.search(line)
        if m:
            try:
                addr = int(m.group(1), 16)
                resolved = str_map.get(addr) or str_map.get(addr - 0x400000)
                if resolved:
                    line += f'  ; "{resolved}"'
            except Exception:
                pass
        new_lines.append(line)
    return '\n'.join(new_lines)

def get_elf_load_addr(path):
    """Accurately extracts the virtual memory load address from Program Headers (PT_LOAD)."""
    out, _, _ = run_cmd(f'readelf -l "{path}"')
    lines = out.splitlines()
    for i, line in enumerate(lines):
        if 'LOAD' in line:
            parts = line.split()
            hex_tokens = [p for p in parts if p.startswith('0x')]
            # In readelf -l, tokens are: [Offset, VirtAddr, PhysAddr, ...]
            if len(hex_tokens) >= 2:
                try:
                    vaddr = int(hex_tokens[1], 16)
                    if vaddr > 0:
                        return vaddr
                except Exception:
                    pass
            # If tokens wrap onto the next line
            if i + 1 < len(lines):
                next_tokens = [p for p in lines[i+1].split() if p.startswith('0x')]
                if len(next_tokens) >= 2:
                    try:
                        vaddr = int(next_tokens[1], 16)
                        if vaddr > 0:
                            return vaddr
                    except Exception:
                        pass
    
    # Fallback to Entry Point calculation
    out_h, _, _ = run_cmd(f'readelf -h "{path}"')
    m = re.search(r'Entry point address:\s+(0x[0-9a-fA-F]+)', out_h)
    if m:
        entry = int(m.group(1), 16)
        if entry >= 0x10000:
            return entry - (entry % 0x10000)
    return 0

def get_elf_entry(path):
    """Extracts Entry Point address from ELF Header."""
    out_h, _, _ = run_cmd(f'readelf -h "{path}"')
    m = re.search(r'Entry point address:\s+(0x[0-9a-fA-F]+)', out_h)
    if m:
        return m.group(1)
    return ""

def handle_nm(path):
    out, _, _ = run_cmd(f'nm -n -S --defined-only "{path}"')
    funcs = []
    for line in out.splitlines():
        parts = line.split()
        if len(parts) >= 3:
            try:
                func_type_index = next((i for i, p in enumerate(parts) if len(p) == 1 and p.upper() == 'T'), -1)
                if func_type_index > 0 and func_type_index + 1 < len(parts):
                    addr, name = '0x' + parts[0], parts[func_type_index + 1]
                    funcs.append({'addr': addr, 'name': name})
            except Exception:
                pass
    
    # Auto-fallback: If binary has 0 section headers or 0 symbols, synthesize _start from Entry Point!
    if not funcs:
        entry = get_elf_entry(path)
        if entry and entry != '0x0':
            funcs.append({'addr': entry, 'name': '_start'})

    return {'functions': funcs}

def handle_resolve_strings(binary_path, disasm_text):
    s_out, _, _ = run_cmd(f'strings -a -t x "{binary_path}"')
    str_map = {
        int(p.strip().split(maxsplit=1)[0], 16): p.strip().split(maxsplit=1)[1]
        for p in s_out.splitlines()
        if len(p.strip().split(maxsplit=1)) == 2
    }
    rip_rel = re.compile(r'^\s*([0-9a-fA-F]+):.*#\s*([0-9a-fA-F]+)')
    results = []
    for line in disasm_text.splitlines():
        m = rip_rel.search(line)
        if m:
            instr, target = m.group(1), int(m.group(2), 16)
            resolved = str_map.get(target) or str_map.get(target - 0x400000)
            if resolved:
                results.append({'string': resolved, 'addr': instr})
    return {'strings': results}

def handle_disasm(path, opt):
    arch_val = opt.get('arch', 'x86-64')
    arch_map = {'x86-64': 'i386:x86-64', 'arm': 'arm', 'aarch64': 'aarch64'}
    m_arch = arch_map.get(arch_val, 'i386:x86-64')
    syntax = opt.get('syntax', 'intel')
    syntax_flag = f"-M {syntax}" if arch_val == 'x86-64' else ""
    raw_flag = '--show-raw-insn' if opt.get('show_raw') else '--no-show-raw-insn'
    objdump_bin = get_objdump_cmd(arch_val)

    if opt.get('raw_binary'):
        load_addr = get_elf_load_addr(path)
        adjust_flag = f"--adjust-vma={hex(load_addr)}" if load_addr else ""
        cmd = f'{objdump_bin} -D -b binary -m {m_arch} {adjust_flag} {syntax_flag} {raw_flag} -w "{path}"'
        out, _, _ = run_cmd(cmd)
        return {'output': resolve_strings(out, path)}

    cmd = f'{objdump_bin} {"-D" if opt.get("all_sections") else "-d"} {syntax_flag} {raw_flag} -w "{path}"'
    out, err, code = run_cmd(cmd)

    # Automatic bare-metal fallback: If ELF has 0 section headers and objdump returns empty
    has_disasm_lines = any(':\t' in l or re.match(r'^\s*[0-9a-f]+:', l) for l in out.splitlines())
    if not has_disasm_lines or "no sections" in err.lower() or "can't disassemble" in err.lower():
        load_addr = get_elf_load_addr(path)
        adjust_flag = f"--adjust-vma={hex(load_addr)}" if load_addr else ""
        fallback_cmd = f'{objdump_bin} -D -b binary -m {m_arch} {adjust_flag} {syntax_flag} {raw_flag} -w "{path}"'
        out, _, _ = run_cmd(fallback_cmd)

    return {'output': resolve_strings(out, path)}

def handle_function_code(path, start_addr, opt):
    arch_val = opt.get('arch', 'x86-64')
    arch_map = {'x86-64': 'i386:x86-64', 'arm': 'arm', 'aarch64': 'aarch64'}
    m_arch = arch_map.get(arch_val, 'i386:x86-64')
    syntax = opt.get('syntax', 'intel')
    syntax_flag = f"-M {syntax}" if arch_val == 'x86-64' else ""
    raw_flag = '--show-raw-insn' if opt.get('show_raw') else '--no-show-raw-insn'
    objdump_bin = get_objdump_cmd(arch_val)

    clean = start_addr.lstrip('0x').lstrip('0') or '0'

    cmd = f'{objdump_bin} {"-D" if opt.get("all_sections") else "-d"} {syntax_flag} {raw_flag} --start-address={start_addr} -w "{path}"'
    out, _, _ = run_cmd(cmd)

    code, in_func = [], False
    for line in out.splitlines():
        if f"{clean} <" in line and ">:" in line:
            in_func = True
        if in_func:
            if len(code) > 1 and ">:" in line and f"{clean} <" not in line:
                break
            code.append(line)

    # Automatic bare-metal fallback if no section headers exist
    if not code:
        load_addr = get_elf_load_addr(path)
        adjust_flag = f"--adjust-vma={hex(load_addr)}" if load_addr else ""
        fallback_cmd = f'{objdump_bin} -D -b binary -m {m_arch} {adjust_flag} {syntax_flag} {raw_flag} --start-address={start_addr} -w "{path}"'
        f_out, _, _ = run_cmd(fallback_cmd)
        lines = f_out.splitlines()
        for l in lines:
            if clean + ':' in l or in_func:
                in_func = True
                code.append(l)
                if 'ret' in l or 'syscall' in l or len(code) > 80:
                    break
        if not code and lines:
            code = lines[:80]

    return {'output': resolve_strings('\n'.join(code) if code else out, path)}
