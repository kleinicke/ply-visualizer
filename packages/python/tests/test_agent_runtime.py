"""Verify profiles and real unattended rendering, not just tool acknowledgments."""
import asyncio
import base64
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch
from mcp import Client
from viz3d.mcp_server import create_server, SceneManager, CORE_TOOLS, APP_TOOLS
from viz3d.doctor import diagnose


class RuntimeTests(unittest.IsolatedAsyncioTestCase):
    async def test_core_catalog_and_unavailable_full_tool(self):
        async with Client(create_server([Path.cwd()], tools='core')) as client:
            names = {t.name for t in (await client.list_tools()).tools}
            self.assertEqual(names, CORE_TOOLS | APP_TOOLS)
            result = await client.call_tool('export_3d_selection', {'scene_id': 'missing', 'path': 'x.ply'})
            self.assertTrue(result.is_error)
            caps = json.loads((await client.read_resource('viewer://capabilities')).contents[0].text)
            self.assertEqual(caps['tool_profile'], 'core')

    async def test_failed_headless_open_does_not_leak_scene(self):
        async with Client(create_server([Path.cwd()], renderer='headless')) as client:
            with patch('viz3d.session.ViewerSession.start_headless', side_effect=RuntimeError('Chromium missing')):
                result = await client.call_tool('visualize_points', {'points': [[0,0,0]]})
            self.assertTrue(result.is_error)
            self.assertIn('Chromium missing', str(result))
            scenes = await client.call_tool('list_3d_scenes', {})
            self.assertEqual(scenes.structured_content['scenes'], [])

    @unittest.skipUnless(os.environ.get('VIZ3D_TEST_HEADLESS') == '1', 'Enable with VIZ3D_TEST_HEADLESS=1 after installing Chromium')
    async def test_headless_capture_and_camera_preservation(self):
        async with Client(create_server([Path.cwd()], renderer='headless', tools='full')) as client:
            result = await client.call_tool('visualize_points', {'points': [[0,0,0],[1,0,0],[0,1,0]], 'colors': [[255,0,0],[0,255,0],[0,0,255]]})
            self.assertFalse(result.is_error, str(result))
            scene = result.structured_content['scene_id']
            before = await client.call_tool('inspect_3d_scene', {'scene_id': scene, 'detail': 'full'})
            self.assertFalse(before.is_error, str(before))
            self.assertTrue(before.structured_content['rendering']['webgl'])
            self.assertEqual(before.structured_content['objects'][0]['vertices'], 3)
            image = await client.call_tool('capture_3d_view', {'scene_id': scene})
            self.assertFalse(image.is_error, str(image))
            png = base64.b64decode(next(c.data for c in image.content if c.type == 'image'))
            self.assertTrue(png.startswith(b'\x89PNG\r\n\x1a\n'))
            Path('/tmp/viz3d-headless-test.png').write_bytes(png)
            changed = await client.call_tool('set_3d_camera', {'scene_id': scene, 'position': [3,2,4], 'target': [0.2,0.3,0]})
            self.assertFalse(changed.is_error, str(changed))
            # update_3d_scene must preserve the renderer and camera across geometry revisions.
            update = await client.call_tool('update_3d_scene', {'scene_id': scene, 'points': [[0,0,0],[2,0,0],[0,2,0]]})
            self.assertFalse(update.is_error, str(update))
            after = await client.call_tool('inspect_3d_scene', {'scene_id': scene, 'detail': 'full'})
            self.assertFalse(after.is_error, str(after))
            self.assertEqual(after.structured_content['camera']['position'], [3,2,4])
            self.assertEqual(after.structured_content['renderer_id'], before.structured_content['renderer_id'])
            await client.call_tool('close_3d_scene', {'scene_id': scene})


class DoctorTests(unittest.TestCase):
    def test_auto_renderer_respects_apps_capability_and_browser_override(self):
        for supports_apps, external_browser, expected_headless in (
            (True, False, False), (False, False, True), (False, True, False)
        ):
            with self.subTest(apps=supports_apps, browser=external_browser):
                manager = SceneManager([Path.cwd()], renderer='auto')
                context = Mock()
                context.client_capabilities.model_dump.return_value = {
                    'extensions': {'io.modelcontextprotocol/ui': {}} if supports_apps else {}
                }
                viewer = Mock()
                with patch.object(manager, 'describe', return_value={}):
                    manager.add(lambda: viewer, context, external_browser=external_browser)
                self.assertEqual(viewer.start_headless.called, expected_headless)
                manager.close()

    def test_unknown_host_and_invalid_root_are_honest(self):
        with tempfile.TemporaryDirectory() as root:
            result = diagnose([str(Path(root)/'missing')])
            self.assertFalse(result['ok'])
            self.assertIsNone(result['host_webgl'])
            self.assertFalse(result['headless']['checked'])
