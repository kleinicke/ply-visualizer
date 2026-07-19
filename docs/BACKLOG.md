# Backlog and deliberately-skipped work

Decisions from the July 2026 roadmap discussion. This file records what was
considered and _not_ built, so the reasoning isn't lost or re-litigated.

### Rust/WASM implementation preference

For new parsing and compute-heavy features, prefer Rust compiled to WASM when
the work can be expressed as a coarse, typed-array operation. LAS/LAZ and E57
decoding, sampling, bounds/scalar extraction and complete film timelines are
good candidates. DOM interaction, Three.js object management, browser APIs and
tiny per-click calculations stay in TypeScript unless they can join a larger
batched Rust geometry API. This keeps Rust useful without paying WASM call and
copy overhead for trivial UI work.

## Planned

### KITTI sequence and SemanticKITTI support

Build on the shipped single-file KITTI BIN parser in bounded phases:

1. Extend the existing sequence player to load numerically ordered KITTI BIN
   scans, preserving intensity settings while supporting play/pause, stepping,
   seeking, small-frame prefetching, cancellation and per-frame errors.
2. Add an explicit **Open KITTI Sequence** workflow that detects KITTI Odometry
   and SemanticKITTI folders and parses `times.txt`, `calib.txt` and available
   `poses.txt` files. Missing poses must remain valid because not every sequence
   includes ground truth.
3. Use calibration and poses to show the sensor trajectory and offer current
   scan in sensor coordinates, current scan in world coordinates, and bounded
   last-N/all-frame accumulation. Accumulation needs a configurable point and
   memory budget, sampling notices, cancellation and coordinate rebasing for
   float32 precision.
4. Match SemanticKITTI `.label` files to their scans, require one `uint32` per
   point, and expose the lower 16-bit semantic class and upper 16-bit instance
   ID as scalar fields. Add the official class names/colors, semantic and
   instance color modes, a compact legend and class visibility filters.

Test folder discovery variants, numeric ordering, pose/calibration transforms,
missing metadata, label-count mismatches, playback cancellation and accumulated
map limits. Reuse `engine/src/sequencePlayback.ts` and the existing scalar-field
rendering rather than creating a separate KITTI viewer.

Explicitly deferred from the first version: synchronized camera images, object
tracklets and bounding boxes, raw GPS/IMU processing, KITTI Tracking, KITTI-360,
semantic-completion voxels, and trajectory or segmentation evaluation.

### Harden Middlebury and ETH3D stereo dataset workflows

**Existing prototype:** `src/dataset/` already provides a scene picker,
downloads and caches Middlebury Stereo 2014 and ETH3D two-view data, then opens
the disparity with its calibration and color image. Downloading and extracting
the complete ETH3D archive is intentional; it is small enough and avoids a more
fragile partial-download path.

Before presenting this as finished dataset support:

1. Add small deterministic end-to-end fixtures (synthetic or legally
   redistributable crops) covering PFM disparity, `calib.txt`, color and masks.
2. Store scene metadata before opening the custom editor so initialization
   cannot race calibration discovery.
3. Make downloads cancellable, report byte/stage progress accurately and
   implement the currently placeholder cache-clearing behavior.
4. Validate disparity, calibration, mask and color-image dimensions and explain
   mismatches instead of continuing with subtly incorrect geometry.
5. Support the provided validity/occlusion masks and make invalid-point handling
   visible in statistics.
6. Add an image/point-cloud comparison toggle and tests for Middlebury perfect
   versus imperfect calibration.
7. Consolidate duplicated calibration conversion code under the shared engine
   parser rather than keeping dataset-only interpretations in the extension.

### Automatic calibration, camera poses and sidecar discovery

**Partially implemented:** manual calibration loading already supports native
and RealSense JSON, OpenCV/ROS/Kalibr YAML, Middlebury/ETH3D `calib.txt`, COLMAP
`cameras.txt`, TUM text and ZED `.conf`. Automatic loading currently works only
when the built-in dataset manager supplies explicit paths.

Add a general sidecar workflow for locally opened depth/disparity images:

1. Search the same directory for exact-stem sidecars and conventional names such
   as `calib.txt`, `calibration.*`, `camera.*`, `intrinsics.*` and
   `cameras.txt`. Apply only one unambiguous compatible match; otherwise show a
   concise camera/file picker.
2. Validate camera dimensions, focal lengths, principal point, distortion,
   baseline and units against the source image. Calibration must not silently
   decide whether ambiguous input represents depth or disparity, or guess an
   unknown depth scale.
3. Show which sidecar was auto-loaded, allow changing/removing it, and remember
   an explicit directory association for sibling frames. Optionally discover a
   matching color image with the same ambiguity safeguards.
4. Treat intrinsics and camera position as separate data. Intrinsics are enough
   to project a depth image in its local camera frame; stereo disparity also
   needs baseline/disparity offset; alignment in a reconstruction or world frame
   additionally needs an extrinsic camera pose.

Extend COLMAP support from the current intrinsics-only parser into a coherent
reconstruction-folder adapter:

1. Parse text `cameras.txt` for camera models/intrinsics and `images.txt` for
   each image's world-to-camera quaternion/translation and `CAMERA_ID`. Invert
   the pose correctly to obtain camera-to-world coordinates and map image names
   to corresponding color/depth files.
2. Support the common COLMAP camera models through a model/parameter registry
   instead of loose content guessing. Add explicit coordinate-convention tests:
   COLMAP camera axes are X right, Y down, Z forward.
3. Visualize registered camera frustums and trajectories and allow a selected
   COLMAP depth map or point cloud to be placed in the reconstruction frame.
4. Optionally parse `points3D.txt` as a sparse colored point cloud with
   reprojection error as a scalar field. Binary sparse models, rigs/frames and
   COLMAP dense depth-map binaries are later phases after the text workflow is
   correct.

Use paired calibration/pose fixtures to test matrix direction, quaternion
ordering, image-to-camera association, multiple cameras, missing files and
ambiguous sidecars. Do not conflate COLMAP `images.txt` camera poses with the
unrelated 3D human-body pose feature below.

### Harden camera distortion models and add Fisheye624 — shipped July 2026

**Implemented.** Advanced project/unproject math now has one Rust/WASM source of
truth with explicit coefficient layouts, convergence/domain reporting and
checked browser-boundary goldens. The UI and calibration adapters use
`fisheye-kb3` and `fisheye624`, expose raw-versus-rectified input, and reject
the old ambiguous Kannala-Brandt identity rather than guessing its convention.

**Original beta:** the depth UI and data types exposed ideal pinhole,
equidistant fisheye, OpenCV pinhole/fisheye and a Kannala-Brandt option. Ideal
pinhole and basic equidistant projection are usable, but the calibrated models
must remain beta until their pixel-to-ray equations and parameter conventions
are corrected. The current TypeScript and Rust/WASM paths duplicate the same
math, some distortion branches apply a forward equation where unprojection
requires its numerical inverse, and the tests mostly check types or mock
implementations rather than production results.

1. Define one explicit camera-model contract with `project` (3D ray to pixel)
   and `unproject` (pixel to 3D ray), named coefficient layouts, convergence
   reporting and valid-domain/FOV handling. The numerical source of truth should
   live in Rust and compile to WASM; remove duplicated advanced-model equations
   from TypeScript rather than allowing the two paths to drift.
2. Correct OpenCV pinhole unprojection by iteratively inverting radial and
   tangential distortion. Correct OpenCV fisheye unprojection by solving for the
   undistorted angle, respecting both `fx` and `fy` and matching OpenCV's
   four-coefficient convention exactly.
3. Replace the ambiguous five-coefficient Kannala-Brandt interpretation with a
   specifically named convention, initially KB3:
   `r(theta) = theta + k0*theta^3 + k1*theta^5 + k2*theta^7 + k3*theta^9`.
   Validate coefficient counts and avoid silently interpreting calibration
   parameters from a different KB variant.
4. Add Meta/Project Aria **Fisheye624** (`FisheyeRadTanThinPrism`) with six
   radial, two tangential and four thin-prism coefficients. Implement robust
   forward projection and the required iterative inverse, including convergence
   limits and rejection of invalid rays instead of returning plausible-looking
   bad geometry.
5. Use the same projection API anywhere 3D points are mapped back to images,
   including color reprojection. Keeping original pixel coordinates remains the
   preferred fast path when depth and color are already pixel-aligned.
6. Preserve the exact model identity and coefficient ordering when importing
   OpenCV/ROS/Kalibr, COLMAP and future Project Aria calibration files. Fix the
   older VS Code camera picker and calibration form mappings so they expose the
   same supported model names as the Svelte depth panel. Make it explicit
   whether an input depth image is raw/distorted or already rectified, since
   applying calibration distortion to a rectified image is incorrect.
7. Add production tests, not copied formula tests: project/unproject round trips
   at the center and image edges, anisotropic `fx`/`fy`, strong but valid
   distortion, non-convergence and out-of-domain cases. Compare OpenCV models
   with OpenCV reference output and Fisheye624 with Project Aria reference
   output using small checked-in golden fixtures. Exercise both the Rust unit
   layer and the compiled WASM boundary.

Rust/WASM owns the batched per-pixel numerical kernels and iterative solvers.
TypeScript/Svelte still owns calibration-file parsing and model mapping, typed
parameter transport, validation messages, settings UI and browser/extension
integration. These parts should not be moved to Rust merely because the camera
math is implemented there.

### Stabilize and document 3D body-pose JSON support

**Existing experimental feature:** `engine/src/pose.ts` already accepts generic
joints/edges, Human3.6M-like positions, Halpe, OpenPose/COCO-like arrays and
generic points; it renders joints/bones and supports multiple Halpe instances,
labels, transforms, dataset colors and score/uncertainty controls. Several real
fixtures already exist under `testfiles/json/`, so the README's "accept pose
files" item is no longer a from-scratch task. I actually have no idea, what
standard for these actually exist and which ones are coming. I want to support
them as long as they are logical, consistent and have the potential to gain some
traction.

1. Define and document a versioned canonical JSON schema with units, coordinate
   convention, joint names, confidence and explicit skeleton edges.
2. Replace array-length guessing and nearest-neighbor anatomy with explicit
   adapters/presets for supported layouts such as COCO-17, OpenPose BODY_25,
   Halpe-26 and Human3.6M. Unknown layouts may show points but must not invent a
   misleading skeleton.
3. Support every person in multi-person formats, not only the first OpenPose
   entry, and distinguish true 3D coordinates from 2D keypoints displayed on a
   `z=0` plane.
4. Add pose sequences/timeline playback, stable per-person identity where
   available, unit/axis selection and straightforward alignment with loaded
   point clouds.
5. Turn the existing fixtures into exact parser and rendering tests covering
   invalid joints, confidence thresholds, uncertainties, labels, transforms,
   multiple people and useful schema errors.

SMPL/SMPL-X body meshes and BVH animation are separate, substantially larger
features and are not implied by stabilizing skeleton JSON.

### Load-pipeline IO: remaining fetch/transfer costs

Analysis from a 201 MB / 850k-splat binary PLY (July 2026):
`read+parse 199ms · transfer 335ms · fetch 1346ms · parse(js) 137ms · build 56ms | total 2257ms`.
Parsing is NOT the bottleneck — IO is. Per-path IO behavior:

| Path                                 | Disk reads | Transfer to webview             |
| ------------------------------------ | ---------- | ------------------------------- |
| Initial open, binary PLY             | 1 (fixed)  | webview fetch (no copy)         |
| Initial open, ascii PLY/XYZ/LAS/…    | 1          | parsed arrays via postMessage   |
| Add file / sequence / fetch-fallback | 1          | full bytes via structured clone |
| Splat containers (.spz/…)            | 1          | webview fetch (no copy)         |

**Fixed (July 2026):** the initial binary-PLY open used to read the full file in
the extension host only to parse a few-KB header, then the webview fetched all
bytes again — two full disk passes. `documentLoader` now reads a 64 KB header
prefix (`readFileHead`, same pattern as the PCD gate) and falls back to a full
read only for ascii files or over-long headers. Expected: `read+parse` drops
from ~200 ms to single-digit ms on large clouds; the webview fetch may gain a
little (it no longer starts with an OS cache pre-warmed by the extension read),
net win expected clearly positive on SSDs — verify by comparing PERF lines
before/after.

Remaining ideas, roughly by expected value:

1. **The webview fetch itself is slow**: 1346 ms for 201 MB ≈ 150 MB/s through
   the `vscode-webview-resource` protocol — far below SSD speed. Investigate:
   streaming `response.body` reader vs one `arrayBuffer()` call, protocol chunk
   sizes, and whether newer VS Code versions improved it. This is the single
   biggest lever left (~1s on a 200 MB file).
2. **Clone vs fetch — measure, then let the winner own both paths.** Add-file
   and sequence loads send full bytes via structured clone; the initial open
   uses the webview fetch. Which is faster at 200 MB scale is an open empirical
   question: fetch measured ~150 MB/s (1346 ms), while a Node `readFileFast`
   (~100–200 ms) + clone (`transfer` phase in add-file PERF lines) might total
   well under that. Comparing the PERF lines of opening vs adding the _same
   large file_ settles it; whichever wins should serve both paths (possibly
   size-dependent). Note there is no third option: the extension and webview are
   separate processes with no shared memory — "read once and hand the buffer
   over" _is_ the structured clone, and VS Code webview postMessage does not
   support transferables.
3. **Creative acceleration of the JS fetch+parse hop** (speculative, no concrete
   design yet): today the webview fetches and parses in JS on the main thread.
   Options worth exploring even without a clear win-path: doing fetch+parse in a
   Worker (unblocks UI; transferable ArrayBuffers work between webview workers),
   a Rust/WASM streaming binary parser that parses chunks while the fetch
   streams (overlapping IO and parse instead of sequencing them), or extending
   the existing wasm-stream approach (PCD) to binary PLY. Note the constraint
   that makes naive Rust unattractive: WASM cannot read JS buffers in place, so
   a plain "parse in Rust" pays a full extra copy of the file for a parse phase
   that is already bandwidth-bound.

Per the general bar: reliable wins ≥ ~50 ms are worth shipping.

### Other new file formats

PTX Static FBX 3MF VTK/VTP COPC/EPT FBX

### Analyze EDL

Eye-dome-lightening on colored point clouds is not really nice. It makes them
much darker. Analyze what would help here and figure out if its actually
reasonable from me to want it to also look nice there.

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

## Implemented

### Gaussian splatting (3DGS PLY + SPZ/SPLAT/KSPLAT/SOG)

**Shipped (July 2026).** Both halves of what was once deferred here, plus the
splat-native container formats:

1. **DC-color point preview** — the PLY parser (both the full parser and the
   webview-side "ultimate" binary reader) detects the INRIA 3DGS layout
   (`f_dc_0..2` without `red/green/blue`), synthesizes vertex colors from the SH
   DC coefficients, keeps `opacity`/`scale_*` as scalar fields, and drops
   `f_rest_*`/`rot_*` (previously 45 junk Float32Arrays ≈ 180 MB per 1M splats).
   Explicit rgb wins when a file carries both.
2. **Real splat rendering** — per-file "✨ Splats" toggle backed by
   `@sparkjsdev/spark` (not the unmaintained `@mkkellogg/GaussianSplats3D`),
   lazy-loaded as a separate ~4.8 MB webpack chunk on first use
   (`engine/src/visualization/splatMode.ts`). Points stay loaded but hidden in
   splat mode, so picking/measurement keep working on gaussian centers;
   transforms mirror onto the `SplatMesh`. Splat load waits on
   `mesh.initialized` before hiding the points, so failures revert to the point
   view with a status message instead of an empty scene. Design history and
   integration gotchas (CSP `connect-src data:`, `three/addons` alias, ASCII
   wasm-path guard): [gaussian-splatting-plan.md](gaussian-splatting-plan.md).
3. **Splat-native containers** — `.spz`, `.splat`, `.ksplat`, `.sog` open via
   Spark directly: the gaussian centers are extracted (`forEachSplat`) into a
   regular point-cloud entry (opacity as a scalar field) and splat rendering
   turns on automatically; the Points toggle still works.

Known limitation: zoomed far out, unbounded captures look like an opaque blob —
outdoor 3DGS scenes surround their content with huge low-detail environment
gaussians, so from outside you only see that shell. That is inherent to the
representation, not a renderer bug; the workflow is to move the camera inside
(double-click a point to set the rotation center, then zoom in) or inspect in
points mode. If it bothers users, a possible future feature is a scale/opacity
filter or crop box implemented via Spark's splat modifiers (dynos).

3DGS nx/ny/nz properties are always all zeros and are deliberately dropped at
parse (no normals array, no no-op Normals button).

Test files: `testfiles/splats/3dgs_*` (regenerate with
`uv run --with numpy testfiles/splats/generate_3dgs.py`); specs in
`engine/test/gaussian-splat-*.spec.ts` and
`src/test/suite/gaussianSplatParser.test.ts`.

### KITTI BIN support

**Shipped (July 2026, initial version).** `KittiBinParser`
(`engine/src/parsers/kittiBinParser.ts`) reads the headerless little-endian
float32 `[x, y, z, reflectance]` layout, rejects empty, mis-sized or non-finite
records and reports the format as "KITTI BIN"; reflectance feeds the existing
intensity color modes. Because `.bin` is ambiguous, the VS Code registration is
a separate `plyViewer.kittiBin` custom editor with `priority: "option"` — users
opt in via "Open With..." or the explorer context menu instead of the extension
hijacking every `.bin` file. Playwright coverage:
`engine/test/kitti-bin-loading.spec.ts`.

Sequence playback, calibration/poses and SemanticKITTI labels are tracked in the
planned phased item above.

### Better point-to-point measurements

**Shipped (July 2026, initial version).** `MeasurementManager` now holds an
ordered measurement path: toggle path mode (Measurements panel button or `M`),
double-click points on geometry (picked through `SelectionManager`, no separate
raycasting path), and the panel lists every segment length plus the accumulated
total. Undo-last-point and clear-path exist alongside the retained
rotation-center Shift+double-click quick measurement. Distance math stayed in
TypeScript per the original sketch (one subtraction per click does not justify a
WASM boundary). Playwright coverage: `engine/test/measurement-path.spec.ts`.

Still open from the original sketch: explicit tests for transformed objects,
multiple clouds and picks near overlapping geometry.

### LAS and LAZ support

**Shipped (July 2026, initial version).** Add `.las` and `.laz` as first-class
point-cloud formats in both the VS Code and browser hosts. Prefer one Rust
parser compiled to WASM rather than separate JavaScript and extension-host
implementations.

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

**Shipped (July 2026, initial version).** Add `.e57` using Rust/WASM. E57
containers can hold several scans, so each scan should become an independently
visible and transformable entry in the existing file list rather than silently
loading only the first one.

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

**Shipped (July 2026, initial version)** as "Video Mode" in the Camera tab:
`engine/src/film/` (keyframe timeline + `FilmManager`), `FilmPanel.svelte`,
`state/film.svelte.js`. Covers keyframe add/reorder/edit/delete/re-capture
(position, orientation, rotation center, FOV, per-keyframe travel duration and
dwell), Catmull-Rom position/target spline with per-segment quaternion slerp and
smoothstep easing, play/stop/loop preview, keyframe frustum preview
(short-far-plane `CameraHelper`s), `captureStream`+`MediaRecorder` recording
with codec fallback (MP4 → VP9 → VP8 → WebM), and camera-path JSON save/load
(save goes through the extension host in VS Code). The pre-playback camera is
restored after playback/recording. Playwright coverage:
`engine/test/film-mode.spec.ts`.

Refined after first user feedback (July 2026): looping flies a closing segment
from the last keyframe back to the first (the last keyframe's duration is that
segment's travel time; the spline wraps) instead of teleporting; easing is
boundary-dependent so dwell-0 keyframes are flown through at speed rather than
braking to a stop at every keyframe; recordings bake the CSS canvas background
into `scene.background` for the take (the canvas clears with alpha 0, so raw
captureStream footage was black); and Record can be pressed mid-preview — it
restarts from the beginning and runs the loop exactly once.

Deliberate deviation from the sketch: timeline generation stayed in TypeScript
instead of Rust/WASM — sampling one camera pose per frame is trivial compute,
far below the "coarse batched typed-array operation" bar set below. Revisit only
if a batched Rust geometry API grows anyway.

Still open: pause (currently play/stop only), timeline scrubbing, high-DPI /
resize-during-recording tests.

### CloudCompare-style rotation direction

**Status: RESOLVED (July 2026) — shipped as `CloudCompareControls` in
`engine/src/controls.ts` and then PROMOTED TO THE DEFAULT "Trackball" scheme
(`T`).** The previous delta-based three.js TrackballControls remains available
as "Legacy Trackball" (`I`); the old roll-only "Inverse Trackball" scheme and
its shadow-state `_rotateCamera` patch were removed with their specs
(inverse-trackball-rotation, measure-accumulated-roll, rotation-drift-check —
the accumulated-roll spec had been failing on main anyway).

Sensitivity design (second iteration, after user feedback that the pure ball was
too slow): orbit and roll are split into independently scaled parts, because
naively multiplying the incremental step angles rebuilds the counter-holonomy
and flips circular-drag roll back to the wrong direction at high speed
(measured: −1.31 rad at 3.2x). SWING (yaw/pitch) is Shoemake-arcball style — the
twist-free single rotation from the drag-start ball point to the current one,
endpoint-based and therefore path-independent (closed loops add zero swing at
any speed) — scaled 3.2x to match the legacy trackball's speed. TWIST (roll) is
the integral of each step's view-axis component, scaled 1.5x. Poses are
recomputed rigidly from the drag-start state each move, so there is no drift and
no momentum state.

Reattempted on explicit user request after the abandonment below. The first
retry (mirroring the whole trackball rotation) was wrong — user feedback: it
inverted the straight drags, which had been fine, and left "the rotation" (roll)
backwards. That feedback identified what CloudCompare actually does differently:

- **CloudCompare is a sphere-projected ("virtual ball") trackball, not a delta
  trackball.** Each pointer move projects the previous and current cursor
  _positions_ onto a unit ball over the canvas and applies the minimal rotation
  carrying one to the other, scene-side (camera gets the conjugated inverse,
  applied rigidly to eye+up — orthonormal by construction, no drift, no momentum
  state).
- **Straight drags through the center match normal three.js trackball**
  direction (scene front follows the mouse) — that part was never the problem.
- **The actual difference is that rotation is position-dependent.** Drags near
  the canvas rim and circular gestures ROLL the scene under the cursor,
  following the finger. A delta-based trackball structurally cannot do this: its
  per-step math ignores the cursor position, so its only roll is the
  _accumulation_ (holonomy) of yaw/pitch steps — which comes out large and in
  the wrong direction (measured: −3.0 rad against a 180° clockwise circular
  gesture vs +0.38 rad following it). That is "the rotation is inverted", and it
  explains why every sign-flipping attempt failed: there is no roll term in the
  delta formula to flip.
- Coverage: `engine/test/cloudcompare-rotation.spec.ts` (straight-drag direction
  parity with normal trackball, rim-drag tangential roll with zero roll at
  center, circular-gesture roll following the finger and opposite to normal
  trackball's, sustained-drag stability). The older roll-only
  `inverse-trackball` scheme remains available and unchanged; the unused
  turntable implementation stays parked in `controls.ts`.

The historical post-mortem below is kept: its failure analysis (particularly
"fighting the controls' assumptions") was pointing at the right conclusion — the
fix required replacing the rotation model, not adjusting signs inside it.

**Pre-2026-07 status: abandoned.** The accepted answer was the recovery shortcut
— double-click into empty void to get back to a sane view (commit `7df5232`) —
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

## Discarded

### Large-coordinate auto-rebase, discarded

Clouds with large absolute coordinates (UTM/LiDAR) currently need Fit to View
(F) after loading, and float32 precision can make points jitter during rotation.
An automatic hidden per-file rebase was implemented and tested in July 2026,
then removed: it added a full point scan, an extra position buffer for affected
files, and transform/export complexity without a demonstrated visible benefit in
the available fixtures. Revisit only with a real file that reproduces the
precision problem and can serve as a regression test.

### Cross-section slab (world-space clipping planes), discarded

Built (axis picker + min/max sliders driving `renderer.clippingPlanes`) and
**removed on user decision before ever being committed** — not needed in the
panel. If it ever comes back, the verified recipe: a small
`visualization/sectionPlanes.ts` module mapping min/max percentages of the
content bounding box onto two `THREE.Plane`s in global
`renderer.clippingPlanes`. Use global planes, not per-material clipping —
per-material needs re-apply hooks on every material recreation — and EDL is
unaffected because ShaderMaterials don't opt into clipping.

## Info

For development, some test point clouds and images are here:
/Users/florian/Projects/cursor/test_data/
