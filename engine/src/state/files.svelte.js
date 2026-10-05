import { defaultEntryPresentation } from './fileEntries';

// Class instances in entries own GPU resources; only their presentation is deeply reactive.
export function createEntryPresentation() {
  const presentation = $state(defaultEntryPresentation());
  return presentation;
}

export const filesState = $state(
  /** @type {{ entries: readonly import('./fileEntries').FileEntry[]; statsTick: number; statsLoadingFileName: string | null }} */ ({
    entries: [],
    statsTick: 0,
    statsLoadingFileName: null,
  })
);
