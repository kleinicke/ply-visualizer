"""Authenticated HTTP MCP and REST adapters over the same validated tools."""
import argparse
import asyncio
from contextlib import asynccontextmanager
import hmac
import os
from pathlib import Path
import secrets

from starlette.applications import Starlette
from starlette.responses import JSONResponse, FileResponse
from starlette.routing import Route, Mount
from .mcp_server import create_server
from .session import FORMATS, MODEL_ASSETS
from mcp.server.transport_security import TransportSecuritySettings
from .tasks import TaskStore, invoke_complete, wire

MAX_BODY = 2 * 1024 * 1024
MAX_UPLOAD = 256 * 1024 * 1024


def create_http_app(roots, *, token, state_dir, allowed_hosts=None, tools="full", renderer="inline"):
    if len(token) < 32: raise ValueError('HTTP bearer token must contain at least 32 characters')
    state = Path(state_dir).resolve()
    state.mkdir(parents=True, exist_ok=True, mode=0o700)
    uploads = state / 'uploads'; uploads.mkdir(exist_ok=True, mode=0o700)
    store = TaskStore(state / 'tasks.sqlite')
    server = create_server([*roots, uploads], task_store=store, transport='streamable-http', tools=tools, renderer=renderer)
    mcp_app = server.streamable_http_app(stateless_http=True, json_response=True, transport_security=TransportSecuritySettings(allowed_hosts=allowed_hosts or ['127.0.0.1', '127.0.0.1:*', 'localhost', 'localhost:*', '[::1]', '[::1]:*']))

    async def tools(request):
        return JSONResponse({'tools': [wire(t) for t in await server.list_tools()]})

    async def execute(request):
        name = request.path_params['name']
        known = {t.name for t in await server.list_tools()}
        if name not in known: return JSONResponse({'error': {'code': 'not_found', 'message': 'Unknown operation'}}, status_code=404)
        try:
            args = await request.json()
            if not isinstance(args, dict): raise ValueError('Expected an arguments object')
            if request.query_params.get('async') == 'true':
                result = store.submit(lambda: invoke_complete(server, name, args))
                return JSONResponse(result, status_code=202, headers={'Location': '/api/v1/tasks/'+result['taskId']})
            result = wire(await server.call_tool(name, args))
            return JSONResponse(result, status_code=422 if result.get('isError') else 200)
        except Exception as error:
            return JSONResponse({'error': {'code': 'invalid_request', 'message': str(error)}}, status_code=400)

    async def task(request):
        try:
            if request.method == 'DELETE': return JSONResponse(store.cancel(request.path_params['key']))
            return JSONResponse(store.get(request.path_params['key']))
        except Exception:
            return JSONResponse({'error': {'code': 'not_found', 'message': 'Unknown or expired task'}}, status_code=404)

    upload_lock = asyncio.Lock()

    async def upload(request):
        async with upload_lock:
            name = request.path_params['name']
            if Path(name).name != name or name.startswith('.') or len(name) > 200:
                return JSONResponse({'error': 'Invalid filename'}, status_code=400)
            used = sum(p.stat().st_size for p in uploads.glob('*/*') if p.is_file())
            if len(list(uploads.iterdir())) >= 1024:
                return JSONResponse({'error': 'Upload file limit reached; delete unused uploads'}, status_code=413)
            # Persist complete files only; untrusted names never select an existing path.
            folder = uploads / secrets.token_hex(12); folder.mkdir(mode=0o700)
            target = folder / name
            try:
                count = 0
                with target.open('xb') as output:
                    async for chunk in request.stream():
                        count += len(chunk)
                        if count > MAX_UPLOAD or used + count > 1024 * 1024 * 1024: raise ValueError('Upload exceeds 256 MiB')
                        output.write(chunk)
                return JSONResponse({'path': str(target), 'size': count}, status_code=201)
            except Exception:
                target.unlink(missing_ok=True); folder.rmdir()
                return JSONResponse({'error': 'Upload failed or exceeds 256 MiB'}, status_code=413)

    async def download(request):
        try:
            path = Path(request.query_params['path']).resolve(strict=True)
            allowed = [Path(root).resolve() for root in [*roots, uploads]]
            if path.suffix.lower() not in FORMATS | MODEL_ASSETS | {'.json'} or not path.is_file() or not any(path.is_relative_to(root) for root in allowed): raise ValueError()
            # Never expose server task storage/token even if a broad root contains it.
            if path.is_relative_to(state) and not path.is_relative_to(uploads): raise ValueError()
            if request.method == 'DELETE':
                if not path.is_relative_to(uploads): raise ValueError()
                path.unlink()
                path.parent.rmdir()
                return JSONResponse({'deleted': True})
            return FileResponse(path, filename=path.name)
        except (KeyError, ValueError, OSError):
            return JSONResponse({'error': 'File not found within allowed roots'}, status_code=404)

    async def openapi(request):
        entries, schemas = {}, {}
        def rewrite(value, prefix):
            if isinstance(value, list): return [rewrite(v, prefix) for v in value]
            if not isinstance(value, dict): return value
            return {key: ('#/components/schemas/'+prefix+item.removeprefix('#/$defs/') if key == '$ref' and item.startswith('#/$defs/') else rewrite(item, prefix)) for key, item in value.items()}
        for tool in await server.list_tools():
            info = wire(tool)
            schema = rewrite(info['inputSchema'], tool.name+'_')
            schemas.update({tool.name+'_'+key: value for key, value in schema.pop('$defs', {}).items()})
            entries['/api/v1/tools/'+tool.name] = {'post': {'operationId': tool.name, 'description': tool.description,
                'parameters': [{'name': 'async', 'in': 'query', 'schema': {'type': 'boolean', 'default': False}}],
                'requestBody': {'required': True, 'content': {'application/json': {'schema': schema}}},
                'responses': {'200': {'description': 'MCP result envelope (structuredContent plus optional image content)'}, '202': {'description': 'Asynchronous task handle'}, '422': {'description': 'Tool error'}}}}
        return JSONResponse({'openapi': '3.1.0', 'info': {'title': '3D Visualizer', 'version': '1'}, 'paths': entries,
                             'security': [{'bearerAuth': []}], 'components': {'schemas': schemas, 'securitySchemes': {'bearerAuth': {'type': 'http', 'scheme': 'bearer'}}}})

    @asynccontextmanager
    async def lifespan(app):
        async with mcp_app.router.lifespan_context(mcp_app):
            yield

    app = Starlette(routes=[Route('/api/v1/tools', tools), Route('/api/v1/tools/{name}', execute, methods=['POST']),
        Route('/api/v1/tasks/{key}', task, methods=['GET', 'DELETE']), Route('/api/v1/uploads/{name}', upload, methods=['POST']),
        Route('/api/v1/files', download, methods=['GET', 'DELETE']), Route('/api/v1/openapi.json', openapi), Mount('/', app=mcp_app)], lifespan=lifespan)

    async def authenticated(scope, receive, send):
        if scope['type'] != 'http': return await app(scope, receive, send)
        headers = dict(scope['headers'])
        expected = ('Bearer '+token).encode()
        if not hmac.compare_digest(headers.get(b'authorization', b''), expected):
            return await JSONResponse({'error': 'Unauthorized'}, status_code=401, headers={'WWW-Authenticate': 'Bearer realm="ply-visualizer"'})(scope, receive, send)
        if b'origin' in headers:
            return await JSONResponse({'error': 'Browser-origin API access is not enabled'}, status_code=403)(scope, receive, send)
        if not scope['path'].startswith('/api/v1/uploads/'):
            body = bytearray()
            while True:
                event = await receive()
                if event['type'] == 'http.disconnect': return
                body.extend(event.get('body', b''))
                if len(body) > MAX_BODY:
                    return await JSONResponse({'error': 'Request exceeds 2 MiB'}, status_code=413)(scope, receive, send)
                if not event.get('more_body'): break
            delivered = False
            async def bounded_receive():
                nonlocal delivered
                if not delivered:
                    delivered = True
                    return {'type': 'http.request', 'body': bytes(body), 'more_body': False}
                return await receive()
            return await app(scope, bounded_receive, send)
        return await app(scope, receive, send)
    return authenticated


def main():
    parser = argparse.ArgumentParser(description='Single-owner REST and HTTP MCP server; use TLS reverse proxy for remote access.')
    parser.add_argument('--root', action='append', required=True)
    parser.add_argument('--tools', choices=['core', 'full'], default='core')
    parser.add_argument('--renderer', choices=['auto', 'inline', 'headless'], default='auto')
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--state-dir', default='.local/ply-agent-api')
    parser.add_argument('--token-file')
    parser.add_argument('--allowed-host', action='append', help='Allowed MCP Host header, e.g. viewer.example.org; repeat as needed')
    args = parser.parse_args()
    state = Path(args.state_dir); state.mkdir(parents=True, exist_ok=True, mode=0o700)
    token_file = Path(args.token_file) if args.token_file else state / 'token'
    if not token_file.exists():
        with os.fdopen(os.open(token_file, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'w') as output:
            output.write(secrets.token_urlsafe(32))
    token = token_file.read_text().strip()
    app = create_http_app(args.root, token=token, state_dir=state, allowed_hosts=args.allowed_host, tools=args.tools, renderer=args.renderer)
    print(f'HTTP MCP: /mcp; REST: /api/v1; bearer credential file: {token_file.resolve()}', flush=True)
    import uvicorn
    uvicorn.run(app, host=args.host, port=args.port, access_log=False)


if __name__ == '__main__': main()
