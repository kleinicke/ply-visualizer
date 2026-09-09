import json
from pathlib import Path
import sys
import unittest
from unittest.mock import Mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from viz3d import show, show_batch
from viz3d.training import LayerInspection
import test_session


class TrainingTests(unittest.TestCase):
    setUp = test_session.SessionTests.setUp
    fetch = test_session.SessionTests.fetch

    def test_revisions_overlays_vectors_and_failed_update(self):
        points = [[0, 0, 0], [1, 0, 0]]
        with show(points, open_browser=False) as viewer:
            url = viewer.url
            viewer.update(points, target=[[0, 0, 1]], vectors=[[1, 0, 0], [0, 1, 0]], vector_scale=-0.1, step=12)
            scene = json.loads(self.fetch(viewer.url + "session.json"))
            self.assertEqual(viewer.url, url)
            self.assertEqual(scene["revision"], 1)
            self.assertEqual(scene["step"], 12)
            self.assertEqual([f["name"] for f in scene["files"]], ["prediction.ply", "target.ply"])
            self.assertEqual(scene["vectors"][0][0], [0, 0, 0, -0.1, 0, 0])
            for file in scene["files"]:
                self.assertIn(b"end_header", self.fetch(viewer.url + file["url"]))
            with self.assertRaises(ValueError):
                viewer.update(points, vectors=[[1, 0, 0]])
            with self.assertRaises(ValueError):
                viewer.update(None)
            self.assertEqual(json.loads(self.fetch(viewer.url + "session.json"))["revision"], 1)
            for i in range(5):
                viewer.update(points, step=i)
            self.assertEqual(len(viewer._history), 3)
            self.assertEqual(len(list(Path(viewer._frames.name).iterdir())), 3)
        with self.assertRaises(RuntimeError):
            viewer.update(points)

    def test_batch_and_inline(self):
        with show_batch([[[0, 0, 0]], [[1, 1, 1], [2, 2, 2]]], labels=["original", "augmented"], open_browser=False) as viewer:
            scene = json.loads(self.fetch(viewer.url + "session.json"))
            self.assertEqual(scene["batches"], ["original", "augmented"])
            self.assertEqual([f["batch"] for f in scene["files"]], [0, 1])
            self.assertIn('?ui=collapsed', viewer._repr_html_())
            self.assertIn('?ui=none', viewer.iframe(ui="none"))
            self.assertIn('height="600"', viewer.iframe(height=600))
            with self.assertRaises(ValueError):
                viewer.iframe(ui='" onload="alert(1)')
            with self.assertRaises(ValueError):
                viewer.update_batch([[[0, 0, 0]]], labels=[])

    def test_hook_is_throttled_and_does_not_replace_output(self):
        module = Mock()
        viewer = Mock()
        with LayerInspection(module, viewer, select=lambda output: output[0], every=2) as hook:
            callback = module.register_forward_hook.call_args.args[0]
            for i in range(4):
                self.assertIsNone(callback(module, (), [i]))
            self.assertEqual(viewer.update.call_count, 2)
            viewer.update.assert_called_with(2, step=3)
        module.register_forward_hook.return_value.remove.assert_called_once()

    def test_hook_stops_on_error_without_breaking_forward(self):
        module = Mock()
        viewer = Mock()
        viewer.update.side_effect = ValueError("bad output")
        hook = LayerInspection(module, viewer)
        with self.assertWarns(RuntimeWarning):
            self.assertIsNone(module.register_forward_hook.call_args.args[0](module, (), 1))
        self.assertIsInstance(hook.error, ValueError)


if __name__ == "__main__":
    unittest.main()
