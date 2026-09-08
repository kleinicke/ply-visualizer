"""Exercise the public MCP protocol, including failures and session reuse."""
import asyncio
import json
from pathlib import Path
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
import time

from ply_visualizer.agent_bridge import BrowserBridge
from ply_visualizer.mcp_server import SceneManager, create_server, browser_default
try:
    from mcp import Client
except ImportError:
    Client = None


class BridgeTests(unittest.TestCase):
    def test_reply_and_timeout(self):
        bridge = BrowserBridge()
        with ThreadPoolExecutor() as pool:
            future = pool.submit(bridge.request, 'inspect')
            deadline = time.monotonic() + 2
            while bridge.pending() is None and time.monotonic() < deadline:
                time.sleep(.001)
            command = bridge.pending()
            self.assertFalse(bridge.receive({'id': 'wrong', 'result': {}}))
            self.assertTrue(bridge.receive({'id': command['id'], 'result': {'vertices': 3}}))
            self.assertEqual(future.result(), {'vertices': 3})
            self.assertFalse(bridge.receive({'id': command['id'], 'result': {}}))
        with self.assertRaises(TimeoutError):
            bridge.request('inspect', timeout=.01)
        self.assertIsNone(bridge.pending())

    def test_renderer_ownership_and_expected_errors(self):
        from unittest.mock import patch
        from ply_visualizer.agent_bridge import RendererError
        bridge = BrowserBridge()
        with patch('ply_visualizer.agent_bridge.time.monotonic', return_value=100):
            bridge.pending('original')
            self.assertIsNone(bridge.pending('duplicate'))
            self.assertEqual(bridge.renderer_id(), 'original')
            with ThreadPoolExecutor() as pool:
                future = pool.submit(bridge.request, 'inspect')
                for _ in range(2000):
                    command = bridge.pending('original')
                    if command: break
                    time.sleep(.001)
                self.assertIsNone(bridge.pending('duplicate'))
                self.assertFalse(bridge.receive({'id': command['id'], 'renderer_id': 'duplicate', 'result': {}}))
                self.assertTrue(bridge.receive({'id': command['id'], 'renderer_id': 'original', 'error': 'No points matched'}))
                with self.assertRaisesRegex(RendererError, 'No points matched'): future.result()
        with patch('ply_visualizer.agent_bridge.time.monotonic', return_value=111):
            bridge.pending('replacement')
            self.assertEqual(bridge.renderer_id(), 'replacement')

    def test_browser_default_respects_host_and_override(self):
        from types import SimpleNamespace
        class Capabilities:
            def model_dump(self, **kwargs):
                return {'extensions': {'io.modelcontextprotocol/ui': {'mimeTypes': ['text/html;profile=mcp-app']}}}
        host = SimpleNamespace(client_capabilities=Capabilities())
        self.assertFalse(browser_default(host, None))
        self.assertTrue(browser_default(host, True))
        plain = SimpleNamespace(client_capabilities=None)
        self.assertFalse(browser_default(plain, None))
        self.assertFalse(browser_default(plain, False))

    def test_file_roots_reject_symlinks(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / 'allowed'
            root.mkdir()
            outside = Path(directory) / 'outside.ply'
            outside.write_text('ply')
            (root / 'link.ply').symlink_to(outside)
            manager = SceneManager([root])
            for name in ('../outside.ply', 'link.ply'):
                with self.assertRaises(ValueError):
                    manager.path(name)


@unittest.skipIf(Client is None, 'Install the mcp extra')
class MCPTests(unittest.IsolatedAsyncioTestCase):
    async def test_agent_workflow(self):
        async with Client(create_server([Path.cwd()])) as client:
            tools = (await client.list_tools()).tools
            self.assertEqual(len(tools), 21)
            self.assertTrue(next(t for t in tools if t.name == "open_3d_url").annotations.open_world_hint)
            self.assertFalse(next(t for t in tools if t.name == 'update_3d_scene').meta)
            app_resource = await client.read_resource('ui://ply-visualizer/viewer.html')
            content = app_resource.contents[0]
            self.assertEqual(content.mime_type, 'text/html;profile=mcp-app')
            self.assertIn('<!doctype html>', content.text)
            self.assertEqual(content.meta['ui']['csp']['connectDomains'], [])
            self.assertEqual(next(t for t in tools if t.name == 'open_3d_files').meta['ui']['resourceUri'], 'ui://ply-visualizer/viewer.html')
            points = next(t for t in tools if t.name == 'visualize_points')
            self.assertEqual(points.input_schema['properties']['points']['maxItems'], 20000)
            async def call(name, args):
                result = await client.call_tool(name, args)
                self.assertFalse(result.is_error, result)
                return json.loads(result.content[0].text)
            scene = await call('visualize_points', {'points': [[0, 0, 0]], 'open_browser': False})
            pending = await call('read_viewer_data', {'scene_id': scene['scene_id'], 'resource': 'agent/command'})
            self.assertIsNone(pending['command'])
            chunk = await call('read_viewer_data', {'scene_id': scene['scene_id'], 'resource': f"files/{scene['revision']}/0"})
            import base64
            self.assertTrue(base64.b64decode(chunk['data']).startswith(b'ply'))
            for resource in ('../.local/.pypirc', 'assets/../../.local/.pypirc', 'files/999/0'):
                invalid_resource = await client.call_tool('read_viewer_data', {'scene_id': scene['scene_id'], 'resource': resource})
                self.assertTrue(invalid_resource.is_error)
            updated = await call('update_3d_scene', {'scene_id': scene['scene_id'], 'points': [[1, 2, 3]]})
            self.assertEqual(updated['url'], scene['url'])
            self.assertGreater(updated['revision'], scene['revision'])
            invalid = await client.call_tool('set_3d_camera', {'scene_id': scene['scene_id'], 'position': [0,0,0], 'target': [0,0,0]})
            self.assertTrue(invalid.is_error)
            await call('close_3d_scene', {'scene_id': scene['scene_id']})
            missing = await client.call_tool('update_3d_scene', {'scene_id': scene['scene_id'], 'points': [[0,0,0]]})
            self.assertTrue(missing.is_error)

    async def test_concurrent_geometry_chunks_and_region_validation(self):
        import base64
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'chunks.pcd'
            payload = bytes(range(256)) * 8193
            path.write_bytes(payload)
            async with Client(create_server([Path(folder)])) as client:
                result = await client.call_tool('open_3d_files', {'paths': [str(path)], 'open_browser': False})
                scene_id = result.structured_content['scene_id']
                offsets = list(range(0, len(payload), 512 * 1024))
                chunks = await asyncio.gather(*(client.call_tool('read_viewer_data', {'scene_id': scene_id, 'resource': f"files/{result.structured_content['revision']}/0", 'offset': offset}) for offset in offsets))
                for offset, chunk in zip(offsets, chunks):
                    self.assertFalse(chunk.is_error, chunk)
                    self.assertEqual(chunk.structured_content['offset'], offset)
                    self.assertEqual(chunk.structured_content['size'], len(payload))
                self.assertEqual(b''.join(base64.b64decode(chunk.structured_content['data']) for chunk in chunks), payload)
                for args in ({'field': 'label'}, {'field': 'label', 'values': []}, {'bounds': [1,0,0,0,1,1]}, {'plane': [0,0,0,1]}):
                    invalid = await client.call_tool('select_3d_region', {'scene_id': scene_id, **args})
                    self.assertTrue(invalid.is_error, invalid)
                    self.assertNotEqual(invalid.content[0].text, 'Error executing tool select_3d_region')

    async def test_real_stdio_transport(self):
        import os
        import sys
        from mcp import StdioServerParameters
        source = str(Path(__file__).resolve().parents[1])
        process = StdioServerParameters(command=sys.executable,
            args=['-m', 'ply_visualizer.mcp_server', '--root', str(Path.cwd())],
            env={**os.environ, 'PYTHONPATH': source})
        async with Client(process) as client:
            self.assertEqual(len((await client.list_tools()).tools), 21)
            resource = await client.read_resource('viewer://capabilities')
            self.assertEqual(json.loads(resource.contents[0].text)['transport'], 'stdio')
