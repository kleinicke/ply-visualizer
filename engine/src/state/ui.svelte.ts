// Phase 1 write-through store: mirrors UI status/tab state that today lives
// only as DOM side effects in ui/status.ts. Consumed directly by
// components/ErrorOverlay.svelte and components/WelcomeMessage.svelte
// (Phase 2 leaf islands); the rest is still write-through only.
export const uiState = $state({
  errorMessage: '',
  isErrorVisible: false,
  statusMessage: '',
  activeTab: 'controls',
  showWelcomeMessage: false,
  perfStatsText: '',
  sequenceMode: false,
  sequenceIndex: 0,
  sequenceTotal: 0,
  isSequencePlaying: false,
});
