# Viewer features and workflows

Start with [opening a file](getting-started.md). The features below belong to
the shared viewer; host-specific commands and input restrictions are described
in the [VS Code reference](vscode-commands.md),
[Python guide](../packages/python/README.md), and [MCP guide](mcp-workflows.md).

## Feature map

| Task                                                                         | Where to start                                       |
| ---------------------------------------------------------------------------- | ---------------------------------------------------- |
| Show or compare loaded objects                                               | Files panel and per-file visibility                  |
| Inspect surfaces, wireframes, points, or normals                             | Per-file display buttons, where available            |
| Inspect RGB, intensity, or numeric labels                                    | Per-file Color selector                              |
| Adjust position, rotation, or scale                                          | Per-file Transform section                           |
| Change viewpoint and rotation center                                         | Camera and Controls tabs; double-click geometry      |
| Measure a distance or path                                                   | Shift-double-click visible geometry                  |
| Convert a depth or disparity image                                           | Depth settings and camera parameters                 |
| Register overlapping scans                                                   | Tools → Align point clouds                           |
| Play a model's animation clips                                               | [Model animation controls](models-and-animations.md) |
| Play a series of point-cloud files                                           | VS Code's Play Point Cloud Sequence command          |
| Record a camera path                                                         | Camera keyframes and recording controls              |
| Inspect point subsets, compare distances, or export selections with an agent | [MCP workflows](mcp-workflows.md)                    |

## Geometry and colors

Use the display buttons in a file's panel. Point clouds provide point rendering;
meshes can additionally offer surfaces, wireframes, and normals. Native scene
models retain their materials and offer mesh/wireframe controls. A point cloud
with no faces cannot become a surface merely by choosing a mesh mode.

The Color selector lists what is present in the loaded data: original RGB,
assigned colors, intensity, or numeric scalar fields. Select an attribute and a
color mapping to inspect its distribution. Numeric segmentation labels identify
stored categories; the viewer does not infer their semantic names.

Adjust point size to fill gaps or expose individual samples. Slider controls
reset on double-click; their tooltips describe the reset value. Eye-Dome
Lighting defaults to Auto; **E** cycles Auto, All, and Off. Brightness and gamma
controls affect presentation, so check these before interpreting unusually dark
or bright source colors.

## Multiple objects and transforms

Add the files you want to inspect together. Toggle individual visibility, or
Shift-click a checkbox to isolate one object and repeat to restore the group.
Assign contrasting colors when inspecting overlapping clouds.

Expand **Transform** to edit an object's pose. Matrix input in the settings UI
uses row-major order; quaternion and angle-axis inputs are also available.
Transforms affect the displayed object. Verify the resulting position and scale
before exporting or using it for alignment.

MCP matrix arguments use **column-major** order, so transpose a matrix copied
from the settings UI. The [MCP tool reference](mcp-tools.md#transform-3d-object)
describes transform composition and replacement.

## Camera and measurement

Use the selected control scheme to rotate, pan, and zoom; the **Controls** tab
shows its bindings. Double-click geometry to put the rotation center on a
specific feature, making close inspection easier. Use the camera controls for
explicit camera position and rotation-center coordinates.

Shift-double-click visible points to build measurement paths. Use the
measurement controls to undo points, close a path, or clear measurements.
Distances are in scene units. Do not interpret a distance as meters unless the
source scale is known.

## Depth and disparity

1. Open a supported depth image or use its VS Code conversion command.
2. Set the image's camera model and intrinsics, including focal lengths and
   principal point where applicable.
3. Choose the correct depth/disparity interpretation, coordinate convention, and
   scale or bias for the source data.
4. Inspect the projected cloud. Return to the parameters if the shape or scale
   is wrong; decoding an image does not establish its calibration.

Depth inputs include TIFF, PNG, PFM, NPY/NPZ, and EXR. Supported camera options
include pinhole and fisheye variants. A normal color photograph is not a depth
map; this workflow does not estimate depth from RGB.

## Alignment

Load overlapping point clouds, then open **Tools → Align point clouds**. Choose
an anchor and the alignment/refinement workflow. Scene-wide operations work
across the loaded clouds; the per-file registration panel supports correcting a
single pair using automatic alignment, ICP, or picked correspondences.

ICP works best when the initial poses are already close. Correspondences need
matching landmarks on the two clouds. Inspect the overlap after alignment and
check per-cloud outcomes before accepting a multi-cloud result. The
[MCP alignment workflow](mcp-workflows.md#align-and-compare-clouds) explains the
agent interface and its job-status behavior.

## Splats, volumes, and reconstruction data

Gaussian splat files offer a **Splats** display mode. A 3DGS PLY can also be
inspected as colored points. SPZ, SPLAT, KSPLAT, and SOG containers use the
splat renderer. Point-cloud tools do not imply access to every splat parameter.

Volume inputs have their own controls for presentation and slicing. In VS Code,
**Open DICOM Folder as Volume** opens a series from a directory. **Open COLMAP
Reconstruction** opens reconstruction data through its dedicated command. These
are distinct workflows from projecting a single depth image.

## Three kinds of playback

- **Model animation:** play clips stored in GLTF/GLB, FBX, or Collada files. See
  [models and animations](models-and-animations.md).
- **Point-cloud sequence:** use VS Code's **Play Point Cloud Sequence
  (Wildcard)** command to select a file sequence, then use its playback
  controls.
- **Camera path:** add camera keyframes, move to another viewpoint, and add
  more. Set travel/dwell times and loop behavior, preview the path, then use the
  recording controls to export a video in the available browser format.

MCP's `control_3d_video` manages camera-keyframe previews. It does not export
video or control a model's embedded animation clips.

## Automation and repeatable inspection

The Python API opens files or point arrays, supports local notebooks, and can
update training previews while retaining the camera. See the
[Python guide](../packages/python/README.md) for batches, target overlays,
vector arrows, and removable layer-inspection hooks.

MCP adds programmatic inspection, picking, measurements, selections, saved scene
states, comparisons, and subset export. These capabilities have explicit tool
arguments rather than requiring an agent to manipulate the viewer's settings
panel. Start with the [task walkthroughs](mcp-workflows.md).
