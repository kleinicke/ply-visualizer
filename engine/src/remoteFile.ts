/** Shared HTTP download and filename handling for both hosts. */
export function parseRemoteUrl(value: string): URL {
  let text = value.trim();
  if (/^https?%3a%2f%2f/i.test(text)) {
    text = decodeURIComponent(text.split(/[?&#]/, 1)[0].replace(/\\_/g, '_'));
  }
  const url = new URL(text);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only http:// and https:// URLs can be opened.');
  }
  return url;
}

function safeName(value: string): string {
  return (
    value
      .split(/[\\/]/)
      .pop()
      ?.replace(/[<>:"|?*\x00-\x1f]/g, '_') || 'download'
  );
}

export function remoteFileName(response: Response, source: URL, bytes: Uint8Array): string {
  const disposition = response.headers.get('content-disposition') || '';
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
  const plain = /filename="([^"]+)"|filename=([^;]+)/i.exec(disposition);
  let name =
    encoded ||
    plain?.[1] ||
    plain?.[2] ||
    new URL(response.url || source.href).pathname.split('/').pop() ||
    'download';
  try {
    name = decodeURIComponent(name.trim());
  } catch {
    /* Keep literal spelling. */
  }
  // Fetch may already have decoded Content-Encoding: gzip. Strip the wrapper
  // suffix regardless, and detect the inner format from the decoded bytes.
  name = safeName(name).replace(/\.gz$/i, '');
  if (!/\.[a-z0-9]+$/i.test(name)) {
    const header = new TextDecoder().decode(bytes.subarray(0, 128));
    const extension = /^ply\r?\n/.test(header)
      ? 'ply'
      : header.startsWith('glTF')
        ? 'glb'
        : header.startsWith('LASF')
          ? 'las'
          : header.startsWith('ASTM-E57')
            ? 'e57'
            : /^# .*PCD|^VERSION\s+\.7/.test(header)
              ? 'pcd'
              : /^OFF\s/.test(header)
                ? 'off'
                : header.startsWith('NRRD')
                  ? 'nrrd'
                  : bytes[0] === 0x93 && header.slice(1, 6) === 'NUMPY'
                    ? 'npy'
                    : '';
    if (extension) {
      name += `.${extension}`;
    }
  }
  return name;
}

export async function downloadRemoteFile(value: string, signal?: AbortSignal) {
  const url = parseRemoteUrl(value);
  const response = await fetch(url.href, { signal, redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`Download failed: HTTP ${response.status} ${response.statusText}`);
  }
  let bytes = new Uint8Array(await response.arrayBuffer());
  // Inspect bytes, not the suffix or Content-Encoding: fetch transparently
  // decompresses HTTP encoding, while a .gz file usually arrives still wrapped.
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    try {
      const decoded = new Blob([bytes])
        .stream()
        .pipeThrough(new DecompressionStream('gzip'), { signal });
      bytes = new Uint8Array(await new Response(decoded).arrayBuffer());
    } catch (error) {
      if (signal?.aborted) {
        throw error;
      }
      throw new Error(
        `Unable to decompress gzip file: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  signal?.throwIfAborted();
  if (!bytes.length) {
    throw new Error('The downloaded file is empty.');
  }
  return { bytes, name: remoteFileName(response, url, bytes), url: url.href };
}
