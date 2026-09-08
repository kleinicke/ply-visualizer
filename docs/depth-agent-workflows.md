# Depth images for Python and agents

The 0.4.0 API accepts explicit calibration derived from nearby files, model
output metadata, or user context. Agents can translate unfamiliar camera formats
into one schema; the viewer does not estimate calibration from image pixels or
recursively scan a directory.

```python
from ply_visualizer import DepthCalibration, show_depth

calibration = DepthCalibration(
    width=640, height=480, fx=525, fy=525, cx=319.5, cy=239.5,
    kind="z", value_scale=0.001,
    sources={"intrinsics": "camera.yaml: K", "encoding": "dataset.md: depth in mm"},
)
view = show_depth(depth, calibration=calibration, rgb=aligned_rgb, inline=True)
view
```

Replace these illustrative values with the input's calibration. `depth` can be
an HxW NumPy array, a real dense PyTorch tensor (CPU/GPU, attached/detached), or
a file. The library copies tensors without modifying them. Standard pip and uv
installation use the same package; to install a development checkout:

```sh
npm run build:python-viewer
uv pip install -e 'packages/python[mcp]'
```

Use `uv pip install -e 'packages/python[notebook]'` for the notebook extras.
Keep the Python session/kernel alive. `session=view` appends while preserving
the camera; this also works with `show_colmap`.

## Encoding and cameras

`kind="z"` means axial depth; `"depth"` means ray range. Both convert samples to
meters as `raw * value_scale + value_offset`. `"inverse_depth"` converts to
axial Z as `1 / (raw * value_scale + value_offset)`. `"disparity"` uses
`Z = fx * baseline / (raw * value_scale + value_offset + disparity_offset)`.
Disparity requires rectified pinhole intrinsics, `image_rectified=True` and a
positive baseline in meters. Relative network outputs need explicit scale/bias
calibration; they are not automatically metric.

Supported camera models reuse the shared Rust camera kernels: ideal/OpenCV
pinhole, equidistant/OpenCV/KB3/624 fisheye and E57
pinhole/spherical/cylindrical. MCP resource `viewer://depth-calibration` lists
coefficient order/counts. Unsupported coefficient counts fail. Rectified inputs
reject nonzero distortion.

Intrinsics must match the raster's width/height exactly. Adjust them explicitly
for crop/resize using the producer's pixel-center convention. Coordinates
default to OpenCV (+X right, +Y down, +Z forward); select OpenGL (+Y up, -Z
forward) when appropriate. Optional `camera_to_world` is an affine column-major
4x4 matrix in that camera convention. The viewer's own camera continues to use
its OpenGL default.

Files: NPY/NPZ, TIFF, raw grayscale/RGB PNG8/16, EXR, PFM and COLMAP dense
binary. For multi-array NPZ choose `array_key`; for multi-channel depth choose
`channel`. RGB must be aligned HxWx3 integer samples 0..255, supplied as a
supported raster or array. JPEG/palette PNG, packed RGB depth encodings,
arbitrary tensor checkpoint loading and cross-camera RGB registration are not
adapters in this API: decode or align those explicitly before passing arrays.
PFM values remain raw; include any producer-specific header magnitude in
value_scale. EXR channel indices refer to the shared decoder's displayed channel
order.

`invalid_values` defaults to `[0]`; nonfinite samples are always removed.
Optional single-channel mask keeps nonzero finite pixels. Confidence must match
resolution and can be filtered with `min_confidence`. min_depth/max_depth filter
converted depth. The result reports source/output counts and projection
failures.

Picks and subset exports retain pixel_u, pixel_v, raw_depth_value, depth_value,
confidence when supplied, and source_row (original row-major pixel index). Full
inspection retains the normalized calibration and its `sources` map.

## COLMAP and MCP

```python
from ply_visualizer import show_colmap
view = show_colmap("dense", image="image1.jpg", variant="geometric", inline=True)
```

The adapter reads `stereo/depth_maps/<image>.<variant>.bin` and the **dense
workspace's** `sparse/cameras` and `sparse/images` in binary or text format. It
uses undistorted pinhole intrinsics, resizes them to the depth map, and inverts
COLMAP's world-to-camera pose. It retains reconstruction units rather than
assuming a metric scale. This follows
[COLMAP's dense workspace and pose conventions](https://colmap.github.io/format.html).

MCP has one additional tool, `open_depth_image`: use `path` plus `calibration`,
or `path=dense_workspace` plus `colmap_image`. Optional scene_id appends; it
opens inline without a separate browser. After submission inspect the scene and
capture it to verify successful conversion. Existing selection, comparison,
measurements and export tools operate on the resulting point cloud.

A distributable companion skill lives at `skills/ply-depth-inspection/SKILL.md`.
It teaches context discovery and translation, with validation checks. Installing
it helps compatible agents choose the workflow; it cannot force every AI/client
to use this viewer. Neither a PyPI release nor a skill is required to test a
locally configured MCP server.
