# Python and CLI preview — 3D viewer

One Python package provides a browser viewer for local 3D files and point
arrays, plus the `ply-viewer` command. Python 3.10+ and a WebGL-capable browser
are required. There are no Python runtime dependencies; NumPy arrays work
without requiring NumPy for users who only open files. Node.js is needed only to
build the bundled viewer from this repository, not to use an installed wheel.

This is a local preview, **not yet published on PyPI or npm**.

## Install with uv (recommended)

Install [uv](https://docs.astral.sh/uv/getting-started/installation/) first.
Until there is a public release, use this repository or a locally built wheel.
From the repository root, build the browser assets using Node 24:

```sh
npm ci
npm run build:python-viewer
```

### CLI only

For occasional use, run the local package in an isolated tool environment:

```sh
uvx --from ./packages/python ply-viewer engine/examples/example-point-cloud.ply
```

For regular use, install its command persistently:

```sh
uv tool install ./packages/python
ply-viewer scan.ply
```

If uv reports that its executable directory is missing from PATH, run
`uv tool update-shell` and restart your shell. Tool installation makes the CLI
available, but does not add `ply_visualizer` to your Python project or notebook
kernel. [uv tools guide](https://docs.astral.sh/uv/guides/tools/).

### Python and local Jupyter notebooks

For an existing uv-managed Python project, add the built local package from that
project's directory (replace the path with your checkout location):

```sh
uv add /absolute/path/to/ply-visualizer/packages/python
uv run --with jupyter jupyter lab
```

Choose the kernel using that project's environment. Then a notebook cell can run
`from ply_visualizer import show`. The viewer opens in a separate browser tab;
keep the kernel running. NumPy and PyTorch stay optional: use the versions
already installed in your project, or add them as needed.
[uv Jupyter guide](https://docs.astral.sh/uv/guides/integration/jupyter/).

For a virtual environment without uv project management, from this repository:

```sh
# Create this environment only if it does not already exist.
uv venv packages/python/.venv
uv pip install --python packages/python/.venv ./packages/python
packages/python/.venv/bin/ply-viewer engine/examples/example-point-cloud.ply
```

For notebooks in that environment, install JupyterLab into the same environment
and launch it directly:

```sh
uv pip install --python packages/python/.venv jupyterlab
packages/python/.venv/bin/jupyter lab
```

### Installing a wheel

A wheel already contains the viewer assets and needs no Node.js build:

```sh
# CLI only:
uv tool install /path/to/ply_visualizer-0.1.0-py3-none-any.whl
# Or, from a uv-managed Python project:
uv add /path/to/ply_visualizer-0.1.0-py3-none-any.whl
```

### Public package direction

The intended distribution is a public PyPI package with the browser assets
bundled. uv installs from PyPI; no separate uv marketplace is needed. The
current distribution name is `ply-visualizer`, its Python import is
`ply_visualizer`, and its command is `ply-viewer`.

If the project is released under the proposed PyPI name **`3d-visualizer`**, the
installation commands would be:

```sh
# Future release examples, not installation commands for the current preview:
uv add 3d-visualizer           # Dependency in a uv-managed Python project
uv pip install 3d-visualizer   # Into an existing virtual environment
uv tool install 3d-visualizer # Isolated CLI installation
uvx --from 3d-visualizer ply-viewer scan.ply # One-off CLI use
```

That name has not been reserved or configured in this package. A public release
requires choosing an available PyPI name and publishing the built distribution.
The installation name can differ from the Python import name; imports cannot use
`3d-visualizer` as a Python identifier. The existing `ply_visualizer` import can
remain compatible even if the distribution is renamed.
[Python packaging names](https://packaging.python.org/en/latest/discussions/distribution-package-vs-import-package/).

## Alternative: install with pip from this repository

After building the browser assets above:

```sh
python3 -m venv packages/python/.venv
packages/python/.venv/bin/python -m pip install ./packages/python
packages/python/.venv/bin/ply-viewer engine/examples/example-point-cloud.ply
```

On Windows, replace the environment's `bin/` paths with `Scripts/`, e.g.
`packages\python\.venv\Scripts\python.exe`, `ply-viewer.exe`, or `jupyter.exe`.
After activating the environment, the command is simply:

```sh
ply-viewer scan.ply mesh.stl
ply-viewer --no-browser scan.ply
python -m ply_visualizer scan.ply
```

The command prints a local URL and keeps running until Ctrl+C. `--no-browser`
allows an agent or another application to open that URL itself. It does not
render an image or report successful browser rendering to the caller.

## Python

```python
from ply_visualizer import show

# In an interactive Python session or local notebook:
viewer = show("scan.ply", "mesh.stl")
print(viewer.url)
# Later:
viewer.close()
```

```python
from ply_visualizer import show

# Lists, iterables, NumPy arrays, and PyTorch tensors with shape (N, 3) work.
points = [[0, 0, 0], [1, 0, 0], [0, 1, 0]]
colors = [[255, 0, 0], [0, 255, 0], [0, 0, 255]]

# In a script, keep Python alive while the viewer is in use.
with show(points, colors=colors) as viewer:
    print(viewer.url)
    try:
        viewer.wait()
    except KeyboardInterrupt:
        pass
```

Coordinates must be finite float32-compatible numbers. Optional colors must
match the point count and contain integer RGB values in 0..255. Point arrays are
serialized to a temporary binary PLY, decoded by the existing engine, and
removed when the session closes. This first implementation serializes arrays row
by row; it is not a zero-copy transport for very large arrays.

## NumPy and PyTorch

Pass arrays and tensors directly, including RGB colors:

```python
import numpy as np
from ply_visualizer import show

viewer = show(np.random.default_rng(0).normal(size=(1000, 3)))
```

```python
import torch
from ply_visualizer import show

device = "cuda" if torch.cuda.is_available() else (
    "mps" if torch.backends.mps.is_available() else "cpu"
)
points = torch.randn(1000, 3, device=device, requires_grad=True)
rgb = torch.randint(0, 256, (1000, 3), device=device, dtype=torch.uint8)
viewer = show(points, colors=rgb)
# No manual .detach(), .cpu(), or .numpy() needed.
# Keep Python alive and call viewer.close() when finished.
```

- NumPy arrays can be transposed, sliced, read-only, or non-contiguous.
- PyTorch inputs can be CPU or GPU tensors, detached or attached to autograd.
  Both coordinates and colors are handled independently, so mixing devices or
  NumPy/PyTorch inputs works. Float16 and bfloat16 tensors are supported.
- Visualization detaches internally, transfers to CPU, and serializes a
  snapshot. The original device, values, `requires_grad`, and autograd graph are
  unchanged. GPU-to-CPU transfer synchronizes; avoid calling this every training
  step.
- PyTorch conversion does not depend on NumPy. CPU rows are converted in bounded
  chunks rather than performing a GPU scalar read for every coordinate.
- Inputs must be real, dense `(N, 3)` data. For `(B, N, 3)` batches, use
  `show(batch[0])`; batches are deliberately not flattened automatically.
  Sparse, quantized, complex, nested, and data-free meta tensors are rejected
  with an error. RGB retains the integer-valued 0..255 convention, including
  floating-point tensors; normalized RGB can be passed as `(rgb * 255).round()`.

### Inspect a model output using a forward hook

For a module producing `(B, N, 3)`, this opens its first batch once. The hook
returns `None`, so it does not replace the model output. Remove the hook when
done and keep the session alive as long as you need the browser:

```python
session = None

def inspect_once(module, inputs, output):
    global session
    if session is None:
        session = show(output[0])

handle = model.register_forward_hook(inspect_once)
try:
    prediction = model(batch)
finally:
    handle.remove()

# Continue training normally; later call session.close().
```

For tuple/dict outputs, select the tensor explicitly, such as
`show(output["points"][0])`. Run visualization in the main process and, in
distributed training, on one rank only. Keep browser/server operations outside
compiled model code.
[PyTorch forward hook documentation](https://docs.pytorch.org/docs/stable/generated/torch.nn.Module.html#torch.nn.Module.register_forward_hook).

Useful future additions (not implemented yet): a persistent
`session.update(...)` that preserves the camera; a batch selector;
prediction/target overlays; scalar coloring for labels, confidence or per-point
error; and gradient/displacement arrows anchored at point positions. A training
callback could publish these at a configurable interval instead of opening tabs
from every forward pass.

The server binds only to `127.0.0.1`, uses a random session URL, and serves only
the explicitly supplied files and bundled viewer assets. Source files remain on
your machine; the package does not upload them. Keep file paths available for
the life of the session. Do not share the session URL with untrusted code.

## Current scope

In a **local Jupyter notebook**, use `viewer = show(points)` in a cell and keep
the kernel running. It opens a separate browser tab; `viewer.close()` releases
the session when you are done. To open the link yourself, use
`viewer = show(points, open_browser=False)` and inspect `viewer.url`. Do not
call `viewer.wait()` in a notebook cell, since it blocks that cell. Use the
notebook kernel's Python environment when installing the package. Remote
notebooks (including Colab) need a separate proxy/transport integration and are
not supported by this loopback-only preview.

- Supported inputs: PLY, XYZ, XYZN, XYZRGB, PCD, PTS, OBJ, STL, OFF, GLB,
  LAS/LAZ, E57, SPZ, SPLAT, KSPLAT, and SOG.
- Multiple files appear together in one scene.
- OBJ input currently provides geometry; automatic sidecar material/texture
  resolution and external-resource glTF are outside this preview.
- Opens a browser tab, including when called from a notebook. Inline notebook
  widgets and remote notebook servers are not implemented yet.
- No separate image-viewer integration, MCP tools, scene editing API, headless
  capture, or desktop launch integration yet. The shared 3D viewer retains its
  existing manual controls and depth-conversion features.

## Build a distributable wheel

```sh
npm run build:python-viewer
packages/python/.venv/bin/python -m pip wheel --no-deps ./packages/python --wheel-dir /tmp/ply-viewer-wheels
```

The wheel includes the browser engine and its assets. Install that wheel on
another machine with `python -m pip install /path/to/the.whl`; no Node.js or
Tauri installation is necessary there. Build assets before packaging.

## Verify

```sh
npm run test:python-viewer
# Also test actual NumPy/PyTorch inputs in the isolated environment:
packages/python/.venv/bin/python -m pip install numpy torch
packages/python/.venv/bin/python -m unittest discover -s packages/python/tests -v
cd engine
npx playwright test local-session.spec.ts --reporter=line
```

The browser test requires `npm run build:python-viewer` and the existing engine
test server assets in `engine/dist` (`npm run build --workspace=engine`). Array
tests skip optional libraries and GPU backends that are unavailable.
