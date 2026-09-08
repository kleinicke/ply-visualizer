import { gzipSync, deflateSync, deflateRawSync } from 'zlib';
import * as assert from 'assert';
import { createServer, type Server } from 'http';
import { downloadRemoteFile, parseRemoteUrl, remoteFileName } from '../../../engine/src/remoteFile';

suite('Remote file downloads', () => {
  let server: Server;
  let base: string;
  suiteSetup(async () => {
    server = createServer((req, res) => {
      if (req.url === '/redirect') {
        res.writeHead(302, { location: '/cloud.ply?token=a%26b' });
        res.end();
      } else if (req.url === '/cloud.ply.gz' || req.url === '/compressed') {
        res.end(gzipSync('ply\nformat ascii 1.0\nend_header\n'));
      } else if (req.url === '/encoded.ply.gz') {
        res.setHeader('Content-Encoding', 'gzip');
        res.end(gzipSync('ply\nformat ascii 1.0\nend_header\n'));
      } else if (req.url === '/cloud.ply.zlib' || req.url === '/zlib') {
        res.end(deflateSync('ply\nformat ascii 1.0\nend_header\n'));
      } else if (req.url === '/cloud.ply.deflate-raw') {
        res.end(deflateRawSync('ply\nformat ascii 1.0\nend_header\n'));
      } else if (req.url === '/corrupt.ply.gz') {
        res.end(Buffer.from([0x1f, 0x8b, 0x08, 0]));
      } else if (req.url === '/empty.ply.gz') {
        res.end(gzipSync(''));
      } else if (req.url === '/missing') {
        res.writeHead(404);
        res.end();
      } else if (req.url === '/empty') {
        res.end();
      } else {
        res.end('ply\nformat ascii 1.0\nend_header\n');
      }
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });
  suiteTeardown(
    () =>
      new Promise<void>((resolve, reject) =>
        server.close(error => (error ? reject(error) : resolve()))
      )
  );
  test('preserves signed query parameters and accepts encoded copied links', () => {
    const url = 'https://example.com/cloud.ply?token=a%26b&download=1';
    assert.strictEqual(parseRemoteUrl(url).href, url);
    assert.strictEqual(parseRemoteUrl(`${encodeURIComponent(url)}&zoom=12`).href, url);
    assert.throws(() => parseRemoteUrl('file:///tmp/cloud.ply'));
  });
  test('downloads complete bytes and follows redirects for the filename', async () => {
    const result = await downloadRemoteFile(`${base}/redirect`);
    assert.strictEqual(result.name, 'cloud.ply');
    assert.strictEqual(
      new TextDecoder().decode(result.bytes),
      'ply\nformat ascii 1.0\nend_header\n'
    );
  });
  test('recognizes extensionless PLY and safe Content-Disposition filenames', async () => {
    assert.strictEqual((await downloadRemoteFile(`${base}/download`)).name, 'download.ply');
    assert.strictEqual(
      remoteFileName(
        new Response('', {
          headers: { 'Content-Disposition': "attachment; filename*=UTF-8''..%2Fmy%20cloud.ply" },
        }),
        new URL(base),
        new Uint8Array()
      ),
      'my cloud.ply'
    );
  });
  test('decompresses gzip files and detects extensionless compressed PLY', async () => {
    for (const [path, name] of [
      ['/cloud.ply.gz', 'cloud.ply'],
      ['/compressed', 'compressed.ply'],
      ['/encoded.ply.gz', 'encoded.ply'],
    ]) {
      const file = await downloadRemoteFile(`${base}${path}`);
      assert.strictEqual(file.name, name);
      assert.strictEqual(
        new TextDecoder().decode(file.bytes),
        'ply\nformat ascii 1.0\nend_header\n'
      );
    }
    await assert.rejects(downloadRemoteFile(`${base}/corrupt.ply.gz`), /decompress gzip/);
    await assert.rejects(downloadRemoteFile(`${base}/empty.ply.gz`), /empty/);
  });
  test('decompresses zlib and explicitly named raw DEFLATE', async () => {
    for (const [path, name] of [
      ['/cloud.ply.zlib', 'cloud.ply'],
      ['/zlib', 'zlib.ply'],
      ['/cloud.ply.deflate-raw', 'cloud.ply'],
    ]) {
      const file = await downloadRemoteFile(`${base}${path}`);
      assert.strictEqual(file.name, name);
      assert.strictEqual(
        new TextDecoder().decode(file.bytes),
        'ply\nformat ascii 1.0\nend_header\n'
      );
    }
  });
  test('rejects HTTP errors, empty files, and cancellation', async () => {
    await assert.rejects(downloadRemoteFile(`${base}/missing`), /404/);
    await assert.rejects(downloadRemoteFile(`${base}/empty`), /empty/);
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(downloadRemoteFile(base, controller.signal), { name: 'AbortError' });
  });
});
