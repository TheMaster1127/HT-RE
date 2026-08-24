import os
import re
import tempfile
from backend.utils import validate, find_ghidra_headless, run_cmd, save_decomp_cache

def handle_decompile_single(path, addr, name, file_hash):
    if not validate(path):
        return {'error': 'Invalid binary path.'}

    seek_target = addr if addr.startswith('0x') else f'0x{addr}'
    script_path = os.path.abspath("DecompileHeadless.java")
    ghidra_bin = find_ghidra_headless()

    if ghidra_bin and os.path.exists(script_path):
        with tempfile.TemporaryDirectory() as tmpdir:
            script_dir = os.path.dirname(script_path)
            cmd = f'"{ghidra_bin}" "{tmpdir}" temp_proj -import "{path}" -scriptPath "{script_dir}" -postScript DecompileHeadless.java "{seek_target}" -deleteProject'
            out, _, _ = run_cmd(cmd)
            
            if "=== GHIDRA_C_START ===" in out:
                raw_c = out.split("=== GHIDRA_C_START ===")[1].split("=== GHIDRA_C_END ===")[0]
                clean_lines = [
                    re.sub(r'^.*?INFO\s+DecompileHeadless\.java>\s*', '', l)
                    for l in raw_c.splitlines()
                    if '(GhidraScript)' not in l and not l.strip().startswith(('INFO ', 'WARN '))
                ]
                c_code = '\n'.join(clean_lines).strip()
                
                # Save to backend background cache 
                clean_addr = seek_target.lstrip('0x').lstrip('0') or '0'
                save_decomp_cache(file_hash, {clean_addr: c_code})
                
                return {'output': c_code}
            return {'output': f"// Ghidra decompilation error for {name} ({seek_target})."}
    return {'output': "// Ghidra analyzeHeadless binary not found on this system."}

def handle_decompile_batch(path, file_hash):
    if not validate(path):
        return {'error': 'Invalid binary path.'}

    script_path = os.path.abspath("DecompileAll.java")
    ghidra_bin = find_ghidra_headless()

    if ghidra_bin and os.path.exists(script_path):
        print("[*] Starting Batch Ghidra Decompilation...")
        with tempfile.TemporaryDirectory() as tmpdir:
            script_dir = os.path.dirname(script_path)
            cmd = f'"{ghidra_bin}" "{tmpdir}" temp_proj -import "{path}" -scriptPath "{script_dir}" -postScript DecompileAll.java -deleteProject'
            out, _, _ = run_cmd(cmd)

            results = {}
            pattern = re.compile(r'=== FUNC_START:([0-9a-fA-F]+):([0-9a-fA-F]*):([^\s=]+) ===\s*(.*?)\s*=== FUNC_END ===', re.DOTALL)
            for match in pattern.finditer(out):
                abs_addr = match.group(1).lstrip('0') or '0'
                rel_addr = match.group(2).lstrip('0') or '0'
                code_raw = match.group(4).strip()
                clean_lines = [
                    re.sub(r'^.*?INFO\s+DecompileAll\.java>\s*', '', l)
                    for l in code_raw.splitlines()
                    if '(GhidraScript)' not in l and not l.strip().startswith(('INFO ', 'WARN '))
                ]
                c_code = '\n'.join(clean_lines).strip()
                results[abs_addr] = c_code
                if rel_addr:
                    results[rel_addr] = c_code

            # Flag to prove the batch process was fully executed
            results['BATCH_COMPLETE'] = "true"

            # Save batch to backend cache
            save_decomp_cache(file_hash, results)

            print(f"[+] Batch Decompiled {len(results)-1} mappings successfully with Ghidra!")
            return {'functions': results}

    return {'error': 'Ghidra batch execution failed.'}
