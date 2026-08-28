export const SMALL_VIEW_SHOW_COVERAGE = 0.005;
export const SMALL_VIEW_HIDE_COVERAGE = 0.0075;

export function shouldShowSmallView(coverage: number | null, currentlyVisible: boolean): boolean {
  if (coverage === null) {return false;}
  return coverage < (currentlyVisible ? SMALL_VIEW_HIDE_COVERAGE : SMALL_VIEW_SHOW_COVERAGE);
}
