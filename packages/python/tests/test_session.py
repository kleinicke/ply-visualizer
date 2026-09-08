import json
from pathlib import Path
import struct
import sys
import tempfile
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ply_visualizer import show


class SessionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.assets = self.root / "assets"
        self.assets.mkdir()
        (self.assets / "bundle.js").write_text("// test")
        (self.assets / "index.html").write_text('<script async src="https://analytics.re4vive.com/js/test.js"></script><title>Viewer</title>')
        self.asset_patch = patch("ply_visualizer.session.ASSETS", self.assets)
        self.asset_patch.start()
        self.addCleanup(self.asset_patch.stop)

    def fetch(self, url):
        with urlopen(url, timeout=5) as response:
            return response.read()

    def test_only_selected_files_are_served_and_manifest_hides_paths(self):
        file = self.root / "a cloud.ply"
        file.write_bytes(b"ply data")
        (self.root / "secret.txt").write_text("secret")
        with show(file, open_browser=False) as viewer:
            manifest = json.loads(self.fetch(viewer.url + "session.json"))
            self.assertEqual([{k:v for k,v in entry.items() if k != "id"} for entry in manifest["files"]], [{"name": file.name, "url": "files/0/0", "batch": 0}])
            self.assertEqual(len(manifest["files"][0]["id"]), 24)
            self.assertEqual(self.fetch(viewer.url + "files/0/0"), b"ply data")
            self.assertNotIn(b"analytics.re4vive.com", self.fetch(viewer.url))
            for resource in ("../secret.txt", "%2e%2e/secret.txt", "files/1", "files/-1", "files/0/extra"):
                with self.assertRaises(HTTPError) as error:
                    self.fetch(viewer.url + resource)
                self.assertEqual(error.exception.code, 404)
                error.exception.close()
            with self.assertRaises(HTTPError) as error:
                self.fetch(f"http://{viewer.authority}/session.json")
            error.exception.close()
            for headers in ({"Host": "example.com"}, {"Origin": "https://example.com"}):
                with self.assertRaises(HTTPError) as error:
                    self.fetch(Request(viewer.url + "session.json", headers=headers))
                self.assertEqual(error.exception.code, 403)
                error.exception.close()
        viewer.close()  # Closing twice is supported.

    def test_points_and_colors_binary_payload_and_cleanup(self):
        with show([[1, 2, 3], [4, 5, 6]], colors=[[255, 0, 1], [2, 3, 4]], open_browser=False) as viewer:
            payload = self.fetch(viewer.url + "files/0/0")
            header, data = payload.split(b"end_header\n", 1)
            self.assertIn(b"element vertex 2", header)
            self.assertEqual(data, struct.pack("<fffBBBfffBBB", 1, 2, 3, 255, 0, 1, 4, 5, 6, 2, 3, 4))
            temporary_file = viewer._files[0]
            self.assertTrue(temporary_file.exists())
        self.assertFalse(temporary_file.exists())

    def test_append_retains_ids_files_and_bounded_history(self):
        model = self.root / "model.gltf"
        model.write_text("{}")
        asset = self.root / "model.bin"
        asset.write_bytes(b"buffer")
        with show([[0,0,0]], open_browser=False) as viewer:
            viewer.update([[1,2,3]])
            original = viewer._manifest()["files"][0]["id"]
            original_file = viewer._files[0]
            for _ in range(4):
                viewer.add_files([model, asset])
            self.assertEqual(viewer._manifest()["files"][0]["id"], original)
            self.assertTrue(original_file.is_file())
            self.assertEqual(len(viewer._history), 3)
            self.assertEqual(len(viewer._files), 9)
            self.assertEqual(self.fetch(viewer.url + viewer._manifest()["files"][0]["url"]), original_file.read_bytes())
            viewer.update([[4,5,6]])
            self.assertNotEqual(viewer._manifest()["files"][0]["id"], original)
            viewer.update([[7,8,9]])
            viewer.update([[10,11,12]])
            self.assertFalse(original_file.exists())

    def test_invalid_arrays(self):
        for points, colors in (([], None), ([[1, 2]], None), ([[float("nan"), 0, 0]], None),
                               ([[1, 2, 3]], []), ([[1, 2, 3]], [[0.5, 0, 0]]),
                               ([[1, 2, 3]], [[256, 0, 0]]), ([[1e100, 0, 0]], None)):
            with self.subTest(points=points, colors=colors), self.assertRaises(ValueError):
                show(points, colors=colors, open_browser=False)

    def test_missing_and_non_3d_files(self):
        with self.assertRaises(FileNotFoundError):
            show(self.root / "missing.ply", open_browser=False)
        image = self.root / "image.png"
        image.write_bytes(b"image")
        with self.assertRaisesRegex(ValueError, "Unsupported 3D"):
            show(image, open_browser=False)


if __name__ == "__main__":
    unittest.main()
