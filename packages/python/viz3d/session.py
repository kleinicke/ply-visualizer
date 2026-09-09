"""Small loopback host. All parsing and rendering happens in the shared engine."""
from __future__ import annotations

import atexit
from functools import partial
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from itertools import zip_longest
import json
import math
import html
import mimetypes
import os
from pathlib import Path
import re
import secrets
import shutil
import struct
import tempfile
import threading
from urllib.parse import unquote, urlsplit, parse_qs
import webbrowser

from .arrays import point_rows
from .agent_bridge import BrowserBridge


FORMATS = frozenset(".plydepth .ply .xyz .xyzn .xyzrgb .pcd .pts .obj .stl .off .gltf .glb .fbx .dae .3ds .las .laz .e57 .spz .splat .ksplat .sog".split())
ASSETS = Path(__file__).parent / "_assets"


MODEL_ASSETS = frozenset(".npy .npz .tif .tiff .pfm .exr .txt .bin .png .jpg .jpeg .webp .bmp .tga .ktx2 .dds .mtl".split())

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
        if resource == "agent/events":
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            generation = -1
            try:
                while not session._closed.is_set():
                    generation = session.wait_change(generation)
                    self.wfile.write(f"data: {generation}\n\n".encode())
                    self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError):
                pass
            return
        if resource == "agent/command":
            self._send(json.dumps(session._bridge.pending(parse_qs(urlsplit(self.path).query).get("renderer_id", [None])[0])).encode(), "application/json")
            return
        if resource == "session.json":
            with session._lock:
                data = json.dumps(session._manifest()).encode()
            self._send(data, "application/json")
            return
        if resource.startswith("files/"):
            parts = resource.split("/")
            if len(parts) != 3 or any(not part.isdecimal() or len(part) > 9 for part in parts[1:]):
                self.send_error(404)
                return
            revision, index = map(int, parts[1:])
            with session._lock:
                snapshot = session._history.get(revision)
                if snapshot is None or index >= len(snapshot[0]):
                    self.send_error(404)
                    return
                try:
                    with snapshot[0][index].open("rb") as source:
                        self._headers(os.fstat(source.fileno()).st_size, "application/octet-stream")
                        shutil.copyfileobj(source, self.wfile)
                except (BrokenPipeError, ConnectionResetError):
                    pass
                except (FileNotFoundError, IsADirectoryError, PermissionError):
                    self.send_error(404)
            return
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

    def do_POST(self):
        session = self.session
        if (self.headers.get("Host") != session.authority
                or self.headers.get("Origin") not in (None, f"http://{session.authority}")
                or self.path != f"/{session._token}/agent/result"):
            self.send_error(403)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 8 * 1024 * 1024:
                self.send_error(413)
                return
            self.connection.settimeout(10)
            value = json.loads(self.rfile.read(length))
        except (ValueError, OSError):
            self.send_error(400)
            return
        accepted = session._bridge.receive(value)
        self._send(json.dumps({"accepted": accepted}).encode(), "application/json")

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
        self._events = threading.Condition()
        self._generation = 0
        self._bridge = BrowserBridge(self.notify_change)
        self._headless = None
        self._lock = threading.RLock()
        self._update_lock = threading.Lock()
        self._revision = 0
        self._frames = tempfile.TemporaryDirectory(prefix="ply-scenes-")
        self._frame_folders = set()
        self._history = {0: (files, {"files": [{"name": file.name, "batch": 0, "id": secrets.token_hex(12)} for file in files], "batches": ["Sample 0"], "vectors": [[]], "step": None}, None)}
        self._temporary = temporary
        self._downloads = []
        self._token = secrets.token_urlsafe(32)
        self._closed = threading.Event()
        self._server = ThreadingHTTPServer(("127.0.0.1", 0), partial(_Handler, session=self))
        self.authority = f"127.0.0.1:{self._server.server_port}"
        self.url = f"http://{self.authority}/{self._token}/"
        self._thread = threading.Thread(target=self._server.serve_forever, daemon=True)
        self._thread.start()
        atexit.register(self.close)

    def notify_change(self):
        with self._events:
            self._generation += 1
            self._events.notify_all()

    def wait_change(self, after, timeout=5):
        with self._events:
            self._events.wait_for(lambda: self._generation != after or self._closed.is_set(), timeout)
            return self._generation

    def inspect(self, *, detail="summary"):
        """Inspect the connected renderer; raises if no renderer answers."""
        if detail not in {"summary", "full"}: raise ValueError("detail must be summary or full")
        return self._bridge.request("inspect", {"detail": detail})

    def capture(self):
        """Return rendered PNG bytes from the active inline, browser or headless view."""
        import base64
        return base64.b64decode(self._bridge.request("capture")["png"], validate=True)

    def start_headless(self):
        from .headless import HeadlessRenderer
        if self._headless is None:
            self._headless = HeadlessRenderer(self.url)

    def close(self):
        with self._update_lock:
            self._close()

    def _close(self):
        if not self._closed.is_set():
            self._closed.set()
            self.notify_change()
            if self._headless is not None:
                self._headless.close()
            self._server.shutdown()
            self._server.server_close()
            self._thread.join()
            self._frames.cleanup()
            for temporary in self._downloads: temporary.cleanup()
            if self._temporary:
                self._temporary.cleanup()
            self._closed.set()
            atexit.unregister(self.close)

    def _manifest(self):
        _, scene, _ = self._history[self._revision]
        return {**scene, "version": 1, "revision": self._revision,
                "files": [{**file, "url": f"files/{self._revision}/{index}"}
                          for index, file in enumerate(scene["files"])]}

    def add_files(self, files, temporary=None):
        """Append explicitly provided models/assets without replacing existing objects."""
        files = [Path(file).resolve(strict=True) for file in files]
        if not files or any(not file.is_file() or file.suffix.lower() not in FORMATS | MODEL_ASSETS for file in files):
            raise ValueError("Provide supported model files and optional supporting assets")
        with self._update_lock, self._lock:
            if self._closed.is_set(): raise ValueError("Viewer session is closed")
            old_files, old_scene, _ = self._history[self._revision]
            if len(old_scene["batches"]) != 1: raise ValueError("Append requires a single-sample scene")
            scene = {**old_scene, "files": [*old_scene["files"],
                *({"name": file.name, "batch": 0, "id": secrets.token_hex(12)} for file in files)]}
            self._revision += 1
            self._files = [*old_files, *files]
            self._history[self._revision] = (self._files, scene, None)
            self.notify_change()
            if temporary is not None: self._downloads.append(temporary)
            self._prune_history()
        return self

    def _prune_history(self):
        for revision in list(self._history):
            if revision < self._revision - 2:
                self._history.pop(revision)
        # Track retained folders independently: their creating revision may have
        # expired while appended scenes still reference the generated files.
        for folder in list(self._frame_folders):
            if not any(file.is_relative_to(folder) for files, _, _ in self._history.values() for file in files):
                shutil.rmtree(folder, ignore_errors=True)
                self._frame_folders.remove(folder)

    def update(self, points, *, colors=None, target=None, vectors=None,
               vector_scale=1.0, max_vectors=256, step=None):
        """Replace the scene; connected viewers preserve their camera.

        Prediction is orange and target cyan unless prediction RGB is supplied.
        Vectors are arrows anchored at points; pass -learning_rate * gradients
        to display a proposed gradient-descent step.
        """
        return self._update(points, colors=colors, target=target, vectors=vectors,
                            vector_scale=vector_scale, max_vectors=max_vectors, step=step)

    def update_batch(self, points, *, colors=None, target=None, vectors=None,
                     vector_scale=1.0, max_vectors=256, labels=None, step=None):
        """Publish (B, N, 3) arrays or a list of variable-length (N, 3) samples."""
        return self._update(points, colors=colors, target=target, vectors=vectors,
                            vector_scale=vector_scale, max_vectors=max_vectors,
                            labels=labels, step=step, batched=True)

    def _update(self, points, **options):
        from .scenes import build_scene
        with self._update_lock:
            if self._closed.is_set():
                raise RuntimeError("Viewer session is closed")
            folder = Path(tempfile.mkdtemp(dir=self._frames.name))
            try:
                files, scene = build_scene(folder, points, **options)
            except BaseException:
                shutil.rmtree(folder)
                raise
            with self._lock:
                self._frame_folders.add(folder)
                for entry in scene["files"]: entry["id"] = secrets.token_hex(12)
                self._revision += 1
                self._files = files
                self._history[self._revision] = (files, scene, folder)
                self.notify_change()
                self._prune_history()
        return self

    def inspect_layer(self, module, *, select=lambda output: output, every=100):
        from .training import LayerInspection
        return LayerInspection(module, self, select=select, every=every)

    def iframe(self, *, height=480, ui="collapsed"):
        """HTML embedding for local Jupyter kernels. No notebook dependency."""
        if not isinstance(height, int) or not 160 <= height <= 2000:
            raise ValueError("height must be an integer in 160..2000")
        if ui not in ("collapsed", "full", "none"):
            raise ValueError("ui must be collapsed, full, or none")
        if self._closed.is_set():
            raise RuntimeError("Viewer session is closed")
        return (f'<iframe src="{html.escape(self.url, quote=True)}?ui={ui}" '
                f'title="3D point cloud viewer" width="100%" height="{height}" '
                'style="border:0;border-radius:8px" allow="fullscreen" '
                'referrerpolicy="no-referrer"></iframe>')

    def _repr_html_(self):
        return self.iframe()

    def display(self, *, height=480, ui="collapsed"):
        """Display inline in a local notebook. Requires the notebook extra."""
        try:
            from IPython.display import HTML, display
        except ImportError as error:
            raise RuntimeError('Install notebook support: uv pip install "3d-visualizer[notebook]"') from error
        display(HTML(self.iframe(height=height, ui=ui)))
        return None

    def wait(self):
        """Keep a script alive until close() or Ctrl+C."""
        self._closed.wait()

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        self.close()


def show(*sources, colors=None, target=None, vectors=None, vector_scale=1.0, max_vectors=256, inline=False, open_browser=None, headless=False) -> ViewerSession:
    """Show 3D paths or Nx3 points (NumPy, PyTorch, or Python iterables).

    Optional colors are Nx3 integer RGB values (0..255). The viewer opens in
    your browser. Keep the returned session and the Python process alive.
    PyTorch tensors are detached internally and transferred to CPU, including
    GPU tensors and tensors requiring gradients. The input is never modified.
    """
    if headless:
        open_browser = False
    if open_browser is None:
        try:
            from IPython import get_ipython
            notebook = getattr(get_ipython(), "kernel", None) is not None
        except ImportError:
            notebook = False
        open_browser = not (inline or notebook)
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
                if file.suffix.lower() not in FORMATS | MODEL_ASSETS:
                    raise ValueError(f"Unsupported 3D file: {file.name}. Supported: {', '.join(sorted(FORMATS))}")
            if not any(file.suffix.lower() in FORMATS for file in files):
                raise ValueError("Unsupported 3D input: include at least one model with supporting assets")
        else:
            if len(sources) != 1:
                raise ValueError("Pass either file paths or one (N, 3) point array")
            temporary = tempfile.TemporaryDirectory(prefix="viz3d-viewer-")
            try:
                # Rich scenes are serialized once by update(), before opening.
                files = [] if target is not None or vectors is not None else [_points_file(sources[0], colors, Path(temporary.name))]
            except (TypeError, OverflowError) as error:
                raise ValueError("Expected an (N, 3) point array and optional (N, 3) RGB colors") from error
        session = ViewerSession(files, temporary)
        if target is not None or vectors is not None:
            if len(sources) != 1 or isinstance(sources[0], (str, os.PathLike)):
                session.close()
                raise ValueError("target and vectors require point arrays")
            try:
                session.update(sources[0], colors=colors, target=target, vectors=vectors,
                               vector_scale=vector_scale, max_vectors=max_vectors)
            except BaseException:
                session.close()
                raise
    except BaseException:
        if temporary:
            temporary.cleanup()
        raise
    if open_browser:
        try:
            webbrowser.open(session.url)
        except webbrowser.Error:
            pass  # The caller can still use session.url.
    if headless:
        try:
            session.start_headless()
        except Exception:
            session.close()
            raise
    return session


def show_batch(points, *, colors=None, target=None, vectors=None, labels=None,
               vector_scale=1.0, max_vectors=256, inline=False, open_browser=None):
    """Open a batch with a sample selector, using one persistent viewer."""
    if len(points) == 0:
        raise ValueError("batch must not be empty")
    viewer = show(points[0], inline=True, open_browser=False)
    try:
        viewer.update_batch(points, colors=colors, target=target, vectors=vectors,
                            labels=labels, vector_scale=vector_scale, max_vectors=max_vectors)
    except BaseException:
        viewer.close()
        raise
    if open_browser is None:
        try:
            from IPython import get_ipython
            notebook = getattr(get_ipython(), "kernel", None) is not None
        except ImportError:
            notebook = False
        open_browser = not (inline or notebook)
    if open_browser:
        webbrowser.open(viewer.url)
    return viewer
