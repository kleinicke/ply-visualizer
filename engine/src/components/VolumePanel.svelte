<script lang="ts">
  import { beginVolumeRequest, volumeState } from '../state/volume.svelte';

  let { host, data, fileIndex }: { host: any; data: any; fileIndex: number } = $props();
  const initialMetadata = () => data.metadata as any;
  const metadata = initialMetadata();
  const sessionId = metadata.volumeSessionId as string;
  const range = metadata.volumeRange as { min: number; max: number };
  const histogram = (metadata.volumeHistogram as number[]) || [];
  let threshold = $state(Number(metadata.threshold ?? range.min));
  let renderMode = $state<'points' | 'mesh' | 'slices'>(
    metadata.volumeRenderMode === 'mesh' || metadata.volumeRenderMode === 'surface'
      ? 'mesh'
      : metadata.volumeRenderMode === 'slices'
        ? 'slices'
        : 'points'
  );
  let step = $state<[number, number, number]>(
    Array.isArray(metadata.meshExtractionStep)
      ? ([...metadata.meshExtractionStep] as [number, number, number])
      : [1, 1, 1]
  );
  let timer: number | undefined;
  let windowCenter = $state(Number(metadata.windowCenter ?? (range.min + range.max) / 2));
  let windowWidth = $state(
    Math.max(Number.EPSILON, Number(metadata.windowWidth ?? range.max - range.min))
  );
  let sliceIndices = $state<[number, number, number]>(
    Array.isArray(metadata.sliceIndices)
      ? ([...metadata.sliceIndices] as [number, number, number])
      : (metadata.volumeSizes.map((size: number) => Math.floor((size - 1) / 2)) as [
          number,
          number,
          number,
        ])
  );

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
      void host.reextractVolumeLocally({
        sessionId,
        fileIndex,
        threshold,
        step,
        renderMode,
        windowCenter,
        windowWidth,
        sliceIndices,
        requestId,
      });
    }, delay);
  }

  function setThreshold(value: number, delay = 300) {
    threshold = Math.max(range.min, Math.min(range.max, value));
    requestExtraction(delay);
  }

  function onModeChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    renderMode = value === 'mesh' ? 'mesh' : value === 'slices' ? 'slices' : 'points';
    requestExtraction(0);
  }

  function onWindowChange(kind: 'center' | 'width', event: Event) {
    const value = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(value)) return;
    if (kind === 'center') windowCenter = value;
    else windowWidth = Math.max(Number.EPSILON, value);
    requestExtraction();
  }

  function onSliceChange(axis: number, event: Event) {
    const next = [...sliceIndices] as [number, number, number];
    next[axis] = Math.max(
      0,
      Math.min(sizes[axis] - 1, Math.round(Number((event.target as HTMLInputElement).value) || 0))
    );
    sliceIndices = next;
    requestExtraction();
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
      <option value="points">Point cloud (pixels)</option>
      <option value="mesh">Mesh (isosurface)</option>
      <option value="slices">Orthogonal slices</option>
    </select>
  </div>

  {#if renderMode !== 'mesh'}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:10px;">
      <label>Window center
        <input aria-label="Window center" type="number" value={windowCenter} onchange={(event) => onWindowChange('center', event)} style="width:100%;box-sizing:border-box;" />
      </label>
      <label>Window width
        <input aria-label="Window width" type="number" min={Number.EPSILON} value={windowWidth} onchange={(event) => onWindowChange('width', event)} style="width:100%;box-sizing:border-box;" />
      </label>
    </div>
  {/if}

  {#if renderMode === 'slices'}
    <div style="margin-top:6px;font-size:10px;">Displayed slices:</div>
    {#each sliceIndices as slice, axis}
      <label style="display:grid;grid-template-columns:10px 1fr 32px;gap:4px;align-items:center;margin-top:2px;font-size:10px;">
        <span>{'ijk'[axis]}</span>
        <input aria-label={`${'ijk'[axis]} slice`} type="range" min="0" max={sizes[axis] - 1} step="1" value={slice} oninput={(event) => onSliceChange(axis, event)} style="min-width:0;width:100%;" />
        <span style="text-align:right;">{slice}</span>
      </label>
    {/each}
  {:else}
    <label for={`volume-threshold-${fileIndex}`} style="font-size:10px;">
      Hide voxel values below: {formatted(threshold)}{units ? ` ${units}` : ''}
    </label>
    <div style="position:relative;height:30px;margin-top:2px;">
      <svg viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true" style="position:absolute;inset:0;width:100%;height:100%;opacity:0.5;">
        <polyline points={histogramPoints} fill="none" stroke="currentColor" stroke-width="0.8" />
      </svg>
      <input id={`volume-threshold-${fileIndex}`} aria-label="Volume voxel threshold" type="range" min={range.min} max={range.max} step={(range.max - range.min) / 1000 || 1} value={threshold} oninput={(event) => setThreshold(Number((event.target as HTMLInputElement).value))} style="position:absolute;inset:0;width:100%;margin:0;background:transparent;" />
    </div>

    <label style="display:grid;grid-template-columns:auto 1fr;gap:4px;align-items:center;margin-top:4px;font-size:10px;">
      <span>Threshold value</span>
      <input aria-label="Volume threshold value" type="number" min={range.min} max={range.max} step="any" value={threshold} onchange={(event) => setThreshold(Number((event.target as HTMLInputElement).value), 0)} style="width:100%;box-sizing:border-box;" />
    </label>

    {#if isHU}
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px;margin-top:4px;">
        <button onclick={() => setThreshold(300, 0)} title="Bone preset: 300 HU">Bone</button>
        <button onclick={() => setThreshold(40, 0)} title="Soft tissue preset: 40 HU">Soft tissue</button>
        <button onclick={() => setThreshold(-500, 0)} title="Skin preset: -500 HU">Skin</button>
      </div>
    {/if}

    {#if renderMode === 'mesh'}
      <div style="display:grid;grid-template-columns:auto repeat(3,1fr);gap:3px;align-items:center;margin-top:5px;font-size:10px;">
        <span>Mesh sampling i/j/k:</span>
        {#each step as value, axis}
          <input aria-label={`Volume stride ${'ijk'[axis]}`} type="number" min="1" max={sizes[axis] - 1} value={value} onchange={(event) => onStepChange(axis, event)} style="width:100%;min-width:0;" />
        {/each}
      </div>
    {/if}

    <div style="margin-top:5px;font-size:10px;opacity:0.8;">
      {#if renderMode === 'points'}
        {Number(data.vertexCount).toLocaleString()} points
      {:else}
        {Number(data.faceCount).toLocaleString()} triangles
      {/if}
      {#if renderMode === 'mesh'}
        · sampling {step.join(' × ')}
      {:else}
        · one point per retained voxel
      {/if}
      {#if Array.isArray(metadata.effectiveSpacing)}
        · spacing {metadata.effectiveSpacing.map((value: number) => formatted(value)).join(' × ')} {metadata.spaceUnits || ''}
      {/if}
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
  {/if}

  {#if progress !== undefined && progress < 1}
    <div style="font-size:10px;margin-top:4px;">Extracting… {Math.round(progress * 100)}%</div>
  {/if}
  {#if error}
    <div style="font-size:10px;color:var(--vscode-errorForeground);margin-top:4px;">{error}</div>
  {/if}
</div>
