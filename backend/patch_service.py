import subprocess
from backend.utils import validate

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
