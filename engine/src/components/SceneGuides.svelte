<script lang="ts">
  import { Color } from 'three';
  import { agentPresentation } from '../state/agentPresentation.svelte';
  import { onMount } from 'svelte';
  import { sceneGuidesState } from '../state/sceneGuides.svelte';
  import { filesState } from '../state/files.svelte';
  import { getPointCloudColorOptions } from '../colorOptions';
  import { projectCoordinateGrid, registerSceneGuides, type GridProjection } from '../visualization/coordinateGrid';

  let { host }: { host: any } = $props();
  let grid = $state<GridProjection>({ lines: [], labels: [] });
  let width = $state(1);
  let height = $state(1);
  function update() {
    if (!sceneGuidesState.grid) return;
    const canvas = host.renderer.domElement;
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    grid = projectCoordinateGrid(host, width, height);
  }
  onMount(() => registerSceneGuides(host, update));
  $effect(() => {
    sceneGuidesState.grid;
    host.requestRender();
  });
  const entries = $derived.by(() => {
    if (!sceneGuidesState.legend) return [];
    filesState.renderTick;
    filesState.renderModeTick;
    return host.spatialFiles.flatMap((data: any, index: number) => {
      if (!data || filesState.visibility[index] === false) return [];
      const mode = filesState.colorModes[index] ?? host.individualColorModes[index] ?? 'assigned';
      const flat = mode === 'assigned' || /^\d+$/.test(mode);
      const colorIndex = mode === 'assigned' ? index % host.fileColors.length : Number(mode);
      const color = flat ? host.fileColors[colorIndex] : null;
      const hex = color ? '#' + new Color(color[0], color[1], color[2]).getHexString() : null;
      const label = hex ?? getPointCloudColorOptions(host, data, index).find(option => option.value === mode)?.label ?? mode;
      return [{ name: data.fileName ?? `Object ${index + 1}`, label,
        color: hex }];
    });
  });
</script>

{#if sceneGuidesState.grid}
  <svg class="coordinate-grid" data-testid="coordinate-grid" viewBox={`0 0 ${width} ${height}`} aria-label="Coordinate grid in scene units">
    {#each grid.lines as line}<line {...line} />{/each}
    {#each grid.labels as label}
      <text x={label.x + 5} y={label.y - 6} fill={['#ff9292', '#9ee4aa', '#98c9ff'][label.axis]}>{label.text}</text>
    {/each}
  </svg>
{/if}
{#if sceneGuidesState.legend && entries.length}
  <aside class="scene-legend" aria-label="Legend">
    <strong>Legend</strong>
    {#if agentPresentation.selection}<p class="selection-summary">{agentPresentation.selection}</p>{/if}
    {#each agentPresentation.labels as entry}
      <div class="legend-entry"><span class="swatch" style:background={entry.color}></span><small>{entry.label}</small></div>
    {/each}
    {#each entries as entry}
      <div class="legend-entry">
        {#if entry.color}<span class="swatch" style:background={entry.color}></span>{/if}
        <div><div class="name" title={entry.name}>{entry.name}</div><small>{entry.label}</small></div>
      </div>
    {/each}
  </aside>
{/if}

{#if agentPresentation.warning}<div class="distance-warning" role="status">{agentPresentation.warning}</div>{/if}

{#if agentPresentation.comparison.length}
  <div class="comparison-labels">{#each agentPresentation.comparison as name}<span>{name}</span>{/each}</div>
{/if}

<style>
  .distance-warning { position: absolute; bottom: 42px; left: 16px; color: #ffbb44; background: #20252cee; padding: 6px 10px; font-size: 12px; }
  .selection-summary { overflow-wrap: anywhere; }
  .comparison-labels { position: absolute; inset: auto 0 12px; display: flex; pointer-events: none; color: white; text-shadow: 0 1px 3px black; }
  .comparison-labels span { width: 50%; text-align: center; }
  .coordinate-grid { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
  line { stroke: #a8b5c5; stroke-opacity: 0.28; stroke-width: 1; }
  text { font: 11px system-ui, sans-serif; paint-order: stroke; stroke: #20252c; stroke-width: 3px; stroke-linejoin: round; }
  .scene-legend { position: absolute; left: 16px; top: 16px; max-width: min(260px, 40vw); max-height: 45%; overflow: auto; pointer-events: auto; background: var(--vscode-editor-background, #20252c); color: var(--vscode-foreground, #eee); border: 1px solid var(--vscode-panel-border, #555); border-radius: 6px; padding: 12px; font-size: 12px; box-shadow: 0 2px 8px #0003; }
  .legend-entry { display: flex; gap: 8px; align-items: center; margin-top: 10px; }
  .legend-entry > div { min-width: 0; }
  .swatch { width: 12px; height: 12px; flex-shrink: 0; border: 1px solid #888; border-radius: 3px; }
  .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  small { opacity: 0.75; }
</style>
