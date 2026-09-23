/** UI host detection only; JetBrains still uses the browser file-loading API. */
declare const acquireVsCodeApi: (() => unknown) | undefined;
export const isIdeHost =
  typeof acquireVsCodeApi !== 'undefined' ||
  (typeof location !== 'undefined' &&
    new URLSearchParams(location.search).get('host') === 'jetbrains');
