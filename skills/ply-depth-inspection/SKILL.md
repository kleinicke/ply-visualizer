---
name: ply-depth-inspection
description:
  Show depth or disparity rasters, stereo-network outputs, and COLMAP dense
  reconstructions as inspectable point clouds using 3D Visualizer MCP or Python.
  Use when the user asks to visualize depth in 3D, including finding calibration
  in accompanying files or context.
---

Translate the user's depth data and accompanying calibration into an explicit
`3d-visualizer` depth job. Prefer the inline MCP viewer when its tools are
available. Otherwise use the Python API in the user's existing environment.

## Calibration discovery

Read parameter files, dataset documentation, notebook variables or code near the
requested input, within the task's scope. Match the camera/image identifier and
processing stage. Do not estimate focal length, baseline, units or distortion
from the pixels. Ask for missing facts that prevent a meaningful reconstruction.
Record the source file/key for each parameter group in `calibration.sources`.

Read `viewer://depth-calibration` before translating a camera model. Map its
coefficient ordering exactly; do not pad an unsupported model into a
superficially similar one. Distinguish axial Z, ray range, rectified pixel
disparity, and inverse axial depth. A model's relative depth output is not
automatically metric depth; unknown affine/scale calibration must remain
explicit.

Intrinsics must describe the exact raster dimensions. Account for crop offset,
resize and the producer's pixel-center convention. Rectified images use their
rectified intrinsics with no distortion applied again. For disparity, establish
left/right direction, pixel scaling, baseline in meters and any principal-point
offset. Declare camera axes and pose direction; `camera_to_world` is
column-major and operates in the declared OpenCV or OpenGL camera coordinates.

## Inline workflow

1. Call `open_depth_image(path=..., calibration=...)`. Its schema exposes the
   calibration fields. Required: width, height, fx, fy, cx, cy, kind. Use
   aligned RGB, mask and confidence files when available. Choose NPZ array_key
   and depth channel explicitly when ambiguous.
2. Keep scene_id. Call `inspect_3d_scene(detail="full")` after loading. Check
   output/source counts, depth calibration, units, projection failures and
   bounds. A submitted job is not proof that rendering succeeded.
3. Capture the view. Check a few picks against original pixels and expected
   dimensions. Selection/export retain pixel_u, pixel_v, raw_depth_value,
   depth_value and source_row = v * width + u.
4. Append another depth job with scene_id when comparing results; this preserves
   the camera. Do not run complex align-all merely to display depth.

For COLMAP, call
`open_depth_image(path=dense_workspace, colmap_image=exact_image_name, colmap_variant="geometric")`.
Choose photometric explicitly if that is the available map. The adapter uses the
dense workspace's undistorted sparse camera and inverse pose. It retains
reconstruction units and does not assume meters. No browser window is needed for
a compatible MCP client.

## Python workflow

```python
from ply_visualizer import DepthCalibration, show_depth, show_colmap

calibration = DepthCalibration(
    width=640, height=480, fx=525, fy=525, cx=319.5, cy=239.5,
    kind="z", value_scale=0.001,
    sources={"intrinsics": "camera.yaml: K", "encoding": "dataset docs: uint16 mm"},
)
view = show_depth(depth_tensor, calibration=calibration, inline=True)
view  # notebook display; keep this session alive
```

Use actual calibration, not the example numbers. Inputs accept HxW NumPy arrays
and real dense PyTorch tensors, including GPU tensors requiring gradients; the
library detaches and transfers them internally. Remove batch/channel-first axes
explicitly according to the producer. Use `session=view` to append comparisons.
`show_colmap(workspace, image=...)` provides the same dense adapter.

For development installations use `uv pip install -e 'packages/python[mcp]'`
from the checkout after building its viewer assets. Do not publish, change the
user's MCP configuration, or install into an unrelated environment just to use
this skill. This skill guides calibration translation; it does not replace the
MCP server or enable inline rendering in a client that lacks MCP Apps support.
