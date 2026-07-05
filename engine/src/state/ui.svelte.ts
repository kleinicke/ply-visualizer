// Phase 1 write-through store: mirrors UI status/tab state that today lives
// only as DOM side effects in ui/status.ts. Nothing reads from this store
// yet - it's populated alongside the existing DOM code so later phases can
// switch panels over to it without a behavior change in this phase.
export const uiState = $state({
  errorMessage: '',
  isErrorVisible: false,
  statusMessage: '',
  activeTab: 'controls',
});
