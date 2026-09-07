"""Bounded request/reply bridge to a running browser viewer."""
import threading
import uuid


class BrowserBridge:
    def __init__(self):
        self._serial = threading.Lock()
        self._condition = threading.Condition()
        self._pending = None
        self._result = None

    def request(self, operation, arguments=None, timeout=15):
        with self._serial:
            with self._condition:
                self._pending = {"id": uuid.uuid4().hex, "operation": operation, "arguments": arguments or {}}
                self._result = None
                try:
                    if not self._condition.wait_for(lambda: self._result is not None, timeout):
                        raise TimeoutError("No browser response. Open the scene URL in a local browser, keep the tab active, and retry.")
                    result = self._result
                    if "error" in result:
                        raise RuntimeError(result["error"])
                    return result["result"]
                finally:
                    self._pending = None
                    self._result = None

    def pending(self):
        with self._condition:
            return self._pending

    def receive(self, value):
        with self._condition:
            if not isinstance(value, dict) or self._pending is None or self._result is not None or value.get("id") != self._pending["id"]:
                return False
            if not ("result" in value or isinstance(value.get("error"), str)):
                return False
            self._result = value
            self._condition.notify_all()
            return True
