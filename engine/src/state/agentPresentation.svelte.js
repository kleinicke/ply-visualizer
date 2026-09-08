/** Optional agent inspection annotations shared by the inline legend and captures. */
export const agentPresentation = $state({
  selection: '',
  warning: '',
  /** @type {{label: string, color: string}[]} */
  labels: [],
  /** @type {string[]} */
  comparison: [],
});
