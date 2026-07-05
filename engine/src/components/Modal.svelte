<script lang="ts">
  import type { Snippet } from 'svelte';

  let { onClose, children }: { onClose: () => void; children: Snippet } = $props();

  function onBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 1000;"
  onclick={onBackdropClick}
>
  <div style="background: white; padding: 20px; border-radius: 8px; min-width: 300px; max-width: 400px;">
    {@render children()}
  </div>
</div>
