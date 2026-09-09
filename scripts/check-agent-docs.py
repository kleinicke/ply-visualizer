"""Check docs and exercise their generated install/config commands against a wheel.

Only the explicitly generated quickstart is executable. Arbitrary documentation
examples (publishing, file exports, training loops) are never executed as shell.
"""
import argparse
import asyncio
import json
import os
from pathlib import Path
import re
import shlex
import subprocess
import sys
import tempfile
import tomllib

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--wheel', type=Path)
args = parser.parse_args()
subprocess.run([sys.executable, str(ROOT/'scripts/generate-agent-quickstart.py'), '--check'], check=True)
project = tomllib.loads((ROOT/'packages/python/pyproject.toml').read_text())['project']
for name in ['README.md', 'MCP.md']:
    text = (ROOT/'packages/python'/name).read_text()
    for language, block in re.findall(r'```(\w*)\n(.*?)```', text, re.S):
        if re.search(r'\bply-viewer(?:-mcp|-api)?\b|\b(?:from|import) ply_visualizer\b', block):
            raise SystemExit(f'Legacy command/import in {name} code block')
        for version in re.findall(r'3d-visualizer(?:\[[^\]]+\])?==([\w.]+)', block):
            if version != project['version']: raise SystemExit(f'Stale package pin in {name}: {version}')
    if name == 'README.md':
        for target in re.findall(r'\]\(([^)]+)\)', text):
            if ':' not in target and not target.startswith('#'): raise SystemExit(f'PyPI-relative link: {target}')
if not args.wheel:
    print('Agent docs: generated versions, commands and PyPI links checked')
    raise SystemExit(0)

wheel = args.wheel.resolve()
text = (ROOT/'packages/python/MCP.md').read_text().split('<!-- agent-quickstart:start -->')[1].split('<!-- agent-quickstart:end -->')[0]
config = next(json.loads(b)['mcpServers']['3d-visualizer'] for b in re.findall(r'```json\n(.*?)```', text, re.S))
# Rewrite only the installation source: preserve commands, extras and client args.
def local_source(value):
    return re.sub(r'3d-visualizer(\[[^\]]+\])?=='+re.escape(project['version']), lambda m: str(wheel)+(m[1] or ''), value)

with tempfile.TemporaryDirectory(prefix='viz3d-docs-') as tmp:
    folder=Path(tmp)
    env={**os.environ, 'UV_TOOL_DIR':str(folder/'tools'), 'UV_TOOL_BIN_DIR':str(folder/'bin')}
    env.pop('PYTHONPATH', None)
    env['PATH']=str(folder/'bin')+os.pathsep+os.environ['PATH']
    commands=re.findall(r'```sh\n(.*?)```', text, re.S)[0].strip().splitlines()
    for command in commands:
        argv=[local_source(v) for v in shlex.split(command)]
        subprocess.run(argv,env=env,check=True,timeout=180,cwd=folder)
    from mcp import Client, StdioServerParameters
    async def check_client():
        argv=[local_source(v).replace('/absolute/path/to/data',tmp) for v in config['args']]
        async with Client(StdioServerParameters(command=config['command'],args=argv,env=env)) as client:
            tools=(await client.list_tools()).tools
            assert len(tools)==10, len(tools)
            opened=await client.call_tool('visualize_points',{'points':[[0,0,0],[1,0,0],[0,1,0]]})
            assert not opened.is_error, opened
            scene=opened.structured_content['scene_id']
            image=await client.call_tool('capture_3d_view',{'scene_id':scene})
            assert not image.is_error and any(c.type=='image' for c in image.content), image
            await client.call_tool('close_3d_scene',{'scene_id':scene})
    asyncio.run(check_client())
print('Generated install commands and client configuration passed against the built wheel')
