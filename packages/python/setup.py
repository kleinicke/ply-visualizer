"""Fail packaging early if the shared engine has not been built."""
from pathlib import Path

from setuptools import setup
from setuptools.command.build_py import build_py


class BuildViewer(build_py):
    def run(self):
        assets = Path(__file__).parent / "viz3d" / "_assets"
        if not all((assets / name).is_file() for name in ("index.html", "bundle.js", "bundle.css")):
            raise RuntimeError("Build the viewer first: npm run build:python-viewer")
        super().run()


setup(cmdclass={"build_py": BuildViewer})
