"""Bounded, persisted Tasks extension runtime for the local single-owner server."""
import asyncio
from datetime import datetime, timezone
import json
import os
import sqlite3
import time
import uuid

from mcp.server.extension import Extension, MethodBinding
from mcp.shared.exceptions import MCPError
from mcp.server.mcpserver.exceptions import ToolError
from mcp_types import RequestParams
from pydantic import Field

IDENTIFIER = 'io.modelcontextprotocol/tasks'
LONG_TOOLS = {'align_3d_clouds', 'export_3d_selection', 'preview_3d_views', 'open_3d_url', 'compare_3d_clouds'}


def wire(value):
    return value.model_dump(mode='json', by_alias=True, exclude_none=True) if hasattr(value, 'model_dump') else value


def timestamp():
    return datetime.now(timezone.utc).isoformat()


class TaskStore:
    def __init__(self, path, limit=64, ttl=3600):
        self._lease = open(str(path)+'.lock', 'a+b')
        try:
            if os.name == 'nt':
                import msvcrt
                self._lease.seek(0); self._lease.write(b'0'); self._lease.flush(); self._lease.seek(0)
                msvcrt.locking(self._lease.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(self._lease, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            self._lease.close()
            raise ValueError('State directory is already owned by another server process') from None
        self.db = sqlite3.connect(path, check_same_thread=False)
        self.db.execute('CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, expires REAL, payload TEXT)')
        self.limit, self.ttl, self.running = limit, ttl, set()
        for key, payload in self.db.execute('SELECT id,payload FROM tasks').fetchall():
            task = json.loads(payload)
            if task['status'] == 'working':
                task.update(status='failed', error={'code': -32603, 'message': 'Server restarted; operation was interrupted. Inspect scene/files before retrying.'}, lastUpdatedAt=timestamp())
                self._save(task)
        self.db.commit()

    def _save(self, task):
        self.db.execute('UPDATE tasks SET payload=? WHERE id=?', (json.dumps(task), task['taskId']))
        self.db.commit()

    def get(self, key):
        row = self.db.execute('SELECT payload FROM tasks WHERE id=? AND expires>?', (key, time.time())).fetchone()
        if not row: raise MCPError(-32602, 'Unknown or expired task')
        return json.loads(row[0])

    def submit(self, operation):
        self.db.execute('DELETE FROM tasks WHERE expires<?', (time.time(),))
        if len(self.running) >= self.limit or self.db.execute('SELECT count(*) FROM tasks').fetchone()[0] >= self.limit:
            raise MCPError(-32000, 'Task limit reached; wait for retained tasks to expire')
        now = timestamp()
        task = dict(taskId=uuid.uuid4().hex, status='working', createdAt=now, lastUpdatedAt=now,
                    ttlMs=self.ttl*1000, pollIntervalMs=1000)
        self.db.execute('INSERT INTO tasks VALUES (?,?,?)', (task['taskId'], time.time()+self.ttl, json.dumps(task)))
        self.db.commit()  # A returned handle always resolves, including after restart.
        async def run():
            try:
                result = wire(await operation())
                task.update(status='completed', result=result)
            except asyncio.CancelledError:
                task.update(status='failed', error={'code': -32603, 'message': 'Server stopped; operation interrupted'})
            except MCPError as error:
                task.update(status='failed', error=wire(error.error))
            except ToolError as error:
                task.update(status='failed', error={'code': -32602, 'message': str(error)})
            except Exception:
                task.update(status='failed', error={'code': -32603, 'message': 'Task execution failed; inspect server diagnostics'})
            task['lastUpdatedAt'] = timestamp()
            # Bound stored captures/results independently of upload limits.
            if len(json.dumps(task)) > 16 * 1024 * 1024:
                task.pop('result', None)
                task.update(status='failed', error={'code': -32603, 'message': 'Task result exceeds 16 MiB; export to a file'})
            self._save(task)
        running = asyncio.create_task(run())
        self.running.add(running)
        running.add_done_callback(self.running.discard)
        return {**task, 'resultType': 'task'}

    def cancel(self, key):
        task = self.get(key)
        if task['status'] == 'working':
            # Renderer mutations cannot safely be interrupted by cancelling a waiter.
            task.update(statusMessage='Cancellation requested; the running operation may still complete.', lastUpdatedAt=timestamp())
            self._save(task)
        return {}

    async def close(self):
        for task in list(self.running): task.cancel()
        await asyncio.gather(*list(self.running), return_exceptions=True)
        self.db.close()
        self._lease.close()


class TaskParams(RequestParams):
    task_id: str = Field(alias='taskId', min_length=1, max_length=128)
    input_responses: dict | None = Field(default=None, alias='inputResponses')


class ViewerTasks(Extension):
    identifier = IDENTIFIER

    def __init__(self, store):
        self.store = store
        self.invoke = None

    def methods(self):
        async def get(ctx, params): return {**self.store.get(params.task_id), 'resultType': 'complete'}
        async def update(ctx, params):
            self.store.get(params.task_id)  # No input requests are generated; ignore unknown response keys.
            return {}
        async def cancel(ctx, params): return self.store.cancel(params.task_id)
        return [MethodBinding(name, TaskParams, fn, frozenset({'2026-07-28'}))
                for name, fn in [('tasks/get', get), ('tasks/update', update), ('tasks/cancel', cancel)]]

    async def intercept_tool_call(self, params, ctx, call_next):
        meta = wire(params).get('_meta', {})
        extensions = meta.get('io.modelcontextprotocol/clientCapabilities', {}).get('extensions', {})
        args = params.arguments or {}
        long = params.name in LONG_TOOLS and args.get('action') not in ('status', 'undo', 'disable', 'enable')
        if ctx.protocol_version == '2026-07-28' and IDENTIFIER in extensions and long:
            return self.store.submit(lambda: self.invoke(params.name, args))
        return await call_next(ctx)


async def invoke_complete(server, name, arguments):
    result = await server.call_tool(name, arguments)
    # Align tools acknowledge submission; task completion must represent actual completion.
    if name == 'align_3d_clouds' and not getattr(result, 'is_error', False) and arguments.get('action') not in ('status', 'undo'):
        async def poll():
            nonlocal result
            while True:
                result = await server.call_tool(name, {'scene_id': arguments['scene_id'], 'action': 'status'})
                data = result.structured_content or {}
                job = data.get('job') or data.get('alignment', {}).get('job') or {}
                if job.get('state') == 'failed':
                    from mcp_types import CallToolResult, TextContent
                    message = job.get('error') or job.get('message') or 'Alignment failed; inspect job details'
                    result = CallToolResult(is_error=True, structured_content=data, content=[TextContent(type='text', text=str(message))])
                    break
                if result.is_error or job.get('state') == 'completed':
                    break
                await asyncio.sleep(1)
        await asyncio.wait_for(poll(), timeout=1800)
    return result
