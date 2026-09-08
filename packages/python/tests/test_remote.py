"""Remote data uses explicit HTTP requests, bounded files, and scene cleanup."""
import gzip
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
import unittest
from ply_visualizer.remote import open_remote

DATA = b'FIELDS x y z\nSIZE 4 4 4\nTYPE F F F\nCOUNT 1 1 1\nWIDTH 1\nHEIGHT 1\nPOINTS 1\nDATA ascii\n1 2 3\n' + b' ' * 1024

class RemoteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *_): pass
            def do_GET(self):
                if self.path == '/redirect':
                    self.send_response(302); self.send_header('Location', '/cloud.pcd'); self.end_headers(); return
                if self.path == '/bad-redirect':
                    self.send_response(302); self.send_header('Location', 'file:///etc/passwd'); self.end_headers(); return
                body = gzip.compress(DATA) if self.path == '/cloud.pcd.gz' else DATA
                self.send_response(200)
                self.send_header('Content-Type', 'text/html' if self.path == '/page.pcd' else 'application/octet-stream')
                self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body)
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True); cls.thread.start()
        cls.url = f'http://127.0.0.1:{cls.server.server_port}'
    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown(); cls.server.server_close(); cls.thread.join()
    def test_download_redirect_gzip_and_cleanup(self):
        for path in ('/cloud.pcd', '/redirect', '/cloud.pcd.gz'):
            with self.subTest(path=path):
                viewer = open_remote(self.url + path)
                downloaded = viewer._files[0]
                self.assertEqual(downloaded.read_bytes(), DATA)
                viewer.close()
                self.assertFalse(downloaded.parent.exists())
    def test_bounded_and_explicit_downloads(self):
        for url in ('file:///etc/passwd', 'https://user:pass@example.com/file.pcd', self.url + '/bad-redirect', self.url + '/page.pcd', self.url + '/download'):
            with self.subTest(url=url), self.assertRaises(ValueError): open_remote(url)
        for path, limit in (('/cloud.pcd', 8), ('/cloud.pcd.gz', len(DATA)-1)):
            with self.subTest(path=path), self.assertRaisesRegex(ValueError, 'exceeds max_bytes'): open_remote(self.url + path, max_bytes=limit)
        viewer = open_remote(self.url + '/download', filename='../../cloud.pcd')
        self.assertEqual(viewer._files[0].name, 'cloud.pcd'); viewer.close()

    def test_mcp_multiple_urls_and_append_keep_downloads_alive(self):
        import asyncio
        import base64
        from mcp import Client
        from ply_visualizer.mcp_server import create_server
        async def check():
            async with Client(create_server([Path.cwd()])) as client:
                first = await client.call_tool("open_3d_url", {"url": [self.url + "/cloud.pcd", self.url + "/redirect"]})
                self.assertFalse(first.is_error, first)
                scene = first.structured_content
                self.assertEqual(len(scene["files"]), 2)
                appended = await client.call_tool("open_3d_url", {"scene_id":scene["scene_id"], "url":self.url + "/cloud.pcd.gz"})
                self.assertFalse(appended.is_error, appended)
                self.assertEqual(len(appended.structured_content["files"]), 3)
                for index in range(3):
                    data = await client.call_tool("read_viewer_data", {"scene_id":scene["scene_id"],
                        "resource":f'files/{appended.structured_content["revision"]}/{index}'})
                    self.assertEqual(base64.b64decode(data.structured_content["data"]), DATA)
        asyncio.run(check())
