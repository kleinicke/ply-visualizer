<script lang="ts">
  // Phase 0 tooling smoke test (docs/SVELTE_MIGRATION_PLAN.md).
  // Proves svelte-loader + TS preprocessing + Svelte 5 runes compile and run
  // inside both the VS Code webview bundle and the standalone-page bundle.
  // Remove once Phase 0 is confirmed working via F5 in the Extension
  // Development Host.
  let count = $state(0);
</script>

<div id="svelte-smoke-test" data-count={count}>
  Svelte {count}
</div>
