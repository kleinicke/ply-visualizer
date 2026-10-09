"""Static server for the Playwright suite: `python3 -m http.server` over dist/.

The stock server listens with a backlog of five connections. Parallel test
workers each open a page that fetches the bundle, stylesheet and WASM glue at
once, the backlog overflows, and the OS resets connections - a test then
fails because bundle.js never loaded, which looked like a flaky spec.
"""

import functools
import http.server
import socket
import sys
from pathlib import Path


class Server(http.server.ThreadingHTTPServer):
    request_queue_size = 256


class DualStackServer(Server):
    # Like the stock server: "localhost" may resolve to ::1.
    address_family = socket.AF_INET6

    def server_bind(self) -> None:
        self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        super().server_bind()


class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args: object) -> None:  # noqa: A002
        pass  # a line per request buries the test report


def main() -> None:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8001
    root = Path(__file__).resolve().parent.parent / "dist"
    handler = functools.partial(Handler, directory=str(root))
    try:
        server = DualStackServer(("::", port), handler)
    except OSError:  # no IPv6 on this host (some CI containers)
        server = Server(("", port), handler)
    with server:
        server.serve_forever()


if __name__ == "__main__":
    main()
