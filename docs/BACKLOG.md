# Backlog and deliberately-skipped work

Decisions from the July 2026 roadmap discussion. This file records what was
considered and _not_ built, so the reasoning isn't lost or re-litigated.

## Planned

### Better point-to-point measurements

Replace the current rotation-center-to-point-only workflow with an arbitrary
measurement path. The user picks A, B, C, ... directly on visible geometry; the
UI shows every segment length and the accumulated total. Keep remove-last and
clear-all, and retain the current rotation-center shortcut as a quick
single-distance option.

Implementation sketch:

1. Extend `MeasurementManager` with an ordered list of picked world-space points
   and render a polyline plus point markers.
2. Reuse `SelectionManager` for point/mesh picking so measurement does not get
   its own competing raycasting path.
3. Show segment lengths, total length and selected coordinates in a small Svelte
   panel; allow undo-last and clear-all from both UI and keyboard.
4. Keep the interaction and Three.js scene objects in TypeScript. Put the pure
   distance calculation in the Rust/WASM geometry module if it can share the
   same batched API with later area/profile tools; do not add a WASM boundary
   for one subtraction per click alone.
5. Test transformed objects, meshes, multiple clouds, undo/clear and picks near
   overlapping geometry.

### LAS and LAZ support

Add `.las` and `.laz` as first-class point-cloud formats in both the VS Code and
browser hosts. Prefer one Rust parser compiled to WASM rather than separate
JavaScript and extension-host implementations.

Implementation sketch:

1. Create a Rust/WASM LiDAR parser that reads LAS headers and point formats,
   decodes positions, RGB and standard attributes, and returns typed arrays
   compatible with `SpatialData`.
2. Expose intensity, classification, return number, scan angle, GPS time and
   other useful dimensions through the existing scalar-field UI instead of
   reducing the format to XYZ/RGB.
3. Add LAZ decompression behind the same Rust API. Evaluate a native Rust LAZ
   implementation first; use a proven WASM decoder such as `laz-perf` only if
   the Rust option is incomplete or materially slower.
4. Parse incrementally and sample during decoding when a configured point or
   memory budget is exceeded. Always tell the user when the displayed cloud is
   sampled and preserve the original point count in metadata.
5. Preserve LAS scale, offset, bounds, CRS/VLR metadata and exact source-space
   coordinates. Render rebased coordinates when necessary for float32 precision,
   while keeping the offset available for transforms and export.
6. Start with representative fixtures for several LAS point formats and both
   compressed and uncompressed data before advertising general support.

Georeferenced map tiles are a possible follow-up, not part of initial LAS/LAZ
support. Correct CRS preservation and large-coordinate rendering come first.

### E57 support

Add `.e57` using Rust/WASM. E57 containers can hold several scans, so each scan
should become an independently visible and transformable entry in the existing
file list rather than silently loading only the first one.

Implementation sketch:

1. Build an E57 WASM crate around the Rust `e57` ecosystem and share the same
   typed-array result contract as the LAS/LAZ parser.
2. Return scan names, scan transforms, bounds, XYZ, RGB and intensity, while
   filtering invalid Cartesian records and reporting unsupported fields.
3. Read from chunked input where practical and perform sampling inside Rust so
   large intermediate JavaScript arrays are never created.
4. Add progress, cancellation and explicit memory-budget errors. Avoid copying
   decoded buffers more often than required by the WASM-to-JavaScript boundary.
5. Test multi-scan files, transformed scans, color/intensity variants and large
   files. Document clearly which E57 features are supported.

### Film-maker mode

Add a camera-keyframe workflow for demonstrations, documentation and
reproducible bug reports. This is planned alongside the format work rather than
being treated as a distant optional feature.

Implementation sketch:

1. Let users add, select, reorder, edit and delete camera keyframes containing
   camera position/orientation, rotation center, field of view and optional
   dwell time.
2. Generate a smooth camera timeline using position interpolation and quaternion
   interpolation. Implement timeline generation as one batched Rust/WASM
   operation; keep Three.js camera application and playback timing in
   TypeScript.
3. Provide preview/play/pause/loop controls and show keyframe camera frustums in
   the scene while editing.
4. Record the standalone/VS Code webview canvas with `captureStream` and
   `MediaRecorder`, choosing the best supported codec and extension rather than
   assuming MP4/H.264 is available.
5. Allow saving/loading the keyframe project as JSON independently of the
   recorded video, so a camera path can be reproduced and adjusted later.
6. Test interpolation across rotations, resizing/high-DPI recording, codec
   fallback, cancellation and restoration of the pre-playback camera.

### Rust/WASM implementation preference

For new parsing and compute-heavy features, prefer Rust compiled to WASM when
the work can be expressed as a coarse, typed-array operation. LAS/LAZ and E57
decoding, sampling, bounds/scalar extraction and complete film timelines are
good candidates. DOM interaction, Three.js object management, browser APIs and
tiny per-click calculations stay in TypeScript unless they can join a larger
batched Rust geometry API. This keeps Rust useful without paying WASM call and
copy overhead for trivial UI work.

## Skipped for now (worth revisiting)

### Cloud-to-cloud distance comparison

**Prototype branch:** `feature/cloud-distance-comparison` (commit `31c29f3`).
The branch contains a bounded nearest-neighbor implementation running in a Web
Worker, with source/reference selection, a maximum-distance clamp and scalar
heatmap coloring. It is intentionally kept off `main` until its usefulness and
performance have been validated with representative real-world clouds.

Color cloud A by its nearest-neighbor distance to reference cloud B — a
CloudCompare-style distance heatmap, useful for comparing reconstruction output
against ground truth.

Sketch when picked up again:

1. Apply each file's transform so both clouds are in world space.
2. Build a uniform voxel-grid hash over B (cell size ≈ expected distance scale);
   no KD-tree needed.
3. For each point in A, check the 27 neighboring cells, take the min distance.
   Output is a `Float32Array` — just another scalar field.
4. Render through the scalar-field colormap infrastructure (which is why
   colormaps were built first).

Run the compute off the main thread. Per the project's performance rule (below),
the distance kernel is a candidate for **Rust → WASM** rather than JS in a Web
Worker. A later extension: point-to-mesh distance against STL/OBJ ground truth
(same UI, triangle-distance kernel).

### Gaussian splatting preview

Not competing with SuperSplat — their editor/renderer quality is out of reach
and out of scope. If revisited, only the cheap version: detect the 3DGS PLY
property layout (`f_dc_0..2`, `opacity`, `scale_*`, `rot_*`) in the PLY parser
and render gaussian centers as a normal point cloud colored from the DC
coefficients. That converts "shows nothing useful" into "shows my
reconstruction" for days of work, not months. A real sorted-splat renderer (e.g.
integrating `@mkkellogg/GaussianSplats3D`) only if users ask.

### Large-coordinate auto-rebase

Clouds with large absolute coordinates (UTM/LiDAR) currently need Fit to View
(F) after loading, and float32 precision can make points jitter during rotation.
An automatic hidden per-file rebase was implemented and tested in July 2026,
then removed: it added a full point scan, an extra position buffer for affected
files, and transform/export complexity without a demonstrated visible benefit in
the available fixtures. Revisit only with a real file that reproduces the
precision problem and can serve as a regression test.

### Cross-section slab (world-space clipping planes)

Built (axis picker + min/max sliders driving `renderer.clippingPlanes`) and
**removed on user decision before ever being committed** — not needed in the
panel. If it ever comes back, the verified recipe: a small
`visualization/sectionPlanes.ts` module mapping min/max percentages of the
content bounding box onto two `THREE.Plane`s in global
`renderer.clippingPlanes`. Use global planes, not per-material clipping —
per-material needs re-apply hooks on every material recreation — and EDL is
unaffected because ShaderMaterials don't opt into clipping.

## Closed — do not reattempt

### CloudCompare-style rotation direction

**Status: abandoned.** The accepted answer is the recovery shortcut —
double-click into empty void to get back to a sane view (commit `7df5232`) —
plus the existing experimental control schemes for those who want them.

Why the multiple past attempts failed (post-mortem opinion):

- **Camera-side vs scene-side rotation.** CloudCompare conceptually rotates the
  scene under a fixed camera; orbit/trackball controls rotate the camera around
  a target. These produce mirrored apparent motion. Naively flipping signs fixes
  one axis and breaks the other, or feels right until the camera is upside down.
- **Screen-space rotations don't commute.** A true trackball composes
  incremental rotations about _view-aligned_ axes. Small errors in composition
  order (pre- vs post-multiply relative to the current view) don't blow up
  immediately — they accumulate as **roll drift**, which is why every attempt
  initially looked fixed and then degraded. The specs in `engine/test/`
  (`measure-accumulated-roll`, `rotation-drift-check`, `zoom-after-rotate`,
  `inverse-trackball-rotation`) exist because of this.
- **Too many camera-touching code paths.** Fit-to-view, double-click recenter,
  manual camera entry, control-scheme switching, and the up-vector handling all
  had to agree with the inverted composition. Each fix was consistent in the
  main path and regressed in a side path.
- **Fighting the controls' assumptions.** The orbit-style decomposition into
  azimuth/polar around a fixed up vector is structurally at odds with a free
  trackball; the inversion kept leaking through that decomposition.

Cost/benefit verdict: repeated significant effort, no stable result, and users
adapt to rotation direction quickly — but a lost camera was the real pain, and
the void-double-click shortcut solves that directly.
