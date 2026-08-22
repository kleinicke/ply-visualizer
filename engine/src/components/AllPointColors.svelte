<script lang="ts">
  import { filesState } from '../state/files.svelte';
  import { getPointCloudColorOptions, type PointCloudColorOption } from '../colorOptions';

  let { host }: { host: any } = $props();

  type Cloud = { index: number; data: any; options: PointCloudColorOption[] };
  type GlobalOption = PointCloudColorOption & { available: number };

  const clouds = $derived.by((): Cloud[] => {
    filesState.renderTick;
    filesState.renderModeTick;
    return (host.spatialFiles ?? []).flatMap((data: any, index: number) => {
      if (!data || host.splatMode?.isActive(index)) {
        return [];
      }
      return [{ index, data, options: getPointCloudColorOptions(host, data, index) }];
    });
  });
  const cloudCount = $derived(clouds.length);

  const options = $derived.by((): GlobalOption[] => {
    const byValue = new Map<string, { labels: Set<string>; available: number }>();
    for (const cloud of clouds) {
      for (const option of cloud.options) {
        const existing = byValue.get(option.value);
        if (existing) {
          existing.labels.add(option.label);
          existing.available++;
        } else {
          byValue.set(option.value, { labels: new Set([option.label]), available: 1 });
        }
      }
    }

    return Array.from(byValue, ([value, details]) => {
      let label = Array.from(details.labels)[0];
      if (value === 'original' && details.labels.size > 1) {
        label = 'Original / camera-projected';
      } else if (value === 'assigned') {
        label = 'Assigned (per cloud)';
      }
      return { value, label, available: details.available };
    }).sort(
      (a, b) => optionRank(a.value) - optionRank(b.value) || a.label.localeCompare(b.label)
    );
  });

  const commonMode = $derived.by(() => {
    if (cloudCount === 0) {
      return '';
    }
    const first = filesState.colorModes[clouds[0].index] ?? 'assigned';
    return clouds.every(cloud => (filesState.colorModes[cloud.index] ?? 'assigned') === first)
      ? first
      : '';
  });

  function optionRank(value: string): number {
    if (value === 'original') return 0;
    if (value === 'recolored') return 1;
    if (value === 'intensity') return 2;
    if (value === 'intensity-viridis') return 3;
    if (value === 'intensity-colors') return 4;
    if (value.startsWith('scalar:')) return 5;
    if (value === 'assigned') return 6;
    return 7;
  }

  function applyToAll(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    if (!value) {
      return;
    }
    for (const cloud of clouds) {
      if (cloud.options.some(option => option.value === value)) {
        // Deliberately call only the colour entry point. In particular, do not
        // engage AllPointSizes: mixed per-cloud sizes must remain mixed.
        host.onFileColorModeChange(cloud.index, value);
      }
    }
  }
</script>

{#if cloudCount > 1}
  <div
    class="all-point-colors"
    style="background-color: var(--vscode-list-hoverBackground); border: 1px solid var(--vscode-sideBar-border); border-radius: 4px; margin-bottom: 8px; padding: 6px 8px; font-size: 11px;"
  >
    <div class="color-control" style="margin: 0;">
      <label for="all-point-colors-select">All Colors:</label>
      <select
        id="all-point-colors-select"
        class="color-selector"
        value={commonMode}
        onchange={applyToAll}
        title="Applies to compatible clouds only; other colors and all point sizes stay unchanged"
      >
        {#if !commonMode}
          <option value="" disabled>Mixed</option>
        {/if}
        {#each options as option (option.value)}
          <option value={option.value}
            >{option.label}{option.available < cloudCount
              ? ` (${option.available}/${cloudCount})`
              : ''}</option
          >
        {/each}
      </select>
    </div>
  </div>
{/if}
