import * as assert from 'assert';
import * as http from 'http';
import type { AddressInfo } from 'net';
import { fetchInRanges } from '../../../engine/src/utils/rangedFetch';

function serve(body: Buffer, honourRanges: boolean): Promise<http.Server> {
  const server = http.createServer((request, response) => {
    const match = /bytes=(\d+)-(\d+)/.exec(request.headers.range ?? '');
    if (!honourRanges || !match) {
      response.writeHead(200, { 'Content-Length': body.length });
      response.end(body);
      return;
    }
    const start = Number(match[1]);
    const end = Number(match[2]);
    response.writeHead(206, {
      'Content-Length': end - start + 1,
      'Content-Range': `bytes ${start}-${end}/${body.length}`,
    });
    // Several writes, so a range arrives in more than one chunk.
    const slice = body.subarray(start, end + 1);
    for (let at = 0; at < slice.length; at += 4096) {
      response.write(slice.subarray(at, at + 4096));
    }
    response.end();
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

suite('Ranged fetch', () => {
  // Not a multiple of the part count, so the last range is shorter.
  const body = Buffer.from(Array.from({ length: 100_003 }, (_, i) => (i * 31) % 251));

  test('reassembles concurrent ranges byte for byte', async () => {
    const server = await serve(body, true);
    try {
      const { port } = server.address() as AddressInfo;
      for (const parts of [1, 2, 4, 7]) {
        const bytes = new Uint8Array(
          await fetchInRanges(`http://127.0.0.1:${port}/`, body.length, parts)
        );
        assert.ok(Buffer.from(bytes).equals(body), `${parts} parts`);
      }
    } finally {
      server.close();
    }
  });

  test('rejects when ranges are ignored, so the caller fetches whole', async () => {
    const server = await serve(body, false);
    try {
      const { port } = server.address() as AddressInfo;
      await assert.rejects(fetchInRanges(`http://127.0.0.1:${port}/`, body.length, 4));
    } finally {
      server.close();
    }
  });
});
