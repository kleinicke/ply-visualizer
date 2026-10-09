import type { DepthBytes } from '../interfaces';

/**
 * Bytes of a depth file the webview can fetch again (VS Code serves it at a
 * webview URI). The file used to stay in memory as long as it was open, only
 * to be re-sent when the depth worker had dropped its decoded copy - which a
 * settings change rarely needs. `initial` serves the first load (the bytes
 * already fetched for opening the file); after that the file is read again.
 */
export function depthBytesFromUri(uri: string, initial: ArrayBuffer): DepthBytes {
  let held: ArrayBuffer | undefined = initial;
  return {
    async load() {
      if (held) {
        const bytes = held;
        held = undefined;
        return bytes;
      }
      const response = await fetch(uri);
      if (!response.ok) {
        throw new Error(`Could not read the depth file again: HTTP ${response.status}`);
      }
      return response.arrayBuffer();
    },
  };
}
