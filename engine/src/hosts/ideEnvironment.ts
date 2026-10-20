/** UI host detection only; JetBrains still uses the browser file-loading API. */
declare const acquireVsCodeApi: (() => unknown) | undefined;
export const isIdeHost =
  typeof acquireVsCodeApi !== 'undefined' ||
  (typeof location !== 'undefined' &&
    new URLSearchParams(location.search).get('host') === 'jetbrains');

/** Browser VS Code uses the shared in-page decoders instead of Node workers. */
export const isWebExtension =
  typeof window !== 'undefined' &&
  (window as Window & { __PLY_WEB_HOST__?: boolean }).__PLY_WEB_HOST__ === true;
