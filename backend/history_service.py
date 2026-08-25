import os
import json
from backend.config import HISTORY_FILE
from backend.utils import validate, run_cmd, get_file_hash, load_decomp_cache

UPLOAD_DIR = ".htre_uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

def get_history():
    if os.path.exists(HISTORY_FILE):
        try:
            with open(HISTORY_FILE, 'r') as f:
                return json.load(f)
        except Exception:
            pass
    return []

def save_history(hist):
    with open(HISTORY_FILE, 'w') as f:
        json.dump(hist, f)

def handle_load_binary(path):
    if not validate(path):
        return {'valid': False, 'message': 'File not found'}
    
    hist = get_history()
    if path in hist:
        hist.remove(path)
    hist.insert(0, path)
    hist = hist[:10]
    save_history(hist)

    out, _, _ = run_cmd(f'readelf -h "{path}"')
    arch = 'x86-64'
    if 'AArch64' in out:
        arch = 'aarch64'
    elif 'ARM' in out:
        arch = 'arm'

    file_hash = get_file_hash(path)
    decomp_cache = load_decomp_cache(file_hash)

    return {'valid': True, 'arch': arch, 'history': hist, 'file_hash': file_hash, 'decomp_cache': decomp_cache}

def handle_upload_binary(file_obj):
    if not file_obj or not file_obj.filename:
        return {'valid': False, 'message': 'No file provided'}
    filename = os.path.basename(file_obj.filename)
    dest_path = os.path.abspath(os.path.join(UPLOAD_DIR, filename))
    file_obj.save(dest_path)
    try:
        os.chmod(dest_path, 0o755)
    except Exception:
        pass
    
    result = handle_load_binary(dest_path)
    result['path'] = dest_path
    return result

def handle_delete_history(path):
    hist = get_history()
    if path in hist:
        hist.remove(path)
        save_history(hist)
    return hist
