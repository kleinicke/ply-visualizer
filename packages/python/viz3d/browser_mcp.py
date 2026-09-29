"""Pair a public browser tab with the existing local MCP viewer tools.

The HTTP listener is loopback-only. The MCP protocol itself stays on stdio.
"""
import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import secrets
import threading
import uuid
from urllib.parse import parse_qs, urlencode, urlsplit

from .agent_bridge import BrowserBridge
from .mcp_server import create_server


ALLOWED_ORIGINS = frozenset({
    "https://3d.f-kleinicke.de",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://localhost:8081",
    "http://127.0.0.1:8081",
})
MAX_RESULT_BYTES = 12 * 1024 * 1024
BRIDGE_PORT = 8767


class BrowserTab:
    def __init__(self, scene_id):
        self.scene_id = scene_id
        self._bridge = BrowserBridge(timeout_message="No response from the paired website tab. Keep it open and active, or pair again.")

    def close(self):
        pass


class BrowserTabManager:
    renderer = "inline"
    roots = []

    def __init__(self):
        self.scenes = {}
        self._lock = threading.RLock()
        self.token = None

    def new_website_session(self, source_url=None, filename=None, current_url=None):
        with self._lock:
            self.scenes.clear()
            scene_id = uuid.uuid4().hex
            self.scenes[scene_id] = BrowserTab(scene_id)
            self.token = secrets.token_urlsafe(32)
            query = urlencode({key: value for key, value in
                               (("source", source_url), ("filename", filename)) if value is not None})
            fragment = "#" + urlencode({"agent_scene": scene_id, "agent_token": self.token})
            url = (current_url.split("#", 1)[0] if current_url else
                   "https://3d.f-kleinicke.de/" + (f"?{query}" if query else "")) + fragment
            return {"scene_id": scene_id, "url": url,
                    "fragment": fragment,
                    "connection": "awaiting_renderer",
                    "note": "Navigate the existing viewer tab to this URL to keep its loaded scene. Pass current_url when pairing an already open tab. The fragment is removed after pairing."}

    def get(self, scene_id):
        with self._lock:
            if scene_id not in self.scenes:
                raise ValueError("Unknown scene_id; call pair_3d_website")
            return self.scenes[scene_id]

    def describe(self, scene_id):
        tab = self.get(scene_id)
        return {"scene_id": scene_id, "url": "https://3d.f-kleinicke.de/",
                "connection": tab._bridge.connection(),
                "renderer_id": tab._bridge.renderer_id(),
                "note": "Files remain in the visitor's browser tab."}

    def close(self):
        with self._lock:
            self.token = None
            self.scenes.clear()


def make_handler(manager, port):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass  # Keep stdout reserved for MCP.

        def _allowed(self):
            return (self.headers.get("Origin") in ALLOWED_ORIGINS
                    and self.headers.get("Host") in {f"127.0.0.1:{port}", f"localhost:{port}"})

        def _send(self, status, payload):
            data = json.dumps(payload, separators=(",", ":")).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Access-Control-Allow-Origin", self.headers.get("Origin", ""))
            self.send_header("Vary", "Origin")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def _body(self):
            length = int(self.headers.get("Content-Length", "0"))
            if length < 1 or length > MAX_RESULT_BYTES:
                raise ValueError("Invalid request size")
            value = json.loads(self.rfile.read(length))
            if not isinstance(value, dict):
                raise ValueError("Expected JSON object")
            return value

        def _authorized_tab(self, query):
            token = query.get("token", [None])[0]
            scene_id = query.get("scene_id", [None])[0]
            return bool(token and secrets.compare_digest(token, manager.token or "")
                        and scene_id in manager.scenes)

        def do_OPTIONS(self):
            if not self._allowed():
                self.send_error(403)
                return
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", self.headers["Origin"])
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Access-Control-Allow-Private-Network", "true")
            self.send_header("Vary", "Origin")
            self.end_headers()

        def do_POST(self):
            if not self._allowed():
                self.send_error(403)
                return
            parsed = urlsplit(self.path)
            query = parse_qs(parsed.query)
            try:
                body = self._body()
                if parsed.path == "/result" and self._authorized_tab(query):
                    tab = manager.get(query["scene_id"][0])
                    self._send(200, {"accepted": tab._bridge.receive(body)})
                elif parsed.path == "/unpair" and self._authorized_tab(query):
                    manager.close()
                    self._send(200, {"disconnected": True})
                else:
                    self._send(404, {"error": "Unknown or unauthorised endpoint"})
            except (ValueError, KeyError, json.JSONDecodeError) as error:
                self._send(400, {"error": str(error)})

        def do_GET(self):
            if not self._allowed():
                self.send_error(403)
                return
            parsed = urlsplit(self.path)
            query = parse_qs(parsed.query)
            if parsed.path != "/command" or not self._authorized_tab(query):
                self._send(404, {"error": "Unknown or unauthorised endpoint"})
                return
            tab = manager.get(query["scene_id"][0])
            self._send(200, tab._bridge.pending(query.get("renderer_id", [None])[0]))

    return Handler


def main(argv=None):
    argparse.ArgumentParser(description="Control an agent-opened 3D website tab over stdio MCP").parse_args(argv)
    manager = BrowserTabManager()
    httpd = ThreadingHTTPServer(("127.0.0.1", BRIDGE_PORT), make_handler(manager, BRIDGE_PORT))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    try:
        create_server([], tools="browser", scene_manager=manager).run(transport="stdio")
    finally:
        httpd.shutdown()
        httpd.server_close()


if __name__ == "__main__":
    main()
