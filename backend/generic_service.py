from backend.utils import run_cmd

def handle_generic_cmd(cmd_type, path):
    cmd = ""
    if cmd_type == 'readelf-h': 
        out_ls, _, _ = run_cmd(f'ls -lh "{path}"')
        out_stat, _, _ = run_cmd(f'stat "{path}"')
        out_h, _, _ = run_cmd(f'readelf -h "{path}"')
        out_d, _, _ = run_cmd(f'readelf -d "{path}"')
        out_c, _, _ = run_cmd(f'readelf -p .comment "{path}"')
        out_file, _, _ = run_cmd(f'file "{path}"')
        out_ldd, _, _ = run_cmd(f'ldd "{path}"')
        
        arch = 'x86 / x86-64'
        if 'AArch64' in out_h:
            arch = 'AArch64'
        elif 'ARM' in out_h:
            arch = 'ARM'
        
        lang = "C++" if "libstdc++" in out_d else "C, or potentially written directly in Assembly (not compiled with a standard compiler)"
        comp = out_c if "String dump" in out_c else "No .comment section found."
        
        link_status = "Unknown"
        if "statically linked" in out_file:
            link_status = "Statically Linked"
        elif "dynamically linked" in out_file:
            link_status = "Dynamically Linked"

        combined = (
            f"=== HT-RE ANALYSIS ===\nArchitecture: {arch}\nCompiler Language: {lang}\nLinking: {link_status}\n\n"
            f"=== FILE PERMISSIONS (LS -L) ===\n{out_ls.strip()}\n\n"
            f"=== FILE METADATA (STAT) ===\n{out_stat.strip()}\n\n"
            f"=== FILE INFO ===\n{out_file.strip()}\n\n"
            f"=== SHARED LIBRARIES (LDD) ===\n{out_ldd.strip() or 'Not dynamically linked or cross-architecture.'}\n\n"
            f"=== .COMMENT SECTION ===\n{comp.strip()}\n\n"
            f"=== ELF HEADER ===\n{out_h}"
        )
        return {'output': combined}
        
    elif cmd_type == 'readelf-S':
        cmd = f'readelf -S "{path}"'
    elif cmd_type == 'strings':
        cmd = f'strings "{path}"'
    elif cmd_type == 'objdump-R':
        cmd = f'objdump -R "{path}"'
    elif cmd_type == 'hexdump':
        cmd = f'xxd "{path}"'
    
    if cmd:
        out, _, _ = run_cmd(cmd)
        return {'output': out}
    return {'error': 'Invalid command'}
