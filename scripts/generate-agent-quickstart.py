"""Generate versioned installation examples from the package metadata."""
import argparse
import json
from pathlib import Path
import tomllib
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
VERSION = tomllib.loads((ROOT/'packages/python/pyproject.toml').read_text())['project']['version']
START = '<!-- agent-quickstart:start -->'
END = '<!-- agent-quickstart:end -->'

def block():
    config = {'mcpServers': {'3d-visualizer': {'command': 'uvx', 'args': ['--from', f'3d-visualizer[mcp,headless]=={VERSION}', '3d-visualizer-mcp', '--root', '/absolute/path/to/data']}}}
    vscode = {'name': '3d-visualizer', 'type': 'stdio', **config['mcpServers']['3d-visualizer']}
    vscode['args'] = [*vscode['args'][:-1], '${workspaceFolder}']
    return '\n'.join([START, '',
        '### Agent installation', '',
        f'These examples target **{VERSION}**. Development versions must be installed',
        'from this checkout until published; do not assume an unreleased version exists on PyPI.', '',
        'For agents, use `uv tool install` or `uvx`; `uv add` is for using the library',
        'inside a Python project. Headless mode also needs Chromium installed once.', '',
        '```sh', f'uv tool install "3d-visualizer[mcp,headless]=={VERSION}"',
        f'uvx --from "3d-visualizer[headless]=={VERSION}" playwright install chromium',
        '3d-visualizer doctor --check-headless', '```', '',
        'Client configuration (replace the data directory):', '', '```json',
        json.dumps(config, indent=2), '```', '',
        '[Install in VS Code](vscode:mcp/install?'+quote(json.dumps(vscode,separators=(',',':')),safe='')+')', '', 'The VS Code link uses the current workspace as the allowed data root.', '',
        '```sh', f'claude mcp add --transport stdio 3d-visualizer -- uvx --from "3d-visualizer[mcp,headless]=={VERSION}" 3d-visualizer-mcp --root /absolute/path/to/data', '```', '',
        'The default `--tools core` exposes eight everyday tools. Use `--tools full`',
        'for depth conversion, selections, animation, alignment and export.',
        '`--renderer auto` uses an advertised MCP Apps host, otherwise offscreen',
        'Chromium. Use `--renderer inline` to require a widget or explicit browser;',
        'use `--renderer headless` for unattended work.', END])

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--check',action='store_true')
args=parser.parse_args()
for name in ['packages/python/README.md','packages/python/MCP.md']:
    path=ROOT/name
    text=path.read_text()
    if START not in text:
        raise SystemExit(f'Missing quickstart marker: {name}')
    start=text.index(START);end=text.index(END)+len(END)
    updated=text[:start]+block()+text[end:]
    if args.check:
        if updated!=text:raise SystemExit(f'Run python3 scripts/generate-agent-quickstart.py ({name} is stale)')
    else:path.write_text(updated)
