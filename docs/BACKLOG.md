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

### Volume rendering for image stacks (tiff-visualizer bridge) — bridge shipped

**Status (August 2026): the first slice is implemented and the bridge carries a
real DICOM series end to end.** What exists:

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

Ordered so each one unblocks the next. Steps 0 and 1 are prerequisites for
everything interactive; 2–4 are independent of each other once 1 lands.

#### Step 0 — anisotropy-aware decimation (do first, it changes the API)

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

#### Step 1 — retain the volume and support re-extraction

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

#### Step 2 — threshold control and point-cloud mode

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
- **Coloring the isosurface: gradient magnitude, not intensity.** The mesh
  currently renders flat grey, which is the first thing anyone notices. But
  "color by intensity" is not the fix: every vertex sits exactly at the
  threshold by construction, so intensity is constant across the whole surface
  and would tint it uniformly. That is a property of level sets, not a gap.

  What does vary is the **gradient magnitude** — how sharp the boundary is — and
  it is already computed: `marchingCubes.ts` derives the world-space gradient
  for the vertex normal and discards its length after normalising. Capturing
  that `length` into a `scalarFields.gradient` costs one array write per vertex
  and immediately gives the existing colormap infrastructure something real to
  show. Do this first; it is the cheapest visible improvement in the whole plan.

  Position/depth and a co-registered second channel are the other meaningful
  surface colorings. Intensity color belongs to point mode, where each point
  genuinely has its own value.

- Point mode needs its own budget and stride: 18M voxels can put millions of
  points above a low threshold.

#### Step 3 — clipping planes ("look inside")

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

#### Step 4 — hand over every series at once

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
repositories. The plan is an npm workspace for the TypeScript side and a Cargo
workspace for the crates, with `wasm/pointcloud-parser` and `wasm/tiff-decoder`
as members instead of islands.

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
