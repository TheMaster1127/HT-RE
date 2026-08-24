import os
import re
from backend.utils import validate, run_cmd, get_objdump_cmd, get_file_hash, load_decomp_cache
from backend.disasm_service import resolve_strings

def handle_export(path, opts, cfg):
    if not validate(path):
        return {'error': 'Invalid binary'}

    export_data = {
        'binary_path': path,
        'options_used': opts
    }

    # Detect C vs C++ to dynamically name the JSON key
    out_file, _, _ = run_cmd(f'file "{path}"')
    out_ldd, _, _ = run_cmd(f'ldd "{path}"')
    out_d, _, _ = run_cmd(f'readelf -d "{path}"')
    is_cpp = "libstdc++" in out_d or "C++" in out_file

    if cfg.get('header'):
        out_ls, _, _ = run_cmd(f'ls -lh "{path}"')
        out_stat, _, _ = run_cmd(f'stat "{path}"')
        out_h, _, _ = run_cmd(f'readelf -h "{path}"')
        link_status = "Unknown"
        if "statically linked" in out_file:
            link_status = "Statically Linked"
        elif "dynamically linked" in out_file:
            link_status = "Dynamically Linked"
        
        export_data['file_permissions'] = out_ls.strip()
        export_data['file_stats'] = out_stat.strip()
        export_data['file_info'] = out_file.strip()
        export_data['linking'] = link_status
        export_data['ldd_output'] = out_ldd.strip()
        export_data['elf_header'] = out_h.strip()

    if cfg.get('sections'):
        out_sec, _, _ = run_cmd(f'readelf -S "{path}"')
        export_data['sections'] = out_sec.strip()

    arch_val = opts.get('arch', 'x86-64')
    cmd_base = get_objdump_cmd(arch_val)
    
    disasm_out = None
    if cfg.get('found_strings') or cfg.get('functions_asm'):
        disasm_out, _, _ = run_cmd(f'{cmd_base} -D -w "{path}"')
        
    if cfg.get('found_strings') and disasm_out:
        s_out, _, _ = run_cmd(f'strings -a -t x "{path}"')
        str_map = {int(p.strip().split(maxsplit=1)[0], 16): p.strip().split(maxsplit=1)[1] for p in s_out.splitlines() if len(p.strip().split(maxsplit=1)) == 2}
        rip_rel = re.compile(r'^\s*([0-9a-fA-F]+):.*#\s*([0-9a-fA-F]+)')
        found_strings = []
        for line in disasm_out.splitlines():
            m = rip_rel.search(line)
            if m:
                instr, target = m.group(1), int(m.group(2), 16)
                resolved = str_map.get(target) or str_map.get(target - 0x400000)
                if resolved:
                    found_strings.append({'addr': hex(int(instr, 16)), 'string': resolved})
        export_data['found_strings'] = found_strings

    requested_funcs_asm = cfg.get('functions_asm', [])
    if requested_funcs_asm and disasm_out:
        target_set = set(requested_funcs_asm)
        extracted = {}
        current_func = None
        func_code = []

        func_pattern = re.compile(r'^([0-9a-fA-F]+)\s+<([^>]+)>:')
        for line in disasm_out.splitlines():
            m = func_pattern.match(line)
            if m:
                if current_func:
                    extracted[current_func] = '\n'.join(func_code)
                addr = m.group(1).lstrip('0') or '0'
                if addr in target_set:
                    current_func = f"0x{addr} ({m.group(2)})"
                    func_code = [line]
                else:
                    current_func = None
            elif current_func:
                func_code.append(line)
                
        if current_func:
            extracted[current_func] = '\n'.join(func_code)
        for k, v in extracted.items():
            extracted[k] = resolve_strings(v, path)
            
        export_data['disassembly'] = extracted

    requested_funcs_c = cfg.get('functions_c', [])
    if requested_funcs_c:
        # Pull directly from our blazing fast background cache instead of re-running Ghidra
        file_hash = get_file_hash(path)
        decomp_cache = load_decomp_cache(file_hash)
        
        c_results = {}
        
        # Build an address-to-name map so the JSON keys look beautiful: "0x4011e0 (main)"
        nm_out, _, _ = run_cmd(f'nm -n -S --defined-only "{path}"')
        name_map = {}
        for line in nm_out.splitlines():
            parts = line.split()
            if len(parts) >= 3:
                try:
                    # Find the symbol type (usually 'T' or 't' for text/functions)
                    idx = next((i for i, p in enumerate(parts) if len(p) == 1 and p.upper() == 'T'), -1)
                    if idx > 0 and idx + 1 < len(parts):
                        clean_addr = parts[0].lstrip('0') or '0'
                        name_map[clean_addr] = parts[idx + 1]
                except Exception:
                    pass

        for addr in requested_funcs_c:
            name = name_map.get(addr, "unknown_function")
            key = f"0x{addr} ({name})"
            if addr in decomp_cache:
                c_results[key] = decomp_cache[addr]
            else:
                c_results[key] = f"// [HT-RE] Code not found in cache for {addr}.\n// Please decompile this function in the web UI first, then re-export."
        
        # Dynamically set the JSON key based on the detected language
        lang_key = "decompiled_cpp" if is_cpp else "decompiled_c"
        export_data[lang_key] = c_results

    if cfg.get('hexdump'):
        hex_start = cfg.get('hex_from', '').strip()
        hex_end = cfg.get('hex_to', '').strip()
        xxd_cmd = f'xxd "{path}"'
        if hex_start or hex_end:
            try:
                s_val = int(hex_start, 16) if hex_start else 0
                e_val = int(hex_end, 16) if hex_end else 0
                if e_val and e_val > s_val:
                    length = e_val - s_val
                    xxd_cmd = f'xxd -s {s_val} -l {length} "{path}"'
                elif s_val:
                    xxd_cmd = f'xxd -s {s_val} "{path}"'
            except Exception:
                pass
            
        hex_out, _, _ = run_cmd(xxd_cmd)
        export_data['hexdump'] = hex_out.splitlines()

    if cfg.get('all_strings'):
        raw_strings, _, _ = run_cmd(f'strings "{path}"')
        export_data['all_strings'] = raw_strings.splitlines()
        
    if cfg.get('custom_binpatch'):
        bp_args = cfg.get('binpatch_args', '')
        bp_out, bp_err, _ = run_cmd(f'binpatch "{path}" {bp_args}')
        export_data['custom_binpatch_output'] = (bp_out + "\n" + bp_err).strip()

    return export_data
