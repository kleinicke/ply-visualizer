/** Old exporters often store a machine-local texture path. Try that reference,
 * then the two common portable layouts beside the downloaded model. */
export async function readRemoteModelResource(relative: string, baseUrl: string) {
  const normalized = relative.replace(/\\/g, '/');
  const name = normalized.split('/').pop()!;
  const candidates = [...new Set([normalized, name, `textures/${name}`])];
  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      const url = new URL(candidate, baseUrl);
      if (!/^https?:$/.test(url.protocol)) {
        continue;
      }
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${relative}`);
      }
      return {
        bytes: new Uint8Array(await response.arrayBuffer()),
        mime: response.headers.get('content-type') || undefined,
      };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error(`Unsupported model resource URL: ${relative}`);
}
