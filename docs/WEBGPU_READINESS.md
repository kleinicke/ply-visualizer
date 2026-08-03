# WebGPU readiness

Status: **preparation only.** No WebGPU backend exists and none is planned as
part of this work. This records what a future attempt has to deal with, and what
has already been made ready for it.

A first attempt was made and reverted (`970ee42`, "remove unused webgpu files"):
`rendering/renderer.ts`, `rendering/pointSprites.ts` and
`postprocessing/ModernEDLPipeline.ts`. It was abandoned because the point cloud
was invisible and the result was slower than WebGL.

## Why the point cloud was invisible

Not a WebGPU problem, and not a hard one — it is worth knowing before anyone
concludes the port is unviable.

The viewer's universal default point size is `0.001` **world units**. At normal
viewing distances that is far below one pixel. It looks correct under WebGL only
because WebGL clamps `gl_PointSize` up to the minimum of
`ALIASED_POINT_SIZE_RANGE`, which is at least 1 — so the point still covers a
pixel. The abandoned attempt drew points as sprite quads, which get no such
clamp, and the whole cloud vanished at the default size.

Any non-WebGL backend must apply a one-pixel minimum explicitly. The constants
are now named and documented at `engine/src/visualization/PointCloudRenderer.ts`
(`DEFAULT_POINT_SIZE`, `MIN_POINT_PIXELS`) rather than being a bare `0.001`
repeated across five files.

The "slower than WebGL" half of the report was not investigated and should be
re-measured rather than assumed — a sprite-quad implementation of points has
very different cost characteristics from native point primitives, so it may say
more about that implementation than about the backend.

## Seams that already exist

- **`engine/src/rendering/viewerRenderer.ts`** — `ViewerRenderer`, the renderer
  surface the viewer actually uses (canvas, draw, size, clear colour, tone
  mapping). `sceneBrightness`, `MeasurementManager`, `FilmManager` and
  `viewCapture` are typed against it and need no changes for a backend swap.

  It is a structural interface, deliberately **not** a
  `WebGLRenderer | WebGPURenderer` union: the union form requires importing
  `three/webgpu`, which pulls the WebGPU build into every user's bundle. The
  reverted attempt did that.

- **`engine/src/rendering/gpuTimer.ts`** — `GpuTimer`, with the WebGL
  `EXT_disjoint_timer_query` implementation behind it. This was the only place
  in the viewer reaching through the renderer to the raw graphics context.
  WebGPU instead needs `trackTimestamp: true` at renderer construction and reads
  results from `renderer.info`; that is a new implementation of three methods,
  not a change to the render loop.

## What still has to be ported

- **`postprocessing/EDLPass.ts` and `edl.ts`** — `EffectComposer` plus raw GLSL.
  WebGPU post-processing is node-based (TSL) and needs a separate
  implementation. Contained to these two files.

- **`colorMode.ts`** — the sRGB decode injected through
  `material.onBeforeCompile`. This and EDLPass are the **only** two places in
  the codebase that touch GLSL. Keeping that number at two is the single most
  useful thing to preserve; new shader work should go behind one module rather
  than adding `onBeforeCompile` hooks.

## The blocker

**Spark (`@sparkjsdev/spark`) is WebGL-bound.** It calls `renderer.getContext()`
and uses raw `gl.readPixels`, `gl.bindBuffer`, `gl.createFramebuffer` and
friends. Gaussian splat rendering cannot move to WebGPU until Spark supports it
upstream — this is not something this codebase can refactor around.

So a realistic transition is either "WebGPU for point clouds and meshes, WebGL
for splats" (two renderers, considerable complexity), or waiting for Spark. That
choice should be made before any further porting work, because it decides
whether the seams above are enough.
