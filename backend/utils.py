import subprocess
import os
import shutil
import hashlib
import json

CACHE_DIR = ".htre_cache"
if not os.path.exists(CACHE_DIR):
    os.makedirs(CACHE_DIR)

def get_file_hash(path):
    if not os.path.exists(path): return ""
    hasher = hashlib.sha256()
    try:
        with open(path, 'rb') as f:
            while chunk := f.read(65536):
                hasher.update(chunk)
        return hasher.hexdigest()
    except Exception:
        return ""

def load_decomp_cache(file_hash):
    if not file_hash: return {}
    p = os.path.join(CACHE_DIR, f"{file_hash}.json")
    if os.path.exists(p):
        try:
            with open(p, 'r') as f: return json.load(f)
        except Exception: pass
    return {}

def save_decomp_cache(file_hash, data_dict):
    if not file_hash: return
    p = os.path.join(CACHE_DIR, f"{file_hash}.json")
    current = load_decomp_cache(file_hash)
    current.update(data_dict)
    try:
        with open(p, 'w') as f: json.dump(current, f)
    except Exception: pass

def run_cmd(cmd):
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, errors='ignore')
        return result.stdout, result.stderr, result.returncode
    except Exception as e:
        return "", str(e), 1

def validate(path):
    return bool(path and os.path.exists(path) and os.path.isfile(path))

def get_objdump_cmd(arch):
    if arch == 'aarch64':
        if os.system('which aarch64-linux-gnu-objdump > /dev/null 2>&1') == 0:
            return 'aarch64-linux-gnu-objdump'
    elif arch == 'arm':
        if os.system('which arm-linux-gnueabihf-objdump > /dev/null 2>&1') == 0:
            return 'arm-linux-gnueabihf-objdump'
    return 'objdump'

def find_ghidra_headless():
    which_path = shutil.which("analyzeHeadless")
    if which_path:
        return which_path

    gh_home = os.environ.get("GHIDRA_HOME") or os.environ.get("GHIDRA_DIR")
    if gh_home and os.path.exists(os.path.join(gh_home, "support/analyzeHeadless")):
        return os.path.join(gh_home, "support/analyzeHeadless")

    home = os.path.expanduser("~")
    candidates = [
        "/usr/lib/ghidra/support/analyzeHeadless",
        "/opt/ghidra/support/analyzeHeadless",
        os.path.join(home, ".local/share/ghidra/support/analyzeHeadless")
    ]
    for root in [home, os.path.join(home, "Downloads"), "/opt"]:
        if os.path.exists(root):
            for d in os.listdir(root):
                if "ghidra" in d.lower():
                    candidates.append(os.path.join(root, d, "support/analyzeHeadless"))

    for c in candidates:
        if os.path.exists(c):
            return c
    return None
