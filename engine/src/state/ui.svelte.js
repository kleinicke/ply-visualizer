// Phase 1 write-through store: mirrors UI status/tab state that today lives
// only as DOM side effects in ui/status.ts. Consumed directly by
// components/ErrorOverlay.svelte and components/WelcomeMessage.svelte
// (Phase 2 leaf islands); the rest is still write-through only.
export const uiState = $state({
  errorMessage: '',
  isErrorVisible: false,
  statusMessage: '',
  // Matches the default-active tab in index.html's static markup
  // (#files-tab / [data-tab="files"] both start with class="... active").
  activeTab: 'files',
  showWelcomeMessage: false,
  perfStatsText: '',
  sequenceMode: false,
  sequenceIndex: 0,
  sequenceTotal: 0,
  isSequencePlaying: false,
});
