<script lang="ts">
  import { uiState } from '../state/ui.svelte';

  let { onAddCloud }: { onAddCloud: () => void } = $props();
</script>

<div id="welcome-message" class="welcome-message" class:hidden={!uiState.showWelcomeMessage}>
  <div class="welcome-content">
    <h2>Welcome to the 3D Point Cloud and Mesh Visualizer</h2>
    <p>Load a point cloud file, mesh or depth image and convert it to a point cloud on the fly.</p>
    <p class="highlight">
      Just click the
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <strong id="welcome-add-cloud" class="clickable-text" onclick={onAddCloud}
        >+ Add Point Cloud</strong
      >
      button to select a file you want to visualize.
    </p>
  </div>
</div>
