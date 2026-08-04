# WebGPU backend

Status: **experimental, opt-in, off by default.** A working WebGPU backend
exists. It is a measurement tool, not a shipping configuration — on the numbers
below it is roughly **half the speed** of WebGL for large point clouds.

## Turning it on

| Host            | Switch                                                 |
| --------------- | ------------------------------------------------------ |
| Standalone page | `?webgpu=1`                                            |
| VS Code         | `plyViewer.experimentalWebGPU`, then reopen the viewer |
| Either, by hand | `window.__PLY_WEBGPU__ = true` before the viewer boots |

Every failure path falls back to WebGL and logs why, so a missing adapter
degrades to the normal viewer rather than a blank canvas. The perf readout shows
`/ WebGPU` when the backend is live, so a measurement is never misattributed.

## Measured result

`engine/scripts/backend-benchmark.mjs` runs both backends against the same
build, file and camera path (`npm run bench:backend -- <file>`).

On `testfiles/pcd_large/test_pc6_binary.ply` (7.9M points, Apple GPU, headless
Chromium, default point size, EDL off on both). GPU time, median of repeated
runs — frame time is vsync-bound in every cell and says only "both keep up":

| Backend | MSAA off | MSAA on (`--antialias`) |
| ------- | -------- | ----------------------- |
| WebGL   | 7.0 ms   | 22.4 ms                 |
| WebGPU  | 14.1 ms  | 11.7 ms                 |

Two results, and the second is the more interesting one.

**WebGPU costs about 2x the GPU time at the default settings.** This reproduces
the "slower than WebGL" half of the abandoned first attempt (`970ee42`) — that
report was right, and it was not an artefact of its sprite-quad implementation.

**MSAA inverts the ranking.** It costs WebGL 3.2x (7.0 → 22.4 ms), which is
exactly the per-sample depth contention `rendererOptions.ts` describes and is
why it is off by default. On WebGPU it is _free_ — in fact slightly faster than
without (14.1 → 11.7 ms), which should not happen and means the two WebGPU
configurations are not taking the same path through three's renderer. Chasing
that is the most promising lead on the 2x, because whatever makes the MSAA path
cheaper is presumably absent from the default one.

One contributor is already identified and fixed: three defaults WebGPU's output
buffer to `HalfFloatType` where `WebGLRenderer` writes 8-bit straight to the
canvas, so the original measurement compared a 16-bit path against an 8-bit one.
`rendererBackend.ts` now passes `outputBufferType: UnsignedByteType`, worth
about 3 ms here. It did not close the gap.

Beyond that the gap is unexplained. Note that three's WebGPU path routes
`THREE.Points` through `PointsNodeMaterial` and generated WGSL, which is a
different shader from `PointsMaterial`'s GLSL; the remainder may be that rather
than WebGPU itself.

## What is different when it is on

Logged to the console at startup (`WEBGPU_CAVEATS` in
`engine/src/rendering/rendererBackend.ts`), because measurements are unreadable
without them:

- **Points are exactly 1 pixel.** WebGPU has no `gl_PointSize`, and three only
  honours point size for `Sprite`-based instancing, not for `THREE.Points`.
  Comparisons are therefore only fair at the default point size, where WebGL
  clamps to 1 pixel too — see `DEFAULT_POINT_SIZE` in
  `engine/src/visualization/PointCloudRenderer.ts`. Supporting larger points
  means porting to instanced sprites, which is what the first attempt did.
- **EDL is off.** `EffectComposer` plus raw GLSL, no WebGPU implementation.
  Toggling it says so rather than doing nothing.
- **Gaussian splats are off.** See the blocker below.
- **sRGB decode of 8-bit vertex colours is skipped**, so colours render
  brighter. It is injected through `material.onBeforeCompile` in `colorMode.ts`,
  which the WebGPU path ignores. This is visible in a side-by-side screenshot
  and is the one caveat with a straightforward fix (a `colorNode`), not yet
  attempted.
- **Device loss is not recovered from.** `webglcontextlost` never fires for a
  WebGPU canvas and nothing listens for the WebGPU equivalent.

## How it is put together

- **`rendering/rendererBackend.ts`** — the switch, the async factory, and the
  caveat list. WebGPU is reached through a dynamic `import('three/webgpu')`, so
  three's WebGPU build lands in its own chunk (~557 KB minified) instead of
  every user's bundle. The reverted first attempt imported it statically.
  Because `three.module.js` and `three.webgpu.js` both import `./three.core.js`,
  the two builds share one copy of core three and one set of class identities.
- **`rendering/viewerRenderer.ts`** — `ViewerRenderer`, the renderer surface the
  viewer actually uses. `sceneBrightness`, `MeasurementManager`, `FilmManager`
  and `viewCapture` are typed against it and needed no changes. Both renderers
  are proven to satisfy it at compile time; the WebGPU proof is a type-only
  import, which TypeScript erases.
- **`rendering/gpuTimer.ts`** — one implementation per backend behind `GpuTimer`
  (disjoint timer query vs. timestamp query). The two bracket slightly different
  work, so treat single-digit-percent differences as noise.
- **`PointCloudVisualizer.webglRenderer`** — the concrete WebGL renderer, null
  on WebGPU. The two WebGL-bound features test this rather than the interface.
- The extension build needs help resolving `three/webgpu` at runtime: it aliases
  it, because its bare `three` alias bypasses the package exports map. The types
  need no help — `engine/src/tsconfig.json` is on `bundler` module resolution,
  which reads exports maps directly. (It used to be on `node`, which predates
  exports maps and needed a `paths` entry to map the types.)

## The blocker

**Spark (`@sparkjsdev/spark`) is WebGL-bound.** It calls `renderer.getContext()`
and uses raw `gl.readPixels`, `gl.bindBuffer`, `gl.createFramebuffer` and
friends. Gaussian splat rendering cannot move to WebGPU until Spark supports it
upstream — this is not something this codebase can refactor around.

So a real transition is either "WebGPU for point clouds and meshes, WebGL for
splats" (two renderers, considerable complexity) or waiting for Spark. Given the
2x measured cost, neither is worth starting until the cost is understood.

## Re-measure antialiasing under the WebGPU backend

MSAA is off by default (`engine/src/rendering/rendererOptions.ts`) because on
WebGL it multiplies the contended per-sample depth work that dominates
zoomed-out point clouds while smoothing nothing on 1-pixel points. That
reasoning is about depth-test contention, not about WebGL specifically, so the
cost is expected to carry over. It does not: see the table above, where MSAA is
free on WebGPU and 3.2x on WebGL. The image-quality half is still unmeasured.
The benchmark script takes `--antialias`, which sets it on both backends.

One thing does change. On WebGL, `antialias` is a **context-creation** flag,
which is the only reason `useAntialiasing()` is a startup switch instead of a UI
control. On WebGPU, sample count is a property of the render target, so the
backend can rebuild its targets and toggle MSAA at runtime. Post-process AA
(FXAA as a TSL node) is the more sensible option there anyway: it costs the same
regardless of point density and is the only kind that helps mesh and line edges
without touching the depth pass. TAA is ruled out — it accumulates across
frames, which would soften the image while the camera moves.

## If this gets picked up again

In rough order of value:

1. **Find the 2x**, starting from the MSAA inversion above — a configuration
   that makes WebGPU _faster_ while doing strictly more work is a strong hint
   about what the default path is doing wrong. Then capture a frame in a GPU
   profiler and compare the generated WGSL against `PointsMaterial`'s GLSL.
   Everything else is premature until this is understood.
2. **Verify in the VS Code webview.** The backend has only been exercised on the
   standalone page under headless Chromium with `--enable-unsafe-webgpu`.
   Whether VS Code's Electron build returns a WebGPU adapter at all is still
   unverified — the setting exists so this can be checked with F5.
3. **Sprite-instanced points**, if point sizes above 1 pixel ever need to work.
   Apply the one-pixel minimum explicitly (`MIN_POINT_PIXELS`) — its absence is
   what made the first attempt's cloud invisible, and that bug is what stopped
   the port, not anything about WebGPU.
4. **`colorNode` for the sRGB decode**, closing the one visible colour
   difference.
