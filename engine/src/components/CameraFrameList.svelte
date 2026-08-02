<script lang="ts">
  import {
    isCameraFrameImageVisible,
    listCameraFrames,
    lookThroughCameraFrame,
    setCameraFrameImageVisible,
  } from '../visualization/cameraFrames';

  // `sceneTick` is bumped by the parent whenever it changes plane visibility
  // for the whole profile, so the per-camera checkboxes below keep reporting
  // what the scene actually shows rather than what this list last set.
  let {
    host,
    cameraGroup,
    sceneTick = 0,
  }: { host: any; cameraGroup: any; sceneTick?: number } = $props();

  // Rows are built only once opened, so profiles with many cameras cost
  // nothing while collapsed, and only a first batch is rendered even then.
  const BATCH = 50;

  let expanded = $state(false);
  let shown = $state(BATCH);
  let openFrame = $state(-1);
  let renderTick = $state(0);

  const frames = $derived.by(() => {
    renderTick;
    return expanded ? listCameraFrames(cameraGroup) : [];
  });
  const visible = $derived.by(() => {
    renderTick;
    sceneTick;
    return frames.map(frame => isCameraFrameImageVisible(frame.group));
  });

  // E57 decodes its images asynchronously and adds each frame group when it is
  // ready, with no reactive signal to hook into. Watching the child count
  // while the list is open keeps it from sitting empty forever if it was
  // opened mid-decode. The interval exists only while expanded.
  $effect(() => {
    if (!expanded) {
      return;
    }
    let lastCount = cameraGroup?.children.length ?? 0;
    const timer = setInterval(() => {
      const count = cameraGroup?.children.length ?? 0;
      if (count !== lastCount) {
        lastCount = count;
        renderTick++;
      }
    }, 500);
    return () => clearInterval(timer);
  });

  function toggleExpanded() {
    expanded = !expanded;
    shown = BATCH;
  }

  function onFrameImageChange(frameIndex: number, event: Event) {
    setCameraFrameImageVisible(
      frames[frameIndex].group,
      (event.target as HTMLInputElement).checked
    );
    renderTick++;
    host.requestRender();
  }

  function onLookThrough(frameIndex: number) {
    lookThroughCameraFrame(host, frames[frameIndex].group);
  }

  function coordinates(position: { x: number; y: number; z: number } | null) {
    return position
      ? `${position.x.toFixed(3)}, ${position.y.toFixed(3)}, ${position.z.toFixed(3)}`
      : 'unknown';
  }

  // Styles stay inline, as in every other panel component. A scoped style
  // block compiles fine in the engine build but breaks the extension build,
  // which runs svelte-loader with emitCss into mini-css-extract: css-loader
  // then fails with "PostCSS received undefined instead of CSS string", the
  // module is dropped, and the component is undefined at runtime.
  const BUTTON =
    'background:transparent;border:none;color:var(--vscode-foreground);font-size:10px;padding:2px 0;cursor:pointer;text-align:left;';
  const DISCLOSURE = `${BUTTON}opacity:0.85;`;
  const NAME_BUTTON = `${BUTTON}flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;`;
  const VIEW_BUTTON = `${BUTTON}border:1px solid var(--vscode-panel-border, rgba(128,128,128,0.4));border-radius:2px;padding:1px 6px;`;
  const TERM = 'white-space:nowrap;';
  const VALUE = 'margin:0;overflow-wrap:anywhere;';
</script>

<div class="camera-frame-list" style="margin-top:6px;font-size:10px;">
  <button
    type="button"
    class="camera-frame-disclosure"
    style={DISCLOSURE}
    aria-expanded={expanded}
    onclick={toggleExpanded}
  >
    {expanded ? '▾' : '▸'} Individual cameras ({cameraGroup.userData.cameraCount ??
      cameraGroup.children.length})
  </button>

  {#if expanded}
    {#each frames.slice(0, shown) as frame, frameIndex (frame.name)}
      <div
        class="camera-frame-row"
        style="display:flex;align-items:center;gap:6px;padding-left:10px;"
      >
        <button
          type="button"
          class="camera-frame-name"
          style={NAME_BUTTON}
          title="Show calibration details"
          onclick={() => (openFrame = openFrame === frameIndex ? -1 : frameIndex)}
        >
          {openFrame === frameIndex ? '▾' : '▸'}
          {frame.name}
        </button>
        {#if frame.hasImagePlane}
          <input
            type="checkbox"
            title="Show this camera's image"
            checked={visible[frameIndex]}
            onchange={event => onFrameImageChange(frameIndex, event)}
          />
        {/if}
        <button
          type="button"
          class="camera-frame-view"
          style={VIEW_BUTTON}
          title="Move the viewer to this camera's optical centre — the only place where its image and the point cloud line up"
          onclick={() => onLookThrough(frameIndex)}
        >
          View
        </button>
      </div>
      {#if openFrame === frameIndex}
        <dl
          class="camera-frame-details"
          style="display:grid;grid-template-columns:auto 1fr;gap:1px 8px;margin:2px 0 6px 20px;opacity:0.8;"
        >
          <dt style={TERM}>Translation</dt>
          <dd style={VALUE}>{coordinates(frame.position)}</dd>
          {#each frame.details as detail}
            <dt style={TERM}>{detail.label}</dt>
            <dd style={VALUE}>{detail.value}</dd>
          {/each}
        </dl>
      {/if}
    {/each}

    {#if frames.length > shown}
      <button
        type="button"
        class="camera-frame-disclosure"
        style={DISCLOSURE}
        onclick={() => (shown += BATCH)}
      >
        Show {Math.min(BATCH, frames.length - shown)} more of {frames.length}
      </button>
    {/if}
  {/if}
</div>
