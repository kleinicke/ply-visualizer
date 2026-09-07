export const localSessionState = $state({
  batches: /** @type {string[]} */ ([]),
  selected: 0,
  step: /** @type {number | null} */ (null),
  paused: false,
  ui: 'full',
  error: '',
});
