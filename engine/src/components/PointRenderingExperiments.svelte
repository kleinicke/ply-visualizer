<script lang="ts">
  import {
    POINT_EXPERIMENT_LABELS,
    type PointExperimentMode,
    type PointExperimentPose,
    type PointExperimentResult,
  } from '../pointRenderingExperiments';

  let { host }: { host: any } = $props();
  // This component is mounted once for one immutable visualizer host.
  // svelte-ignore state_referenced_locally
  const experiments = host.pointRenderingExperiments;
  let mode = $state<PointExperimentMode>('baseline');
  let pose = $state<PointExperimentPose>('normal');
  let fraction = $state(1);
  let running = $state(false);
  let status = $state('Load a large point cloud, then save the normal view.');
  let results = $state<PointExperimentResult[]>([]);

  const modes = Object.entries(POINT_EXPERIMENT_LABELS) as [PointExperimentMode, string][];

  function switchMode(event: Event) {
    mode = (event.currentTarget as HTMLSelectElement).value as PointExperimentMode;
    experiments.applyMode(mode);
    status = `${POINT_EXPERIMENT_LABELS[mode]} · camera unchanged`;
  }

  function switchPointFraction(event: Event) {
    fraction = Number((event.currentTarget as HTMLSelectElement).value);
    experiments.applyPointFraction(fraction);
    status = `${POINT_EXPERIMENT_LABELS[mode]} · ${Math.round(fraction * 100)}% points · camera unchanged`;
  }

  function captureNormal() {
    experiments.captureNormalPose();
    pose = 'normal';
    status = 'Saved current camera as Normal; generated matching ~5 px Degenerate pose.';
  }

  function fitAndCapture() {
    experiments.fitAndCaptureNormalPose();
    pose = 'normal';
    status = 'Fitted cloud and saved it as Normal; generated matching Degenerate pose.';
  }

  async function runCurrent() {
    running = true;
    status = 'Measuring 30 warm-up + 120 fixed-camera frames…';
    try {
      experiments.applyMode(mode);
      experiments.applyPointFraction(fraction);
      const result = await experiments.measure(pose);
      results = [...results, result];
      status = `Median ${result.medianFrameMs.toFixed(2)} ms · p95 ${result.p95FrameMs.toFixed(2)} ms · GPU ${result.gpuMs.toFixed(2)} ms`;
    } catch (error) {
      status = error instanceof Error ? error.message : String(error);
    } finally {
      running = false;
    }
  }

  async function runMatrix() {
    running = true;
    results = [];
    try {
      if (!experiments.hasNormalPose()) experiments.fitAndCaptureNormalPose();
      for (const nextMode of modes.map(([value]) => value)) {
        for (const nextPose of ['normal', 'degenerate'] as const) {
          for (const nextFraction of [1, 0.1]) {
            mode = nextMode;
            pose = nextPose;
            fraction = nextFraction;
            status = `Measuring ${POINT_EXPERIMENT_LABELS[mode]} · ${pose} · ${Math.round(fraction * 100)}%…`;
            experiments.applyMode(mode);
            experiments.applyPointFraction(fraction);
            results = [...results, await experiments.measure(pose)];
          }
        }
      }
      status = `Completed ${results.length} fixed-pose measurements.`;
    } catch (error) {
      status = error instanceof Error ? error.message : String(error);
    } finally {
      running = false;
    }
  }

  function reset() {
    experiments.reset();
    mode = 'baseline';
    fraction = 1;
    status = 'Restored the original always-round baseline.';
  }

  function copyResults() {
    navigator.clipboard.writeText(JSON.stringify(results, null, 2));
    status = `Copied ${results.length} result rows as JSON.`;
  }
</script>

<div class="panel-section" id="point-rendering-experiments">
  <h4>Point Rendering Experiments</h4>
  <div class="experiment-grid">
    <label for="point-experiment-mode">Setup</label>
    <select id="point-experiment-mode" class="control-input" value={mode} onchange={switchMode} disabled={running}>
      {#each modes as [value, label]}
        <option {value}>{label}</option>
      {/each}
    </select>
    <label for="point-experiment-pose">Fixed pose</label>
    <select id="point-experiment-pose" class="control-input" bind:value={pose} disabled={running}>
      <option value="normal">Normal</option>
      <option value="degenerate">Degenerate (~5 px)</option>
    </select>
    <label for="point-experiment-count">Point count</label>
    <select id="point-experiment-count" class="control-input" value={fraction} onchange={switchPointFraction} disabled={running}>
      <option value={1}>100%</option>
      <option value={0.1}>10%</option>
    </select>
  </div>
  <div class="control-buttons experiment-actions">
    <button class="control-button" onclick={fitAndCapture} disabled={running}>Fit + Save Normal</button>
    <button class="control-button" onclick={captureNormal} disabled={running}>Save Current</button>
    <button class="control-button" onclick={runCurrent} disabled={running}>Run Current</button>
    <button class="control-button" onclick={runMatrix} disabled={running}>Run Full Matrix</button>
    <button class="control-button" onclick={reset} disabled={running}>Reset</button>
  </div>
  <p class="setting-description experiment-status">{status}</p>
  {#if results.length > 0}
    <div class="experiment-results-wrap">
      <table class="experiment-results">
        <thead><tr><th>Setup</th><th>Pose</th><th>Pts</th><th>Median</th><th>GPU</th></tr></thead>
        <tbody>
          {#each results as result}
            <tr>
              <td>{result.mode}</td><td>{result.pose}</td>
              <td>{Math.round(result.pointFraction * 100)}%</td>
              <td>{result.medianFrameMs.toFixed(2)} ms</td><td>{result.gpuMs.toFixed(2)} ms</td>
            </tr>
          {/each}
        </tbody>
      </table>
      <button class="control-button" onclick={copyResults}>Copy JSON</button>
    </div>
  {/if}
  <p class="setting-description">
    The 10% setup uses a deterministic, uniformly strided index (no position copy). D creates
    250k-point render chunks because file-transfer chunks are normally reassembled before drawing. C
    is WebGL-only.
  </p>
</div>

<style>
  .experiment-grid { display: grid; grid-template-columns: auto 1fr; gap: 6px 8px; align-items: center; }
  .experiment-grid label { font-size: 11px; }
  .experiment-actions { margin-top: 8px; flex-wrap: wrap; }
  .experiment-actions button { flex: 1 1 110px; }
  .experiment-status { min-height: 2.4em; font-family: monospace; }
  .experiment-results-wrap { overflow-x: auto; margin: 8px 0; }
  .experiment-results { width: 100%; border-collapse: collapse; font-size: 10px; }
  .experiment-results th, .experiment-results td { padding: 3px 4px; border-bottom: 1px solid var(--vscode-panel-border); text-align: right; }
  .experiment-results th:first-child, .experiment-results td:first-child { text-align: left; }
</style>
