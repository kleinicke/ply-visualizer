'use strict';

/**
 * Runs one scenario per file in a real VS Code window and records what the
 * extension itself reported.
 *
 * The measurement principle: this scrapes the extension's OWN Output-channel
 * log rather than instrumenting the webview from the outside. The number that
 * lands in the results is therefore the number a user sees in the "3D
 * Visualizer" Output panel, not a parallel measurement that could drift from
 * it. See docs/performance-method.md.
 *
 * A scenario is a list of steps. `open` opens the file; every other step is
 * forwarded into the webview by plyViewer.benchmarkScenario and runs exactly
 * the code path its button runs. Each step is finished when the PERF line it
 * is defined to produce appears — never after a fixed wait, which would either
 * truncate a slow run or pad a fast one.
 *
 * Driven by scripts/benchmark-vscode.mjs.
 */

const fs = require('node:fs');
const path = require('node:path');
const vscode = require('vscode');

// Every PERF line the extension writes to the Output channel, whichever phase
// vocabulary it uses. The tag is what identifies the step; the trailing total
// is the one number every line is guaranteed to carry.
const PERF_LINE = /PERF\[([^\]]+)\][^\r\n]*?total ([0-9.]+)\s*ms([^\r\n]*)/g;

/**
 * Which PERF tag ends each step.
 *
 * `open` matches any tag, because the load line's tag is the format's own
 * (`x3a/all`, `ply file.ply`, ...) and hard-coding the list here would silently
 * break the harness the next time a format is added.
 */
const STEP_COMPLETION = {
  open: () => true,
  alignAll: tag => tag.startsWith('registration/align-all') || tag.startsWith('benchmark/skipped'),
  refineAll: tag =>
    tag.startsWith('registration/refine-all') || tag.startsWith('benchmark/skipped'),
  recolorAll: tag => tag.startsWith('x3a/recolour-all') || tag.startsWith('benchmark/skipped'),
  registerAndRecolorAll: tag =>
    tag.startsWith('x3a/auto-match+recolour-all') || tag.startsWith('benchmark/skipped'),
};

function filesUnder(directory, result = []) {
  if (!fs.existsSync(directory)) {
    return result;
  }
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      filesUnder(file, result);
    } else if (entry.isFile() && entry.name.endsWith('.log')) {
      result.push(file);
    }
  }
  return result;
}

function scrape(logRoot) {
  const lines = [];
  for (const file of filesUnder(logRoot)) {
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    for (const match of text.matchAll(PERF_LINE)) {
      lines.push({ line: match[0], tag: match[1], totalMs: Number(match[2]), extra: match[3] });
    }
  }
  return lines;
}

/**
 * Wait for a PERF line that (a) is new and (b) belongs to this step.
 *
 * Both halves matter. Without the tag check a "register first, then recolour"
 * run would finish on the alignment line it emits on the way; without the count
 * check every step would finish instantly on the previous iteration's line.
 *
 * `open` is special. A container logs one line per scan and then a `<kind>/all`
 * summary, so the first line to appear is NOT the end of the load — stopping
 * there would start the align step while scans were still arriving, and would
 * report a fraction of the load as the whole of it. So `open` waits for the
 * logging to go quiet, then prefers the container summary when there is one.
 */
async function waitForStepLine(logRoot, previousCount, step, timeoutMs) {
  const belongs = STEP_COMPLETION[step] || (() => true);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const current = scrape(logRoot);
    const fresh = current.slice(previousCount).filter(entry => belongs(entry.tag));
    if (fresh.length > 0) {
      if (step !== 'open') {
        return { entry: fresh[0], all: fresh };
      }
      const settled = await settle(logRoot, previousCount, deadline);
      const loadLines = settled.slice(previousCount).filter(entry => belongs(entry.tag));
      // The LAST `<kind>/all` line, not the first: a container emits a
      // per-stage summary (`x3a/geometry/all`) before the whole-load one
      // (`x3a/all`), and only the last is the number the user waited for.
      const containers = loadLines.filter(entry => isContainerSummary(entry.tag));
      const container = containers[containers.length - 1];
      return { entry: container ?? loadLines[loadLines.length - 1], all: loadLines };
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return null;
}

/** `x3a/all`, but not `x3a/geometry/all` — the whole-load summary of a container. */
const isContainerSummary = tag => /^[^/]+\/all\b/.test(tag);

/**
 * Poll until the container summary lands, or until no new PERF line has
 * appeared for QUIET_MS.
 *
 * The quiet window is generous on purpose. A big archive streams its large
 * scans in chunks, and those emit no per-scan line, so the log can go silent
 * for tens of seconds in the middle of a load that is far from finished. A 3 s
 * window ended the wait after the first two small scans of an 8-scan archive
 * and reported 7 s for a load that actually took 31 s — a wrong number, which
 * is worse than a slow one. The summary line short-circuits the wait whenever
 * a container is involved, so the full window is only ever paid by formats
 * that emit a single line and are done.
 */
const QUIET_MS = 20000;
async function settle(logRoot, previousCount, deadline) {
  let lines = scrape(logRoot);
  let count = lines.length;
  let lastChange = Date.now();
  while (Date.now() < deadline && Date.now() - lastChange < QUIET_MS) {
    if (lines.slice(previousCount).some(entry => isContainerSummary(entry.tag))) {
      return lines;
    }
    await new Promise(resolve => setTimeout(resolve, 250));
    lines = scrape(logRoot);
    if (lines.length !== count) {
      count = lines.length;
      lastChange = Date.now();
    }
  }
  return lines;
}

async function run() {
  const inputs = JSON.parse(process.env.PLY_PERF_FILES || '[]');
  const logRoot = process.env.PLY_PERF_LOG_ROOT;
  const resultFile = process.env.PLY_PERF_RESULT;
  const steps = JSON.parse(process.env.PLY_PERF_STEPS || '["open"]');
  const timeoutMs = Number(process.env.PLY_PERF_TIMEOUT_MS || 600000);
  if (!inputs.length || !logRoot || !resultFile) {
    throw new Error('Missing PLY performance runner environment');
  }

  const results = [];
  for (const input of inputs) {
    const measurements = [];
    for (const step of steps) {
      const before = scrape(logRoot).length;
      const startedAt = Date.now();
      if (step === 'open') {
        await vscode.commands.executeCommand(
          'vscode.openWith',
          vscode.Uri.file(input.file),
          input.file.toLowerCase().endsWith('.bin') ? 'plyViewer.kittiBin' : 'plyViewer.plyEditor',
          { preview: false, viewColumn: vscode.ViewColumn.One }
        );
      } else {
        const delivered = await vscode.commands.executeCommand('plyViewer.benchmarkScenario', step);
        if (!delivered) {
          measurements.push({ step, totalMs: 0, wallMs: 0, line: '', tag: 'NO-VIEWER' });
          continue;
        }
      }
      const found = await waitForStepLine(logRoot, before, step, timeoutMs);
      // A step that never reports must not abort the run: record the miss so
      // the remaining files still produce numbers.
      measurements.push({
        step,
        totalMs: found ? found.entry.totalMs : 0,
        wallMs: Date.now() - startedAt,
        line: found ? found.entry.line : '',
        tag: found ? found.entry.tag : 'NO-PERF-LINE',
        // Every line the step produced, so a phase breakdown can be read back
        // out of the result file without re-running anything.
        lines: found ? found.all.map(entry => entry.line) : [],
      });
    }
    results.push({ id: input.id, file: input.file, measurements });
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    // Let the closed editor release its webview (and its GPU memory) before
    // the next open.
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  fs.writeFileSync(resultFile, JSON.stringify({ steps, results }, null, 2));
}

module.exports = { run };
