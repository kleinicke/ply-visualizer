<script lang="ts">
  import { uiState } from '../state/ui.svelte';
  import { registrationState, stationPipelineUi } from '../state/registration.svelte';

  const message = $derived(
    uiState.fileLoading || uiState.backgroundChanges > 0
      ? 'Loading point clouds'
      : stationPipelineUi.busy
        ? 'Aligning or recolouring point clouds'
        : registrationState.busy
          ? 'Aligning point clouds'
          : ''
  );
</script>

{#if message}
  <span
    id="file-activity-indicator"
    class="activity"
    role="status"
    aria-label={message}
    title={message}
  >
    <span class="activity-dot"></span>
  </span>
{/if}

<style>
  .activity {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    flex: 0 0 14px;
  }

  .activity-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #168cff;
    box-shadow: 0 0 0 0 rgb(22 140 255 / 55%);
    animation: activity-pulse 1.35s ease-out infinite;
  }

  @keyframes activity-pulse {
    0% {
      box-shadow: 0 0 0 0 rgb(22 140 255 / 55%);
    }
    70%,
    100% {
      box-shadow: 0 0 0 5px transparent;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .activity-dot {
      animation: none;
    }
  }
</style>
