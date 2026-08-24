#!/usr/bin/env python3
from flask import Flask, request, jsonify
from backend.config import DEFAULT_PORT, STATIC_FOLDER
from backend.history_service import get_history, handle_load_binary, handle_delete_history
from backend.disasm_service import handle_nm, handle_resolve_strings, handle_disasm, handle_function_code
from backend.ghidra_service import handle_decompile_single, handle_decompile_batch
from backend.generic_service import handle_generic_cmd
from backend.export_service import handle_export
from backend.patch_service import handle_binpatch

app = Flask(__name__, static_url_path='', static_folder=STATIC_FOLDER)

@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

@app.route('/')
def index():
    return app.send_static_file('index.html')

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

if __name__ == '__main__':
    print(f"🚀 Server running on http://localhost:{DEFAULT_PORT}")
    app.run(port=DEFAULT_PORT, debug=True)
