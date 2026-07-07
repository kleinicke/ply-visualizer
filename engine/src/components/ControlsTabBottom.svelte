<script lang="ts">
  let { host }: { host: any } = $props();

  // Intentional: seed local UI state from the host once at mount; the toggle
  // handlers below keep it in sync afterwards
  // svelte-ignore state_referenced_locally
  let screenSpaceScaling = $state(host.screenSpaceScaling);
  // svelte-ignore state_referenced_locally
  let allowTransparency = $state(host.allowTransparency);

  function onToggleScreenSpaceScaling() {
    host.toggleScreenSpaceScaling();
    screenSpaceScaling = host.screenSpaceScaling;
  }
  function onToggleTransparency() {
    host.toggleTransparency();
    allowTransparency = host.allowTransparency;
  }
</script>

<div class="panel-section">
  <h4>Performance</h4>
  <div class="control-buttons">
    <button
      id="toggle-screenspace-scaling"
      class="control-button"
      class:active={screenSpaceScaling}
      onclick={onToggleScreenSpaceScaling}
    >
      Screen-Space Scaling <span class="button-shortcut">S</span>
    </button>
    <button
      id="toggle-transparency"
      class="control-button"
      class:active={allowTransparency}
      onclick={onToggleTransparency}
    >
      Allow Transparency <span class="button-shortcut">U</span>
    </button>
  </div>
  <p class="setting-description">
    Screen-Space Scaling: Distance-based point sizes for better visuals. Allow Transparency:
    Re-enables alpha blending (impacts performance).
  </p>
</div>
