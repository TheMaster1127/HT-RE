import os
import re
import tempfile
from backend.utils import validate, run_cmd, get_objdump_cmd, find_ghidra_headless
from backend.disasm_service import resolve_strings

def handle_export(path, opts, cfg):
    if not validate(path):
        return {'error': 'Invalid binary'}

    export_data = {
        'binary_path': path,
        'options_used': opts
    }

    if cfg.get('header'):
        out_ls, _, _ = run_cmd(f'ls -lh "{path}"')
        out_stat, _, _ = run_cmd(f'stat "{path}"')
        out_file, _, _ = run_cmd(f'file "{path}"')
        out_ldd, _, _ = run_cmd(f'ldd "{path}"')
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
                    found_strings.append({'addr': instr, 'string': resolved})
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
                    current_func = f"{addr} ({m.group(2)})"
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
        ghidra_bin = find_ghidra_headless()
        script_path = os.path.abspath("DecompileAll.java")
        if ghidra_bin and os.path.exists(script_path):
            with tempfile.TemporaryDirectory() as tmpdir:
                script_dir = os.path.dirname(script_path)
                cmd = f'"{ghidra_bin}" "{tmpdir}" temp_proj -import "{path}" -scriptPath "{script_dir}" -postScript DecompileAll.java -deleteProject'
                out, _, _ = run_cmd(cmd)

                c_results = {}
                pattern = re.compile(r'=== FUNC_START:([0-9a-fA-F]+):([^\s=]+) ===\s*(.*?)\s*=== FUNC_END ===', re.DOTALL)
                for match in pattern.finditer(out):
                    clean_addr = match.group(1).lstrip('0') or '0'
                    if clean_addr in set(requested_funcs_c):
                        code_raw = match.group(3).strip()
                        clean_lines = [re.sub(r'^.*?INFO\s+DecompileAll\.java>\s*', '', l) for l in code_raw.splitlines() if '(GhidraScript)' not in l and not l.strip().startswith(('INFO ', 'WARN '))]
                        c_results[f"{clean_addr} ({match.group(2)})"] = '\n'.join(clean_lines).strip()

                export_data['decompiled_c'] = c_results

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
