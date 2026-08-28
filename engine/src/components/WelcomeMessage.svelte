<script lang="ts">
  import { uiState } from '../state/ui.svelte';

  let {
    onAddCloud,
    onLoadGuidedExample,
    onLoadBasicExample,
  }: {
    onAddCloud: () => void;
    onLoadGuidedExample: () => Promise<void>;
    onLoadBasicExample: () => Promise<void>;
  } = $props();

  let loadingExample = $state<'guided' | 'basic' | null>(null);

  async function loadExample(kind: 'guided' | 'basic'): Promise<void> {
    loadingExample = kind;
    try {
      await (kind === 'guided' ? onLoadGuidedExample() : onLoadBasicExample());
    } finally {
      loadingExample = null;
    }
  }
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
    <p class="example-prompt">
      No file at hand?
    </p>
    <div class="example-actions">
      <button
        id="welcome-load-guided-example"
        class="example-button"
        onclick={() => loadExample('guided')}
        disabled={loadingExample !== null}
        title="Load a measured point cloud with a looping camera preview"
      >
        {loadingExample === 'guided' ? 'Loading guided example…' : 'Guided example'}
      </button>
      <button
        id="welcome-load-basic-example"
        class="example-button"
        onclick={() => loadExample('basic')}
        disabled={loadingExample !== null}
        title="Load the original static point-cloud example"
      >
        {loadingExample === 'basic' ? 'Loading basic example…' : 'Basic example'}
      </button>
    </div>
  </div>
</div>
