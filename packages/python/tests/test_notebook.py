"""Execute a real kernel; browser iframe interaction is covered by Playwright."""
import importlib.util
from pathlib import Path
import sys
import tempfile
import unittest


@unittest.skipUnless(all(importlib.util.find_spec(name) for name in ("nbclient", "ipykernel")), "Notebook test dependencies are not installed")
class NotebookTests(unittest.TestCase):
    def test_local_notebook_rich_display_and_update(self):
        import nbformat
        from nbclient import NotebookClient
        from jupyter_client import KernelManager

        package = str(Path(__file__).resolve().parents[1])
        notebook = nbformat.v4.new_notebook(cells=[
            nbformat.v4.new_code_cell(f"""
import sys, json, webbrowser
from urllib.request import urlopen
sys.path.insert(0, {package!r})
from viz3d import show
def unexpected_browser(*args):
    raise AssertionError('Notebook should not open a browser tab')
webbrowser.open = unexpected_browser
viewer = show([[0,0,0],[1,0,0],[0,1,0]])
viewer
"""),
            nbformat.v4.new_code_cell("""
viewer.update([[0,0,0],[2,0,0]], step=10)
with urlopen(viewer.url + 'session.json') as response:
    assert json.load(response)['step'] == 10
viewer.display(height=320, ui='full')
"""),
            nbformat.v4.new_code_cell("viewer.close()"),
        ])
        manager = KernelManager(kernel_name="python3")
        manager.kernel_spec.argv = [sys.executable, "-m", "ipykernel_launcher", "-f", "{connection_file}"]
        with tempfile.TemporaryDirectory() as directory:
            try:
                NotebookClient(notebook, km=manager, timeout=60, resources={"metadata": {"path": directory}}).execute()
            finally:
                if manager.has_kernel:
                    manager.shutdown_kernel(now=True)
        first = notebook.cells[0].outputs[-1]["data"]["text/html"]
        self.assertIn("<iframe", first)
        self.assertIn("?ui=collapsed", first)
        second = notebook.cells[1].outputs[-1]["data"]["text/html"]
        self.assertIn('height="320"', second)
        self.assertIn("?ui=full", second)


if __name__ == "__main__":
    unittest.main()
