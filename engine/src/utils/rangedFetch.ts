/** Below this a single request is as fast, and one request is simpler. */
export const RANGED_FETCH_MIN_BYTES = 16 * 1024 * 1024;

/**
 * Fetch a file of known size as `parts` concurrent byte ranges, each streamed
 * straight into its slice of one buffer.
 *
 * VS Code serves a webview's local resources through a protocol handler whose
 * single-request throughput is well below the disk's; several ranges at once
 * are what made the binary PLY route fast (`parsePlyFromRanges`). Rejects when
 * any range is not honoured exactly, so the caller can fall back to a plain
 * fetch; the other ranges are cancelled.
 */
export async function fetchInRanges(uri: string, size: number, parts = 4): Promise<ArrayBuffer> {
  const out = new Uint8Array(size);
  const stop = new AbortController();
  const step = Math.ceil(size / parts);
  try {
    await Promise.all(
      Array.from({ length: parts }, async (_, index) => {
        const start = index * step;
        const end = Math.min(size, start + step);
        if (start >= end) {
          return;
        }
        const response = await fetch(uri, {
          headers: { Range: `bytes=${start}-${end - 1}` },
          signal: stop.signal,
        });
        if (response.status !== 206 || !response.body) {
          void response.body?.cancel().catch(() => undefined);
          throw new Error(`range request was not honoured (${response.status})`);
        }
        const reader = response.body.getReader();
        let at = start;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          if (at + value.byteLength > end) {
            throw new Error('range response is longer than requested');
          }
          out.set(value, at);
          at += value.byteLength;
        }
        if (at !== end) {
          throw new Error(`range ended early: ${at - start} of ${end - start} bytes`);
        }
      })
    );
  } catch (error) {
    stop.abort();
    throw error;
  }
  return out.buffer;
}
