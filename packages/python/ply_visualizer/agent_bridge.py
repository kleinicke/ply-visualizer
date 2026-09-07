"""Bounded request/reply bridge to a running browser viewer."""
import threading
import uuid
import time


class RendererError(RuntimeError):
    """An actionable error returned by the renderer."""


class BrowserBridge:
    def __init__(self):
        self._serial = threading.Lock()
        self._condition = threading.Condition()
        self._pending = None
        self._result = None
        self._last_seen = None
        self._renderer_id = None

    def request(self, operation, arguments=None, timeout=15):
        with self._serial:
            with self._condition:
                self._pending = {"id": uuid.uuid4().hex, "operation": operation, "arguments": arguments or {}}
                self._result = None
                try:
                    if not self._condition.wait_for(lambda: self._result is not None, timeout):
                        raise TimeoutError("No renderer response. Keep the inline MCP viewer active and check client support for app-to-server tools and WebAssembly. A browser can be opened explicitly as a fallback.")
                    result = self._result
                    if "error" in result:
                        raise RendererError(result["error"])
                    return result["result"]
                finally:
                    self._pending = None
                    self._result = None

    def pending(self, renderer_id=None):
        with self._condition:
            now = time.monotonic()
            if self._renderer_id is not None and renderer_id != self._renderer_id and self._last_seen is not None and now - self._last_seen < 10:
                return None
            self._renderer_id = renderer_id
            self._last_seen = now
            return self._pending

    def renderer_id(self):
        with self._condition:
            return self._renderer_id

    def connection(self):
        with self._condition:
            if self._last_seen is None:
                return "awaiting_renderer"
            return "connected" if time.monotonic() - self._last_seen < 10 else "disconnected"

    def receive(self, value):
        with self._condition:
            if not isinstance(value, dict) or self._pending is None or self._result is not None or value.get("id") != self._pending["id"]:
                return False
            if self._renderer_id is not None and value.get("renderer_id") != self._renderer_id:
                return False
            if not ("result" in value or isinstance(value.get("error"), str)):
                return False
            self._result = value
            self._condition.notify_all()
            return True
