---
name: 3d-visualizer-inspection
description:
  Inspect point clouds, meshes and depth reconstructions with 3D Visualizer. Use
  when asked to view, compare, measure or export 3D data through the installed
  viewer; verify actual rendered results before describing them.
---

# 3D Visualizer inspection

Use the installed 3D Visualizer MCP tools. The distribution is `3d-visualizer`,
the Python import is `viz3d`, and the server command is `3d-visualizer-mcp`.
Installing a package alone does not register its MCP tools with the host.

## Establish the available interface

Read `viewer://capabilities` when available. Check the active tool profile,
allowed roots, rendering mode and build IDs. Core supports everyday opening,
inspection, camera control, capture and closing. Depth, selection, comparison,
animation and export need `--tools full`; do not invent unavailable tools.

If rendering is unavailable, report the actual error. Offscreen rendering uses
`--renderer headless` and the headless extra plus Chromium. Do not open a
browser window unless the user requested that fallback.
`3d-visualizer doctor --check-headless` can diagnose an unattended installation;
it cannot determine whether an unrelated chat host permits WebGL.

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
   drawing comparisons. Close scenes that are no longer needed.

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
[depth-calibration workflow](../ply-depth-inspection/SKILL.md) and the server's
`viewer://depth-calibration` resource. Obtain intrinsics, distortion, encoding,
scale and poses from accompanying files or explicit context. Do not estimate
these from image appearance or silently assume meters.

Alignment should be requested or needed for the user's comparison. Complex
align-all can be expensive; do not invoke it by default. Poll accepted jobs and
verify the resulting transforms and screenshot rather than treating "queued" as
completion.
