<script lang="ts">
  import { smallViewState } from '../state/smallView.svelte';

  let { host }: { host: any } = $props();

  function fitToView() {
    host.smallViewAffordance.hide();
    host.fitCameraToAllObjects();
    host.requestRender();
  }
</script>

{#if smallViewState.visible}
  <div id="small-view-affordance">
    <button id="small-view-fit" class="control-button" onclick={fitToView}>
      Fit to View <span class="button-shortcut">F</span>
    </button>
  </div>
{/if}

<style>
  #small-view-affordance {
    width: 100%;
  }

  #small-view-fit {
    width: 100%;
    margin: 0;
    border-radius: 6px;
    white-space: nowrap;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
</style>
