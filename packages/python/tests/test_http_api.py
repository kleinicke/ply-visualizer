"""HTTP/REST and Tasks exercise the real SDK dispatcher, no renderer required."""
import asyncio
import json
from pathlib import Path
import tempfile
import unittest
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from viz3d.http_api import create_http_app
from viz3d.tasks import TaskStore, IDENTIFIER
from starlette.testclient import TestClient

TOKEN = 'test-token-' * 4

class HTTPTests(unittest.TestCase):
    def test_rest_upload_scene_persistence_auth_and_schema(self):
        with tempfile.TemporaryDirectory() as folder:
            app = create_http_app([folder], token=TOKEN, state_dir=Path(folder)/'state')
            with TestClient(app) as client:
                self.assertEqual(client.get('/api/v1/tools').status_code, 401)
                client.headers['Authorization'] = 'Bearer '+TOKEN
                self.assertEqual(client.get('/api/v1/tools', headers={'Origin': 'https://example.org'}).status_code, 403)
                listing = client.get('/api/v1/tools').json()
                self.assertIn('open_depth_image', [t['name'] for t in listing['tools']])
                document = client.get('/api/v1/openapi.json').json()
                self.assertIn('/api/v1/tools/open_3d_files', document['paths'])
                def check_refs(value):
                    if isinstance(value, dict):
                        if '$ref' in value:
                            target = document
                            for key in value['$ref'][2:].split('/'): target = target[key]
                        for item in value.values(): check_refs(item)
                    elif isinstance(value, list):
                        for item in value: check_refs(item)
                check_refs(document)
                self.assertEqual(client.post('/api/v1/tools/list_3d_scenes', content=b'x'*(2*1024*1024+1)).status_code, 413)
                data = b'ply\nformat ascii 1.0\nelement vertex 1\nproperty float x\nproperty float y\nproperty float z\nend_header\n0 0 0\n'
                uploaded = client.post('/api/v1/uploads/points.ply', content=data)
                self.assertEqual(uploaded.status_code, 201)
                path = uploaded.json()['path']
                opened = client.post('/api/v1/tools/open_3d_files', json={'paths':[path], 'open_browser':False})
                self.assertEqual(opened.status_code, 200, opened.text)
                scene_id = opened.json()['structuredContent']['scene_id']
                scenes = client.post('/api/v1/tools/list_3d_scenes', json={}).json()
                self.assertIn(scene_id, json.dumps(scenes))
                self.assertEqual(client.get('/api/v1/files', params={'path':path}).content, data)
                self.assertEqual(client.get('/api/v1/files', params={'path':'/etc/passwd'}).status_code, 404)
                task = client.post('/api/v1/tools/list_3d_scenes?async=true', json={})
                self.assertEqual(task.status_code, 202)
                for _ in range(100):
                    state = client.get(task.headers['location']).json()
                    if state['status'] != 'working': break
                self.assertEqual(state['status'], 'completed', state)
                self.assertIn(scene_id, json.dumps(state['result']))
                self.assertEqual(client.delete('/api/v1/files', params={'path':path}).status_code, 200)
                self.assertFalse(Path(path).exists())

    def test_modern_mcp_discovery_and_task_negotiation(self):
        with tempfile.TemporaryDirectory() as folder:
            app = create_http_app([folder], token=TOKEN, state_dir=Path(folder)/'state')
            with TestClient(app, base_url='http://127.0.0.1:8765') as client:
                client.headers.update({'Authorization':'Bearer '+TOKEN, 'Accept':'application/json, text/event-stream', 'MCP-Protocol-Version':'2026-07-28'})
                def rpc(method, params):
                    meta = params.setdefault('_meta', {})
                    meta.setdefault('io.modelcontextprotocol/protocolVersion', '2026-07-28')
                    meta.setdefault('io.modelcontextprotocol/clientCapabilities', {})
                    response = client.post('/mcp', headers={'Mcp-Method':method, 'Mcp-Name':params.get('name','')}, json={'jsonrpc':'2.0','id':1,'method':method,'params':params})
                    self.assertEqual(response.status_code, 200, response.text)
                    return response.json()
                discovery = rpc('server/discover', {})
                self.assertIn(IDENTIFIER, json.dumps(discovery))
                plain = rpc('tools/call', {'name':'export_3d_selection', 'arguments':{'scene_id':'missing','path':str(Path(folder)/'out.ply')}})
                self.assertNotEqual(plain.get('result',{}).get('resultType'), 'task')
                task = rpc('tools/call', {'name':'export_3d_selection', 'arguments':{'scene_id':'missing','path':str(Path(folder)/'out.ply')}, '_meta':{'io.modelcontextprotocol/clientCapabilities':{'extensions':{IDENTIFIER:{}}}}})
                self.assertEqual(task.get('result',{}).get('resultType'), 'task', task)
                key = task['result']['taskId']
                for _ in range(100):
                    state = rpc('tasks/get', {'taskId':key})['result']
                    if state['status'] != 'working': break
                self.assertEqual(state['status'], 'completed', state)
                self.assertTrue(state['result']['isError'])
                self.assertEqual(rpc('tasks/update', {'taskId':key,'inputResponses':{'unknown':{}}}).get('error'), None)
                self.assertEqual(rpc('tasks/cancel', {'taskId':key}).get('error'), None)

    def test_persisted_tasks_and_bound(self):
        async def run(folder):
            path=Path(folder)/'tasks.sqlite'
            store=TaskStore(path, limit=1)
            with self.assertRaisesRegex(ValueError, 'another server'): TaskStore(path)
            async def work(): return {'ok':True}
            task=store.submit(work)
            await asyncio.gather(*list(store.running))
            with self.assertRaises(Exception): store.submit(work)
            await store.close()
            reopened=TaskStore(path)
            self.assertEqual(reopened.get(task['taskId'])['result'], {'ok':True})
            await reopened.close()
        with tempfile.TemporaryDirectory() as folder: asyncio.run(run(folder))

    def test_alignment_waits_for_job_completion(self):
        from types import SimpleNamespace
        from viz3d.tasks import invoke_complete
        class FakeServer:
            polls = 0
            async def call_tool(self, name, args):
                if args['action'] != 'status': return SimpleNamespace(is_error=False, structured_content={'submitted':True})
                self.polls += 1
                return SimpleNamespace(is_error=False, structured_content={'alignment':{'job':{'state': 'completed' if self.polls == 2 else 'running'}}})
        server = FakeServer()
        result = asyncio.run(invoke_complete(server, 'align_3d_clouds', {'action':'icp', 'scene_id':'fixture'}))
        self.assertEqual(server.polls, 2)
        self.assertEqual(result.structured_content['alignment']['job']['state'], 'completed')
