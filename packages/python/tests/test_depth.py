"""Depth jobs validate calibration and preserve tensor data before rendering."""
from dataclasses import asdict
import json
import importlib.util
import sys
from pathlib import Path
import tempfile
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ply_visualizer import DepthCalibration, show_depth, show_colmap

class DepthTests(unittest.TestCase):
    def calibration(self, **kwargs):
        return DepthCalibration(**dict(width=2, height=2, fx=2., fy=2., cx=0., cy=0., kind='z', **kwargs))

    def test_invalid_calibration(self):
        for changes, message in [({'baseline': 0, 'kind': 'disparity'}, 'Disparity'),
                                 ({'coefficients': [1]}, 'coefficient'),
                                 ({'width': 0}, 'positive'),
                                 ({'camera_model': 'pinhole-opencv', 'coefficients': [1,0,0,0], 'image_rectified': True}, 'Rectified'),
                                 ({'camera_to_world': [1]*16}, 'affine')]:
            data = asdict(self.calibration()); data.update(changes)
            with self.assertRaisesRegex(ValueError, message): DepthCalibration(**data).validate()

    @unittest.skipUnless(all(importlib.util.find_spec(n) for n in ("numpy", "torch")), "NumPy/PyTorch not installed")
    def test_numpy_and_torch_serialization_and_append(self):
        import numpy as np
        import torch
        source = torch.tensor([[1., float('nan')], [2., 3.]], requires_grad=True)
        with tempfile.TemporaryDirectory() as folder:
            for values in [source, source.detach().numpy(), source.to(torch.bfloat16)]:
                with show_depth(values, calibration=self.calibration(), open_browser=False) as viewer:
                    files, _, _ = viewer._history[viewer._revision]
                    actual = np.load(files[1]); np.testing.assert_equal(actual, [[1, np.nan], [2, 3]])
                    descriptor = json.loads(files[0].read_text())
                    self.assertEqual(descriptor['calibration']['kind'], 'z')
                    self.assertEqual(descriptor['roles'], {'depth': 0})
                    old_ids = [f['id'] for f in viewer._manifest()['files']]
                    show_depth(values, calibration=self.calibration(), session=viewer)
                    self.assertEqual([f['id'] for f in viewer._manifest()['files']][:2], old_ids)
                    self.assertEqual(len(viewer._manifest()['files']), 4)
            self.assertTrue(source.requires_grad)

    def test_colmap_does_not_escape_workspace(self):
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaises((ValueError, FileNotFoundError)):
                show_colmap(folder, image='../../../../etc/passwd', open_browser=False)

    @unittest.skipUnless(importlib.util.find_spec("mcp"), "MCP not installed")
    def test_mcp_schema_and_missing_calibration(self):
        import asyncio
        from mcp import Client
        from ply_visualizer.mcp_server import create_server
        async def check():
            async with Client(create_server([Path(__file__).resolve().parents[3]])) as client:
                tools = (await client.list_tools()).tools
                tool = next(t for t in tools if t.name == 'open_depth_image')
                self.assertIn('DepthCalibration', json.dumps(tool.input_schema))
                result = await client.call_tool('open_depth_image', {'path': 'missing.npy'})
                self.assertTrue(result.is_error)
                self.assertIn('Explicit calibration', json.dumps(result.structured_content))
        asyncio.run(check())
