"""Concurrent MCP client used by the browser integration tests, not shipped."""
import asyncio
import json
import os
from pathlib import Path
import sys
from contextlib import contextmanager
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import threading
from urllib.parse import quote
from mcp import Client
from ply_visualizer.mcp_server import create_server

@contextmanager
def remote_fixture(path):
    if not os.environ.get('PLY_AGENT_TEST_REMOTE'):
        yield None
        return
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(SimpleHTTPRequestHandler, directory=str(path.parent)))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f'http://127.0.0.1:{server.server_port}/{quote(path.name)}'
    finally:
        server.shutdown(); server.server_close(); thread.join()

async def main():
    root = Path(__file__).resolve().parents[3]
    extra = os.environ.get('PLY_AGENT_TEST_FILE')
    roots = [root] + ([Path(extra).parent] if extra else [])
    path = Path(extra) if extra else root / 'engine/test/fixtures/agent-mesh.ply'
    with remote_fixture(path) as url:
        async with Client(create_server(roots)) as client:
            if url:
                initial = await client.call_tool('open_3d_url', {'url': url})
            else:
                initial = await client.call_tool('open_3d_files', {'paths': [str(path)], 'open_browser': False})
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
