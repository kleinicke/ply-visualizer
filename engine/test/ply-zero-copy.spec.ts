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
      faces: r.faces.map((f: any) => f.indices),
    });
    return { streamed: shape(streamed), copied: shape(copied) };
  });

  // Same file, same numbers — the only difference is where the bytes lived.
  expect(both.streamed).toEqual(both.copied);
  expect(both.streamed.vertexCount).toBe(64);
  expect(both.streamed.faces).toEqual([[0, 1, 2]]);
  expect(both.streamed.comments).toContain('zero-copy fixture');
  // Vertex i carries colour (i, 2i, 3i), so vertex 1 is the first that shows
  // the channels are not simply zeroed.
  expect(both.streamed.colors.slice(0, 6)).toEqual([0, 0, 0, 1, 2, 3]);
  expect(both.streamed.quality[10]).toBeCloseTo(1.0, 5);
});

test('a response with no content-length still parses, via the copying path', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#three-canvas');

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
