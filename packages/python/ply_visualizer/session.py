"""Small loopback host. All parsing and rendering happens in the shared engine."""
from __future__ import annotations

import atexit
from functools import partial
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from itertools import zip_longest
import json
import math
import mimetypes
import os
from pathlib import Path
import re
import secrets
import shutil
import struct
import tempfile
import threading
from urllib.parse import unquote, urlsplit
import webbrowser

from .arrays import point_rows


FORMATS = frozenset(".ply .xyz .xyzn .xyzrgb .pcd .pts .obj .stl .off .glb .las .laz .e57 .spz .splat .ksplat .sog".split())
ASSETS = Path(__file__).parent / "_assets"


def _points_file(points, colors, directory: Path) -> Path:
    """Serialize, without a NumPy dependency or converting arrays into JSON."""
    points = point_rows(points, "points")
    if colors is not None:
        colors = point_rows(colors, "colors")
    body = directory / "vertices.bin"
    count = 0
    missing = object()
    rows = ((point, None) for point in points) if colors is None else zip_longest(points, colors, fillvalue=missing)
    with body.open("wb") as output:
        for point, color in rows:
            if point is missing or color is missing:
                raise ValueError("colors must have the same number of rows as points")
            if len(point) != 3:
                raise ValueError("points must have shape (N, 3)")
            xyz = tuple(float(value) for value in point)
            if not all(math.isfinite(value) and abs(value) <= 3.4028234663852886e38 for value in xyz):
                raise ValueError("points must contain finite float32 coordinates")
            output.write(struct.pack("<fff", *xyz))
            if colors is not None:
                if len(color) != 3:
                    raise ValueError("colors must have shape (N, 3), with integer RGB values in 0..255")
                rgb = tuple(float(value) for value in color)
                if not all(math.isfinite(value) and value.is_integer() and 0 <= value <= 255 for value in rgb):
                    raise ValueError("colors must contain integer RGB values in 0..255")
                output.write(bytes(int(value) for value in rgb))
            count += 1
    if count == 0:
        raise ValueError("points must not be empty")
    target = directory / "points.ply"
    header = f"ply\nformat binary_little_endian 1.0\nelement vertex {count}\nproperty float x\nproperty float y\nproperty float z\n"
    if colors is not None:
        header += "property uchar red\nproperty uchar green\nproperty uchar blue\n"
    with target.open("wb") as output, body.open("rb") as source:
        output.write((header + "end_header\n").encode("ascii"))
        shutil.copyfileobj(source, output)
    body.unlink()
    return target


class _Handler(BaseHTTPRequestHandler):
    def __init__(self, *args, session, **kwargs):
        self.session = session
        super().__init__(*args, **kwargs)

    def log_message(self, *_args):
        pass  # Do not log the capability URL or local file paths.

    def do_GET(self):
        session = self.session
        if self.headers.get("Host") != session.authority:
            self.send_error(403)
            return
        origin = self.headers.get("Origin")
        if origin and origin != f"http://{session.authority}":
            self.send_error(403)
            return
        path = unquote(urlsplit(self.path).path)
        prefix = f"/{session._token}/"
        if not path.startswith(prefix):
            self.send_error(404)
            return
        resource = path[len(prefix):] or "index.html"
        if resource == "session.json":
            data = json.dumps({"version": 1, "files": [
                {"name": file.name, "url": f"files/{index}"}
                for index, file in enumerate(session._files)
            ]}).encode()
            self._send(data, "application/json")
            return
        if resource.startswith("files/"):
            index = resource.removeprefix("files/")
            if not index.isdecimal() or len(index) > 9 or int(index) >= len(session._files):
                self.send_error(404)
                return
            file = session._files[int(index)]
            content_type = "application/octet-stream"
        else:
            file = (ASSETS / resource).resolve()
            if not file.is_relative_to(ASSETS.resolve()):
                self.send_error(404)
                return
            content_type = mimetypes.guess_type(file.name)[0] or "application/octet-stream"
            if file.suffix == ".wasm":
                content_type = "application/wasm"
        try:
            if resource == "index.html":
                # The website shell is shared; its analytics is unnecessary in local sessions.
                html = file.read_text(encoding="utf-8")
                html = re.sub(r'<script async src="https://analytics\.re4vive\.com/[^\"]+"></script>', "", html)
                self._send(html.encode(), "text/html; charset=utf-8")
            else:
                with file.open("rb") as source:
                    self._headers(os.fstat(source.fileno()).st_size, content_type)
                    shutil.copyfileobj(source, self.wfile)
        except (FileNotFoundError, IsADirectoryError, PermissionError):
            self.send_error(404)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def _headers(self, length, content_type):
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(length))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()

    def _send(self, data, content_type):
        self._headers(len(data), content_type)
        self.wfile.write(data)


class ViewerSession:
    """A local viewer session. Keep Python alive; close() releases its server/files."""

    def __init__(self, files, temporary=None):
        self._files = files
        self._temporary = temporary
        self._token = secrets.token_urlsafe(32)
        self._closed = threading.Event()
        self._server = ThreadingHTTPServer(("127.0.0.1", 0), partial(_Handler, session=self))
        self.authority = f"127.0.0.1:{self._server.server_port}"
        self.url = f"http://{self.authority}/{self._token}/"
        self._thread = threading.Thread(target=self._server.serve_forever, daemon=True)
        self._thread.start()
        atexit.register(self.close)

    def close(self):
        if not self._closed.is_set():
            self._server.shutdown()
            self._server.server_close()
            self._thread.join()
            if self._temporary:
                self._temporary.cleanup()
            self._closed.set()
            atexit.unregister(self.close)

    def wait(self):
        """Keep a script alive until close() or Ctrl+C."""
        self._closed.wait()

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        self.close()


def show(*sources, colors=None, open_browser=True) -> ViewerSession:
    """Show 3D paths or Nx3 points (NumPy, PyTorch, or Python iterables).

    Optional colors are Nx3 integer RGB values (0..255). The viewer opens in
    your browser. Keep the returned session and the Python process alive.
    PyTorch tensors are detached internally and transferred to CPU, including
    GPU tensors and tensors requiring gradients. The input is never modified.
    """
    if not sources:
        raise ValueError("Provide 3D file paths or an (N, 3) point array")
    if not (ASSETS / "bundle.js").is_file():
        raise RuntimeError("Viewer assets are missing. From the repository run: npm run build:python-viewer")
    temporary = None
    try:
        if all(isinstance(source, (str, os.PathLike)) for source in sources):
            if colors is not None:
                raise ValueError("colors is only supported with point arrays")
            files = [Path(source).expanduser().resolve(strict=True) for source in sources]
            for file in files:
                if not file.is_file():
                    raise ValueError(f"Not a file: {file}")
                if file.suffix.lower() not in FORMATS:
                    raise ValueError(f"Unsupported 3D file: {file.name}. Supported: {', '.join(sorted(FORMATS))}")
        else:
            if len(sources) != 1:
                raise ValueError("Pass either file paths or one (N, 3) point array")
            temporary = tempfile.TemporaryDirectory(prefix="ply-viewer-")
            try:
                files = [_points_file(sources[0], colors, Path(temporary.name))]
            except (TypeError, OverflowError) as error:
                raise ValueError("Expected an (N, 3) point array and optional (N, 3) RGB colors") from error
        session = ViewerSession(files, temporary)
    except BaseException:
        if temporary:
            temporary.cleanup()
        raise
    if open_browser:
        try:
            webbrowser.open(session.url)
        except webbrowser.Error:
            pass  # The caller can still use session.url.
    return session
