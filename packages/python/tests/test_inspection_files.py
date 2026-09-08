"""Artifact confinement and chunk integrity without a renderer."""
import base64
from pathlib import Path
from types import SimpleNamespace
import tempfile
import unittest

from ply_visualizer.inspection_files import artifact_path, export_subset


class ArtifactTests(unittest.TestCase):
    def test_root_symlink_and_no_overwrite(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve() / 'root'
            root.mkdir()
            manager = SimpleNamespace(roots=[root])
            self.assertEqual(artifact_path(manager, 'subset.ply', '.ply'), root / 'subset.ply')
            with self.assertRaises(ValueError): artifact_path(manager, '../escape.ply', '.ply')
            (root/'existing.ply').write_bytes(b'keep')
            with self.assertRaises(ValueError): artifact_path(manager, 'existing.ply', '.ply')
            (root/'link.ply').symlink_to(root/'existing.ply')
            with self.assertRaises(ValueError): artifact_path(manager, 'link.ply', '.ply', existing=True)

    def test_export_stages_chunks_before_creating_destination(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            calls = []
            def request(operation, args):
                calls.append(args['action'])
                if args['action']=='start':
                    return {'export_id':'1', 'size':4, 'points':1, 'attributes':['label'], 'original_rows_available':True, 'coordinates':'object-local'}
                if args['action']=='chunk':
                    return {'offset':0, 'size':4, 'data':base64.b64encode(b'ply\n').decode()}
                return {'released':True}
            bridge = SimpleNamespace(request=request)
            manager = SimpleNamespace(roots=[root], get=lambda _:SimpleNamespace(_bridge=bridge))
            result = export_subset(manager, 'scene', 'subset.ply')
            self.assertEqual((root/'subset.ply').read_bytes(), b'ply\n')
            self.assertNotIn('data',result)
            self.assertEqual(calls[-1],'release')
            original = bridge.request
            def corrupt(operation,args):
                value=original(operation,args)
                if args['action']=='chunk': value['offset']=1
                return value
            bridge.request=corrupt
            with self.assertRaisesRegex(ValueError,'Invalid export chunk'):
                export_subset(manager,'scene','broken.ply')
            self.assertFalse((root/'broken.ply').exists())
            self.assertEqual(calls[-1],'release')
