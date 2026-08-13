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

The full candidate inventory, with what each port wins and where the ceiling is,
lives under "Moving more TypeScript to Rust" below.

## Planned

### Volume rendering for image stacks (tiff-visualizer bridge) — bridge shipped

**Status (August 2026): the volume workflow is implemented and carries real
DICOM series end to end.** What exists:

- `engine/src/parsers/nrrdParser.ts` reads NRRD (raw/gzip/ascii, all sample
  types, big and little endian, detached `.nhdr`, channel-first 4D), producing a
  volume with a full voxel-to-world affine, normalised LPS to RAS.
- `engine/src/visualization/marchingCubes.ts` extracts an isosurface in world
  space, with slab-wise edge caching so peak memory is a slice rather than the
  volume, and gradient normals transformed by the inverse-transpose (oblique
  DICOM shades correctly).
- `engine/src/visualization/isosurface.ts` picks the iso value — 300 HU for CT,
  Otsu otherwise — and packages the result as `SpatialData` on the typed-array
  path via the new `indicesArray`.
- `.nrrd`/`.nhdr` are registered in `formats/builtinFormats.ts` and the custom
  editor, so 3D Slicer and ITK volumes also open directly.
- On the producer side, `tiff-visualizer` reads `PixelSpacing`, `SliceThickness`
  and modality, derives the affine (slice step measured from consecutive
  `ImagePositionPatient`, not from thickness), and its **Open DICOM Volume in 3D
  Viewer** command writes NRRD and hands it over.
- DICOM geometry is normalised from the source millimetres to this viewer's
  metre-based world space. Window center/width and photometric interpretation
  survive the NRRD bridge.
- This extension also has **Open DICOM Folder as Volume**. It detects native,
  uncompressed grayscale DICOM by content (including extensionless files),
  groups compatible slices into series, and opens selected series without
  requiring the image-viewer bridge.
- Directly opened series keep their DICOM identity in the viewer (`Series 4 MR`,
  etc.). Temporary lossless NRRD files use the real DICOM SeriesNumber and
  modality rather than the selected-list position, and carry both in metadata.
- The canonical first view is now a **full-resolution point cloud**: every
  source voxel at or above the threshold becomes exactly one point at affine
  world coordinates. The initial threshold is the measured minimum, so first
  load retains every voxel. There is no silent point budget or automatic stride.
  Each point keeps its original scalar value. Its grayscale presentation is
  independent from thresholding and offers three mappings: per-layer actual
  min/max (the DICOM default, matching the 2D image viewer), the declared DICOM
  window, or whole-volume min/max. All three include MONOCHROME1 inversion.
- Raising **Hide voxel values below** removes those voxels from point geometry.
  **Mesh (isosurface)** is an explicit optional representation and marching
  cubes uses that same entered scalar threshold. Mesh sampling is exposed
  separately and never changes point-cloud fidelity.
- Volume control messages go directly to the authoritative retained-session
  lookup; a redundant panel-local gate that could silently discard threshold and
  mode changes was removed. Geometry delivery is awaited and rejected updates
  now surface an error instead of leaving stale pixels visible.
- The webview also retains the scalar array from the canonical full point
  payload and performs later point filtering, marching-cubes extraction, and
  orthogonal-slice rebuilding locally. Threshold and render-mode controls now
  update the displayed geometry directly instead of depending on another
  extension-host message round trip; the host path remains a compatibility
  fallback for older partial payloads.
- The round point sprite is used at every configured point size for DICOM and
  ordinary PLY/point-cloud files; zooming into the 0.001 default no longer
  reveals square sprites.
- The volume panel has a third **Orthogonal slices** mode. It displays the
  original voxel samples on axial/coronal/sagittal planes with independent
  window/level and slice-position controls. Segmentation threshold remains
  exclusive to surface and point modes.
- Double-click picking applies the active clipping planes before selecting a
  point or mesh intersection, so a clipped-away voxel can no longer become the
  rotation centre.
- Slice clipping planes sit halfway between voxel centres rather than directly
  through the retained outer layer. This keeps the selected boundary layer a
  positive distance inside the GPU half-space and prevents camera-motion flicker
  from floating-point clipping classification.
- File-list refreshes update stable keyed rows in place instead of remounting
  the complete list. The shared refresh boundary also restores the container's
  exact scroll offsets, so threshold, render-mode, color, visibility, and future
  setting changes cannot jump back to the first file or discard open form state.

**The descriptor question is settled: NRRD is the payload.** It is a documented
standard that already carries the affine, world units, dtype and endianness, so
there is no private contract for two repositories to version against each other
— which was the main risk this slice existed to retire. Intensity semantics,
which NRRD has no field for, ride as `units:=HU` plus `modality:=CT` key/value
pairs.

Verified against a real 640x640x44 MR series in
`tiff-visualizer/test/volume-export-test.js`, which reads the produced file back
with _this_ repository's parser rather than a local reimplementation.

### Volume viewer: plan for the next five pieces

**Status (August 2026): Steps 0–4 are implemented.** Extraction now uses
anisotropy-aware per-axis strides; open volumes are retained for debounced,
cancellable re-extraction; the volume panel provides a histogram threshold, HU
presets, point mode and optional gradient-magnitude surface coloring; and
affine-aware i/j/k clipping works in slice indices (with bounding-box clipping
for ordinary point clouds). Point clouds are now the full-resolution default,
with one windowed-grey point per retained voxel and threshold-only filtering;
meshes are optional threshold-driven isosurfaces. Step 4 is implemented as a
multi-series handoff: the image viewer writes every selected DICOM series and
this extension opens the first NRRD then adds the rest to the same scene. A
presentation follow-up also added metre-scale DICOM geometry, orthogonal
source-value slices with window/level, greyscale point intensity by default,
neutral surfaces by default, selectable per-layer/DICOM-window/whole-volume
brightness mapping, and visible effective stride/count/spacing metadata.

Ordered so each one unblocks the next. Steps 0 and 1 are prerequisites for
everything interactive; 2–4 are independent of each other once 1 lands.

#### Step 0 — anisotropy-aware decimation — implemented

`chooseStep` returns one integer applied to all three axes. On the real MR
series that is 0.2344 x 0.2344 x 3.3 mm — **14:1 anisotropy** — so decimating
uniformly throws away 14x more real distance along z than along x. It does not
bite today only because 640x640x44 is 18M cells, under the 40M budget; a
512x512x600 CT would hit it immediately.

- `chooseStep` returns `[sx, sy, sz]`. Derive a target world spacing (start at
  the largest voxel dimension), set
  `step[a] = clamp(round(target / voxelSize[a]), 1, …)`, then scale all three up
  together until the cell count fits the budget. Voxel sizes are the column
  lengths of `ijkToWorld`.
- `extractIsosurface` takes the triple: touches the `at()` sampler, the
  `gx/gy/gz` grid sizes, `gradientAt`, and the `vi/vj/vk` rescale before the
  affine multiply. Contained, but every one of those must use the _same_ axis's
  step or the surface shifts.
- Do this before the UI work: both the threshold control and point mode call the
  extraction API, and changing its signature afterwards means touching them
  twice.
- Test: extend "decimation keeps the surface in the same place" with a
  deliberately anisotropic affine and per-axis steps; the sphere must stay a
  sphere of the right radius, which is exactly what a mismatched axis breaks.

#### Step 1 — retain the volume and support re-extraction — implemented

Everything interactive needs the volume to still be in memory. Today
`documentLoader` parses, extracts, posts the mesh and drops the volume, so any
parameter change would re-read and re-decode the file.

- A small session store in `src/providerHandlers/`, keyed by document URI,
  holding the parsed `VolumeData` plus the last extraction options. Populate it
  in the `isVolumeFile` branch; clear it on `webviewPanel.onDidDispose`.
- **Memory is the real constraint.** This series is 72 MB as float32; a CT is
  300 MB+. Hold at most one volume per panel, and keep the parser's native dtype
  rather than widening to float (it already does).
- New webview→extension message `volume:reextract` carrying threshold, step,
  render mode and slice range. The extension re-runs extraction and posts the
  result.
- Replacing what is on screen: there is no update-in-place path, but
  `removeFileByIndex` (main.ts) plus `addNewFiles` exists, so re-extraction is
  remove-then-add. Preserve the file's transform and color mode across the swap,
  or every threshold nudge resets the user's view.
- Extraction is ~2.3 s for this series, so the request must be debounced and
  cancellable, and the existing progress callback surfaced.

#### Step 2 — threshold control and point-cloud mode — implemented

These ship together because they are the same panel and the same round trip.

- **Panel:** a Svelte component in `engine/src/components/` (say
  `VolumePanel.svelte`) backed by a `engine/src/state/volume.svelte.js` store,
  per the project rule that no new HTML-string generators are added.
- **Make the slider meaningful.** Send a 256-bin histogram plus the sample range
  in the initial `volumeData` metadata — nearly free during the range pass that
  already runs — and draw it behind the slider. Choosing an iso value blind is
  the actual problem; a bare slider only half solves it.
- **HU awareness:** when `intensityUnits` is `HU`, label the slider in absolute
  Hounsfield units and offer presets (bone 300, soft tissue ~40, skin -500).
  This is what the units field in the descriptor was for.
- **Point-cloud mode** is the more useful half for noisy MR, and is cheap: a new
  `engine/src/visualization/volumePoints.ts` walks the voxels, keeps those at or
  above the threshold, and emits world-space positions plus the sample value as
  a scalar field. No marching cubes. The result flows through the existing point
  rendering and scalar-field colormaps untouched.
- **Coloring the isosurface: gradient magnitude, not intensity.** Gradient is
  available as an optional scalar mode, while the default remains a neutral
  material that does not imply a medical colormap. But "color by intensity" is
  not the fix: every vertex sits exactly at the threshold by construction, so
  intensity is constant across the whole surface and would tint it uniformly.
  That is a property of level sets, not a gap.

  What does vary is the **gradient magnitude** — how sharp the boundary is — and
  it is already computed: `marchingCubes.ts` derives the world-space gradient
  for the vertex normal and discards its length after normalising. Capturing
  that `length` into a `scalarFields.gradient` costs one array write per vertex
  and immediately gives the existing colormap infrastructure something real to
  show. Do this first; it is the cheapest visible improvement in the whole plan.

  Position/depth and a co-registered second channel are the other meaningful
  surface colorings. Intensity color belongs to point mode, where each point
  genuinely has its own value.

- Point mode deliberately has no hidden budget or stride: an 18M-voxel series
  produces 18M points when its threshold includes every value. Any reduction
  must come from the visible scalar threshold, never invisible sampling.

#### Step 3 — clipping planes ("look inside") — implemented

Note this was **already built once and removed on user decision** — see the
discarded cross-section-slab entry near the end of this file, which preserves
the verified recipe. Volume data is a far stronger reason to have it than point
clouds were.

**Clip along the volume's own slice planes, not world axes.** This is the
correction that separates this from the discarded version, which mapped
percentages of the world-space content bounding box. What is actually wanted is
"show slices 10 to 30" — the same slice numbering the 2D viewer shows — and for
an oblique series the constant-slice planes are _not_ world-axis-aligned. Tying
the sliders to world axes would cut at an angle through the stack and the
numbers would mean nothing.

- `engine/src/visualization/sectionPlanes.ts`, two `THREE.Plane`s per volume
  axis in **global** `renderer.clippingPlanes` — not per-material, which needs
  re-apply hooks on every material recreation. EDL is unaffected because
  ShaderMaterials do not opt into clipping.
- Derive each plane from the volume's affine, which the mesh already carries in
  `metadata.ijkToWorld`:
  - The normal of a constant-k plane is `normalize(cross(colI, colJ))` — the
    reciprocal basis vector — **not** `normalize(colK)`. The two coincide only
    when the affine is orthogonal. They do for well-formed DICOM (the test MR
    agrees to 1.000000), but a sheared volume would cut wrong, and the correct
    form costs nothing.
  - World point of slice `s`: `p = origin + s * colK`. To keep `a <= k <= b`,
    add `Plane(n, -dot(n, p(a)))` and `Plane(-n, dot(n, p(b)))`; Three.js keeps
    the half-space where `distanceToPoint >= 0`.
- Sliders are labelled in **slice indices**, matching what tiff-visualizer shows
  for the same series, so the two extensions agree on what "slice 12" means.
  Three axis pairs (i, j, k), k being the interesting one.
- Purely render-time: no re-extraction, so it is instant and independent of Step
  1's round trip. This is the "dynamically, anytime" property — dragging a slice
  slider costs a frame, not the ~2.3 s an extraction costs. It is therefore the
  _right_ answer for exploring, and slice-range cropping before extraction is
  only worth exposing if someone wants slices permanently gone.
- Expect a hollow look: cutting a closed surface reveals backfaces. Setting
  `side: THREE.DoubleSide` on the volume mesh is the cheap fix; true capped
  cross-sections are a much larger job and not worth it here.
- Worth building generally rather than volume-only — point clouds want it too.
  For a file with no affine, fall back to the bounding-box behaviour of the
  original discarded implementation.

#### Step 4 — hand over every series at once — implemented

Today the export picks one series and the rest are unreachable without repeating
the command. The test dataset has four (44/26/26/36 slices).

- tiff-visualizer: replace the single-choice QuickPick with a multi-select
  defaulting to the series on screen, write one NRRD per chosen series.
- ply-visualizer: `openWith` the first, then add the rest. The webview already
  understands `isAddFile: true`; the cleanest wiring is a command taking a URI
  list rather than having tiff-visualizer replay the add-file protocol.
- Beware `plyViewer.openMultipleFiles`, which today opens only the first file
  and then shows a message claiming it opened all of them. That looks like a
  pre-existing bug and should be checked before being reused as the mechanism.
- Memory: four isosurfaces at once is four times the triangles. Multi-select
  should warn past some total.

**Also still open, unchanged:** compressed DICOM (the host-side decode path
handles only uncompressed transfer syntaxes; the webview's WASM codecs are not
reachable from the extension host), then raycasting.

Original plan follows.

Microscopy and medical stacks are 3D+time+channel data (what Imaris and arivis
call 4D/5D). The sibling `tiff-visualizer` extension already decodes them —
multi-page TIFF, OME-TIFF with C/Z/T axes, voxel spacing, per-channel LUTs and
normalization — but its render path is 2D per slice, and a volume raycaster does
not belong there. This engine has the opposite half: Three.js, WebGPU, camera
controls and transforms, but no notion of intensity stacks.

Therefore the stack arrives over a **bridge** rather than being re-parsed here.
`tiff-visualizer` item 10 covers its side: a command that hands over the decoded
volume with an explicit descriptor (dimensions, dtype, voxel spacing and units,
channel table with colors and ranges), versioned so the two repositories evolve
independently. Do not add image-format parsing for this; the point of the split
is that neither extension grows the other's half.

What belongs here, roughly in order:

1. **Volume raycasting.** 3D texture upload plus a ray-march shader in
   `engine/src/visualization/`, WebGPU with a WebGL2 fallback, following the
   existing backend-selection pattern. MIP and alpha-blended compositing modes.
2. **Transfer-function editor.** Opacity/color over intensity, the control that
   makes volume rendering usable at all. Per channel when the descriptor carries
   several, composited additively.

   **Its cheap precursor is the next thing to build:** an isosurface _threshold_
   control. Extraction already accepts any iso value and reports the sample
   range and units, but nothing exposes that — the default (300 HU, or Otsu) is
   currently take-it-or-leave-it, which for a noisy MR means one fixed and very
   dense surface. Needs a Svelte control in `engine/src/components/` plus a way
   to re-extract without re-reading the file, so the extension host has to
   retain the parsed `VolumeData` for the open document and re-run
   `buildVolumeMesh` on request. A decimation-step control belongs in the same
   panel.

3. **Clipping planes and slice planes**, reusing existing camera/transform
   infrastructure.
4. **Isosurface extraction (marching cubes).** The heavy pass runs in
   `tiff-visualizer`'s Rust/WASM crate; what arrives here is an ordinary mesh,
   which is this engine's core competence — so this may be the cheapest
   genuinely useful step, ahead of full raycasting.
5. **Object and track overlays.** Detected objects as a point cloud,
   trajectories over time as lines. The sequence-playback and trajectory
   infrastructure from the KITTI work applies almost unchanged.

Memory is the binding constraint: a full float volume is easily gigabytes, so
the descriptor must support a downsampled resolution level, and the viewer must
degrade to one rather than failing.

Explicitly out of scope: segmentation, tracking algorithms, deconvolution and
stitching. That is Imaris/arivis analysis territory and a multi-year effort;
this is a viewer.

**First slice, to de-risk the bridge before building the raycaster.** The
descriptor is the part that is expensive to get wrong, because changing it later
means changing two repositories at once. So validate it on producers that
already decode and on the cheapest possible consumer:

- Producers: **DICOM and OME-TIFF**, both already implemented in
  tiff-visualizer. `src/imagePreview/dicomDataset.ts` parses DICOM headers,
  groups planes by study/series/SOP across multiple files, and orders slices by
  projecting `ImagePositionPatient` (0020,0032) onto the normal derived from
  `ImageOrientationPatient` (0020,0037); OME-TIFF is item 2 there, with C/Z/T
  axes. Series assembly and slice ordering — the expensive parts — are done, so
  no new format work is needed to feed the bridge.
- Consumer: **isosurface first** (step 4 above), not raycasting. Marching cubes
  in the producer's Rust/WASM crate delivers an ordinary mesh, which this engine
  already renders, transforms, measures and compares. That yields something
  useful end to end while touching no shader code.
- Only once a real volume has made the trip should the raycaster start.

**The one real gap on the producer side is voxel geometry, not decoding.**
`dicomDataset.ts` reads position and orientation solely to compute a sort key
and does not read `PixelSpacing` (0028,0030) or `SliceThickness` (0018,0050) at
all, so in-plane millimetres are currently unavailable. Filling the descriptor's
world transform means: in-plane spacing from `PixelSpacing`, slice spacing from
the difference between consecutive `ImagePositionPatient` values (more reliable
than `SliceThickness`, which ignores gaps and overlap), and the rotation from
the two orientation vectors plus their cross product. That is a handful of tags
over parsing that already exists.

Two consequences for the descriptor, worth settling before any code:

- Carry a **full 4×4 affine**, not spacing-plus-origin. DICOM series are
  routinely oblique and NIfTI carries an affine natively; an axis-aligned
  industrial CT volume degrades to that trivially, while the reverse does not.
- Carry **modality-dependent intensity semantics**: CT wants Hounsfield units
  after `RescaleSlope`/`RescaleIntercept` (0028,1053/1052), which makes
  isosurface thresholds physically meaningful (bone ≈ +300 HU) rather than
  arbitrary. Microscopy channels have no such scale. The descriptor needs a
  units field, or thresholds are not portable between the two.

**NIfTI (`.nii`, `.nii.gz`)** stays worthwhile as a later producer — a 348-byte
header over raw voxels, near-free once the descriptor exists, and it reaches the
neuroimaging audience. **VGI/VOL** (text header plus raw volume) is the same
deal for industrial CT and is closest to this repository's metrology users.
Neither needs to come first now that DICOM and OME-TIFF already decode.

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

### Complete OpenCV extended distortion and route Stonex through shared camera transforms

**Current state (August 2026):** the shared Rust/WASM camera-model layer accepts
OpenCV's standard 4, 5, 8, 12, and 14 coefficient pinhole layouts. It implements
the rational denominator, thin-prism correction, tilted-sensor projection, and
iterative inverse, with a specialized five-parameter path when all extensions
are zero. Stonex preserves the complete CAL `DistCoeffs` vector and colors
points through the indexed Rust batch projector while retaining its CAL FOV
guard.

1. **Completed.** Add the standard OpenCV extended pinhole model with the exact
   coefficient order `k1,k2,p1,p2,k3,k4,k5,k6,s1,s2,s3,s4,tauX,tauY`. Implement
   the rational radial denominator, thin-prism terms, and tilted-sensor
   projection and iterative inverse according to OpenCV semantics. Keep the
   existing five-coefficient model as a compatible subset rather than inventing
   a Stonex-specific camera model.
2. **Completed for Stonex; other importers remain.** Preserve all coefficients
   when importing Stonex CAL and other OpenCV/ROS calibration files. Retain
   `fx`, `fy`, `cx`, and `cy` as ordinary shared intrinsics; principal-point
   offset is not a separate lens-shift transform.
3. **Completed for point coloring.** Remove the hand-written radial/tangential
   projection in `stonexX3aParser.ts`. Route point coloring, image-plane/frustum
   construction, and any future X3I undistortion through the existing shared
   `project`/`unproject` camera-model API and its Rust/WASM implementation.
4. Route model-to-camera, panorama rotation, camera-to-world inversion, and
   viewer-axis conversion through the extension's standard matrix/convention
   utilities. Keep file adapters responsible only for parsing and mapping vendor
   fields, not for maintaining another transformation implementation.
5. Use inverse distortion when constructing calibration frustum edge rays and
   image planes. The camera origin and central orientation are already correct,
   but strong edge distortion should be represented by the same model used for
   point-to-image projection.
6. Add OpenCV-reference golden tests with nonzero `k4-k6`, `s1-s4`, and
   `tauX/tauY`, including forward projection, iterative unprojection,
   project/unproject round trips, failure to converge, and regression coverage
   for the current five-coefficient Stonex fixture.

Do not reinterpret these coefficients as a fisheye model. This remains an OpenCV
rectilinear/pinhole camera with optional rational, decentering, thin-prism, and
sensor-tilt corrections. Make sure if some parameter are 0, that these extra
options do not lead to worse performance. So when loading a complex camera model
with all parameter 0, it should be as quick as a very easy camera model.

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

### LingBot-Map multi-array NPZ prediction import

**Reference: [Robbyant/lingbot-map](https://github.com/Robbyant/lingbot-map)** —
a feed-forward, VGGT/DUSt3R-style streaming 3D reconstruction model ("Geometric
Context Transformer"). Investigated July 2026 to see what it's good for and
what's missing. Notes for whoever picks this up:

- It outputs **point clouds only** (per-pixel unprojection), never meshes.
  Camera poses go `pose_enc` → world-to-camera extrinsic → inverted to
  camera-to-world (`closed_form_inverse_se3_general`), OpenCV-style convention
  (X right, Y down, Z forward) per the VGGT/DUSt3R lineage, though their own
  README never states axis handedness explicitly.
- `--save_predictions` writes **per-frame NPZ archives** bundling several arrays
  together: `world_points`, `world_points_conf`, `depth`, `depth_conf`,
  `extrinsic`, `intrinsic`, `images`, `pose_enc`, plus chunk-transform
  bookkeeping. No PLY/OBJ export exists in their pipeline; their own viewer is
  viser/Open3D with `--conf_threshold`/`--point_size`/`--downsample_factor`.

**Already works today:** `engine/src/parsers/npyParser.ts`'s content-based
detection (`isNpyPointCloudData`, routed in `fileHandler.ts:181-197`) already
opens a standalone `.npy` whose last dimension is 3 — `(N,3)`, `(H,W,3)`, even
batched — as a point cloud with no changes needed. Extracting `world_points` to
its own `.npy` is a working path right now.

**Missing — their actual `.npz` output isn't usable as-is:**

1. `fileHandler.ts` only does the point-cloud-vs-depth content sniff for the
   `npy` extension (line 181: `basicType.extension === 'npy'`); `.npz` always
   falls through to `NpyReader.handleNpzFile`
   (`engine/src/depth/readers/NpyReader.ts:360-446`), which requires a **2D**
   array and throws otherwise. Extend the same shape-based sniff to `.npz` so an
   archive containing a `(...,3)` array routes to the point-cloud pipeline
   instead of the depth-only one.
2. Add a dedicated importer for this multi-key layout: read `world_points` for
   XYZ, `world_points_conf` for confidence-based filtering (mirroring their own
   `--conf_threshold`), and `images` for per-point RGB — today the depth reader
   has no concept of sibling arrays in the same archive, so `extrinsic`/
   `intrinsic`/`images` are invisible to it even when present.
3. Optional follow-up: since output is one NPZ per frame, wire it into
   `engine/src/sequencePlayback.ts` so a folder of per-frame predictions plays
   back as an animated point-cloud sequence instead of one file at a time.

### Other new file formats

PTX Static FBX 3MF VTK/VTP COPC/EPT FBX

**AmiraMesh (`.am`).** Worth calling out separately because of where it came
from: surveying what arivis reads (a ~40-format imaging list — DICOM, CZI, ND2,
LIF, IMS, the whole-slide TIFF variants) turned up exactly one format that
carries geometry rather than pixels, and this is it. Everything else on that
list is either 2D — and therefore tiff-visualizer's problem — or a 3D intensity
stack, which is the volume bridge above, not a parser here.

AmiraMesh is a readable ASCII header (`# AmiraMesh BINARY-LITTLE-ENDIAN 2.1`,
`define`/`Parameters` blocks, then `@1`-style data sections) over ASCII or
binary blocks, and one file can hold point sets, line sets, triangle surfaces,
tetrahedral grids or uniform scalar fields. Scope for a first pass:

1. Points and triangle surfaces only, mapped onto the existing parser contract
   in `engine/src/parsers/`.
2. Per-vertex data sections exposed as scalar fields, reusing the colormap
   infrastructure.
3. Tetrahedral grids rendered as their boundary surface; uniform scalar fields
   deferred to the volume bridge rather than handled here.

Modest effort, and it is the one arivis format that belongs in this repository.

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

### Scan-to-scan registration (X3A stations first)

**Implemented (August 2026), all three stages, in Rust.** The solvers are
`wasm/pointcloud-parser/src/registration/` (tested with `cargo test`);
`engine/src/registration/` is the marshalling layer and its Web Worker,
`engine/src/registrationFeature.ts` the host glue, and
`engine/src/components/RegistrationPanel.svelte` the per-file UI.

**The problem.** An X3A archive is raw field data. Every embedded X3R record is
expressed relative to _its own_ capture position, and the container carries no
station pose to recover it from: the `DESC`/`INST` header block is
byte-identical across stations (instrument constants — 4096, 16128, −17000,
21500 …), and the only varying fields are timestamps. `ScanArchive.x3a` alone
holds six-plus full stations. `stonexX3aParser.ts` therefore states the honest
assumption (`sharedScannerFrameAssumed`, "All members share a scanner station")
and stacks them all on one origin, which is wrong whenever the tripod actually
moved. Registration is done downstream in the vendor software, so the viewer has
to compute it or show garbage.

**Why it is cheap here.** `parseAll` already emits one viewer entry per X3R, and
every entry already owns an editable 4×4 transform. Registration is not a
rendering or data-model feature — it computes a matrix and writes it into a slot
that exists. Everything runs in world space: a fit produces a delta `D` and the
entry's matrix becomes `D · M`, so it composes with whatever the user did by
hand.

1. **Manual point pairs → closed-form fit.** Pick 3+ correspondences across two
   clouds, solve absolute orientation with Horn's quaternion method (largest
   eigenvector of the 4×4 profile matrix via Jacobi). Deterministic, no
   dependencies, and the workflow CloudCompare users already know. This is the
   floor: it always works, and it seeds stage 3 when stage 2 has nothing to bite
   on.
2. **4-DoF coarse auto-align.** The lever that makes auto-registration tractable
   _for this data specifically_: a terrestrial scanner is leveled by its
   dual-axis compensator, so station-to-station is yaw + XY (plus a little Z),
   not 6-DoF. Raster both clouds top-down, sweep yaw, and FFT phase-correlate
   each hypothesis for the XY shift; recover Z from a 1-D correlation of
   vertical histograms. Sub-second, no features, no RANSAC.
3. **Point-to-plane ICP refine.** Voxel-downsample both clouds, uniform spatial
   hash for neighbors, PCA normals on the target, Gauss-Newton on the
   small-angle parameterization (`[p×n, n]`, 6×6 Cholesky) with a distance gate
   and trimming. Point-to-plane, not point-to-point — on planar indoor/facade
   geometry it converges in a fraction of the iterations and does not slide
   along walls.

Deliberately **not** done: 6-DoF global feature matching (FPFH + RANSAC,
TEASER++). Given stage 2 it buys almost nothing on leveled terrestrial data, and
it is a large amount of machinery to maintain.

**What real archives taught the design.** The first version worked on synthetic
rooms and produced nonsense on `ScanArchive2.x3a`. Three things fixed it, and
all three are non-obvious enough to be worth recording:

- **Never size anything from the bounding box.** A station scan is a dense core
  a few metres across with a thin tail of long-range returns: half the points of
  one real scan sit inside 4.4 m while its box spans 150 m. A raster cell or a
  voxel derived from that box is an order of magnitude too coarse, and the
  overlapping structure lands in three cells. `robustExtent` — twice the
  90th-percentile radius about the median centre — is what both stages size
  themselves from now.
- **Raster verticality, not density.** Ground is most of what a scan sees and it
  looks the same everywhere, so a density raster of an outdoor site correlates
  almost as well at the wrong yaw as at the right one. Storing each cell's
  vertical extent lights up walls and edges and leaves flat ground blank.
- **Let ICP pick the yaw.** Even after both fixes, on genuinely different
  stations the correct yaw won the correlation by 1.15x — noise. The coarse
  stage now returns a shortlist of separated peaks, `registerClouds` screens
  each with a cheap ICP and keeps the best by overlap-weighted residual, and a
  later candidate must beat an earlier one by 5% to displace it (otherwise a
  symmetric room hands the win to the 180° flip, which fits every wall).

Measured after those changes, on the archives in `testfiles/lidar/`:
`Abschnitt_B` (two records of one station) returns identity at 2 cm RMS with a
0.556-vs-0.067 peak margin — it correctly says "these are already in the same
frame"; `OHP_FRONT` recovers 70.3° / 6.2 m at 1.9 cm RMS and 34% overlap in 6 s;
`ScanArchive2` recovers 325.2° / 9.8 m at 6 mm RMS and 23% overlap in 16 s.
Capping ICP's working set per scale took that last one from 398 s to 16 s
without changing the pose it converges to.

**Align all to one cloud.** `alignAllTo` registers every other loaded cloud onto
one anchor, which keeps its own transform and so defines the common frame. A
star, not a chain: each cloud is matched against the anchor directly, so one bad
pair cannot drag everything after it out of place. Pairs that fail are listed
rather than left silently wherever they landed, and a single undo restores every
transform it touched. It lives inside the per-file "Align to another cloud"
panel — the anchor is simply the file whose panel is open, which removes the
need for an anchor selector, keeps a niche feature out of the main UI, and works
for any format rather than only X3A.

**Colour resolution: the previews are not enough.** Tempting shortcut, measured
and rejected. Only a 1/8-scale preview of each camera frame survives parsing,
and it is _horizontally_ fine — 0.117 deg/px against the scan's 0.162 deg
azimuth step — so it looked like cross-station colouring could run entirely in
the webview with no new plumbing. Vertically it is not close: the X3R grid steps
about 0.009 deg per row, so a preview pixel spans roughly thirteen points and
would visibly smear vertical detail. Colouring has to reach the full-resolution
X3I frames, which means the archive bytes: either during the parse, or by
re-reading just the frames' byte ranges (the member offsets are already known)
so neither a full re-parse nor holding decoded images in memory is required.

**Station pipeline (colouring).** `StonexX3aParser.parseAll` takes an optional
`StonexStationPipelineOptions`: register every scan onto the largest
photographed one, then colour from every station's cameras
(`parsers/stonexStationColoring.ts`). Order matters — the composition that maps
another scan's points into a camera,
`viewerToCamera(frame) · T_station⁻¹ · T_scan`, only means anything once the
scans share a frame. Two things keep the result honest: each station's own scan
is an organised sphere of ranges, which gives a free depth buffer in its frame
so colour cannot be painted through a wall that station could not see past; and
a point seen by several frames takes the one that saw it nearest the image
centre, scored on the same scale the parser's first pass uses. Already-coloured
points are left alone by default and only touched under `recolorAlreadyColored`
— a camera one station away is not automatically an improvement on the one that
stood next to the surface.

Measured on `ScanArchive2.x3a` (6 scans, 2 stations, 26M points): all five
non-anchor scans register at 6-10 mm RMS, the three `linke_ecke` scans
independently agreeing on the station offset to within 7 cm, and the four
previously grey scans go from 0% to 85.6-98.6% coloured. The whole pass adds
about 31 s on top of the 20 s parse.

Two things made the first working version feel hung on a large archive, both
worth remembering: the parser handed **whole scans** to the registration solver
where the viewer's own path had always strided to 400k points, so every pair
paid a robust-extent pass and a voxel downsample over twenty million points; and
the colouring walked **every scan against every station** even when the scan was
already fully coloured, which on a three-station archive is three passes over
forty-five million points that change nothing. With both fixed, `OHP_FRONT.x3a`
(8 scans, 3 stations, 723 MB) runs end to end in 95 s and recovers three
distinct station positions — (4.91, 3.87), the anchor, and (-6.98, 8.05) — with
each station's preview sweeps landing on the same spot as its photographed scan.
Its five grey scans reach 83.6-93.1% coloured.

Colouring takes the placement the viewer already has rather than re-deriving it,
because there are many ways to get scans into one frame and the user may have
corrected one by hand; a second button re-registers first for archives that
arrive unaligned.

Still to verify in the extension: the result-application path. The pipeline runs
during a parse because that is the only time the full-resolution X3I frames are
in hand, so the UI needs to ask the host to re-read the archive with these
options set, and the loader needs to apply the per-scan
`metadata.stationTransform` on the way in.

**Scope honesty.** This gets stations visually together for inspection. It is
not survey-grade: no targets, no network adjustment, no loop closure. The panel
says so. Anything beyond that belongs in Reconstructor or CloudCompare.

**Rust, and what made it fast.** The first version was TypeScript on the render
thread. Porting it moved the work into a worker so a sweep never freezes the
viewer, but the port alone changed the runtime by nothing at all — the pose came
back identical to four decimal places and a hair _slower_. Two structural fixes
did the actual work, and both were invisible until profiled:

- **The spatial index must be sparse.** A dense lattice over the bounding box
  needs billions of cells at the correspondence gate's resolution, because the
  box is set by a few long-range returns 150 m out while the structure sits in
  the first few metres. The cell-count cap then inflated cells to ~1 m, each
  holding thousands of points, and every nearest-neighbour query became a linear
  scan: **0.65 s per ICP iteration**. Hashing the occupied cells makes empty
  space free and the cell size can stay at the gate. One full ICP run went from
  **58.4 s to 2.3 s**.
- **Prepare each scale once.** Building a level — voxel downsample, grid, PCA
  normals over the target — dwarfs the iteration loop that uses it, and the
  candidate screening runs ICP six times over the same pair. `IcpPyramid` builds
  the levels once and every attempt borrows them.

One environment constraint the port ran into, worth knowing before putting any
other worker in the webview: **a VS Code webview cannot construct a Web Worker
from the extension's bundle.** The document is `vscode-webview://` while the
script is served from `vscode-cdn.net`, and a worker script has to be
same-origin. The standalone page is unaffected, which is why every Playwright
spec passed while the extension's Align button did nothing at all. The solvers
therefore keep a working in-page fallback
(`registration/wasmLoader.browser.ts`), and `registration-fallback.spec.ts`
blocks `Worker` to hold that path honest. Getting the work off the UI thread in
the extension means running it in the extension host — a genuinely separate
process — rather than in a webview worker.

End-to-end auto-align on the real archives, unchanged poses throughout:
`ScanArchive2` **16.0 s → 2.0 s**, `OHP_FRONT` 6.2 s → 1.7 s, `Abschnitt_B` 4.3
s → 1.3 s.

The neighbour search is the same kernel the cloud-to-cloud distance item below
needs; `registration::point_index` should be its caller rather than a second
implementation.

### Timeline: generalize sequence playback into a real time axis

Prompted by a comparison with [Rerun](https://rerun.io), whose single biggest
capability this viewer lacks is a timeline. Rerun logs every entity against one
or more timelines and lets you scrub them; here, time exists only as
`sequenceMode` — an index-based player over a file list
(`engine/src/sequencePlayback.ts`, `state/ui.svelte.js`,
`components/SequenceControls.svelte`), where exactly one file is visible at a
time and "time" is its position in the array.

That is the right primitive but too narrow. What is missing:

1. **Timestamps, not indices.** A frame should carry a time value, parsed from
   the source where one exists (KITTI `timestamps.txt`, TUM/RealSense pose
   files, X3A capture metadata, file mtime as the fallback) and be scrubbed on a
   continuous axis. Files at irregular intervals then play back at their real
   spacing instead of uniformly.
2. **More than one thing on the axis.** Today the timeline owns visibility of
   the whole scene. It should be per-file: a static reference cloud stays
   visible while a moving lidar frame advances, and two sequences with different
   frame rates resolve independently (each file holds the sample nearest the
   current time, or nothing if it has not started yet).
3. **Time-varying transforms.** A trajectory file is a sequence of poses, not a
   sequence of geometries. Being able to bind a per-file 4x4 to the time axis
   makes camera-pose JSON and the dataset workflows in
   `depth/datasetWorkflow.ts` animate for free, and is a prerequisite for
   anything resembling Rerun's transform tree.

Scope for a first pass: keep `sequencePlayback.ts` as the frame cache and
prefetch layer, move the axis itself into a `state/timeline.svelte.js`, extend
`SequenceControls.svelte` into a scrubber showing per-file frame extents, and
drive visibility through the existing `fileVisibility` path rather than a second
mechanism. The eviction/cache logic already there is the hard part and is
already solved — this is mostly a data-model change.

Deliberately out of scope: an entity-component store and a logging/streaming API
in the Rerun sense. Those pay off when data arrives incrementally from an
instrumented program, which is not this viewer's entry point.

### Linked 2D/3D views for depth and projected data

The other feature worth taking from Rerun, and cheap here because the math
already exists. When a cloud came from a depth image, `engine/src/depth/`
already knows the intrinsics, the camera model and the pixel grid that produced
every point — but once `applyDepthResultTypedArrays` has run, the point cloud is
a flat vertex array with no way back to the pixel it came from.

The feature: show the source depth (and color) image in a panel next to the 3D
view, and link the two directions.

1. **Point → pixel.** Keep the `(u, v)` of each generated point alongside the
   positions in the depth result, so the existing picker
   (`point-picking.spec.ts`, `WebGPUPointPicker.ts`) can report an image
   coordinate, and hovering a point highlights it in the 2D panel. For a dense
   grid this is an index computation rather than stored data; for sparse or
   filtered results it needs an explicit index array.
2. **Pixel → point.** Hovering the image highlights the corresponding 3D point
   and shows its depth value — the useful direction for spotting bad pixels,
   invalid-depth regions and distortion-model mistakes.
3. **Reprojection overlay.** With a camera pose available, project any visible
   cloud into a selected camera's image plane and draw it over the color image.
   This is the actual diagnostic: it shows immediately whether the intrinsics,
   the distortion model and the OpenGL/OpenCV convention are right, which today
   can only be judged by eyeballing the 3D result.

The 2D panel should be a Svelte component over a plain canvas, reusing
`depth/colorImageForDepth.ts` for the image data — no second Three.js scene.
Step 3 shares the projection code with `DepthProjector` and must use the same
camera model, not a reimplementation.

### Moving more TypeScript to Rust

Inventory re-taken August 2026 (second pass, after the `camera-models`
extraction and the X3A work). Current split: **48,775** lines of TS/JS/Svelte in
`engine/src/`, **7,846** in `src/` (both excluding tests), against **11,638**
lines of Rust (`wasm/pointcloud-parser` 6,725, `wasm/tiff-decoder` 3,865,
`wasm/camera-models` 1,048) — Rust is about 17% of the codebase. Effort is
explicitly not the limiting factor here; the limiting factor is that a second
implementation is a liability, so the ordering below is by "removes a duplicate
or a real CPU cost", not by line count.

**The rule this list follows: replace, don't shadow.** Every item is done when
the TypeScript version is _deleted_, not when a Rust version exists beside it.
See the drift already paid for below.

**How far this can go.** Everything portable on this list is roughly 11-13k
lines, which would take Rust to about a third of the codebase. It cannot go
further: the VS Code host (`src/`, the `vscode` API is JS-only), the Three.js
scene graph and render loop, the Svelte UI, and the `postMessage` glue are
permanently TypeScript — see "Explicitly not worth porting" below. "Rust by
default" therefore means _Rust by default for compute_; it is not a plan to
retire TypeScript.

**And porting is not automatically a win.** The first X3A port (`e9fecea`, "port
x3a loading to rust, but issues doesnt make it faster") landed without a speedup
and needed a follow-up (`b05ece8`) to actually move the clock. Parsing is
frequently memcpy- and IO-bound, and WASM cannot read a JS buffer in place, so a
naive port pays a whole extra copy of the file (the same constraint recorded
under "Load-pipeline IO"). Each item below should therefore state what it wins —
CPU, a deleted duplicate, or a boundary crossing removed — and be measured
against that claim, not merely completed.

#### 0. Route the engine through the Rust parsers that already exist

Not new Rust — wiring, and the highest-value item on the list.
`src/wasmPointcloud.ts` exposes `parse_xyz`, `parse_pts`, `parse_ascii_ply`,
`parse_pcd_ascii`, `parse_pcd_binary` and `StreamParser`, but it is
**extension-host only**, and every call site falls back to the JS parser on any
failure. The engine loads `pkg-web` for exactly three things — `lidarParser.ts`
(LAS/LAZ/E57), `registration/`, and the `tiff-decoder` kernels behind
`depth/readers/tiffWasm.ts`. Consequence: in the standalone page and in the
webview, the TypeScript parsers in `engine/src/parsers/` are _the only_
implementation, and the Rust ones never run.

That is where the known drift comes from: the Rust ASCII path skips the extra
scalar fields the TS parsers expose. Two implementations, one of which is
exercised only in Node, is the worst configuration.

Work: make the engine load `pointcloud_parser` from `pkg-web` for these formats
the same way `lidarParser.ts` already does, bring the Rust ASCII path up to
parity on extra scalar fields, then delete the corresponding TS paths. After
this, `wasmPointcloud.ts` is a Node-side convenience over the same crate rather
than a separate universe.

Caveat from the registration work: a webview Web Worker is _not_ a separate
process, and `registration/wasmLoader.browser.ts` plus a `Worker`-blocking spec
exist because of it. Whatever loads the parser in the browser needs the same
honesty test, or plan to keep the load off the UI thread in the extension host.

**Partly done (August 2026): XYZ variants and PTS.**
`engine/src/parsers/ pointcloudWasm.ts` is the shared wrapper — it loads the
crate through the registration loader, which already resolves the package in all
four builds, and marshals into the packed typed arrays the format registry
expects. `parsers/ptsParser.ts` and `parsers/xyzVariantParser.ts` are
**deleted**, and with them every JS fallback at the PTS and XYZ call sites in
`src/`: a failure to load the crate is now an error the user sees, not a silent
second implementation. `ascii-rust-parsers.spec.ts` loads all four layouts in a
real page, so "the browser actually reaches the crate" is a test rather than a
claim.

Two things surfaced doing it, both worth knowing before the next item:

- **The browser loader was returning a hand-picked subset** of the module (the
  four registration functions), so `parsers/stonexWasm.ts` — which casts the
  loader's result to its own view of the crate — got `null` in the webview and
  the standalone page while working in the extension host. It now resolves the
  whole namespace. Anything that loads the crate in the browser should go
  through it rather than importing `pkg-web` a second time.
- **Parity is not only about scalar fields.** Rust `parse_pts` was missing the
  9-column (x y z r g b nx ny nz) layout and used the 0-1-vs-int colour
  heuristic, which turns a legitimately dark `1 1 1` row white. Both are fixed
  and covered by `cargo test`. Check each remaining format the same way — the
  Rust side is not automatically the superset.

**Then PCD, in the same pass.** `parsers/pcdParser.ts` is **deleted**, and with
it the last JS fallback at every PCD call site. Closing the gaps was most of the
work, and each one was a real difference, not a tidy-up:

- **`binary_compressed` did not exist in Rust at all.** It is now an LZF
  decompressor plus a column-major reader, both tested.
- **NaN points were kept.** PCL marks an invalid range pixel with NaN
  coordinates rather than omitting it; the TypeScript parser dropped those rows
  and the Rust one did not, so the same file produced different point counts
  depending on which parser ran.
- **The header never crossed the boundary**, which is why
  `pcdViewpointIsIdentity` existed: a cloud with a real VIEWPOINT had to avoid
  the fast parser entirely. `parse_pcd` now returns the header as JSON, and the
  viewpoint gate is gone from the whole-file path. It remains on the _streaming_
  path, which reads rows without a header and genuinely cannot carry it.
- Intensity aliases (`reflectivity`/`reflectance`/`remission`) and
  case-insensitive field names, both of which the TypeScript parser had.

Item 0 is therefore done for XYZ, PTS and PCD; ASCII PLY came with item 1.

#### 1. Binary PLY

The single biggest CPU item still in TypeScript.
`engine/src/parsers/plyParser.ts` is 1,247 lines, of which
`parseBinaryDataOptimized` (≈ lines 703–871) plus `readBinaryValue` /
`readBinaryValueFast` are a hand-rolled `DataView` loop. The Rust crate has
`parse_ascii_ply` only — `StreamParser` explicitly rejects binary and mesh PLY.
Binary PLY is the format the large perf-test files in the repo root use, so this
is where a Rust port actually shows up on the clock.

Three things must come along or the port is a regression:

1. `isGaussianSplatLayout` / `isSplatConsumedProperty` — the 3DGS detection that
   drives DC coloring and the Spark splat toggle.
2. `isExtraScalarProperty` / `collectExtraScalarTargets` /
   `assembleScalarFields` — the scalar-field surface the colormap UI reads.
3. Face elements, since PLY is also a mesh format here.

Big enough to be worth doing properly: a real property/element table in Rust
rather than the per-value type switch the TS version needs.

**Done (August 2026), and it turned out there were three decoders, not two.**
`wasm/pointcloud-parser/src/ply.rs` is the whole format in one place — header,
ASCII and binary bodies (both byte orders), faces, scalar fields and 3DGS DC
colour — built as the property/element table this item asked for. All three
carry-alongs above came with it, and each has a `cargo test`.

What was deleted:

- **`plyParser.ts` went from 1,247 lines to 288**: the ASCII parser, the binary
  parser, the two `readBinaryValue` variants and the headerless-XYZ fallback are
  gone. What remains is the type definitions and `parseHeaderOnly`, which reads
  a header and never touches a point.
- **The webview's second binary decoder** —
  `binaryDataHandlers.handleUltimateRawBinaryData`, ~250 lines of `DataView`
  loop driven by a property/offset table the extension host computed. This was
  the one that mattered: it was a whole separate implementation of splat colour
  and scalar fields, sitting a message boundary away from the first, and it is
  the path the biggest files take.

The transfer path changed shape to allow that, and the change is worth knowing
about: **the extension host now sends the whole PLY file rather than slicing out
the vertex region**, because the parser reads the header itself. That removed
`vertexStride`, `propertyOffsets`, `faceCountType`, `faceIndexType` and
`splatHeaderData` from the message (a Gaussian file no longer needs its header
re-attached for Spark), and `parseHeaderOnly` now returns only `headerInfo` and
`binaryDataStart`. The fetch path already downloaded the whole file, so it pays
nothing; the postMessage path sends the header bytes it previously stripped.

**Measured, and the first version was a regression.** On `test_pc6_binary.ply`
(7.9M points, 203 MB, `double` x/y/z + `uchar` rgb) in the F5 host, the parse
phase went from **65-101ms** on the JavaScript reader to **562-764ms** in Rust —
about 50% on total load. Two separate causes, found by timing the parser
natively (`examples/bench_ply.rs`, which exists for this) at **250ms**, i.e.
already 3x the JavaScript loop before any boundary was involved:

1. **The loop.** It staged every property into a `Vec<f64>` per vertex and then
   re-dispatched through a `match`, pushing into growing vectors: roughly three
   bounds and capacity checks per value, where the JavaScript did one intrinsic
   load into a pre-sized array. The deleted TypeScript had a `fastEligible`
   specialization for exactly the common layout, and nothing replaced it.
2. **The boundary.** 203 MB copied in, ~119 MB copied back out, plus the wasm
   memory growth that entails.

Both are addressed:

- `read_vertices_fast` is the specialization: float/double x/y/z, `uchar` r/g/b,
  optional float normals and intensity, offsets fixed before the loop, output
  buffers pre-sized and written by index. Properties with no target are dropped
  from the walk entirely, which matters most on 3DGS files (62 declared, ~7
  read). Native **250ms → 50-120ms**; in-page parse **~650ms → ~130ms warm**.
- `parse_ply_at` plus `alloc`/`dealloc` let the webview stream a fetch response
  straight into wasm memory and parse it where it lies, so the file never
  becomes a JavaScript `ArrayBuffer` at all (`parsePlyFromResponse`). Measured
  in a browser on the same file: streamed fetch+parse **224-324ms** against
  arrayBuffer+parse **264-304ms**.

Two things learned that generalize to the remaining items:

- **A generic property walk is not free.** The obvious Rust port — read every
  declared property into a buffer, then dispatch — is several times slower than
  a JavaScript loop that reads only what it needs. Specialize the common layout
  and skip untargeted properties.
- **The first parse in a fresh webview is the expensive one**, because wasm
  memory has to grow to hold the file plus its output. Warm re-parses in the
  same page are 2x faster and will flatter any benchmark that loops.

Still worth re-measuring in the F5 host against the `PERF[ply/…]` lines above,
since the browser numbers here come from a localhost dev server rather than the
webview's asset protocol.

#### 2. NPY / NPZ

One Rust reader collapses three TS paths: `parsers/npyParser.ts` (274),
`depth/readers/NpyReader.ts` (447), and the NPZ handling threaded through
`fileHandler.ts`, `depth/depthConversionPipeline.ts` and
`formats/builtinFormats.ts`. NPY is a trivial format (magic, version, an ASCII
dict header, then raw data); NPZ is a zip container, which is the only real
dependency (`zip` + `flate2`). Low risk, good ratio, and it removes the split
between "NPY as points" and "NPY as depth" reading the same header twice.

**Done (August 2026).** `wasm/pointcloud-parser/src/npy.rs` reads both, and the
two TypeScript readers are down to **721 → 205 lines** of interpretation with no
parsing left in them: `npyParser.ts` decides what a point-cloud shape is,
`NpyReader.ts` decides which array of an archive to show and whether its name
means depth, disparity or inverse depth. The Rust side exposes `npy_inspect`
(headers only, cheap enough for file-type detection) and `npy_read(data, name)`.

It was not only deduplication — the duplicated readers were each wrong in ways
the other was not:

- **`numpy.savez_compressed` output was silently skipped.** The hand-rolled zip
  walker read only _stored_ entries and `console.warn`ed past deflated ones, so
  a compressed archive produced "contains no readable arrays". `zip` + `flate2`
  reads both.
- **A one-dimensional shape threw.** numpy writes `(100,)`, whose trailing comma
  produced an empty token that `parseInt` turned into `NaN`, which the header
  parser treated as fatal.
- **Fortran-ordered arrays were read as row-major**, i.e. transposed, silently.
  They are now refused with a message that says so, which is the honest
  behaviour until someone needs them transposed properly.
- The point-cloud path built **a JavaScript object per point**; it now returns
  the flat XYZ buffer the geometry wants.

One thing this exposed and did _not_ change: `refineCategory` had to become
async (reading a shape means loading the wasm module), and with it
`detectFileTypeWithContent`. That detection is only reached from drag-and-drop
and the extension host — `parseMultipleFiles` still keys on the extension alone,
so an `(H,W,3)` NPY picked through the file dialog in the standalone page is
still treated as a depth image. That inconsistency predates this work; fixing it
is a one-line change in `parseMultipleFiles` and belongs with whoever wants that
behaviour.

#### 3. Volume and isosurface kernels

`visualization/marchingCubes.ts` (429) + `marchingCubesTables.ts` (326) +
`isosurface.ts` (260) + `volumeVoxels.ts` (362) ≈ 1,400 lines of pure array math
with no DOM and no Three.js object handling until the very end, where a
`Float32Array` of triangles becomes a `BufferGeometry`. Textbook fit for the
Rust/WASM preference at the top of this file, and unlike the parsers there is no
existing duplicate to reconcile. Also the piece most likely to be shared with
tiff-visualizer's volume work, so it argues for the Cargo workspace in the item
below.

#### 4. NRRD

`parsers/nrrdParser.ts`, 504 lines: text header plus raw/gzip-encoded payload.
Straightforward in Rust, shares `flate2` with item 2, and belongs next to the
volume kernels it feeds.

#### 5. Stonex X3A — partially

`parsers/stonexX3aParser.ts` is the largest single TS parser at 1,376 lines, but
most of it is container walking, `DESC`/`INST` header interpretation and station
bookkeeping — logic, not throughput. Port the per-record point/pixel decode;
leave the container and metadata layer in TypeScript, where it is easier to
change as new archives turn up. Note it already delegates camera projection to
the shared Rust OpenCV pinhole batch projector, so the boundary exists.

#### 6. Depth image decoding and projection

`engine/src/depth/` is 6,755 lines, and the compute half of it belongs in Rust
next to `camera-models`, which already owns the projection kernels.

**Split in two, and the first half is on hold (August 2026).** The pixel readers
should not be written here at all: `tiff-visualizer` already has Rust decoders
for every one of them, and the plan is to share that code rather than port it a
second time — see "Shared core with tiff-visualizer" below for the mechanism and
the order. The projection and conversion kernels below are this repository's own
code, are not shared with an image viewer, and can go ahead independently.

Port:

- **The pixel readers** — _waiting on the shared crate; do not start here._
  `readers/PngReader.ts` (408), `readers/PfmReader.ts` (65),
  `readers/ExrReader.ts` (71), `readers/Rgb24Reader.ts` (137).
  `readers/TifReader.ts` (117) and `readers/tiffWasm.ts` (471) already front the
  `tiff-decoder` crate, and `ExrReader` already delegates to it, so the shape is
  settled; what is actually missing is PFM and full-bit-depth PNG, and both
  exist in `tiff-visualizer` today. `Rgb24Reader` is packing-mode interpretation
  rather than decoding and stays in TypeScript either way. Once the shared crate
  lands, `DepthRegistry` dispatches to one Rust surface instead of five
  hand-rolled decoders.
- **`DepthProjector.ts` (350) + `DepthConverter.ts` (255) +
  `depthConversionPipeline.ts` (423)** — per-pixel disparity/depth conversion
  and unprojection to XYZ. This is the batch kernel `camera-models` was
  extracted for, so the boundary already exists; the win here is that the whole
  W×H buffer stops crossing it twice (in as depth, out as points).

  **Done (August 2026), and it was item 0's shape again: the Rust already
  existed.** `normalizeDepth` and `projectToPointCloud` both called the kernel
  first and kept a full JavaScript implementation behind it — a projection loop
  for `pinhole-ideal` and `fisheye-equidistant`, and a complete normalization
  path. So the same file could project differently depending on whether the wasm
  had loaded, and only for those two models. Both fallbacks are gone;
  `DepthProjector.ts` is **350 → 105 lines**, and callers
  (`DepthConverter.processDepthToPointCloud`, `convertDepthToUnified`,
  `DepthWorkerClient.processOnMainThread`) now ensure the module is up rather
  than degrading silently. `depthWorker.ts` already did.

  **What the fallback was hiding, found immediately after removing it.**
  `cameraCoefficientsFromParameters` returned the caller's `coefficients` array
  verbatim, without looking at the camera model. The depth panel keeps its
  comma-separated coefficients field across a change of model, so switching from
  an OpenCV fisheye to an ideal pinhole handed the kernel four coefficients for
  a model that takes none. The kernel refused the call — and the JavaScript
  fallback then projected the image as an undistorted ideal pinhole and said
  nothing. So this was not merely a hidden error: **a file could be displayed
  undistorted while a distorted model was selected**, which looks plausible and
  is wrong. Coefficients are now fitted to the effective model
  (`fitCoefficientsToModel`), covered by `cameraCoefficients.test.ts` and by two
  cases in the browser spec.

  **An all-zero distortion set now drops to the closed-form model**, which was a
  27x speed-up on the case that surfaced it. The distorted models have no
  closed-form unprojection, so every pixel runs a Newton solve; a 5120x5120
  depth image at `fisheye624` with twelve zeros spent about twenty seconds
  iterating — most of it on pixels outside the model domain, which only fail
  after exhausting their iterations — to produce exactly what the equidistant
  closed form gives immediately. The reduction is exact, not an approximation:
  with zero coefficients the OpenCV pinhole distortion is the identity and the
  fisheye radial polynomial is `radius = theta`. Measured at 2048x2048: **7.0s →
  0.26s, bit-identical output**. `resolveCameraModel` returns the model and its
  coefficients together so the two cannot disagree.

  This also retired the "input image is already rectified" checkbox: zeroing the
  coefficients says the same thing, and now does the same thing. Note the
  consequence — a calibration that declares itself rectified _and_ carries
  non-zero coefficients will now have them applied.

  **Unused coefficients are now free, which is what makes consolidating the
  model list possible.** Measured on a 1024x1024 depth image:

  | configuration                                           | before        | after       |
  | ------------------------------------------------------- | ------------- | ----------- |
  | OpenCV pinhole, 5 coefficients vs the same padded to 14 | 165ms / 165ms | unchanged   |
  | fisheye624 with only its 4 radial terms                 | 1707ms        | **1394ms**  |
  | Kannala-Brandt KB3, same 4 values                       | 1384ms        | 1393ms      |
  | fisheye624 with a real k5 or prism term                 | 1775ms        | 1737-1799ms |

  Two mechanisms, and the first turned out not to be the expensive one:

  1. `camera-models` now skips the 2D Newton inversion when Fisheye624's six
     tangential and thin-prism coefficients are all zero, the same way
     `OpenCvPinhole` already skips on `has_rational`/`has_prism`/`has_tilt`.
     Correct, but worth only a little.
  2. The cost is `invert_radial`, a **bisection of up to 512 steps** that
     evaluates the radial polynomial at each one — so six terms instead of four
     is a third more work per pixel. `resolveCameraModel` therefore reduces
     Fisheye624 carrying only its first four radial terms to `fisheye-kb3`,
     which is the same polynomial and the same output to the last digit.

  The ideal-pinhole entry is gone from both model pickers: an OpenCV pinhole
  with zero coefficients _is_ it, and now resolves to it automatically. The
  fisheye entries could collapse the same way — kb3 and OpenCV fisheye are the
  identical polynomial over the identical four slots, differing only in whether
  the labels start at k0 or k1 — but the list is left as it is for now.

  **Done, and it was not the bisection — it was a loop-invariant scan.** The
  suspicion above was wrong in an instructive way. `invert_radial`'s solve is a
  Newton iteration with a bisection fallback and converges in a handful of
  steps. The cost was the code _before_ it: a 512-step scan of the derivative to
  find where the polynomial stops being monotonic, which depends on the
  calibration and **not on the pixel**, and which therefore recomputed the same
  number 26 million times on a 5120x5120 frame.

  `RadialDomain` now holds that result, built once per image and passed to
  `unproject_with_domain`; `unproject` keeps its old signature by building one
  on the spot. The arithmetic is untouched, so the answers are identical bit for
  bit — which is what the tests assert.

  |                                                  | before | after               |
  | ------------------------------------------------ | ------ | ------------------- |
  | native, 1M unprojections, kb3                    | 1052ms | **52.7ms** (20.0x)  |
  | native, fisheye624 with 8 zeros                  | 1416ms | **63.7ms** (22.2x)  |
  | native, fisheye624 with prism terms              | 1549ms | **148.1ms** (10.5x) |
  | in-browser, full 1024x1024 depth projection, kb3 | 1538ms | **102ms**           |
  | in-browser, fisheye624 with prism terms          | 1910ms | **176ms**           |

  How it is held to being correct, since "roughly right" is not good enough for
  a camera model:

  - **A reference implementation** of the pre-hoist `invert_radial`, scan
    inline, kept in the test module. Over 200 targets per calibration the two
    must agree on `to_bits()`, not merely to a tolerance.
  - **An independent brute-force inverse**: sample the forward polynomial at
    200,000 points and take the closest. The solver must land within one sample
    spacing of it.
  - **Backward then forward**: a grid of pixels unprojected to rays and
    projected back must return to the same pixel within 1e-6.
  - **Forward then backward**: a fan of rays projected and unprojected must come
    back pointing the same way (dot product > 1 - 1e-9).

  The round-trip angles are capped per family, and that cap is a property of the
  models rather than a convenience: a pinhole with real barrel distortion stops
  being monotonic well before the horizon, so beyond that the forward map folds
  over, two rays share a pixel, and the inverse legitimately returns the other
  one. Measured on the k1 = -0.28 calibration in the tests, a ray 63 degrees
  off-axis comes back 45 degrees off-axis, converged and wrong. Pinholes are
  therefore exercised to 40 degrees and fisheyes to 69.

  **A process note worth keeping.** The first attempt appeared to produce no
  speedup at all in the browser, which nearly buried the change. The edit to
  `tiff-decoder` had never been applied — an interrupted tool call whose build
  half was re-run while its edit half was not — so the caller still used the
  per-pixel path while the kernel had the fast one. Browser timings under load
  varied by 10% run to run and hid it; the native benchmark
  (`camera-models/examples/bench_unproject.rs`) showed 20x immediately and made
  the discrepancy obvious. **Measure the kernel natively before concluding an
  optimization does not work.**

  **What is left in this area:** `unproject_opencv_pinhole` is now the slowest
  path (714ms per megapixel against the fisheye's 102ms), and it has its own
  per-pixel 2D Newton solve with no loop-invariant part left to hoist. Trimming
  the radial polynomial to its non-zero degree is also available — the
  infrastructure to carry it now exists in `RadialDomain` — but after the hoist
  it is worth perhaps a fifth of a much smaller number, so it needs measuring
  before it is worth writing.

  Still open, and a UI decision rather than a kernel one: switching between two
  models that accept the same count keeps the numbers and silently reinterprets
  them — four fisheye k's become `[k1, k2, p1, p2]` under OpenCV pinhole. The
  panel could clear or remap the field on a model change.

  `depth-projection-kernel.spec.ts` covers it: ten cases written from the camera
  model by hand — ray geometry, the OpenGL/OpenCV flip, euclidean depth as a
  distance, the fisheye radius-to-angle map, invalid-pixel rejection, disparity
  and inverse-depth conversion, millimetres, clamping, and the grey ramp.
  Writing them found the trap in this area: **the wasm loads lazily**, so a spec
  that simply calls the kernels gets the JavaScript path and passes while
  proving nothing. It now calls `initTiffWasm()` first. The same ten
  expectations passed before and after the deletion, which is what says the two
  implementations agreed.

- **`colorImageForDepth.ts` (241)** and the colormap tables it uses, which are
  duplicated in `tiff-visualizer` — see the shared-core item below.

Do _not_ port the calibration side: `YamlCalibrationParser` (355),
`ColmapParser` (249), `CalibTxtParser` (244), `ZedParser` (215), `TumParser`
(136), `RealSenseParser` (184), `calibrationForm.ts`, `panelState.ts`,
`defaultSettings.ts`, `commentSettings.ts`. That is ~2,300 lines of small text
formats and UI state which change every time a new dataset turns up; TypeScript
is the right place for churn, and none of it is on the clock.

`depthWorker.ts` / `DepthWorkerClient.ts` stay as the thread boundary, with the
caveat from item 0: a webview Web Worker is not a separate process.

#### 7. Point-cloud math kernels

Small, pure, and each one removes a JS hot loop over millions of points:

- **`utils/intensity.ts` (127) and `utils/scalarFields.ts` (109)** — min/max
  sweeps, percentile clipping and normalization over full-length arrays, run
  again on every colormap change.
- **`visualization/robustBounds.ts` (89)** — percentile-based bounds, a full
  pass per file load.
- **Cloud-to-cloud distance** — already flagged as a Rust/WASM candidate in its
  own item above; the KD-tree in
  `wasm/pointcloud-parser/src/registration/ point_index.rs` is the index it
  should reuse rather than build a second one.

These are worth doing as one batch under a single `wasm-bindgen` entry point
rather than five crossings; individually each is too small to justify the
boundary.

#### 8. Stonex colour correction and station colouring

`visualization/stonexColorCorrection.ts` (224) and
`parsers/stonexStationColoring.ts` (466) are per-pixel and per-point loops that
sit on the far side of the boundary from the X3A decode being ported in item 5,
and colour correction is measured at 2-3% of the archive parse. Porting them is
only worth it _with_ item 5 — the point is that colour never leaves Rust, not
the 3% by itself. See "Rust: X3A parsing and colouring" below for the full
measurement.

#### Parallelism and GPU: what Rust does and does not unlock

Two follow-on questions, with opposite answers. Neither changes the ordering
above, but both change how the ported kernels should be _written_.

**Multi-core: Rust is neutral-to-better, never worse.** Three options, in
increasing order of cost:

1. **N workers, each with its own single-threaded wasm instance.** Available
   today, no build changes, no `SharedArrayBuffer`. This is already the shape
   used three times over — `parsers/lidarParser.ts`,
   `depth/DepthWorkerClient.ts` and `registration/workerHost.ts` each spawn a
   worker and transfer `ArrayBuffer`s. Chunk the input, transfer results back.
   The parallelism is identical to what TypeScript gets; Rust's contribution is
   only that each core is several times faster. **This is the default answer for
   items 6 and 7.**
2. **`rayon` inside one wasm module.** Real shared-memory parallelism, and what
   the "per-frame colouring is embarrassingly parallel" claim in the X3A item
   below actually depends on. The cost is not the code, it is the
   infrastructure: `wasm-bindgen-rayon`, a nightly toolchain with `-Z build-std`
   and `-C target-feature=+atomics,+bulk-memory,+mutable-globals`, a separate
   `pkg` output, an explicit thread-pool init before first use — **and
   `SharedArrayBuffer`, which requires cross-origin isolation.** There is no
   COOP/COEP anywhere in this repo today. For the standalone page that is two
   response headers in `engine/deploy.sh`. **For the VS Code webview it is an
   open question, and it decides whether this option exists in the product at
   all.** Settle it before planning any `rayon` work: log `crossOriginIsolated`
   and `typeof SharedArrayBuffer` from the webview. One line, and it is a
   prerequisite, not a detail.
3. **`rayon` on the native and extension-host paths — already free.**
   `cargo test`, `cargo bench` and `examples/convert_ply_lidar.rs` are ordinary
   native Rust with real threads. The extension host counts too:
   `wasmPointcloud .ts` runs in Node, where `SharedArrayBuffer` exists
   unconditionally, so wasm threads work there with no isolation requirement.
   That is an argument for parsing in the host and transferring, which
   `providerHandlers/binaryTransfer .ts` already does.

**WebGPU: Rust is irrelevant, and `wgpu` would actively hurt.** The compute
shader is WGSL either way — it is a separate string compiled by the browser, not
Rust and not TypeScript — so porting CPU-side code to Rust buys nothing towards
a GPU port. The trap is `wgpu`: compiled to wasm it targets WebGPU correctly,
but it wants to own its own `GPUAdapter`/`GPUDevice`, and this engine already
has one in `rendering/rendererBackend.ts` (Three.js `WebGPURenderer`). Two
devices cannot share buffers, so every result would round-trip through CPU
memory to reach a `BufferGeometry` — which defeats the purpose. **Dispatch WGSL
from TypeScript against the renderer's existing device.** Rust's role in a GPU
kernel is authoring and validating it on the CPU side, nothing more.

One genuine friction point Rust adds: data living in wasm linear memory reaches
a GPU buffer through a `Uint8Array` view over `memory.buffer` handed to
`queue.writeBuffer` — no extra copy, but **the view is invalidated whenever wasm
memory grows**, so it must be re-created per call and never cached. TypeScript
has no equivalent footgun.

**The consequence for the items above.** Items 6 and 7 are per-pixel and
per-point loops with no cross-element dependencies — exactly the ones that would
later want option 1, or the GPU. Write them so the kernel is a plain function
over a slice, with chunking, threading and dispatch kept outside it. That costs
nothing now and keeps both doors open. Do not build for `rayon` or for WebGPU
speculatively; the isolation question above is unanswered, and the WebGPU
backend is still measured as ~2x slower than WebGL.

#### Explicitly not worth porting

- **Mesh loaders** — `objParser` (319), `stlParser` (355), `offParser` (250),
  `gltfParser` (423), `mtlParser` (153), `kittiBinParser` (106). Small, not hot,
  and glTF leans on the Three.js loader. Porting these buys nothing but a second
  place for bugs to live.
- **The VS Code host** — all of `src/` (7,846). The `vscode` API has no Rust
  binding: custom editors, commands, workspace config and `postMessage` are
  JS-only by construction. This layer can get thinner, never native.
- **Everything DOM- or scene-bound** — `components/` (4,922 Svelte), most of
  `visualization/`, `rendering/` (1,265), `postprocessing/` (288),
  `controls.ts`, `state/`, `main.ts` (4,796). Roughly 35k lines. Going native
  here means dropping Three.js for `wgpu`, which also throws away the
  glTF/OBJ/STL addon loaders, the Spark splat renderer and every tuned
  camera-control behaviour. That is a rewrite of the product, not a port.
- **Calibration and dataset text parsers** — see the exclusion list in item 6.
- **The Spark/splat path** — `visualization/splatMode.ts` (589) is orchestration
  of a JS library; there is nothing to compute.

#### What a port actually costs

Worth stating once, because it undercuts naive line-count reasoning: a ported
module does not delete all of its TypeScript. It needs a `wasm-bindgen` binding
plus a TS wrapper for loading, typing and error fallback, so a 1,000-line parser
becomes roughly 800 lines of Rust and 150 of TS, not zero TS. Budget the
remaining wrapper, and count the item as done only when the _second
implementation_ is gone (the rule above), not when the file count drops.

#### Ordering and stopping rule

0 → 1 → 2 → 6 → 3 → 4 → 5 → 8, with 7 folded in wherever a crossing is already
being added. Item 6 moves ahead of the volume work because it deletes five
hand-rolled decoders and removes a live boundary crossing, where 3 and 4 add new
Rust beside no existing duplicate.

**Where this stands (August 2026):** 0, 1 and 2 are done. Item 6 is split — its
pixel readers wait for the shared crate (see above), its projection and
conversion kernels do not and are the next thing to pick up. After that the
order is unchanged: 3 → 4 → 5 → 8.

Stop after any step whose TypeScript counterpart could not actually be deleted.
A port that leaves a fallback in place has not reduced the maintenance surface,
it has doubled it — which is precisely the state item 0 exists to clean up.

### Rust: X3A parsing and colouring

**Step one done (August 2026): `wasm/camera-models` is its own crate.** The
projection and unprojection kernels lived inside the TIFF decoder for historical
reasons only - nothing in them is TIFF-specific - and the point-cloud side needs
the same maths to colour scans from their photographs. Both WASM crates now
depend on it by path; it is plain Rust with no wasm-bindgen, so each binds to it
in its own way.

**Why the rest should follow.** Measured on a real archive (`OHP_FRONT.x3a`,
42.2M points, 30 frames, on the user's machine):

| Stage                   | Share  | Language      |
| ----------------------- | ------ | ------------- |
| archive directory       | ~0%    | TS            |
| X3I demosaic (now lazy) | 0%     | TS            |
| scan layout scan        | 1-2%   | TS            |
| X3R point decode        | 16-21% | TS            |
| projection + sampling   | 78-80% | split TS/Rust |
| colour correction       | 2-3%   | TS            |

So ~99% of the parse is byte handling, demosaicing, projection and sampling -
none of it inherently JavaScript. Three things follow from moving the whole
parser rather than one pass:

- **The boundary disappears.** Positions currently cross into WASM once per
  frame; on this archive that is 30 copies of 42M points. If Rust owns the
  points from the moment they are decoded, nothing crosses but the finished
  buffers, once.
- **Most of the work is wasted today.** 157.2M candidate point-frame pairs
  produce 57.1M in-frame projections and 49.0M samples: 64% are projected and
  thrown away because the candidate window is a fixed +/-30 degrees rather than
  the frame's real footprint. Inside Rust that filter can be tightened where the
  data lives.
- **It parallelises.** Per-frame colouring is embarrassingly parallel and
  `rayon` makes that nearly free on the native path, which is where the tests
  and benchmarks run.

Phase instrumentation is in the parser and reports through the normal timing
channel (`PERF[x3a/phases]`, `PERF[x3a/colour]`), with counts beside the times -
added after two wrong conclusions were drawn from single, noisy samples, one of
them taken on a code path the real load never follows.

### Shared core with tiff-visualizer (and a possible shared desktop app)

The full three-step plan lives in `tiff-visualizer/BACKLOG.md` item 11; this is
the summary of what concerns this repository.

**The two extensions stay separate.** Two marketplace listings serve two
audiences, and the render stacks share nothing — a Three.js scene with camera
controls versus a 2D canvas/WebGPU pipeline with normalization and a layer
compositor. The only real synergy is 3D volumes, and that is the bridge above,
not a merge.

**What should be shared is code, not products.** This engine reads TIFF, PNG,
PFM, NPY, NPZ and EXR as depth images; tiff-visualizer already has mature
decoders for all six, including a Rust/WASM path. Colormap tables exist in both
repositories.

**Status (August 2026): agreed, and item 6's decoder half waits for it.** The
Rust work happens in tiff-visualizer first; when it settles, the decoders move
to a third repository both extensions depend on. Nothing here should port a
pixel decoder in the meantime — that would be a third copy.

What the inventory found, which decides how hard the extraction is:

- **`wasm/tiff-decoder` here is a fork of an older snapshot of theirs.** Same
  crate name (`tiff-wasm`), same dependency list; 3,865 lines in one file
  against their 8,773 across a `formats/` tree. The local additions are the
  `camera-models` projection kernels, which theirs does not have.
- **Their decoders are already plain Rust.** `formats/*.rs` touch wasm-bindgen
  only as an error type (`Result<_, JsValue>`, `JsValue::from_str`). Extraction
  is swapping that for a `DecodeError`, not a redesign.

The shape to aim for:

1. **A separate repository, consumed as a cargo git dependency pinned by
   `rev`.** Less friction than a submodule (nothing to init or update, CI needs
   no special checkout) and no publishing ceremony per change; crates.io stays
   available later. The pin means neither extension moves until it is bumped.
2. **Plain Rust, no `wasm-bindgen`/`js-sys`/`web-sys`** — the precedent is
   `camera-models`, which both crates already bind to in their own way. Each
   application keeps its own thin binding layer, and the shared crate stays
   testable with plain `cargo test`.
3. **One Cargo feature per format**, `default = []`. This answers the obvious
   objection that the image viewer decodes far more formats than this engine
   needs: DICOM, FITS and netCDF simply are not compiled into this wasm binary.
4. **Byte-level decode only** — bytes in,
   `{width, height, channels, samples, metadata}` out. Depth semantics, units,
   invalid-pixel handling and camera models stay here; normalization, layers and
   the compositor stay there. That is the caveat below, made structural.

Order: tiff-visualizer finishes its Rust work → extract `formats/` (plus
`pipeline/stats`, `demosaic`) with native tests → tiff-visualizer consumes it
and its suite proves the move → this repository's `wasm/tiff-decoder` becomes a
thin wrapper over the shared crate plus `camera-models` → finally collapse the
NPY duplication, which now exists in three places: `formats/npy.rs` there,
`pointcloud-parser/src/npy.rs` here (item 2, deliberately, since it shipped
before this plan), and nothing else. Until step one lands, **new decoder work
belongs in tiff-visualizer only** — the fork here is already ~5k lines behind
and re-syncing two of them is the failure mode this section exists to avoid.

The TypeScript side (the duplicated colormap tables, an npm workspace) is a
separate, later migration. Coupling the two doubles the risk for no gain.

Caveat when the inventory happens: the depth readers here are not
interchangeable with an image decoder. They care about camera models, units and
invalid-pixel semantics that an image viewer does not model, while that viewer
preserves sample depth and metadata a depth reader discards. Only genuinely
equivalent code moves; `engine/src/depth/` keeps its own interpretation layer on
top of a shared byte-level decoder.

A shared Tauri desktop app is the possible third step — one application for
images and 3D, reusing this engine's webview code with a native Rust backend
rather than a Rust UI toolkit. It is explicitly gated behind the shared core and
behind tiff-visualizer's host abstraction; this repository is already ahead
there, since `engine/` proves the code runs outside VS Code.

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
4. **Interaction and rendering hardening** — Points and Splats are mutually
   exclusive per file and the Files panel shows only the controls relevant to
   the active representation. Double-click selection raycasts the gaussian
   ellipsoid surfaces directly (with center picking retained as a fallback), so
   rotation-center changes work naturally in splat mode. Spark invalidates
   frames only while it is dirty; an idle splat scene returns to demand-driven
   rendering instead of holding a constant frame rate. Switching modes and live
   splat edits request an immediate frame.
5. **Interior inspection** — a per-file maximum splat-size control clamps only
   oversized ellipsoids while preserving their color and opacity, instead of
   making both the outer shell and useful interior splats transparent. The
   slider is logarithmic from `0.01` to the file's largest splat, has an exact
   scene-unit field, updates the GPU data live, and resets to the uncapped
   maximum on double-click.
6. **Robust lifecycle/source handling** — original splat sources survive the
   extension's initial-open, add-file and fetch-fallback transfer paths;
   asynchronous decode cannot attach a ghost mesh after its file is removed.

The original GS scope is complete. Remaining ideas are optional follow-ups, not
missing pieces of the initial implementation:

- Sequence playback still uses the gaussian-center point representation; a
  `SplatMesh` rebuild for every frame is not currently intended to be real-time.
- Points and Spark data coexist in splat mode so picking and instant mode
  switching remain available. Large-scene memory could be reduced by dropping
  recreatable point color/scalar attributes while splats are active.
- The max-size edit is a debounced O(N) rewrite. A Spark dyno/GPU modifier may
  be worthwhile if profiling shows slider updates are too slow on multi-million
  splat scenes. A crop box or clipping plane would provide more targeted
  inspection than a global size cap.
- Automated fixtures currently cover 3DGS PLY and `.splat`; add SPZ, KSPLAT and
  SOG fixtures when small redistributable samples or deterministic generators
  are available.

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
