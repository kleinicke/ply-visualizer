#!/usr/bin/env node
/**
 * Measure the CURRENT working tree in a real VS Code window.
 *
 * Answers "where does the time go right now" for the three operations that
 * dominate a working session: opening a file, aligning every cloud onto the
 * first one, and recolouring an archive from its own photographs. Each step is
 * timed by the extension itself; this script only orchestrates and reports.
 *
 *   node scripts/benchmark-vscode.mjs                          # default corpus, load only
 *   FILES=testfiles/lidar/Abschnitt_A.x3a node scripts/benchmark-vscode.mjs
 *   STEPS=open,alignAll,recolorAll node scripts/benchmark-vscode.mjs
 *   ITER=4 node scripts/benchmark-vscode.mjs
 *
 * READING THE OUTPUT — the first iteration of each file is discarded, always.
 * A cold open pays costs that never recur in a session: compiling and
 * instantiating the WASM modules, starting the worker pool, and the first
 * shader compile and GPU upload of a given size. Mixing those into a median
 * hides real changes behind startup noise. Everything reported is the median of
 * iterations 2..N, and the discarded cold number is kept in the result file.
 *
 * Check `uptime` before believing any of it — see docs/performance-method.md.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { downloadAndUnzipVSCode, runTests } from '@vscode/test-electron';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const iterations = Math.max(1, Number(process.env.ITER || 3));
const steps = String(process.env.STEPS || 'open')
  .split(',')
  .map(value => value.trim())
  .filter(Boolean);

// One archive with several stations (the align/recolour scenario needs more
// than one cloud in the file) and one plain point cloud for a load-only
// baseline. Override with FILES=a,b,c.
const DEFAULT_FILES = ['testfiles/lidar/Abschnitt_A.x3a', 'testfiles/ply/test_pc2.ply'];

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[sorted.length >> 1] : 0;
}

function loadAverage() {
  const [one] = os.loadavg();
  return { load: one, cores: os.cpus().length };
}

async function main() {
  const requested = (process.env.FILES ? process.env.FILES.split(',') : DEFAULT_FILES)
    .map(value => value.trim())
    .filter(Boolean)
    .map(value => (path.isAbsolute(value) ? value : path.join(root, value)));
  const missing = requested.filter(file => !fs.existsSync(file));
  if (missing.length) {
    throw new Error(`No such file(s): ${missing.join(', ')}`);
  }

  const { load, cores } = loadAverage();
  if (load > cores / 2) {
    console.warn(
      `WARNING: load average ${load.toFixed(1)} on ${cores} cores. ` +
        'These numbers will be contention, not your change.'
    );
  }

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ply-vscode-perf-'));
  const stage = path.join(tempRoot, 'files');
  fs.mkdirSync(stage, { recursive: true });

  // Hardlink into one workspace folder so VS Code opens real files without
  // copying gigabytes.
  const base = requested.map(file => {
    const real = fs.realpathSync(file);
    const destination = path.join(stage, path.basename(real));
    try {
      fs.linkSync(real, destination);
    } catch {
      fs.copyFileSync(real, destination);
    }
    return { id: path.basename(real), file: destination, bytes: fs.statSync(real).size };
  });

  const totalMb = base.reduce((sum, file) => sum + file.bytes, 0) / 1048576;
  console.log(
    `${base.length} file(s), ${totalMb.toFixed(0)} MB, ${iterations} iteration(s), ` +
      `steps: ${steps.join(' -> ')}`
  );

  const inputs = [];
  for (let iteration = 0; iteration < iterations; iteration++) {
    inputs.push(...base);
  }

  const userData = path.join(tempRoot, 'user');
  const resultFile = path.join(tempRoot, 'result.json');
  fs.mkdirSync(userData, { recursive: true });
  Object.assign(process.env, {
    PLY_PERF_FILES: JSON.stringify(inputs),
    PLY_PERF_LOG_ROOT: userData,
    PLY_PERF_RESULT: resultFile,
    PLY_PERF_STEPS: JSON.stringify(steps),
  });

  // From VS Code's integrated terminal these describe the PARENT extension
  // host; ELECTRON_RUN_AS_NODE in particular makes the downloaded Code binary
  // treat the workspace path as a Node script.
  const parentVsCode = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => key === 'ELECTRON_RUN_AS_NODE' || key.startsWith('VSCODE_')
    )
  );
  for (const key of Object.keys(parentVsCode)) {
    delete process.env[key];
  }

  let executable = await downloadAndUnzipVSCode();
  if (!fs.existsSync(executable)) {
    // @vscode/test-electron expects an `Electron` binary; current VS Code
    // builds ship it as `Code`.
    const alternative = path.join(path.dirname(executable), 'Code');
    if (!fs.existsSync(alternative)) {
      throw new Error(`No VS Code binary at ${executable}`);
    }
    executable = alternative;
  }

  try {
    await runTests({
      vscodeExecutablePath: executable,
      extensionDevelopmentPath: root,
      extensionTestsPath: path.join(root, 'test/vscode-performance/runner.cjs'),
      launchArgs: [
        stage,
        `--user-data-dir=${userData}`,
        '--disable-workspace-trust',
        '--skip-welcome',
        '--disable-extensions',
      ],
    });
  } finally {
    Object.assign(process.env, parentVsCode);
  }

  const { results } = JSON.parse(fs.readFileSync(resultFile, 'utf8'));
  const grouped = new Map();
  for (const row of results) {
    if (!grouped.has(row.id)) {
      grouped.set(row.id, []);
    }
    grouped.get(row.id).push(row);
  }

  const pad = (value, width) => String(value).padStart(width);
  console.log('\n' + 'file'.padEnd(30) + pad('MB', 8) + steps.map(step => pad(step, 14)).join(''));
  const rows = [];
  for (const [id, runs] of grouped) {
    // Discard the cold first open; see the note at the top of this file.
    const warm = runs.length > 1 ? runs.slice(1) : runs;
    const bytes = base.find(file => file.id === id)?.bytes || 0;
    const perStep = {};
    for (const step of steps) {
      const samples = warm.map(
        run => run.measurements.find(measurement => measurement.step === step)?.totalMs ?? 0
      );
      perStep[step] = {
        median: median(samples),
        samples,
        cold: runs[0].measurements.find(measurement => measurement.step === step)?.totalMs ?? 0,
        line: warm[warm.length - 1].measurements.find(m => m.step === step)?.line ?? '',
      };
    }
    rows.push({ id, mb: bytes / 1048576, steps: perStep, warmSamples: warm.length });
    console.log(
      id.slice(0, 29).padEnd(30) +
        pad((bytes / 1048576).toFixed(1), 8) +
        steps.map(step => pad(perStep[step].median.toFixed(0) + 'ms', 14)).join('')
    );
  }

  const misses = rows.flatMap(row =>
    steps.filter(step => row.steps[step].median === 0).map(step => `${row.id}/${step}`)
  );
  if (misses.length) {
    console.log(`\nNo PERF line for: ${misses.join(', ')}`);
  }

  const out = path.join(root, 'benchmark-vscode-result.json');
  fs.writeFileSync(out, JSON.stringify({ steps, iterations, load, cores, rows, results }, null, 2));
  console.log(
    `\nMedians of iterations 2..${iterations} (cold first run discarded). ` +
      `Load average at start: ${load.toFixed(1)} on ${cores} cores. Full detail: ${out}`
  );
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
