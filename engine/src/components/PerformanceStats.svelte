<script lang="ts">
  import { uiState } from '../state/ui.svelte';
</script>

<div
  id="performance-stats"
  style="font-size: 10px; color: var(--vscode-descriptionForeground); font-family: monospace;"
>
  {uiState.perfStatsText}
</div>
