---
name: 3d-visualizer-inspection
description:
  Inspect point clouds, meshes and depth reconstructions with 3D Visualizer. Use
  when asked to visualize a 3D file, inspect segmentation, compare predictions,
  export a subset, or reconstruct a depth/disparity image using accompanying
  calibration. Uses the available 3D Visualizer MCP server.
---

# 3D Visualizer inspection

Use the installed 3D Visualizer MCP tools. The distribution is `3d-visualizer`,
the server command is `3d-visualizer-mcp`. Prefer the active tool schemas over
copied examples: 0.4.2 and the development package have different defaults and
Python imports. Installing a package alone does not register its MCP tools with
the host.

## Establish the available interface

Read `viewer://capabilities` when available. Check the active tool profile,
allowed roots, rendering mode and build IDs. Read `viewer://workflows` for
server-version-specific recipes. Where profiles are supported, core supports
everyday opening, inspection, camera control, capture and closing. Depth,
selection, comparison, animation and export need the full profile. If a needed
tool is absent, explain the setup change; do not silently edit the client
configuration. Release 0.4.2 already exposes the advanced tools and has no
profile flag.

If rendering is unavailable, report the actual error. In versions supporting it,
offscreen rendering uses `--renderer headless` and the headless extra plus
Chromium. Release 0.4.2 requires an attached MCP Apps renderer for camera
operations and capture. Do not open a browser window unless the user requested
that fallback. `3d-visualizer doctor --check-headless` can diagnose an
unattended installation; it cannot determine whether an unrelated chat host
permits WebGL.

## Inspect and verify

1. Open the requested files or points. Retain `scene_id`; append to that scene
   when comparing another model instead of opening an unrelated widget.
2. Inspect the scene. Check successful parsing, object counts,
   `rendered_revision`, renderer ID and matching bundle build. Submission alone
   is not evidence of rendering. Read full state when coordinates or attributes
   matter; use compact replies for routine controls.
3. Frame or move the camera and capture a PNG. Examine the actual image before
   describing spatial relationships or claiming an object is visible. If the
   selected view is ambiguous, use another viewpoint or full-profile multi-view
   preview. A valid PNG is not proof that the desired geometry is visible.
4. After geometry updates, verify the new revision and preserved camera before
   drawing comparisons. Keep a scene open if the user will continue inspecting
   it.

## Coordinates and analytical operations

Use source units unless calibration establishes scale. Camera position and
rotation center are separate; inspect both. Transform matrices are column-major
and quaternions use XYZW. State whether operations use local or world space.

Discover label values and counts before selecting; numeric labels do not imply
semantic object names. Check selection status and point count before exporting.
Never export an older selection after a failed operation. Recompute comparison
distances if marked stale after transforms or geometry changes. Save a full
scene state for reproducible presentation; a camera bookmark alone does not
restore visibility or coloring.

For depth/disparity, read the adjacent
[depth-calibration workflow](references/depth.md) and the server's
`viewer://depth-calibration` resource. Obtain intrinsics, distortion, encoding,
scale and poses from accompanying files or explicit context. Do not estimate
these from image appearance or silently assume meters.

Alignment should be requested or needed for the user's comparison. Complex
align-all can be expensive; do not invoke it by default. Poll accepted jobs and
verify the resulting transforms and screenshot rather than treating "queued" as
completion.

## Keep the interaction concise

Use compact tool responses for routine edits, and full inspection only when
attributes, calibration or reproducibility matter. Prefer one selection/focus
operation over a series of camera adjustments. Report the finding, relevant
counts/units and a useful preview; omit transport logs and full state dumps.

## Complete the intended workflow

For labeled-object export, identify actual label values, select, verify a
nonempty result and inspect the preview, then export to the requested new path.
Check the returned count and provenance fields. Do not identify a semantic
object from its numeric label alone.

For prediction/reference comparisons, inspect object indices and coordinate
frames first. Paired distances require corresponding rows; otherwise choose
nearest-neighbor distances with a meaningful cutoff in known units. Alignment
changes the comparison: do it only when requested or necessary for the stated
task, then verify transforms and recompute stale distances.

For animation, inspect available clips, choose the object explicitly, seek or
set speed using the active schema, then inspect/capture the resulting pose.
Model playback and camera-path keyframes are different operations.

A successful export or visible widget is only the intermediate result if the
user asked for an analytical conclusion. Connect the inspected evidence to that
question, and state remaining uncertainty without claiming unseen results.
