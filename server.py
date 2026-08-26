#!/usr/bin/env python3
import os
import tempfile
from flask import Flask, request, jsonify
from backend.config import DEFAULT_PORT, STATIC_FOLDER
from backend.history_service import get_history, handle_load_binary, handle_delete_history
from backend.disasm_service import handle_nm, handle_resolve_strings, handle_disasm, handle_function_code
from backend.ghidra_service import handle_decompile_single, handle_decompile_batch
from backend.generic_service import handle_generic_cmd
from backend.export_service import handle_export
from backend.patch_service import handle_binpatch, handle_assemble, handle_disassemble_raw, handle_compile, get_patch_history, restore_patch, track_action
from backend.debug_service import handle_debug_start, handle_debug_cmd, handle_debug_stop, handle_debug_poll, handle_trace_run, handle_binwalk

app = Flask(__name__, static_url_path='', static_folder=STATIC_FOLDER)

# Directory for file picker uploads
UPLOAD_DIR = os.path.join(tempfile.gettempdir(), "htre_uploads")
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/api/upload', methods=['POST'])
def api_upload():
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    file = request.files['file']
    if not file.filename:
        return jsonify({'error': 'Empty filename'}), 400
    target_path = os.path.join(UPLOAD_DIR, file.filename)
    file.save(target_path)
    os.chmod(target_path, 0o755)
    return jsonify({'path': target_path})

@app.route('/api/history', methods=['GET'])
def api_history():
    return jsonify({'history': get_history()})

@app.route('/api/history_delete', methods=['POST'])
def api_history_delete():
    return jsonify({'history': handle_delete_history(request.json.get('path', ''))})

@app.route('/api/load', methods=['POST'])
def api_load():
    return jsonify(handle_load_binary(request.json.get('binary_path', '')))

@app.route('/api/nm', methods=['POST'])
def api_nm():
    return jsonify(handle_nm(request.json.get('binary_path', '')))

@app.route('/api/resolve_strings', methods=['POST'])
def api_resolve_strings():
    return jsonify(handle_resolve_strings(request.json.get('binary_path', ''), request.json.get('disassembly', '')))

@app.route('/api/objdump-d', methods=['POST'])
def api_disasm():
    return jsonify(handle_disasm(request.json.get('binary_path', ''), request.json.get('options', {})))

@app.route('/api/function_code', methods=['POST'])
def api_function_code():
    return jsonify(handle_function_code(request.json.get('binary_path', ''), request.json.get('start_addr', ''), request.json.get('options', {})))

@app.route('/api/decompile', methods=['POST'])
def api_decompile():
    return jsonify(handle_decompile_single(request.json.get('binary_path', ''), request.json.get('addr', ''), request.json.get('name', ''), request.json.get('file_hash', '')))

@app.route('/api/decompile_all', methods=['POST'])
def api_decompile_all():
    return jsonify(handle_decompile_batch(request.json.get('binary_path', ''), request.json.get('file_hash', '')))

@app.route('/api/generic', methods=['POST'])
def api_generic():
    return jsonify(handle_generic_cmd(request.json.get('cmd'), request.json.get('binary_path', '')))

@app.route('/api/export', methods=['POST'])
def api_export():
    return jsonify(handle_export(request.json.get('binary_path', ''), request.json.get('options', {}), request.json.get('config', {})))

@app.route('/api/binpatch', methods=['POST'])
def api_binpatch():
    return jsonify(handle_binpatch(request.json))

@app.route('/api/assemble', methods=['POST'])
def api_assemble():
    return jsonify(handle_assemble(request.json))

@app.route('/api/disassemble_raw', methods=['POST'])
def api_disassemble_raw():
    return jsonify(handle_disassemble_raw(request.json))

@app.route('/api/compile', methods=['POST'])
def api_compile():
    return jsonify(handle_compile(request.json))

@app.route('/api/patch_history', methods=['POST'])
def api_patch_history():
    return jsonify(get_patch_history(request.json))

@app.route('/api/restore_patch', methods=['POST'])
def api_restore_patch():
    return jsonify(restore_patch(request.json))

@app.route('/api/track', methods=['POST'])
def api_track():
    return jsonify(track_action(request.json))

# --- DEBUG, TRACE & BINWALK ROUTES ---
@app.route('/api/debug/start', methods=['POST'])
def api_debug_start():
    return jsonify(handle_debug_start(request.json))

@app.route('/api/debug/cmd', methods=['POST'])
def api_debug_cmd():
    return jsonify(handle_debug_cmd(request.json))

@app.route('/api/debug/stop', methods=['POST'])
def api_debug_stop():
    return jsonify(handle_debug_stop(request.json))

@app.route('/api/debug/poll', methods=['POST'])
def api_debug_poll():
    return jsonify(handle_debug_poll(request.json))

@app.route('/api/debug/trace', methods=['POST'])
def api_debug_trace():
    return jsonify(handle_trace_run(request.json))

@app.route('/api/debug/binwalk', methods=['POST'])
def api_debug_binwalk():
    return jsonify(handle_binwalk(request.json))

if __name__ == '__main__':
    print(f"🚀 Server running on http://localhost:{DEFAULT_PORT}")
    app.run(port=DEFAULT_PORT, debug=True)
