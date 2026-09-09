"""Installation and renderer diagnostics without guessing host capabilities."""
import argparse
import importlib.metadata
import json
from pathlib import Path
import sys
from .diagnostics import build_info


def diagnose(roots=(), check_headless=False):
    package = Path(__file__).parent
    missing = [str(package / name) for name in ('_assets/index.html', '_assets/bundle.js', '_mcp_app/viewer.html') if not (package / name).is_file()]
    for folder in ('_assets', '_mcp_app'):
        if not any((package / folder).glob('*.wasm')):
            missing.append(str(package / folder / '*.wasm'))
    resolved = [{'path': str(Path(p).expanduser().resolve()), 'exists': Path(p).expanduser().is_dir()} for p in roots]
    try:
        installed = importlib.metadata.version('3d-visualizer')
    except importlib.metadata.PackageNotFoundError:
        installed = None
    result = {'ok': not missing and all(r['exists'] for r in resolved), **build_info(),
              'installed_distribution_version': installed, 'python': sys.executable,
              'command': str(Path(sys.argv[0]).resolve()), 'module': str(package),
              'roots': resolved, 'missing_assets': missing,
              'host_webgl': None, 'host_note': 'CLI cannot observe a chat host. Inspect a connected scene for renderer capabilities.',
              'headless': {'checked': False}}
    if check_headless and not missing:
        try:
            from .session import show
            with show([[0,0,0], [1,0,0], [0,1,0]], open_browser=False) as scene:
                scene.start_headless()
                reply = scene._bridge.request('inspect', {'detail': 'full'})
                result['headless'] = {'checked': True, 'ok': True, 'rendering': reply.get('rendering'),
                                      'renderer_id': reply['renderer_id'], 'rendered_revision': reply['rendered_revision']}
        except Exception as error:
            result['ok'] = False
            result['headless'] = {'checked': True, 'ok': False, 'error': str(error)}
    return result


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', action='append', default=[])
    parser.add_argument('--check-headless', action='store_true', help='Actually launch Chromium and render a three-point scene')
    args = parser.parse_args(argv)
    result = diagnose(args.root, args.check_headless)
    print(json.dumps(result, indent=2))
    return 0 if result['ok'] else 1
