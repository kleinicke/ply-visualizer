<script lang="ts">
  import { uiState } from '../state/ui.svelte';
</script>

<div id="loading" class="loading" class:hidden={!uiState.loadingVisible}>
  <div class="spinner"></div>
  <p>{uiState.loadingTitle}</p>
  {#if uiState.loadingDetail !== null}
    <p class="loading-detail">{uiState.loadingDetail}</p>
  {/if}
</div>
