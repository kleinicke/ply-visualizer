/**
 * Runs the same fixed-pose point-rendering matrix exposed in the Controls tab.
 *
 * Usage (from engine/):
 *   pnpm run build
 *   pnpm run bench:points -- ../testfiles/lidar/20200810_J5.ply
 *   pnpm run bench:points -- <file> --core --frames=30 --warmup=10 --json
 *
 * --core runs Experiment 0 + A only (baseline and no-alpha).
 */
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(HERE, '..', 'dist');
const PORT = 8124;
const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
};

function startServer() {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://localhost:${PORT}`);
      let filePath = path.join(DIST, decodeURIComponent(url.pathname));
      if ((await stat(filePath).catch(() => null))?.isDirectory())
        filePath = path.join(filePath, 'index.html');
      response.writeHead(200, {
        'Content-Type': MIME[path.extname(filePath)] ?? 'application/octet-stream',
      });
      response.end(await readFile(filePath));
    } catch {
      response.writeHead(404).end('not found');
    }
  });
  return new Promise(resolve => server.listen(PORT, () => resolve(server)));
}

const args = process.argv.slice(2);
const input = args.find(argument => !argument.startsWith('--'));
if (!input) {
  console.error('Usage: pnpm run bench:points -- <file> [--core] [--json] [--headed]');
  process.exit(1);
}
const resolved = path.resolve(input);
const modes = args.includes('--core')
  ? ['baseline', 'no-alpha']
  : ['baseline', 'no-alpha', 'transparent', 'front-to-back', 'depth-prepass'];
const json = args.includes('--json');
const headed = args.includes('--headed');
const frames = Number(
  args.find(argument => argument.startsWith('--frames='))?.split('=')[1] ?? 120
);
const warmup = Number(args.find(argument => argument.startsWith('--warmup='))?.split('=')[1] ?? 30);
const server = await startServer();
let browser;
try {
  browser = await chromium.launch({
    headless: !headed,
    args: ['--ignore-gpu-blocklist', '--enable-gpu-benchmarking'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://localhost:${PORT}/3d-visualizer/`);
  await page.waitForFunction(() => window.visualizer?.renderer !== undefined);
  await page.locator('#hiddenFileInput').setInputFiles(resolved);
  await page.waitForFunction(() => (window.visualizer?.meshes?.length ?? 0) > 0, null, {
    timeout: 180_000,
  });

  await page.evaluate(() => {
    const visualizer = window.visualizer;
    visualizer.edlEnabled = false;
    visualizer.pointRenderingExperiments.fitAndCaptureNormalPose();
  });

  const backend = await page.evaluate(() => window.visualizer.rendererBackend);
  const glRenderer = await page.evaluate(() => {
    const gl = window.visualizer.webglRenderer?.getContext();
    if (!gl) return null;
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    return debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  });
  if (!json)
    console.log(
      `backend=${backend} renderer=${glRenderer ?? 'unavailable'} frames=${frames} warmup=${warmup}`
    );

  const results = [];
  for (const mode of modes) {
    for (const pose of ['normal', 'degenerate']) {
      for (const fraction of [1, 0.1]) {
        const result = await page.evaluate(
          async ({ mode, pose, fraction, frames, warmup }) => {
            const experiments = window.visualizer.pointRenderingExperiments;
            experiments.applyMode(mode);
            experiments.applyPointFraction(fraction);
            return experiments.measure(pose, frames, warmup);
          },
          { mode, pose, fraction, frames, warmup }
        );
        results.push(result);
        if (!json) {
          console.log(
            `${mode.padEnd(14)} ${pose.padEnd(10)} ${(fraction * 100).toFixed(0).padStart(3)}% ` +
              `${result.renderedPoints.toLocaleString().padStart(10)} pts  ` +
              `median ${result.medianFrameMs.toFixed(2).padStart(6)} ms  ` +
              `p95 ${result.p95FrameMs.toFixed(2).padStart(6)} ms  GPU ${result.gpuMs.toFixed(2).padStart(6)} ms`
          );
        }
      }
    }
  }
  const output = {
    file: resolved,
    backend,
    glRenderer,
    viewport: '1280x720',
    errors,
    results,
  };
  if (json) console.log(JSON.stringify(output, null, 2));
  else if (errors.length) errors.forEach(error => console.error(`page error: ${error}`));
} finally {
  await browser?.close();
  server.close();
}
