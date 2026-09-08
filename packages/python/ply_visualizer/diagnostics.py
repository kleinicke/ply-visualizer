"""Identify running Python code separately from the bundled renderer."""
from functools import lru_cache
import hashlib
import json
from pathlib import Path

VERSION = "0.4.0"

@lru_cache(maxsize=1)
def build_info():
    package = Path(__file__).parent
    file = package / "_mcp_app" / "build-info.json"
    renderer = json.loads(file.read_text()) if file.is_file() else {}
    digest = hashlib.sha256()
    for source in sorted(package.glob("*.py")):
        digest.update(source.name.encode())
        digest.update(source.read_bytes())
    return {"package_version": VERSION, "server_build_id": digest.hexdigest()[:20],
            "renderer_bundle": renderer}

# Capture the code loaded by this process, not later edits to the checkout.
build_info()
