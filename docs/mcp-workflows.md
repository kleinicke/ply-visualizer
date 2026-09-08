# MCP workflows

These workflows describe the current development checkout, including inspection
tools that may be absent from an older installed release. Follow the
[setup guide](../packages/python/MCP.md) to connect the server. Check the
client's available tools, and use the [tool reference](mcp-tools.md) for exact
arguments.

The examples below use Python-like notation to describe MCP calls. They are
instructions for an agent or MCP client, not importable Python functions.
Replace `scene_id` with the ID returned when opening your scene, and obtain
object indices and attribute names from inspection.

## Open, inspect, and capture

1. Call `open_3d_files(paths=["scan.pcd"])` for local files under a configured
   root, or `open_3d_url(url="https://…/scan.pcd")` for a direct remote file.
   `visualize_points(points=...)` accepts up to 20,000 XYZ points; use a file
   for larger inputs.
2. Keep the returned `scene_id`. An open response submits the scene; it does not
   prove successful decoding or rendering.
3. Call `inspect_3d_scene(scene_id=scene_id)`. Compare `rendered_revision` with
   the submitted revision and review object counts, bounds, and available
   colors.
4. Call `capture_3d_view(scene_id=scene_id)` to see the actual result.

A live MCP widget or explicit browser fallback must respond. A connected server
alone cannot render headlessly. `list_3d_scenes()` reports scene connection
status. `close_3d_scene(scene_id=scene_id)` releases temporary data and the
local server without deleting source files.

## Find a useful viewpoint

```python
preview_3d_views(scene_id=scene_id, presets=["front", "top", "isometric"])
navigate_3d_view(scene_id=scene_id, action="preset", preset="isometric")
manage_3d_views(scene_id=scene_id, action="save", name="overview")
```

The preview returns a labeled multi-view image and preserves the original
camera. Disable split comparison before using it. Standard views assume Y-up;
inspection reports actual coordinate conventions and camera vectors.

Use `navigate_3d_view` to orbit, pan, zoom, or change the pivot. Use
`set_3d_camera` when you know an explicit position, target, or FOV. Camera
bookmarks restore the camera only. Use scene states for a complete inspection
setup.

## Inspect a labeled region

1. Inspect `attributes` with `detail="full"`, or pick a visible point with
   `pick_3d_point(scene_id=scene_id, screen=[0.5, 0.5])` and read its
   attributes. Screen coordinates range from zero to one, with the origin at top
   left.
2. Discover the actual label field and values. Numeric label `2` does not mean
   “box” unless the dataset defines it that way.
3. Select the region, inspect the preview, and save it if useful:

```python
select_3d_region(scene_id=scene_id, object_index=0, field="label", values=[2])
manage_3d_selections(scene_id=scene_id, action="save", name="region-a")
```

Selection defaults isolate, highlight, and focus the matching points. Set
`highlight=False` to preserve their original colors. An optional
world-coordinate box or plane intersects the attribute condition; the plane
retains points with `a*x+b*y+c*z+d >= 0`. With no condition, the whole
point-cloud object is selected. A zero-match request preserves the previous
selection.

Save another subset as `region-b`, then combine named subsets from the same
source:

```python
manage_3d_selections(scene_id=scene_id, action="union", name="region-a", other="region-b")
manage_3d_selections(scene_id=scene_id, action="save", name="combined")
```

`intersection` and `subtract` work similarly. Combining produces an active
selection; save it to retain the result. Up to 20 named subsets can be retained.
Use `action="activate"` to revisit one, or `action="visible"` with a boolean to
toggle its visibility. Clear the active temporary selection with
`select_3d_region(scene_id=scene_id, action="clear")`.

Geometry replacement expires selections. Region selection operates on point
clouds; use object visibility for meshes.

## Color and measure

Read `available_color_modes` before choosing a scalar field or palette. For
example, if inspection lists this mode:

```python
set_3d_object(scene_id=scene_id, object_index=0, color_mode="scalar:label:colors")
set_3d_object(scene_id=scene_id, object_index=0, point_size_mode="adaptive")
set_3d_appearance(scene_id=scene_id, legend=True, grid=True)
```

Use fixed `point_size` when you know the desired size in world units. Do not
combine it with adaptive sizing. Set `color="#ff8800"` for a uniform color, or
`opacity=0.5` to inspect an overlay; fixed color and `color_mode` are
alternatives. Enabled legends and grids are included in agent PNG captures, with
comparison mode using its own presentation.

Pick the two endpoints and use their returned world coordinates in
`measure_3d_scene(action="distance", start=..., end=...)`. Append points with
`action="path_point", end=...` for a path. Measurements use scene units; the
viewer does not infer meters. Decoded point indices can differ from source rows;
use the reported provenance when available.

## Align and compare clouds

Open two files together and inspect their indices. Clear temporary selections
before alignment. In this example object 1 moves and object 0 remains fixed:

```python
align_3d_clouds(scene_id=scene_id, action="auto", source_index=1, target_index=0, up_axis="z")
align_3d_clouds(scene_id=scene_id, action="status")
```

Use the data's actual up axis. Poll status until the job is `completed` or
`failed`; submission does not mean alignment succeeded. Inspect individual
outcomes for multi-cloud jobs, then capture the overlap. Use `icp` for an
already-close pair, or `correspondences` with at least three non-collinear
matching world-coordinate landmarks. `undo` restores transforms from the last
accepted agent alignment job. These are rigid fits, without scale estimation.

For visual comparison and error coloring:

```python
compare_3d_clouds(scene_id=scene_id, action="enable", left=0, right=1)
compare_3d_clouds(scene_id=scene_id, action="distance", left=0, right=1, method="nearest", max_distance=0.1)
capture_3d_view(scene_id=scene_id)
```

Linked side-by-side views share a camera and currently use WebGL with EDL off.
Distance computation colors the left cloud by its world-space distance to the
right. Nearest-neighbor matches beyond `max_distance` are unmatched (`NaN`).
`paired` compares corresponding decoded rows and requires equal counts; use it
only when row correspondence is meaningful. Distance computation is limited to
one million combined points, and must be repeated after moving or updating
geometry. Comparison does not perform alignment.

## Save an inspection and export a subset

Camera bookmarks are useful for viewpoints. A scene state additionally stores
transforms, visibility, colors, opacity, presentation, and selections:

```python
manage_3d_scene_states(scene_id=scene_id, action="save", name="review")
manage_3d_scene_states(scene_id=scene_id, action="export", name="review", path="review.json")
export_3d_selection(scene_id=scene_id, name="region-a", path="region-a.ply")
```

Export paths must be under configured roots, their parent directory must exist,
and existing files are never overwritten. Scene JSON is limited to 4 MiB and
subset PLY to 256 MiB. Subset export preserves decoded attributes and provenance
where available; it is not a lossless copy of all original numeric types.
Coordinates remain object-local, with the transform and source origin recorded
in the header.

After restarting, reopen identical geometry in the same order, then import and
restore the state:

```python
manage_3d_scene_states(scene_id=scene_id, action="import", name="review", path="review.json")
manage_3d_scene_states(scene_id=scene_id, action="restore", name="review")
```

Import stores the state; restore applies it. State files do not embed the model
geometry or video playback. The renderer retains up to 20 named states.

## Update data or preview a camera path

`update_3d_scene` replaces geometry in the same scene while preserving the
camera. Omitted target/vector overlays are removed. Inspect the new rendered
revision before capturing it. For frequent NumPy/PyTorch updates, use the
[Python training-preview API](../packages/python/README.md#training-previews).

For a camera path, use `control_3d_video(action="add")` at the current view,
move the camera and add another keyframe, then call `action="play"`. At least
two keyframes are required. Use `update` for segment duration/dwell, `loop` for
looping, and `stop` to stop preview and restore the camera. These tools manage
camera playback, not video export or embedded model animations.
