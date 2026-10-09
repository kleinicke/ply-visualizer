import { expect, test } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * The zero-copy PLY route: the file is streamed out of a fetch straight into
 * wasm memory and parsed there.
 *
 * It exists because handing the bytes to the parser as a `Uint8Array` makes
 * wasm-bindgen copy the whole file across the boundary first, and on a
 * multi-hundred-megabyte cloud that copy — plus the `ArrayBuffer` the fetch
 * allocated to hold the file in the first place — costs more than the parse.
 * Only the extension host takes this route in the product (it hands the webview
 * a URI rather than the bytes), so a spec is the only way to exercise it here.
 */

// Written where the dev server can serve it, and removed afterwards: the page
// can only fetch what it is served, and a fetch is the point of this spec.
const served = path.resolve('dist/ply-zero-copy.ply');

test.beforeAll(() => {
  // A mesh with colours, normals and an extra scalar, so the comparison covers
  // every output buffer rather than just positions.
  const vertices = 64;
  const header = [
    'ply',
    'format binary_little_endian 1.0',
    'comment zero-copy fixture',
    `element vertex ${vertices}`,
    'property float x',
    'property float y',
    'property float z',
    'property uchar red',
    'property uchar green',
    'property uchar blue',
    'property float quality',
    'element face 1',
    'property list uchar int vertex_indices',
    'end_header',
    '',
  ].join('\n');
  const body = Buffer.alloc(vertices * 19 + 1 + 12);
  let offset = 0;
  for (let i = 0; i < vertices; i++) {
    body.writeFloatLE(i, offset);
    body.writeFloatLE(i * 2, offset + 4);
    body.writeFloatLE(i * 3, offset + 8);
    body[offset + 12] = i % 256;
    body[offset + 13] = (i * 2) % 256;
    body[offset + 14] = (i * 3) % 256;
    body.writeFloatLE(i / 10, offset + 15);
    offset += 19;
  }
  body[offset] = 3;
  body.writeInt32LE(0, offset + 1);
  body.writeInt32LE(1, offset + 5);
  body.writeInt32LE(2, offset + 9);

  fs.writeFileSync(served, Buffer.concat([Buffer.from(header, 'latin1'), body]));
});

// Left in place on purpose, like the NumPy spec: with the suite running fully
// parallel, a worker finishing early would delete the file another worker is
// still fetching. `dist` is build output and the next build clears it.

test('streaming into wasm memory parses identically to handing over the bytes', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForSelector('#three-canvas');
  // The test hooks are attached at the end of the bundle's evaluation.
  await page.waitForFunction(() => (window as any).__plyParsePly !== undefined);

  const both = await page.evaluate(async () => {
    const { parsePlyFromResponse, parsePlyWasm } = (window as any).__plyParsePly;
    const url = new URL('/ply-zero-copy.ply', location.href).toString();

    const streamed = await parsePlyFromResponse(await fetch(url));
    const copied = await parsePlyWasm(new Uint8Array(await (await fetch(url)).arrayBuffer()));

    const shape = (r: any) => ({
      vertexCount: r.vertexCount,
      faceCount: r.faceCount,
      hasColors: r.hasColors,
      hasNormals: r.hasNormals,
      comments: r.comments,
      format: r.format,
      positions: Array.from(r.positionsArray as Float32Array),
      colors: Array.from((r.colorsArray ?? []) as Uint8Array),
      quality: Array.from((r.scalarFields.quality ?? []) as Float32Array),
      faces: Array.from((r.indicesArray ?? []) as Uint32Array),
    });
    return { streamed: shape(streamed), copied: shape(copied) };
  });

  // Same file, same numbers — the only difference is where the bytes lived.
  expect(both.streamed).toEqual(both.copied);
  expect(both.streamed.vertexCount).toBe(64);
  expect(both.streamed.faces).toEqual([0, 1, 2]);
  expect(both.streamed.comments).toContain('zero-copy fixture');
  // Vertex i carries colour (i, 2i, 3i), so vertex 1 is the first that shows
  // the channels are not simply zeroed.
  expect(both.streamed.colors.slice(0, 6)).toEqual([0, 0, 0, 1, 2, 3]);
  expect(both.streamed.quality[10]).toBeCloseTo(1.0, 5);
});

test('a response with no content-length still parses, via the copying path', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#three-canvas');
  // The test hooks are attached at the end of the bundle's evaluation.
  await page.waitForFunction(() => (window as any).__plyParsePly !== undefined);

  const result = await page.evaluate(async () => {
    const { parsePlyFromResponse } = (window as any).__plyParsePly;
    const url = new URL('/ply-zero-copy.ply', location.href).toString();
    const body = await (await fetch(url)).arrayBuffer();
    // A response the streaming path cannot size: it must fall back rather than
    // allocate a zero-length buffer and produce an empty cloud.
    const headerless = new Response(body, { headers: { 'x-no-length': '1' } });
    headerless.headers.delete('content-length');
    const parsed = await parsePlyFromResponse(headerless);
    return parsed.vertexCount;
  });

  expect(result).toBe(64);
});

test('a binary point cloud decoded while it streams equals the whole-file parse', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForSelector('#three-canvas');
  // The test hooks are attached at the end of the bundle's evaluation.
  await page.waitForFunction(() => (window as any).__plyParsePly !== undefined);

  const outcome = await page.evaluate(async () => {
    const { parsePlyBytes, parsePlyFromResponse, parsePlyWasm } = (window as any).__plyParsePly;
    // Enough vertices for several 4 MB scratch buffers, and every attribute
    // the stream copies out: colours, normals, intensity and a scalar field.
    const vertices = 300_000;
    const header = new TextEncoder().encode(
      'ply\nformat binary_little_endian 1.0\ncomment streamed fixture\n' +
        `element vertex ${vertices}\n` +
        'property float x\nproperty float y\nproperty float z\n' +
        'property float nx\nproperty float ny\nproperty float nz\n' +
        'property uchar red\nproperty uchar green\nproperty uchar blue\n' +
        'property float intensity\nproperty float quality\nend_header\n'
    );
    const stride = 35;
    const bytes = new Uint8Array(header.length + vertices * stride);
    bytes.set(header);
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < vertices; i++) {
      const at = header.length + i * stride;
      view.setFloat32(at, i * 0.5, true);
      view.setFloat32(at + 4, -i, true);
      view.setFloat32(at + 8, Math.sin(i), true);
      view.setFloat32(at + 12, 0, true);
      view.setFloat32(at + 16, 1, true);
      view.setFloat32(at + 20, Math.cos(i), true);
      bytes[at + 24] = i % 256;
      bytes[at + 25] = (i * 3) % 256;
      bytes[at + 26] = 7;
      view.setFloat32(at + 27, i / 7, true);
      view.setFloat32(at + 31, -i / 3, true);
    }
    // Odd piece sizes, so records and even the header straddle chunks.
    const respond = (body: Uint8Array) => {
      let at = 0;
      const stream = new ReadableStream<Uint8Array>({
        pull(controller) {
          if (at >= body.length) {
            controller.close();
            return;
          }
          const size = at === 0 ? 37 : 65_537;
          controller.enqueue(body.slice(at, at + size));
          at += size;
        },
      });
      return new Response(stream, { headers: { 'content-length': String(body.length) } });
    };
    const digest = (array: ArrayBufferView | null) => {
      if (!array) {
        return null;
      }
      const raw = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
      let hash = 0x811c9dc5;
      for (let i = 0; i < raw.length; i++) {
        hash = Math.imul(hash ^ raw[i], 0x01000193) >>> 0;
      }
      return hash;
    };
    const shape = (r: any) => ({
      vertexCount: r.vertexCount,
      faceCount: r.faceCount,
      flags: [r.hasColors, r.hasNormals, r.hasIntensity, r.isGaussianSplat],
      format: r.format,
      comments: r.comments,
      positions: digest(r.positionsArray),
      colors: digest(r.colorsArray),
      normals: digest(r.normalsArray),
      intensity: digest(r.intensityArray),
      fields: Object.keys(r.scalarFields).sort(),
      quality: digest(r.scalarFields.quality),
      indices: r.indicesArray,
    });
    const streamed = shape(await parsePlyFromResponse(respond(bytes)));
    const whole = shape(await parsePlyWasm(bytes));
    // Bytes posted by the host take the same chunked decoder.
    const posted = shape(await parsePlyBytes(bytes));
    let truncated = '';
    try {
      await parsePlyFromResponse(respond(bytes.subarray(0, bytes.length - 100)));
    } catch (error) {
      truncated = String(error);
    }
    return { streamed, whole, posted, truncated };
  });

  expect(outcome.streamed).toEqual(outcome.whole);
  expect(outcome.posted).toEqual(outcome.whole);
  expect(outcome.streamed.vertexCount).toBe(300_000);
  expect(outcome.streamed.fields).toEqual(['intensity', 'quality']);
  expect(outcome.truncated).toContain('truncated');
});

test.describe('Fetching a binary PLY as parallel byte ranges', () => {
  // Every attribute the decoder copies, enough vertices for several scratch
  // buffers per range, and one bad vertex deep inside the third range.
  const vertices = 300_000;
  const badVertex = 200_123;
  const header = Buffer.from(
    'ply\nformat binary_little_endian 1.0\ncomment ranged fixture\n' +
      `element vertex ${vertices}\n` +
      'property float x\nproperty float y\nproperty float z\n' +
      'property float nx\nproperty float ny\nproperty float nz\n' +
      'property uchar red\nproperty uchar green\nproperty uchar blue\n' +
      'property float intensity\nproperty float quality\nend_header\n',
    'latin1'
  );
  const build = (withBad: boolean) => {
    const stride = 35;
    const body = Buffer.alloc(vertices * stride);
    for (let i = 0; i < vertices; i++) {
      const at = i * stride;
      body.writeFloatLE(withBad && i === badVertex ? Number.NaN : i * 0.5, at);
      body.writeFloatLE(-i, at + 4);
      body.writeFloatLE(Math.sin(i), at + 8);
      body.writeFloatLE(0, at + 12);
      body.writeFloatLE(1, at + 16);
      body.writeFloatLE(Math.cos(i), at + 20);
      body[at + 24] = i % 256;
      body[at + 25] = (i * 3) % 256;
      body[at + 26] = 7;
      body.writeFloatLE(i / 7, at + 27);
      body.writeFloatLE(-i / 3, at + 31);
    }
    return Buffer.concat([header, body]);
  };
  const good = build(false);
  const bad = build(true);

  test('ranges decode to the whole-file result, and bad input is refused', async ({ page }) => {
    // The webview's resource service answers ranges with 206; the test server
    // does not, so the ranged routes are served here.
    for (const [route, file] of [
      ['**/ranged-good.ply', good],
      ['**/ranged-bad.ply', bad],
    ] as const) {
      await page.route(route, async request => {
        const match = /bytes=(\d+)-(\d+)/.exec(request.request().headers()['range'] ?? '');
        if (!match) {
          await request.fulfill({ status: 200, body: file });
          return;
        }
        const [start, end] = [Number(match[1]), Number(match[2])];
        await request.fulfill({ status: 206, body: file.subarray(start, end + 1) });
      });
    }
    await page.goto('/');
    await page.waitForSelector('#three-canvas');
    await page.waitForFunction(() => (window as any).__plyParsePly !== undefined);

    const outcome = await page.evaluate(
      async ({ size }) => {
        const { parsePlyFromRanges, parsePlyWasm } = (window as any).__plyParsePly;
        const digest = (array: ArrayBufferView | null) => {
          if (!array) {
            return null;
          }
          const raw = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
          let hash = 0x811c9dc5;
          for (let i = 0; i < raw.length; i++) {
            hash = Math.imul(hash ^ raw[i], 0x01000193) >>> 0;
          }
          return hash;
        };
        const shape = (r: any) => ({
          vertexCount: r.vertexCount,
          flags: [r.hasColors, r.hasNormals, r.hasIntensity],
          comments: r.comments,
          positions: digest(r.positionsArray),
          colors: digest(r.colorsArray),
          normals: digest(r.normalsArray),
          intensity: digest(r.intensityArray),
          quality: digest(r.scalarFields.quality),
        });
        const whole = shape(
          await parsePlyWasm(new Uint8Array(await (await fetch('/ranged-good.ply')).arrayBuffer()))
        );
        const ranged = shape(await parsePlyFromRanges('/ranged-good.ply', size, 4));
        const failure = async (run: () => Promise<unknown>) => {
          try {
            await run();
            return '';
          } catch (error) {
            return String(error);
          }
        };
        return {
          whole,
          ranged,
          bad: await failure(() => parsePlyFromRanges('/ranged-bad.ply', size, 4)),
          // The test server ignores the Range header and answers 200.
          ignored: await failure(() => parsePlyFromRanges('/ply-zero-copy.ply', size, 4)),
        };
      },
      { size: good.length }
    );

    expect(outcome.ranged).toEqual(outcome.whole);
    expect(outcome.ranged.vertexCount).toBe(vertices);
    expect(outcome.bad).toContain(`non-finite x/y/z coordinate at vertex ${badVertex + 1}`);
    expect(outcome.ignored).toContain('not honoured');
  });
});
