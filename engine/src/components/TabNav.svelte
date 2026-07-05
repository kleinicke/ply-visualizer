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
    host.switchTab(tabId);
  }
</script>

<div class="tab-navigation">
  {#each tabs as tab (tab.id)}
    <button
      class="tab-button"
      class:active={uiState.activeTab === tab.id}
      data-tab={tab.id}
      onclick={() => onTabClick(tab.id)}>{tab.label}</button
    >
  {/each}
</div>
