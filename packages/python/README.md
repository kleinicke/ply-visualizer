# 3D Visualizer — Python, CLI and MCP

<!-- mcp-name: io.github.kleinicke/3d-visualizer -->

![Point cloud displayed in the 3D viewer](https://raw.githubusercontent.com/kleinicke/ply-visualizer/main/assets/example.png)

One Python package provides a browser viewer for local 3D files and point
arrays, plus the `ply-viewer` command. Python 3.10+ and a WebGL-capable browser
are required. There are no Python runtime dependencies; NumPy arrays work
without requiring NumPy for users who only open files. Node.js is needed only to
build the bundled viewer from this repository, not to use an installed wheel.

Install the Python package from PyPI as **`ply-visualizer`**. The npm package is
not published. **3D Visualizer** is the product name; the existing package and
Python import retain their names for compatibility. The commands
`3d-visualizer`, `3d-visualizer-mcp` and `3d-visualizer-api` are also available.
`ply-visualizer` is an MCP entry point for registry launchers.

## Install with uv (recommended)

Install [uv](https://docs.astral.sh/uv/getting-started/installation/), then
choose:

```sh
uv add ply-visualizer            # Add to a Python project
uv add "ply-visualizer[notebook]" # Local notebook display support
uv pip install ply-visualizer    # Install into an existing virtual environment
uv tool install ply-visualizer   # Install the CLI independently
uvx --from ply-visualizer ply-viewer scan.ply  # Run without persistent installation
```

The Python import is `from ply_visualizer import show`. Tool installation does
not add the library to a Python project or notebook kernel; use `uv add` or
`uv pip install` in that environment. No Node.js build is needed for PyPI
installs.

For local Jupyter, run `uv run --with jupyter jupyter lab` from your project and
select its Python kernel. Keep that kernel alive while using the viewer.

### AI agents through MCP

Version 0.2.0 adds an optional local MCP server:

```sh
uvx --from "ply-visualizer[mcp]" ply-viewer-mcp --root /absolute/path/to/workspace
```

Configure your agent to launch this command. It can open 3D files or point
arrays, update a scene, inspect rendered geometry, position the camera and
receive PNG screenshots. See [MCP setup and agent instructions](MCP.md). Version
0.3.0 includes an MCP Apps preview for hosts permitting local nested iframes,
with a browser-tab fallback. Version 0.4.0 replaces the nested iframe with
direct in-widget rendering and adds agent controls for navigation, appearance,
measurements, video keyframes, label/region selection with focus previews,
richer picking, named views and overlay opacity. PCD labels are available for
coloring and filtering. Inspection reports coordinate conventions, camera
position/direction/pivot, object transforms and presentation state; updates
reuse the original widget and preserve its camera. Agents can also download
direct HTTP(S) 3D URLs and run automatic alignment, ICP, landmark fitting and
align-all strategies with job status and undo. Inline local Jupyter output is
already supported below.

### Developing from source

From the repository root, build the bundled engine with Node 24:

```sh
npm ci
npm run build:python-viewer
uv tool install ./packages/python
# Or add the local library to your Python project:
uv add /absolute/path/to/ply-visualizer/packages/python
```

See [publishing setup](PUBLISHING.md) for releases.

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

## Training previews

All updates reuse the same browser tab/inline view and preserve its camera. The
viewer polls for the newest revision every 500 ms; intermediate revisions can be
skipped. Publish at a useful training interval, not every forward pass.
Serialization and GPU transfer are synchronous. Updates replace the scene;
manual files added to that scene are also replaced on the next update.

```python
viewer = show(initial_points)

# In your training loop, e.g. every 100 steps:
if step % 100 == 0:
    viewer.update(prediction[0], target=target[0], step=step)
```

Prediction is orange and target cyan. Supply `colors=` to override prediction
RGB. Targets may have a different number of points. This is a geometric overlay,
not a computed nearest-neighbor error metric. Visibility can be toggled in the
standard file panel. Use **Pause updates** to inspect one revision and **Fit
scene** to reset the framing explicitly.

### Batch and augmentation inspection

```python
from ply_visualizer import show_batch

viewer = show_batch(batch, target=target_batch)
viewer.update_batch(next_batch, target=next_targets, step=step)

# A list of differently sized point arrays also works:
viewer = show_batch([original, augmented], labels=["Original", "Augmented"])
```

The sample selector switches batches in one scene and retains the camera.
Colors, targets, and vectors (when supplied) must match the batch size. Batch
snapshots serialize every sample; select a small inspection subset for large
training batches. Only the chosen sample is loaded by the browser.

### Gradient and displacement arrows

```python
# After loss.backward(); non-leaf predictions need retain_grad() beforehand.
viewer.update(
    points,
    vectors=points.grad,
    vector_scale=-learning_rate,
    max_vectors=256,
    step=step,
)
```

Arrows are anchored at the corresponding input points. Negative learning-rate
scaling shows a plain gradient-descent direction; it is not an exact Adam or
momentum optimizer step. To inspect the actual update, pass measured coordinate
displacements instead. Nonzero arrows are magenta. Up to `max_vectors` evenly
spaced vectors are displayed (default 256, maximum 2000). All supplied vector
rows are validated; no autograd hooks or gradient computation are installed by
this operation.

### Layer inspection with a removable forward hook

```python
viewer = show(initial_points)
with viewer.inspect_layer(model, select=lambda output: output[0], every=100):
    train(model)
```

For dictionary outputs use a selector such as
`lambda output: output["points"][0]`. The selector must return `(N, 3)`
coordinates, not arbitrary feature channels. The hook captures the first forward
call and then every `every` calls. It returns `None`, preserving the model's
output. A visualization error disables the hook, emits a warning and is
accessible as `inspection.error`; it does not invalidate training. The context
manager removes the hook, while the caller owns the viewer session's lifetime.
`inspection.close()` also removes it explicitly.

Run viewer updates in the main process, on one rank in distributed training, and
outside compiled model code. GPU-to-CPU transfer introduces synchronization.
[PyTorch forward hooks](https://docs.pytorch.org/docs/stable/generated/torch.nn.Module.html#torch.nn.Module.register_forward_hook).

The server binds only to `127.0.0.1`, uses a random session URL, and serves only
the explicitly supplied files and bundled viewer assets. Source files remain on
your machine; the package does not upload them. Keep file paths available for
the life of the session. Do not share the session URL with untrusted code.

## Inline Jupyter notebooks

In a **local** Jupyter notebook, return the viewer as the last expression in a
cell. Browser auto-opening is disabled when a notebook kernel is detected:

```python
viewer = show(points)
viewer  # Interactive viewer appears in the output cell.
```

Or display explicitly, using the notebook extra:

```python
viewer.display(height=480, ui="collapsed")
```

Settings are collapsed by default. A compact toolbar keeps **Settings**, **Fit
scene**, **Pause updates**, and the batch selector accessible. Choose
`ui="full"` to show settings immediately or `ui="none"` for a presentation-only
canvas with mouse controls. In UI-free mode, batch selection is unavailable;
choose the sample in Python before displaying it.

`viewer.update(...)` updates every open view, including notebook output. Keep
the kernel running, call `viewer.close()` when done, and do not call
`viewer.wait()` in a cell. Notebook output contains a live local iframe, not an
offline saved scene. Reopen the session after restarting the kernel.

This initial inline transport requires the browser and kernel on the same
machine and a notebook host that permits local iframes. Remote Jupyter, Colab,
and notebook environments that block local iframe URLs need a widget/proxy
transport; they are not supported by this transport yet.

For a mature widget-based alternative, [K3D](https://k3d-jupyter.org/) supports
notebook point clouds and other 3D primitives.
[Rerun](https://rerun.io/examples/feature-showcase/notebook_viewer) is worth
considering for recorded, time-based diagnostics. This package embeds the
existing 3D viewer to retain its file formats and interaction controls.

## Current scope

- Supported inputs: PLY, XYZ, XYZN, XYZRGB, PCD, PTS, OBJ, STL, OFF, GLB,
  LAS/LAZ, E57, SPZ, SPLAT, KSPLAT, and SOG.
- Multiple files appear together in one scene.
- OBJ input currently provides geometry; automatic sidecar material/texture
  resolution and external-resource glTF are outside this preview.
- No separate image-viewer integration, headless rendering, or desktop launch
  integration yet. The shared 3D viewer retains its existing manual controls and
  depth-conversion features.

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

## Available platforms

- **VS Code Marketplace:**
  [Install extension](https://marketplace.visualstudio.com/items?itemName=kleinicke.ply-visualizer)
- **Open VSX:**
  [Install extension](https://open-vsx.org/extension/kleinicke/ply-visualizer)
- **Website:** [3d.f-kleinicke.de](https://3d.f-kleinicke.de/)
- **PyPI (Python and CLI):**
  [ply-visualizer](https://pypi.org/project/ply-visualizer/)
- **JetBrains:**
  [Signed preview and installation](https://github.com/kleinicke/ply-visualizer/blob/main/jetbrains/README.md)
- **Standalone app:**
  [Tauri desktop preview](https://github.com/kleinicke/ply-visualizer/blob/main/apps/desktop/README.md)

**MCP is supported:** agents can open and update 3D scenes, control the camera,
and inspect rendered screenshots. See the
[MCP setup guide](https://github.com/kleinicke/ply-visualizer/blob/main/packages/python/MCP.md).
