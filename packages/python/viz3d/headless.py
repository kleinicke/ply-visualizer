"""Offscreen Chromium host for the shared renderer, owned by one scene."""
import threading
from urllib.parse import urlsplit


class HeadlessRenderer:
    def __init__(self, url, *, timeout=60):
        self._stop = threading.Event()
        self._ready = threading.Event()
        self.error = None
        self._thread = threading.Thread(target=self._run, args=(url,), daemon=True)
        self._thread.start()
        if not self._ready.wait(timeout):
            self.close()
            raise TimeoutError('Headless renderer startup timed out')
        if self.error:
            self.close()
            raise RuntimeError(self.error)

    def _run(self, url):
        try:
            from playwright.sync_api import sync_playwright
            with sync_playwright() as playwright:
                browser = playwright.chromium.launch(headless=True, args=[
                    '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
                    '--disable-background-timer-throttling', '--disable-renderer-backgrounding'])
                try:
                    context = browser.new_context(viewport={'width': 1024, 'height': 768})
                    authority = urlsplit(url).netloc
                    def route(request):
                        address = urlsplit(request.request.url)
                        if address.scheme in {'data', 'blob'} or (address.scheme == 'http' and address.netloc == authority):
                            request.continue_()
                        else:
                            request.abort()
                    context.route('**/*', route)
                    page = context.new_page()
                    page.goto(url, wait_until='domcontentloaded', timeout=45000)
                    page.wait_for_function("['loaded','error'].includes(document.documentElement.dataset.localSession)", timeout=45000)
                    error = page.evaluate("document.documentElement.dataset.localSession === 'error'")
                    if error:
                        raise RuntimeError('The shared renderer could not load this scene. Check file format and required model assets.')
                    self._ready.set()
                    while not self._stop.is_set():
                        page.wait_for_timeout(100)
                finally:
                    browser.close()
        except ImportError:
            self.error = 'Install headless rendering: uv tool install "3d-visualizer[mcp,headless]", then uvx --from "3d-visualizer[headless]" playwright install chromium'
        except Exception as error:
            self.error = f'Headless renderer failed: {error}. Run 3d-visualizer doctor --check-headless; install Chromium with playwright install chromium.'
        finally:
            self._ready.set()

    def close(self):
        self._stop.set()
        self._thread.join(timeout=10)
