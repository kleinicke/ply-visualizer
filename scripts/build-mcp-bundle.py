"""Build the local MCPB distribution from an explicit file allowlist."""
import argparse
import json
from pathlib import Path
import tomllib
import zipfile

root = Path(__file__).resolve().parents[1]
bundle = root / "packages/mcpb"
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--out", type=Path, required=True)
args = parser.parse_args()
version = tomllib.loads((root / "packages/python/pyproject.toml").read_text())["project"]["version"]
manifest = json.loads((bundle / "manifest.json").read_text())
project = tomllib.loads((bundle / "pyproject.toml").read_text())["project"]
if manifest["version"] != version or project["dependencies"] != [f"3d-visualizer[mcp]=={version}"]:
    raise SystemExit("MCPB metadata must match the Python release version")
args.out.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(args.out, "w", zipfile.ZIP_DEFLATED) as archive:
    for name in ["manifest.json", "pyproject.toml", "src/server.py", "README.md"]:
        archive.write(bundle / name, name)
    archive.write(root / "icon.png", "icon.png")
    archive.write(root / "LICENSE", "LICENSE")
print(args.out)
