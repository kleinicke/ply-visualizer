<script lang="ts">
  import { uiState } from '../state/ui.svelte';

  let { host }: { host: any } = $props();

  const tabs = [
    { id: 'files', label: 'Files' },
    { id: 'camera', label: 'Camera' },
    { id: 'controls', label: 'Controls' },
    { id: 'info', label: 'Info' },
  ];

  function onTabClick(tabId: string) {
    host.switchTab(uiState.activeTab === tabId ? null : tabId);
  }
</script>

<div class="tab-navigation">
  {#each tabs as tab (tab.id)}
    <button
      class="tab-button"
      class:active={uiState.activeTab === tab.id}
      data-tab={tab.id}
      aria-pressed={uiState.activeTab === tab.id}
      onclick={() => onTabClick(tab.id)}>{tab.label}</button
    >
  {/each}
</div>
