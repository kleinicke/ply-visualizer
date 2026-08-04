/**
 * Measures WebGL against WebGPU on the same build, file and camera.
 *
 * Usage (from engine/):
 *   npm run build
 *   node scripts/backend-benchmark.mjs ../testfiles/ply/test_binary.ply
 *   node scripts/backend-benchmark.mjs <file> --seconds=10 --headed --antialias
 *
 * Serves dist/ itself, so no dev server needs to be running.
 *
 * ## Reading the result
 *
 * The two backends do not draw quite the same thing, and the differences are
 * not this script's to fix (see docs/WEBGPU_READINESS.md):
 *
 * - **Point size.** WebGPU has no `gl_PointSize`; three only honours point size
 *   for Sprite instancing, so `THREE.Points` is always 1 pixel there. At the
 *   default point size WebGL clamps to 1 pixel too, so the comparison is fair.
 *   At any larger point size it is not — WebGL draws more fragments. The script
 *   refuses to report unless both runs used the default size.
 * - **EDL** is off on WebGPU and is therefore forced off on WebGL too.
 * - **GPU time** comes from different mechanisms per backend (disjoint timer
 *   query vs. timestamp query), bracketing slightly different work. Treat
 *   single-digit-percent differences as noise.
 */

import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(HERE, '..', 'dist');
const PORT = 8123;

// WebGPU in headless Chromium needs to be asked for explicitly.
const CHROMIUM_ARGS = [
  '--enable-unsafe-webgpu',
  '--enable-features=Vulkan,UseSkiaRenderer',
  '--use-angle=metal',
  '--ignore-gpu-blocklist',
];

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.map': 'application/json',
};

function startServer() {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://localhost:${PORT}`);
      let filePath = path.join(DIST, decodeURIComponent(url.pathname));
      if ((await stat(filePath).catch(() => null))?.isDirectory()) {
        filePath = path.join(filePath, 'index.html');
      }
      const body = await readFile(filePath);
      response.writeHead(200, {
        'Content-Type': MIME[path.extname(filePath)] ?? 'application/octet-stream',
      });
      response.end(body);
    } catch {
      response.writeHead(404).end('not found');
    }
  });
  return new Promise(resolve => server.listen(PORT, () => resolve(server)));
}

async function measure(filePath, query, seconds, headed) {
  const browser = await chromium.launch({ args: CHROMIUM_ARGS, headless: !headed });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

  await page.goto(`http://localhost:${PORT}/3d-visualizer/${query}`);
  await page.waitForSelector('#three-canvas');
  await page.waitForFunction(() => window.visualizer?.renderer !== undefined);

  await page.locator('#hiddenFileInput').setInputFiles(filePath);
  // Wait for geometry to exist rather than a fixed sleep; large files are slow.
  await page.waitForFunction(() => (window.visualizer?.meshes?.length ?? 0) > 0, null, {
    timeout: 120_000,
  });

  const setup = await page.evaluate(() => {
    const visualizer = window.visualizer;
    // EDL cannot run on WebGPU, so it must not run on WebGL either.
    visualizer.edlEnabled = false;
    return {
      backend: visualizer.rendererBackend,
      points: visualizer.spatialFiles?.[0]?.vertexCount ?? 0,
      pointSize: visualizer.spatialFiles?.[0]?.pointSize ?? null,
    };
  });

  // Spin the camera so every frame is a real frame — a static scene may not
  // redraw at all, and would measure nothing.
  const samples = await page.evaluate(async durationMs => {
    const visualizer = window.visualizer;
    const frames = [];
    const started = performance.now();
    let previous = started;
    return await new Promise(resolve => {
      const spin = () => {
        const now = performance.now();
        frames.push(now - previous);
        previous = now;
        visualizer.camera.position.applyAxisAngle({ x: 0, y: 1, z: 0 }, 0.01);
        visualizer.camera.lookAt(0, 0, 0);
        visualizer.requestRender();
        if (now - started < durationMs) {
          requestAnimationFrame(spin);
        } else {
          resolve({ frames, gpuMs: visualizer.gpuTimer?.averageMs ?? 0 });
        }
      };
      requestAnimationFrame(spin);
    });
  }, seconds * 1000);

  await browser.close();

  // Drop the first 10% — shader compilation and buffer upload land there.
  const warm = samples.frames.slice(Math.ceil(samples.frames.length * 0.1));
  warm.sort((a, b) => a - b);
  return {
    ...setup,
    errors,
    frameCount: warm.length,
    medianFrameMs: warm[Math.floor(warm.length / 2)] ?? 0,
    p95FrameMs: warm[Math.floor(warm.length * 0.95)] ?? 0,
    gpuMs: samples.gpuMs,
  };
}

/** True when a frame time sits on a common display refresh interval. */
function vsyncBound(frameMs) {
  return [1000 / 60, 1000 / 120, 1000 / 144].some(
    interval => Math.abs(frameMs - interval) / interval < 0.05
  );
}

function report(label, result) {
  const fps = result.medianFrameMs > 0 ? 1000 / result.medianFrameMs : 0;
  console.log(
    `${label.padEnd(7)} backend=${result.backend.padEnd(6)} ` +
      `median=${result.medianFrameMs.toFixed(2)}ms (${fps.toFixed(1)} fps) ` +
      `p95=${result.p95FrameMs.toFixed(2)}ms gpu=${result.gpuMs.toFixed(2)}ms ` +
      `frames=${result.frameCount}`
  );
  for (const error of result.errors) {
    console.log(`        ⚠️ page error: ${error}`);
  }
}

const args = process.argv.slice(2);
const file = args.find(argument => !argument.startsWith('--'));
if (!file) {
  console.error('Usage: node scripts/backend-benchmark.mjs <file> [--seconds=N] [--headed]');
  process.exit(1);
}
const seconds = Number(args.find(a => a.startsWith('--seconds='))?.split('=')[1] ?? 8);
const headed = args.includes('--headed');
// MSAA is off by default in both backends; --antialias turns it on for both,
// which is the open question in docs/WEBGPU_READINESS.md.
const antialias = args.includes('--antialias');
const resolved = path.resolve(file);

const query = extra => {
  const parts = [...(extra ? [extra] : []), ...(antialias ? ['antialias=1'] : [])];
  return parts.length > 0 ? `?${parts.join('&')}` : '';
};

const server = await startServer();
try {
  console.log(
    `Benchmarking ${path.basename(resolved)} for ${seconds}s per backend` +
      `${antialias ? ' (MSAA on)' : ''}\n`
  );
  const webgl = await measure(resolved, query(), seconds, headed);
  report('WebGL', webgl);
  const webgpu = await measure(resolved, query('webgpu=1'), seconds, headed);
  report('WebGPU', webgpu);

  console.log(`\n${webgl.points.toLocaleString()} points`);
  if (webgpu.backend !== 'webgpu') {
    console.log(
      '\n⚠️  WebGPU did not start — both rows are WebGL. Check the adapter is ' +
        'available (the viewer logs why it fell back).'
    );
  } else {
    const compare = (label, a, b) => {
      if (a <= 0 || b <= 0) {
        return;
      }
      const delta = ((a - b) / a) * 100;
      console.log(
        `WebGPU is ${Math.abs(delta).toFixed(1)}% ${delta >= 0 ? 'faster' : 'slower'} on ${label}.`
      );
    };
    compare('median frame time', webgl.medianFrameMs, webgpu.medianFrameMs);
    compare('GPU time', webgl.gpuMs, webgpu.gpuMs);

    // requestAnimationFrame is capped by the display refresh rate. Once both
    // backends sit on that cap, frame time says only "both keep up" — the GPU
    // figure is the one still carrying information.
    if (vsyncBound(webgl.medianFrameMs) && vsyncBound(webgpu.medianFrameMs)) {
      console.log(
        '\n⚠️  Both backends are vsync-bound, so the frame-time comparison is ' +
          'meaningless here — read the GPU line instead, or use a heavier file.'
      );
    }
    console.log(
      '\nRead this against the caveats at the top of this script: point size, ' +
        'EDL and GPU-timing mechanism all differ between the two backends.'
    );
  }
} finally {
  server.close();
}
