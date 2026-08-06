<script lang="ts">
  import { beginVolumeRequest, volumeState } from '../state/volume.svelte';

  let { host, data, fileIndex }: { host: any; data: any; fileIndex: number } = $props();
  const initialMetadata = () => data.metadata as any;
  const metadata = initialMetadata();
  const sessionId = metadata.volumeSessionId as string;
  const range = metadata.volumeRange as { min: number; max: number };
  const histogram = (metadata.volumeHistogram as number[]) || [];
  let threshold = $state(Number(metadata.threshold ?? range.min));
  let renderMode = $state<'surface' | 'points'>(
    metadata.volumeRenderMode === 'points' ? 'points' : 'surface'
  );
  let step = $state<[number, number, number]>(
    Array.isArray(metadata.extractionStep)
      ? ([...metadata.extractionStep] as [number, number, number])
      : [1, 1, 1]
  );
  let timer: number | undefined;

  const units = (metadata.intensityUnits as string | undefined) || '';
  const isHU = units.trim().toUpperCase() === 'HU';
  const sizes = metadata.volumeSizes as [number, number, number];
  let clipRanges = $state<Array<[number, number]>>(
    sizes.map((size, axis) => host.sectionPlanes.getRange(fileIndex, axis, size))
  );
  const progress = $derived(volumeState.progress[sessionId]);
  const error = $derived(volumeState.errors[sessionId]);
  const histogramPoints = $derived.by(() => {
    if (!histogram.length) return '';
    const max = Math.max(1, ...histogram);
    return histogram
      .map((count, index) => {
        const x = (index / Math.max(1, histogram.length - 1)) * 100;
        const y = 28 - (Math.log1p(count) / Math.log1p(max)) * 26;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');
  });

  function requestExtraction(delay = 300) {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      const requestId = beginVolumeRequest(sessionId);
      host.vscode.postMessage({
        type: 'volume:reextract',
        fileIndex,
        threshold,
        step,
        renderMode,
        requestId,
      });
    }, delay);
  }

  function setThreshold(value: number, delay = 300) {
    threshold = Math.max(range.min, Math.min(range.max, value));
    requestExtraction(delay);
  }

  function onModeChange(event: Event) {
    renderMode = (event.target as HTMLSelectElement).value === 'points' ? 'points' : 'surface';
    requestExtraction(0);
  }

  function onStepChange(axis: number, event: Event) {
    const next = [...step] as [number, number, number];
    next[axis] = Math.max(
      1,
      Math.min(sizes[axis] - 1, Number((event.target as HTMLInputElement).value) || 1)
    );
    step = next;
    requestExtraction();
  }

  function formatted(value: number): string {
    return Number(value.toPrecision(6)).toString();
  }

  function setClip(axis: number, edge: 0 | 1, value: number) {
    const next = clipRanges.map(range => [...range] as [number, number]);
    if (edge === 0) next[axis][0] = Math.min(value, next[axis][1]);
    else next[axis][1] = Math.max(value, next[axis][0]);
    clipRanges = next;
    host.sectionPlanes.setVolumeRange(
      fileIndex,
      data,
      axis,
      next[axis][0],
      next[axis][1],
      host.transformationMatrices[fileIndex]
    );
    host.requestRender();
  }
</script>

<div class="panel-section volume-panel" style="margin-top:6px;margin-bottom:6px;padding:6px;">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
    <strong style="font-size:11px;">Volume</strong>
    <select aria-label="Volume render mode" value={renderMode} onchange={onModeChange} style="font-size:10px;">
      <option value="surface">Isosurface</option>
      <option value="points">Point cloud</option>
    </select>
  </div>

  <label for={`volume-threshold-${fileIndex}`} style="font-size:10px;">
    Threshold: {formatted(threshold)}{units ? ` ${units}` : ''}
  </label>
  <div style="position:relative;height:30px;margin-top:2px;">
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true" style="position:absolute;inset:0;width:100%;height:100%;opacity:0.5;">
      <polyline points={histogramPoints} fill="none" stroke="currentColor" stroke-width="0.8" />
    </svg>
    <input
      id={`volume-threshold-${fileIndex}`}
      aria-label="Volume threshold"
      type="range"
      min={range.min}
      max={range.max}
      step={(range.max - range.min) / 1000 || 1}
      value={threshold}
      oninput={(event) => setThreshold(Number((event.target as HTMLInputElement).value))}
      style="position:absolute;inset:0;width:100%;margin:0;background:transparent;"
    />
  </div>

  {#if isHU}
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px;margin-top:4px;">
      <button onclick={() => setThreshold(300, 0)} title="Bone preset: 300 HU">Bone</button>
      <button onclick={() => setThreshold(40, 0)} title="Soft tissue preset: 40 HU">Soft tissue</button>
      <button onclick={() => setThreshold(-500, 0)} title="Skin preset: -500 HU">Skin</button>
    </div>
  {/if}

  <div style="display:grid;grid-template-columns:auto repeat(3,1fr);gap:3px;align-items:center;margin-top:5px;font-size:10px;">
    <span>Stride i/j/k:</span>
    {#each step as value, axis}
      <input aria-label={`Volume stride ${'ijk'[axis]}`} type="number" min="1" max={sizes[axis] - 1} value={value} onchange={(event) => onStepChange(axis, event)} style="width:100%;min-width:0;" />
    {/each}
  </div>

  <div style="margin-top:6px;font-size:10px;">Visible slices:</div>
  {#each clipRanges as clip, axis}
    <div style="display:grid;grid-template-columns:10px 1fr 1fr;gap:4px;align-items:center;margin-top:2px;">
      <span>{'ijk'[axis]}</span>
      <label style="display:flex;align-items:center;gap:3px;">
        <input aria-label={`Minimum ${'ijk'[axis]} slice`} type="range" min="0" max={sizes[axis] - 1} step="1" value={clip[0]} oninput={(event) => setClip(axis, 0, Number((event.target as HTMLInputElement).value))} style="min-width:0;width:100%;" />
        <span style="min-width:24px;text-align:right;">{clip[0]}</span>
      </label>
      <label style="display:flex;align-items:center;gap:3px;">
        <input aria-label={`Maximum ${'ijk'[axis]} slice`} type="range" min="0" max={sizes[axis] - 1} step="1" value={clip[1]} oninput={(event) => setClip(axis, 1, Number((event.target as HTMLInputElement).value))} style="min-width:0;width:100%;" />
        <span style="min-width:24px;text-align:right;">{clip[1]}</span>
      </label>
    </div>
  {/each}

  {#if progress !== undefined && progress < 1}
    <div style="font-size:10px;margin-top:4px;">Extracting… {Math.round(progress * 100)}%</div>
  {/if}
  {#if error}
    <div style="font-size:10px;color:var(--vscode-errorForeground);margin-top:4px;">{error}</div>
  {/if}
</div>
