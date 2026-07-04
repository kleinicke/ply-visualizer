# Performance Plan — Point-Cloud Loading & Visualization

A self-contained plan to speed up **loading** and **rendering** of point clouds
in this VS Code extension, and to fix the multi-window crash. Written so an
implementer who has _not_ seen the prior investigation can pick up any item and
execute it. Read §0–§2 first for context, then the item you want in §4–§10.

---

## 0. How to use this document

Each work item has: **Issue** (what's wrong / the opportunity), **Where** (files
& functions), **Do** (concrete steps), **Risk**, **Verify** (acceptance
criteria), **Status**. Status legend: ✅ done · 🔜 ready / do soon · 🧪 try (has
risk) · 🔭 future · ❌ ruled out. Tackle in the order of §11 unless told
otherwise.

---

## 1. Architecture & key files (orientation)

Two processes, message-passing via `postMessage`:

- **Extension host (Node)** — `src/pointCloudEditorProvider.ts` (~3k lines):
  file routing by extension, file **read** (`readFileFast`), **parse** dispatch,
  **transfer** to webview, and `getHtmlForWebview` (CSP + nonced script
  injection). Entry: `resolveCustomEditor`'s `setImmediate(async …)`.
- **Webview (Chromium renderer)** — `engine/src/main.ts` (~14.7k lines, one
  `PointCloudVisualizer` class): Three.js scene/renderer, geometry build, color
  modes, materials, the render loop, and the message dispatch `switch`.

Supporting:

- `wasm/pointcloud-parser/` — **Rust→WASM** parser crate (`src/lib.rs`). Exposes
  `parse_xyz`, `parse_ascii_ply`, `parse_pcd_ascii`, `parse_at`,
  `alloc`/`dealloc`, and a streaming `StreamParser`
  (`new`/`push`/`finish`/`failed`). Core: `Col` enum, `Builder` accumulator,
  `parse_rows`, `parse_line`/`parse_numbers`,
  `ply_header_stream`/`pcd_header_stream`. Uses the `fast-float` crate.
- `src/wasmPointcloud.ts` — extension-side loader for the WASM: `parseXyzWasm`,
  `parseAsciiPlyWasm`, `parsePcdAsciiWasm`, `streamParseFile`, `marshal`. Loads
  the pkg via
  `__non_webpack_require__(path.join(__dirname,'wasm/pointcloud-parser/…'))`.
- `engine/src/parsers/` — JS parsers (fallbacks + binary): `plyParser`,
  `pcdParser`, `ptsParser`, `objParser`, `stlParser`, `offParser`, `gltfParser`,
  `npyParser`, `xyzVariantParser`, `mtlParser`.
- `engine/src/depth/` — depth→pointcloud: `DepthProjector.ts`
  (`projectToPointCloud`, `normalizeDepth`), `readers/TifReader.ts` (uses the
  sister extension's WASM TIFF decoder at `engine/media/wasm/tiff_wasm*`),
  `DepthConverter.ts`.
- `engine/src/postprocessing/EDLPass.ts` — Eye-Dome-Lighting post-process.
- `engine/src/colorProcessor.ts` — sRGB→linear LUT (`ensureSrgbLUT`).
- `engine/src/utils/perfLog.ts` — `PerfTimer` + `perfLog()`; lines go to the
  **"3D Visualizer" Output channel** (extension writes them; webview forwards
  via a `perfLog` message). Use this for any new timing.

### Build / run

- `npm run compile` (webpack: extension `out/extension.js` + webview
  `out/webview/main.js`; **CopyPlugin** copies `wasm/pointcloud-parser/pkg` →
  `out/wasm/pointcloud-parser`). **Requires Node ≥ 20** (copy-webpack-plugin
  uses `Array.toSorted`).
- `npm run build:wasm` — rebuilds the Rust crate
  (`wasm-pack build --target nodejs`), then appends
  `exports.memory = wasm.memory;` to the glue. **`pkg/` is committed** so a
  normal build needs no Rust toolchain.
- WASM in the extension host needs `--experimental-wasm-reftypes` only on Node <
  17 (Electron/modern Node is fine).
- Test by **F5** (Extension Development Host); large test files at
  `/Users/florian/Projects/cursor/test_data/testfiles/pcd_large/` (`test_pc6.*`,
  ~7.9M points, 300–640MB).

---

## 2. Measured baseline & findings (the landscape an implementer needs)

- **Pipeline:**
  `disk read → parse → transfer (ext→webview) → geometry build → GPU upload → render`.
  The cloud exists in ~5 copies at peak (file buf → WASM input → WASM output →
  JS typed arrays → GPU buffers) → drives swap on low-disk machines.
- **Parse:** Rust/WASM ≈ **550–600 MB/s** (P-cores); ~2.5–3× the JS byte parser,
  ~5× the original JS. Done for XYZ/XYZN/XYZRGB (+streaming), ASCII PLY, ASCII
  PCD, TIFF depth. PLY-binary fast path ~99ms (float32/double xyz, uint8 rgb).
- **Read is I/O-bound and cold-cache-dominated.** Internal SSD on the dev
  machine: ~250 MB/s cold (anomalous; parallelism doesn't help —
  purge-confirmed). External SSD: 777 MB/s cold. Typical machines are fast →
  parse-bound.
- **QoS slowdown:** WASM on macOS **E-cores is ~4.7× slower** than P-cores. The
  VS Code extension host runs at reduced QoS → ~2× slower than an isolated
  terminal Node (~1800ms vs ~920ms for an xyzn parse). `nice`/priority does NOT
  change it; the QoS _class_ does, and Node can't set it. Not fixable from
  extension code (only by moving work to the user-interactive renderer).
- **Streaming overlap:** kept ON for XYZ (`ENABLE_XYZ_STREAMING=true`). A
  controlled **cold A/B** (`coldab.mjs`, `sudo node`, purge before each load)
  showed it saves 0.6–1.2s on 600MB XYZ cold; costs ~300ms only warm. **Lesson:
  always A/B cold-vs-cold with cache purge — warm vs cold flips the verdict.**
- **Rendering is largely un-optimized** (this is the biggest untapped area):
  - **No LOD/decimation/octree** — every point renders every frame.
  - Renderer: `antialias:true`, soft **shadows** (a `DirectionalLight` with a
    2048² shadow map → used by meshes), `pixelRatio=min(dpr,2)` (4× fragments on
    retina).
  - **`PointsMaterial`**, square points; colors uploaded as **Float32**.
  - **No `webglcontextlost` handler** → an OOM context loss is a hard crash.
  - Render loop is **on-demand** (`needsRender`) — good. EDL is a per-frame
    full-screen pass when enabled.

### Gotchas already hit (don't re-learn these)

- `vscode.workspace.fs.readFile` returns a Node **Buffer whose `.slice()` is a
  view** — to send a byte range you must
  `buf.subarray(start).buffer.slice(off,end)`, else you ship the whole file
  (garbage geometry; tell-tale: ext "copy" ≈ 0ms).
- **VS Code webview `postMessage` has no transferables** — big ArrayBuffers are
  structured-cloned (~0.5–0.8s for 120–190MB). Can't avoid except by fetching in
  the webview.
- The geometry **`color` attribute is owned by `applyColorModeToGeometry`**
  (`main.ts`), called at the end of `createGeometryFromSpatialData`. Don't build
  a color attribute earlier — it's rebuilt/deleted there. PLY export and
  color-mode reads currently assume **Float32 [0,1]** color arrays (`main.ts`
  ~12876) — any Uint8 switch must update those reads to `.getX()`/normalized.
- `convertSrgbToLinear` (default true) currently **bakes** sRGB→linear into the
  Float32 colors via a LUT. Moving colors to Uint8 requires doing that
  conversion **in the shader** instead (see §7).

---

## 3. Constraints & principles (non-negotiable)

- **Linux is a primary target.** Anything unreliable on Linux in the VS Code
  Electron webview is out for now → **no WebGPU yet**.
- **No platform-specific native builds.** Rust = **WASM only** (no
  `napi-rs`/mmap/ native threads; WASM threads only with COOP/COEP, treat as
  uncertain).
- **No user-noticeable quality regression.** Reduced detail _during camera
  motion_ is OK only if imperceptible once idle.
- **Always keep the JS fallback** so a WASM/loader failure never breaks loading.
- **Comment the "why" in code**, especially crash-safety and quality tradeoffs.
- Prefer **one unified, clean Rust/WASM loader** (§5) as the backbone.

---

## 4. Crash resilience (200M pts across windows) — highest priority, mostly free

**Issue:** each webview is a separate WebGL context sharing one GPU's VRAM + the
machine's RAM, summed across windows. 200M pts at Float32 pos+color ≈ 4.8GB
GPU + ~4.8GB CPU, ×windows. No `webglcontextlost` handler → OOM = hard crash.
Single 200M-pt position array = 2.4GB (over V8 `ArrayBuffer` max on some
Electron builds / GPU max allocation).

- **4.1 `webglcontextlost`/`restored` handling** 🔜
  - _Where:_ `main.ts` `initThreeJS` (after renderer creation ~748). Add a
    `private contextLost = false;` field; guard `performRender` (~1551) to skip
    when lost.
  - _Do:_ on
    `canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); this.contextLost=true; … })`,
    stop rendering + show a recoverable status; on `'webglcontextrestored'`, set
    `contextLost=false` and `requestRender()` (Three re-uploads geometries
    automatically as long as their CPU arrays still exist — so do NOT combine
    with 4.6 unless you re-read).
  - _Risk:_ none (additive). _Verify:_ force a loss via
    `renderer.getContext().getExtension('WEBGL_lose_context').loseContext()`;
    app shows a message and recovers on restore instead of crashing.
- **4.2 Uint8 colors + sRGB-decode-in-shader** 🔜 — see §7 (coupled to the
  shader). ¼ color memory/transfer/upload; ~1.6× crash headroom. _Safe for
  gamma/brightness_ because the source is 8-bit and the conversion is
  shader-side float.
- **4.3 Hidden/unfocused-window GPU reclaim** 🔜
  - _Where:_ `main.ts` — add a `document.visibilitychange` listener.
  - _Do:_ when hidden, dispose the renderer's GPU resources (or
    `renderer.forceContextLoss()` + free) so VRAM frees for the active window;
    rebuild/re-upload on focus. _Risk:_ must re-upload correctly on return.
    _Verify:_ open 2 windows with big clouds; hidden window's VRAM drops (GPU
    memory tooling), active window stops crashing.
- **4.4 Chunked geometry** 🔜
  - _Where:_ `createGeometryFromSpatialData`/`createOptimizedPointCloud` (~645).
  - _Do:_ for counts > ~10M, split into N `BufferGeometry`+`Points` of ≤10M pts
    each (consistently slice positions/colors/normals). _Verify:_ a >50M cloud
    loads without a single-buffer allocation failure; per-chunk frustum culling
    works.
- **4.5 int16-quantized positions (adaptive)** 🧪 — ½ position memory.
  **Opt-in/auto for huge clouds only** (quantize bbox→int16 = uniform precision
  extent/65536; fine ≤~100m, coarse for km). Default Float32. Dequantize in the
  vertex shader (§7).
- **4.6 Free CPU arrays after GPU upload (huge mode)** 🧪 —
  `BufferAttribute. onUploadCallback` to drop source arrays. Halves total to
  GPU-only. **Breaks context-restore re-upload and re-coloring** → gate behind a
  "huge cloud" mode and re-read on demand.
- **4.7 Defensive budget / pre-flight** 🔜 — query `gl.getParameter(MAX_*)`;
  beyond a safe per-context budget, auto-decimate (status message) instead of
  OOMing.

**Expected:** 4.1 + 4.2 + 4.3 should stop the crashes; 4.4 raises the ceiling.

---

## 5. Unified Rust/WASM loader (backbone)

**Goal:** one WASM crate that loads **every** format → packed GPU-ready buffers
(Float32/int16 positions, **Uint8 colors**, normals, intensity) + bbox, decode &
projection in Rust. Extend `wasm/pointcloud-parser`.

- **5.1 Zero-copy read into WASM** 🔜 — `alloc`/`parse_at` primitives already
  exist (`lib.rs`). _Do:_ in `src/wasmPointcloud.ts`, `alloc(len)`, read the
  file straight into `new Uint8Array(mod.memory.buffer, ptr, len)`, then
  `parse_at(ptr,len,fmt)`, `dealloc`. Avoids the JS→WASM copy, ~½ peak memory.
  _Risk:_ `mod.memory` after growth — get the buffer after `alloc`; fall back to
  copy-based parse on any error. _Verify:_ same output as `parse_*`; lower peak
  RSS.
- **5.2 Binary sidecar cache** 🧪 — write a packed blob to
  **`context. globalStorageUri`** (NOT next to the file), keyed by source path,
  header storing source **mtime+size**; re-parse on mismatch (never stale).
  _Verify:_ 2nd open of a big file is near-instant; touching the source
  invalidates.
- **5.3 Shared depth-decode crate** 🔜 — vendor/submodule the sister extension's
  Rust TIFF/EXR decoder so both build from one source. Projection stays here
  (consider moving into WASM).
- **5.4 Parallel parsing** 🔭 — `rayon` over WASM threads; needs
  SharedArrayBuffer + COOP/COEP (verify webview support). Only worth it once
  read isn't the bottleneck.

---

## 6. Parse — per format (all keep JS fallback)

- ✅ PLY binary fast-path; PLY/PCD/XYZ ASCII + TIFF depth → WASM.
- **6.1 PLY ASCII streaming** 🔜 — header-peek then stream (overlap), like XYZ.
  _Where:_ `pointCloudEditorProvider.ts` ascii-PLY branch (~744) + a streaming
  entry.
- **6.2 PLY binary — more layouts** 🔜 — extend the fast path (`main.ts`
  `handleUltimateRawBinaryData` ~7786) to int16/uint16 colors, half-floats,
  big-endian, extra props (currently → slow `readBinaryValue` switch).
- **6.3 PCD** 🔜 — (a) stream ASCII; (b) support **non-identity VIEWPOINT**
  (those fall back to JS now — apply the rigid transform); (c) binary stays JS
  unless slow. _Where:_ provider PCD branch (~373), `pcdViewpointIsIdentity`.
- **6.4 PTS → Rust** 🔜 — trivial; add a `Col` layout (x y z [intensity] [r g
  b]).
- **6.5 OFF → Rust** 🔜 — point clouds easy (header counts + rows); meshes
  later.
- **6.6 OBJ → Rust** 🧪 — scan by line prefix (`v`/`vn`/`vt`/`f`/`usemtl`).
  **Risk: materials/groups/wireframe** — keep JS path, A/B outputs, don't break
  OBJ.
- **6.7 STL → Rust** 🔜 — ASCII facets + replace the JS `Map<string>`
  vertex-dedup (the hotspot, `main.ts` ~10716) with a Rust numeric spatial hash.
  Binary STL fast.
- **6.8 GLTF/GLB — analyze first** 🔍 — binary buffers + JSON; profile large GLB
  before deciding on Rust.
- **6.9 NPY → Rust; NPZ inflate via WASM** 🔜 — NPY is a typed-array view
  (easy); NPZ is zip/deflate (JS `pako` is slow → Rust inflate).
- **6.10 Depth PNG/EXR → Rust decode** 🔜 — PFM fast; PNG (inflate+unfilter) and
  EXR slow in JS → reuse sister crate. Keep/port projection.
- **6.11 Cross-cutting** — extend the crate uniformly; use the returned
  **bbox**; emit **Uint8 colors** from the loader.

---

## 7. Rendering — the custom point shader (consolidates many wins)

**Issue:** `PointsMaterial` draws square points; colors are Float32;
sRGB/brightness baked on CPU; screen-space scaling is CPU per-frame. **One
custom `ShaderMaterial`** unlocks: round points, Uint8 colors, in-shader
sRGB+brightness (fixes 4.2 safely), int16 dequant (4.5), point-size uniform, and
EDL fold (8.x).

- **7.1 Round-point `ShaderMaterial`** 🔜
  - _Where:_ replaces `PointsMaterial` usage — _touch carefully_:
    `optimizeForPointCount` (~308), `updateAllMaterialsFor*` (~349/425),
    `createOptimizedPointCloud` (~645), and everywhere
    `mesh.material instanceof THREE.PointsMaterial` is checked.
  - _Do:_ vertex shader sizes points (`gl_PointSize` from a uniform + optional
    distance attenuation + int16 dequant); fragment shader discards outside the
    circle, smooths the edge (`smoothstep` → built-in AA), reads **Uint8 sRGB**
    vertex colors and applies sRGB→linear + `exposure` (brightness) + the gamma
    toggle uniform. _Risk:_ HIGH — the color-mode/transparency/scaling/export
    systems all assume `PointsMaterial`. Migrate incrementally; keep behavior
    identical (verify each color mode, transparency, screen-space scaling, PLY
    export). _Verify:_ every existing toggle still works; points are round;
    colors pixel-match; FPS/VRAM improve.
- **7.2 Uint8 colors end-to-end** 🔜 — emit Uint8 from the loader/parsers; store
  as `BufferAttribute(uint8, 3, /*normalized*/true)`; update PLY export +
  color-mode reads (`main.ts` ~12876, `buildOriginalColorArray` ~2370) to
  `.getX()`. Depends on 7.1 for the sRGB shader path.

---

## 8. Rendering — config & LOD

- **8.1 Dynamic resolution during motion** 🔜 — drop `setPixelRatio` (→1.0)
  while the camera moves, restore to `min(dpr,2)` when idle (use the existing
  camera-change detection in `animate` ~1455). **Must also resize the EDL
  `EffectComposer` render targets** on the change. _Risk:_ composer resize;
  imperceptible when idle. _Verify:_ sharp when idle; faster during orbit; no
  artifacts on settle.
- **8.2 Conditional shadows / antialias** 🧪 — disable the shadow pass when the
  scene is point-cloud-only; consider MSAA off + relying on 7.1's shader AA.
  **Risk:** meshes/lines/axes may look worse → verify on mesh files before
  committing; keep conditional.
- **8.3 Point budget (flat decimation)** 🔜 — the near-term big render win, no
  camera-dependent LOD. _Where:_ `createGeometryFromSpatialData` (~2453) or a
  draw pre-pass. _Do:_ when count > budget (e.g. 5M), build a strided/random
  subset for display (full data retained); show full detail when zoomed/idle.
  _Verify:_ 50M cloud stays at interactive FPS; full detail when stationary.
- **8.4 EDL fold** 🔜 — integrate Eye-Dome-Lighting into 7.1's point shader (or
  drive it from the same depth) to drop the extra full-screen pass + depth
  texture. _Where:_ `engine/src/postprocessing/EDLPass.ts`, `initEDLComposer`
  (~1564).
- **8.5 Octree LOD (screen-space error)** 🔭 — the endgame; **hardest** (level
  depends on camera distance + pixel size; tuning is finicky — a prior attempt
  struggled). _Recommendation:_ adopt Potree's tuned metric — `potree-core`
  (renders in a Three scene) or build the octree in **Rust** (replacing C++
  PotreeConverter) using Potree's node selection. Own milestone; don't block
  other work.

---

## 9. CPU memory (eases swap on low-disk machines)

- **9.1** 🔜 — zero-copy read (5.1) + free the file buffer before geometry
  build + transfer buffer ownership instead of cloning where possible. Cuts the
  ~5× simultaneous copies. _Verify:_ lower peak RSS during a big load.

---

## 10. Tooling / frameworks

- **10.1** 🔜 — TypeScript 4.9 → 5.x; three 0.184 → latest 0.18x; Rust
  `fast-float` (unmaintained) → `fast-float2`/`lexical`.
- **10.2 Vite (webview build)** 🧪 — low-risk DX/build-speed win; removes the
  webpack/`copy-webpack-plugin` Node-20 friction. Keep webpack/esbuild for the
  Node extension bundle, or move both.
- **10.3 Svelte UI** 🔭 — good long-term (`main.ts` is 14.7k lines of vanilla
  DOM) but a large rewrite; do Vite first.
- **10.4 WebGPU** 🔭 — Three `WebGPURenderer`: compute culling/LOD, bigger
  buffers. **Gated on reliable Linux support in VS Code's Electron webview**
  (your primary target). No firm date — re-evaluate ~2025–2026 on your Linux
  machines.
- ❌ Native Rust addon / mmap / Cesium-3D-Tiles — ruled out for now.

---

## 11. Recommended sequence

1. **Crash safety net** — 4.1 (context loss) + 4.3 (hidden-window dispose).
   Small, safe, stops the crashes.
2. **Custom point shader + Uint8 colors + in-shader sRGB/brightness** — §7
   (4.2/7.1/ 7.2). Big memory/transfer/upload win + round points + crash
   headroom. Highest-risk coherent change; migrate carefully.
3. **Renderer config** — 8.1 dynamic resolution (+ 8.2 only if no mesh
   regression).
4. **Point budget** — 8.3. Caps big-cloud render cost without octree complexity.
5. **Zero-copy read into WASM** — 5.1 / 9.1. ½ peak memory, eases swap.
6. **Extend the Rust loader** — 6.4 PTS, 6.5 OFF, 6.7 STL, 6.9 NPY/NPZ, 6.10
   PNG.
7. **Binary sidecar cache** — 5.2. Instant re-opens.
8. **PLY-ASCII streaming (6.1), PCD streaming+viewpoint (6.3), PLY-binary
   layouts (6.2)**.
9. **Chunked geometry (4.4) + adaptive int16 positions (4.5)** — raise the
   ceiling.
10. **Vite (10.2), TS5/three/fast-float2 (10.1)**.
11. **Octree LOD (8.5), WebGPU (10.4)** — future milestones, gated as noted.

---

## 12. Open questions to resolve during implementation

- Webview cross-origin isolation (COOP/COEP) for WASM threads (5.4).
- `globalStorageUri` size limits / LRU policy for the cache (5.2).
- GLTF large-file profiling before deciding on Rust (6.8).
- int16 quantization precision threshold + the "huge-cloud mode" UX (4.5).
- Whether disabling MSAA/shadows regresses any mesh/line case (8.2).
