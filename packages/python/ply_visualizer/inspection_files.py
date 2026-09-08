"""Bounded local inspection artifacts. File contents never enter agent-facing replies."""
import base64
import json
from pathlib import Path
import shutil
import tempfile


def artifact_path(manager, path, suffix, existing=False):
    file = Path(path).expanduser()
    file = file if file.is_absolute() else manager.roots[0] / file
    parent = file.parent.resolve(strict=True)
    if not any(parent.is_relative_to(root) for root in manager.roots):
        raise ValueError("Artifact is outside configured --root directories")
    file = parent / file.name
    if file.suffix.lower() != suffix or file.is_symlink():
        raise ValueError(f"Expected a regular {suffix} artifact path, not a symlink")
    if existing:
        if not file.is_file(): raise ValueError("Artifact file does not exist")
    elif file.exists():
        raise ValueError("Artifact already exists; choose a new path")
    return file


def export_subset(manager, scene_id, path, name=None, models=False):
    file = artifact_path(manager, path, '.glb' if models else '.ply')
    bridge = manager.get(scene_id)._bridge
    meta = bridge.request('export_subset', {'action': 'start', 'name': name, 'scope': 'models' if models else 'selection'})
    export_id = meta['export_id']
    try:
        size = meta['size']
        if not 0 < size <= 256 * 1024 * 1024: raise ValueError("Export exceeds 256 MiB")
        with tempfile.TemporaryFile() as staged:
            offset = 0
            while offset < size:
                chunk = bridge.request('export_subset', {'action': 'chunk', 'export_id': export_id, 'offset': offset})
                data = base64.b64decode(chunk['data'], validate=True)
                if chunk['offset'] != offset or chunk['size'] != size or not data or len(data) > min(512 * 1024, size-offset):
                    raise ValueError("Invalid export chunk")
                staged.write(data)
                offset += len(data)
            staged.seek(0)
            with file.open('xb') as output:
                try: shutil.copyfileobj(staged, output)
                except BaseException:
                    file.unlink(missing_ok=True)
                    raise
        if models: return {'path': str(file), 'bytes': size, 'models': meta['models'], 'animations': meta['animations'], 'format': 'glb'}
        return {'path': str(file), 'bytes': size, 'points': meta['points'], 'attributes': meta['attributes'], 'original_rows_available': meta['original_rows_available'], 'coordinates': meta['coordinates']}
    finally:
        try: bridge.request('export_subset', {'action': 'release', 'export_id': export_id})
        except (RuntimeError, TimeoutError): pass


def scene_state_file(manager, scene_id, action, name, path, restore=False):
    file = artifact_path(manager, path, '.json', existing=action=='import')
    bridge = manager.get(scene_id)._bridge
    if action == 'import':
        if file.stat().st_size > 4*1024*1024: raise ValueError("Scene state exceeds 4 MiB")
        with file.open() as source: state = json.load(source)
        result = bridge.request('scene_states', {'action': 'import', 'name': name, 'state': state})
        if restore: result = bridge.request('scene_states', {'action': 'restore', 'name': name})
        return {**result, 'path':str(file), 'restored':restore}
    result = bridge.request('scene_states', {'action': 'export', 'name': name})
    encoded = json.dumps(result['state'], allow_nan=False, separators=(',', ':')).encode()
    if len(encoded)>4*1024*1024: raise ValueError("Scene state exceeds 4 MiB")
    with file.open('xb') as output: output.write(encoded)
    return {'path':str(file), 'bytes':len(encoded), 'name':name}
