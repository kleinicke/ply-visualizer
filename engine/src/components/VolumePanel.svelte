<script lang="ts">
  import { beginVolumeRequest, volumeState } from '../state/volume.svelte';

  let { host, data, fileIndex }: { host: any; data: any; fileIndex: number } = $props();
  const initialMetadata = () => data.metadata as any;
  const metadata = initialMetadata();
  const sessionId = metadata.volumeSessionId as string;
  const range = metadata.volumeRange as { min: number; max: number };
  const histogram = (metadata.volumeHistogram as number[]) || [];
  let threshold = $state(Number(metadata.threshold ?? range.min));
  let renderMode = $state<'points' | 'mesh' | 'slices' | 'voxels'>(
    metadata.volumeRenderMode === 'mesh' || metadata.volumeRenderMode === 'surface'
      ? 'mesh'
      : metadata.volumeRenderMode === 'slices'
        ? 'slices'
        : metadata.volumeRenderMode === 'voxels'
          ? 'voxels'
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
  let brightnessMode = $state<'slice-auto' | 'dicom-window' | 'volume-range'>(
    metadata.brightnessMode === 'slice-auto' || metadata.brightnessMode === 'volume-range'
      ? metadata.brightnessMode
      : 'dicom-window'
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
  // Voxel mode parks the global planes at the full extent, so its own clip has
  // to be recovered from the extraction metadata rather than from them.
  let clipRanges = $state<Array<[number, number]>>(
    Array.isArray(metadata.voxelClip)
      ? (metadata.voxelClip.map((clip: number[]) => [...clip]) as Array<[number, number]>)
      : sizes.map((size, axis) => host.sectionPlanes.getRange(fileIndex, axis, size))
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
        brightnessMode,
        sliceIndices,
        clipRanges,
        requestId,
      });
    }, delay);
  }

  /**
   * Voxel mode builds only the shell of the retained block, so a clipping
   * plane through it would show a hollow inside. It clips in the extraction
   * instead, which means the global planes have to be opened up while it is
   * active — and restored from the same ranges when another mode takes over.
   */
  function applyClipPlanes() {
    const geometryClips = renderMode === 'voxels';
    clipRanges.forEach((clip, axis) => {
      host.sectionPlanes.setVolumeRange(
        fileIndex,
        data,
        axis,
        geometryClips ? 0 : clip[0],
        geometryClips ? sizes[axis] - 1 : clip[1],
        host.transformationMatrices[fileIndex]
      );
    });
    host.requestRender();
  }

  function setThreshold(value: number, delay = 300) {
    threshold = Math.max(range.min, Math.min(range.max, value));
    requestExtraction(delay);
  }

  function onModeChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    renderMode =
      value === 'mesh'
        ? 'mesh'
        : value === 'slices'
          ? 'slices'
          : value === 'voxels'
            ? 'voxels'
            : 'points';
    applyClipPlanes();
    requestExtraction(0);
  }

  function onWindowChange(kind: 'center' | 'width', event: Event) {
    const value = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(value)) return;
    if (kind === 'center') windowCenter = value;
    else windowWidth = Math.max(Number.EPSILON, value);
    requestExtraction();
  }

  function onBrightnessModeChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    brightnessMode =
      value === 'slice-auto'
        ? 'slice-auto'
        : value === 'volume-range'
          ? 'volume-range'
          : 'dicom-window';
    requestExtraction(0);
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
    applyClipPlanes();
    if (renderMode === 'voxels') {
      requestExtraction();
    }
  }
</script>

<div class="panel-section volume-panel" style="margin-top:6px;margin-bottom:6px;padding:6px;">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
    <strong style="font-size:11px;">Volume</strong>
    <select aria-label="Volume render mode" value={renderMode} onchange={onModeChange} style="font-size:10px;">
      <option value="points">Point cloud (pixels)</option>
      <option value="voxels">Voxels (solid cubes)</option>
      <option value="mesh">Mesh (isosurface)</option>
      <option value="slices">Orthogonal slices</option>
    </select>
  </div>

  {#if renderMode !== 'mesh'}
    <label style="display:grid;grid-template-columns:auto 1fr;gap:4px;align-items:center;font-size:10px;">
      <span>Brightness</span>
      <select aria-label="Volume brightness mapping" value={brightnessMode} onchange={onBrightnessModeChange} style="min-width:0;font-size:10px;">
        <option value="slice-auto">Match 2D images (per layer)</option>
        <option value="dicom-window">DICOM window (whole series)</option>
        <option value="volume-range">Volume min/max (whole series)</option>
      </select>
    </label>
    {#if brightnessMode === 'dicom-window'}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:10px;margin-top:4px;">
        <label>Window center
          <input aria-label="Window center" type="number" value={windowCenter} onchange={(event) => onWindowChange('center', event)} style="width:100%;box-sizing:border-box;" />
        </label>
        <label>Window width
          <input aria-label="Window width" type="number" min={Number.EPSILON} value={windowWidth} onchange={(event) => onWindowChange('width', event)} style="width:100%;box-sizing:border-box;" />
        </label>
      </div>
    {:else if brightnessMode === 'slice-auto'}
      <div style="font-size:10px;opacity:0.75;margin-top:3px;">Each point uses its original k-layer min/max, matching the 2D viewer.</div>
    {:else}
      <div style="font-size:10px;opacity:0.75;margin-top:3px;">One fixed {formatted(range.min)}–{formatted(range.max)} range for the complete volume.</div>
    {/if}
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
      {:else if renderMode === 'voxels'}
        {Number(data.metadata?.renderedVoxelCount ?? 0).toLocaleString()} voxels · {Number(data.faceCount).toLocaleString()} triangles
      {:else}
        {Number(data.faceCount).toLocaleString()} triangles
      {/if}
      {#if renderMode === 'mesh'}
        · sampling {step.join(' × ')}
      {:else if renderMode === 'voxels'}
        · gap-free boxes, hidden faces removed
      {:else}
        · one point per retained voxel
      {/if}
      {#if Array.isArray(metadata.effectiveSpacing)}
        · {renderMode === 'voxels' ? 'box size' : 'spacing'} {metadata.effectiveSpacing.map((value: number) => formatted(value)).join(' × ')} {metadata.spaceUnits || ''}
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
