# How to measure and change performance in this extension

This is the method, not a tour of the tools. Adapted from the sibling
tiff-visualizer's document, because the expensive mistakes there were the
expensive mistakes here too: not slow code, but _confident conclusions from bad
measurements_, and correct-looking changes that quietly altered the output.

If you are an AI agent working on performance here, read this before touching a
parser, a solver, or a render path.

## 1. Measure the number the user sees

Every load, alignment and colouring run logs one line to the extension's "3D
Visualizer" Output channel:

```
⏱️ PERF[ply Stohl_1_A_0004.x3r] read+parse 354ms · transfer 217ms · build 155.2ms | total 726.0ms  (2,869,566 pts · 47.9 MB)
⏱️ PERF[x3a/all Abschnitt_A.x3a] total 1640.0ms  (6 scans · 3,607,526 pts)
⏱️ PERF[registration/align-all Stohl_1_A.x3r] setup 4.1ms · sample 18.0ms · match 4882.1ms · apply 1.4ms · UI/overhead 6.2ms | total 4911.8ms  (5/5 clouds · 1,096,656 sampled pts · extension host)
⏱️ PERF[x3a/recolour-all Abschnitt_A.x3a] read 87.8ms · reload 1004.3ms · match 0.0ms · colour 633.1ms (frames 6.1 + project 561.0 + white balance 47.5 + summarize 18.6) · … | total 1783.0ms  (6 scans)
```

`test/vscode-performance/runner.cjs` boots a real VS Code, runs a scenario, and
**scrapes those same lines**. It does not measure anything in parallel with the
extension, so the benchmark and the user can never disagree.

The load phases come from `PerfTimer` in
[`engine/src/utils/perfLog.ts`](../engine/src/utils/perfLog.ts). They are built
from **one wall clock shared by both processes** (`Date.now()`), stamped at four
epochs — `loadStartedAt`, `postedAt`, `receivedAt`, `doneAt` — so the phases
partition the timeline and sum to the total _by construction_:

```
read+parse = postedAt   - loadStartedAt   (extension: disk read + parse)
transfer   = receivedAt - postedAt        (data crossing into the webview)
build      = doneAt     - receivedAt      (geometry + GPU upload + first frame)
total      = doneAt     - loadStartedAt   (honest end-to-end the user waits)
```

The align and colour lines are built the same way from their own stages, each
with an explicit `overhead` remainder that catches anything unaccounted for. If
a remainder is large, the breakdown is lying about where the time goes — fix the
instrumentation before optimizing.

A container (an X3A archive) emits one line per scan and then a summary:
`x3a/geometry/all` when the geometry is on screen, `x3a/all` when the load is
genuinely finished. **The last `/all` line is the load.** The per-scan lines
overlap each other and must never be summed.

## 2. Discard the first open, always

```bash
npm run benchmark:vscode                                  # default corpus, load only
STEPS=open,alignAll,recolorAll FILES=testfiles/lidar/Abschnitt_A.x3a ITER=4 \
  node scripts/benchmark-vscode.mjs
```

The first run of a session pays costs that never recur: compiling and
instantiating the WASM modules, starting the registration worker pool, the first
shader compile, and the first GPU upload of a given size. On `Abschnitt_A.x3a`
the cold open measured 2877 ms against 726 ms warm — a 4x difference that has
nothing to do with any change you are testing.

Sequential runs in one session are therefore **not independent samples**. The
harness discards iteration 1 and reports medians of the rest; the cold number is
kept in `benchmark-vscode-result.json` rather than thrown away. Do the same by
hand: a single PERF line is an anecdote.

## 3. Check the machine before believing a number

Run `uptime` first. The harness prints a warning when the one-minute load
average is above half the core count, because at that point the numbers are
contention. During development of this document the machine sat at load 12-23 on
10 cores and the same build produced opens between 726 ms and 2877 ms.

State sample counts and spreads. "Median of 3 warm runs, 1.5-1.7 s" is a result;
"it got faster" is not.

## 4. Verify the output, not just the speed

**A change that is 3x faster and slightly wrong is a bad change.** The failure
mode here is quieter than in a decoder, because a point cloud that is subtly
misplaced still looks like a point cloud.

- Geometry and parsing: `npm run test:node` (seconds, no VS Code) covers the
  parsers over real fixtures. `cd engine && npm test` is the browser suite.
- Registration: `wasm/pointcloud-parser/src/registration/tests.rs` asserts
  recovered transforms against ground truth in metres, not just that the solver
  returned something. A registration change that does not move those numbers has
  not been verified.
- Colouring: `engine/test/recolored-mode.spec.ts` and the X3A colour tests in
  `src/test/suite/` pin the projection. The projection diagnostics in the
  per-file registration panel (own-station-only, ideal-pinhole, reverse-pan,
  invert-extrinsic) exist to A/B a suspected model error on the same edges.

Verify parallel work as a _split_, not only as a total: a chunked or worker path
must produce the same result at 1, 2, 4 and 8 workers. A range bug that only
appears at 8 will not show up at 1.

## 5. Profile before optimizing, and re-profile after

Optimizing the wrong phase is the default failure mode. Read the phase budget
off the PERF line before choosing what to change. Two examples from the numbers
above, both on a 108 MB archive with 3.6M points:

- align-all spends 4882 ms of 4912 ms in `match`. Everything else — sampling,
  applying transforms, the UI — is 30 ms. Only the solver is worth touching.
- recolour spends 1004 ms of 1783 ms in `reload`, re-reading the archive, and
  597 ms actually colouring. Halving the projection maths would win 17% of the
  operation; not re-reading the archive would win more.

Look first for **a type or property mismatch causing a silent fallback**, not
for slow algorithms. That is what most of the real findings in this project and
its sibling turned out to be.

### Three hypotheses this method killed

All three looked obviously right before anything was measured. Recording them
here because the cost of this project is not slow code, it is confident work
done on the wrong thing.

1. **"Chunked postMessage is why geometry delivery takes 5–50 s."** It is not.
   `PERF[transfer/...]` lines now report each scan's send: 631 MB of geometry
   crosses in ~2.0 s at 180–470 MB/s, which is at the transport's known ceiling.
   The 50 s reading came from a machine at load 24. Geometry delivery is 19–20%
   of an X3A parse; the load-time colour pass is 63–72%.
2. **"The recolour's 7.5 s `reload` is a black box, so instrument it."** This
   one held, and it was the cheapest change here: `PERF[x3a/reload]` prints the
   re-parse's own phases. The answer was that 69% of the reload is the
   _load-time own-station colour pass being run a second time_. On OHP_FRONT the
   recolour spends 6.2 s projecting in the re-parse and 8.5 s projecting in the
   station pass — 14.7 s of a 19.5 s operation is projection.
3. **"So skip the load-time colour pass when the run recolours everything
   anyway."** Refuted by A/B: it loses **229k of 3.60M coloured points (6.4%)**
   and runs _slower_. The station pass is not a superset of the load-time pass —
   it rejects, against a station's own depth buffer, points the load-time pass
   coloured, and with nothing pre-coloured every scan also fails the "already
   fully coloured" early-out. The comparison was a SHA-256 of the final colour
   buffers from a headless parse of a real archive, which is the only reason
   this was caught rather than shipped.

`simd128` (`RUSTFLAGS="-C target-feature=+simd128"`) was also measured: the
colour buffers hash identically — unlike the sibling project, where it shifted
JPEG output by ±1 — but the medians are 2258 ms against 2267 ms, i.e. no change.
The projection is branchy scalar work per point (azimuth window, occlusion test,
iterative undistortion, Bayer sample); there is nothing there for LLVM to
vectorise. Not adopted: a build flag that changes the shipped binary for no
measured gain is a liability.

### Three more traps (October 2026 load work)

1. **The first wasm call in a fresh isolate runs on baseline code.** V8 compiles
   wasm with Liftoff first and optimizes hot functions in the background, but a
   call that is already running never switches. A whole-file parse is one call,
   and every opened file is a fresh webview: binary PLY parsed in 315 ms against
   110 ms once optimized. A 50k-vertex warm-up parse while the bytes are still
   in flight fixes it (`warmUpPlyParser`). The same applies to extension-host
   worker threads, which is why the decoder pool shares one compiled
   `WebAssembly.Module` across workers (`parsePool.ts`).
2. **This machine is memory-bound.** With ~20 GB of swap in use, a corpus of
   several 300–600 MB files evicts itself from the page cache and the run
   measures the disk. A/B one file at a time, and compare against HEAD in the
   same session (below), never against an old number.
3. **`postMessage` to a webview JSON-serializes everything that is not a
   buffer.** An object per triangle made a 2M-triangle STL fail outright (V8
   string limit) and an OBJ take 20 s. Ship typed arrays only.

### Four more (depth, PLY and alignment work)

1. **Webview workers silently fell back to the main thread.** A VS Code webview
   page and its bundle are on different origins, so `new Worker(chunkUrl)`
   throws there, and every depth conversion — decode and a 26-megapixel
   projection — ran on the UI thread in one band (8–15 s) while the standalone
   page, which is same-origin, used eight workers (1.7 s). The standalone page
   is the fast test surface and could never show this. Put the thread a step ran
   on into its PERF line (`on=worker/8 bands`) and read it in the extension.
2. **Peak memory is time on this machine.** Binary PLY streamed into wasm memory
   still held file plus output there (wasm memory never shrinks) plus the JS
   copy: about 1 GB for a 341 MB cloud, and 4–19 s depending on swap. Decoding
   chunk by chunk while the fetch runs keeps the heap at a few MB: ~1.7 s, and
   steady.
3. **`f64::min`/`max` are libm calls in wasm**, and a strided column FFT walks a
   row per element. Both looked like arithmetic; both were memory or call
   overhead. Rewrites that keep the operations and their order are
   bit-identical, which is the bar for solver changes (compare the full stats
   JSON of every pair, not one number).
4. **A long-running `webpack --watch` keeps its old config.** After changing
   `webpack.config.js`, a watcher started earlier rebuilds `out/` behind your
   back with the previous options. Restart it, or check the bundle before
   measuring.

### Rendering and memory on Apple silicon (October 2026)

Measured on an M1 Pro through Chromium's Metal ANGLE backend, frames timed with
a `readPixels` after each render so the GPU work is inside the number:

1. **Every WebGL buffer costs its size twice in the GPU process.** A bare page
   uploading 200 MB grew the GPU process by 396 MB. `geometry.dispose()` frees
   almost none of it - ANGLE pools the buffers - while losing the context frees
   all of it. That is why a hidden viewer releases its context
   (`visualization/contextRecovery.ts`) rather than its geometries.
2. **Wasm memory is the other silent cost.** A whole-file PLY parse left the
   page at 246 MB of wasm memory, and the depth worker ~390 MB beyond its decode
   cache, for as long as the view stayed open. Look for it in a heap snapshot
   (`Memory` behind a wasm `Instance`), and remember that workers' memory counts
   in the same process but not in a main-thread snapshot.
3. **The round-disc pass costs its discard, not its texture.** Replacing the
   alpha-map lookup with an analytic `gl_PointCoord` test was no faster; the
   discard itself defeats the GPU's hidden-surface removal. What helped was not
   running a pass that rejects every vertex (`AdaptivePointRenderer`).
4. **VS Code posts a typed array as its whole underlying buffer.** Its
   serializer sends `view.buffer` plus an offset, and the webview copies all of
   it. Per-scan recolour updates were `subarray` views into archive-wide arrays,
   so eight messages moved 1.7 GB and took ~3 s of a 10 s recolour.
   `sendToWebview` now copies such views to their own size; code that posts
   `.buffer` itself must do the same (`ownBuffer` in binaryTransfer.ts).
5. **Freed memory is not returned.** After an OHP_FRONT parse in Node, JS held
   nothing yet the process stayed at ~4 GB resident: "Malloc Large (empty)" in
   `vmmap --summary`, freed large blocks macOS keeps. Fewer large transient
   copies is the lever; check with `vmmap`, not only a heap snapshot.
6. **Refuted: overlapping X3A geometry delivery with the parallel colour pass.**
   Both got slower and the geometry reached the screen later - the workers and
   the 630 MB message copy compete for the same memory bandwidth.

### A/B against HEAD

Build HEAD once in a scratch worktree (`git worktree add --detach <dir> HEAD`,
symlink `node_modules`, `engine/node_modules` and `.vscode-test`, then
`npm run compile` there) and run `scripts/benchmark-vscode.mjs` from each tree
for the same file, back to back. `PLY_PERF_QUIET_MS=4000` shortens the harness's
quiet window for single-line formats. Every parser change in that work was also
checked for byte-identical output against the old path (array hashes or
field-by-field comparison), not only timed.

## 6. Amdahl is the honest answer

When matching is 99% of align-all, a 3x matching win is a 2.9x win. When
`reload` is 56% of recolour, the same 3x win on colouring is barely visible.
Report the phase budget, not just the headline, and say plainly when a subsystem
has stopped being the bottleneck.

## Tools

| Command                                        | What it does                                                             |
| ---------------------------------------------- | ------------------------------------------------------------------------ |
| `npm run benchmark:vscode`                     | One build, real VS Code, per-step medians                                |
| `STEPS=open,alignAll,recolorAll …`             | Adds the align and colour steps to the scenario                          |
| `STEPS=open,alignAllNested,alignAllComplex …`  | The two growing alignment strategies                                     |
| `STEPS=open,reapplyDepth …`                    | Re-applies a depth image's settings (the cost of every parameter change) |
| `FILES=a,b ITER=n`                             | Choose the corpus and the sample count                                   |
| `cd engine && npm run bench:backend -- <file>` | WebGL vs WebGPU on one file                                              |
| `npm run test:node`                            | Parser/logic tests headless, in seconds                                  |
| `cd engine && npm test`                        | Playwright engine suite                                                  |

### How the scenario runs

Loading can be benchmarked from outside — open a file and wait. Aligning and
colouring cannot: they are webview button presses, and a harness in the
extension host has no way to press them. The seam is
[`engine/src/benchmarkScenario.ts`](../engine/src/benchmarkScenario.ts): the
hidden `plyViewer.benchmarkScenario` command forwards one step at a time into
the webview, and each step calls exactly the function its button calls. Steps
are `open`, `alignAll`, `refineAll`, `recolorAll` and `registerAndRecolorAll`.

Nothing in that path measures anything itself — a second measurement taken from
outside could disagree with the Output channel, and then neither would be
trustworthy.

**The scenario is not the corpus.** `alignAll` needs a file that holds more than
one cloud, and `recolorAll` needs an archive with photographs and a camera
profile; on anything else those steps log `PERF[benchmark/skipped]` and the
harness reports them as a miss rather than a zero it might pass off as fast.
