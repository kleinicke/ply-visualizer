"""Concurrent MCP client used by the browser integration tests, not shipped."""
import asyncio
import json
import os
from pathlib import Path
import sys
from mcp import Client
from ply_visualizer.mcp_server import create_server

async def main():
    root = Path(__file__).resolve().parents[3]
    extra = os.environ.get('PLY_AGENT_TEST_FILE')
    roots = [root] + ([Path(extra).parent] if extra else [])
    async with Client(create_server(roots)) as client:
        if extra:
            initial = await client.call_tool('open_3d_files', {'paths': [extra], 'open_browser': False})
        else:
            initial = await client.call_tool('open_3d_files', {'paths': [str(root / 'engine/test/fixtures/agent-mesh.ply')], 'open_browser': False})
        print(json.dumps({'initial': initial.model_dump(mode='json', by_alias=True, exclude_none=True)}), flush=True)
        async def handle(request):
            try:
                result = await client.call_tool(request['name'], request.get('arguments', {}))
                print(json.dumps({'id': request['id'], 'result': result.model_dump(mode='json', by_alias=True, exclude_none=True)}), flush=True)
            except Exception as error:
                print(json.dumps({'id': request['id'], 'error': str(error)}), flush=True)
        tasks = set()
        while line := await asyncio.to_thread(sys.stdin.readline):
            task = asyncio.create_task(handle(json.loads(line)))
            tasks.add(task)
            task.add_done_callback(tasks.discard)
        if tasks: await asyncio.gather(*tasks)
asyncio.run(main())
