import { normalsAsFloat32 } from '../../../engine/src/utils/normals';
import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  parallelParseTextFile,
  parallelStreamTextFile,
} from '../../providerHandlers/parallelTextParse';
import { addPointStreamPart, finishPointStream } from '../../../engine/src/hosts/pointStream';
import { releaseParseWorkers } from '../../providerHandlers/parsePool';
import { loadRegistrationWasm } from '../../../engine/src/registration/wasmLoader';

/**
 * The parallel text parse must produce exactly the sequential result, at any
 * split. Ranges own the lines that start inside them; a mistake there shows
 * up only at some worker counts, as a dropped or doubled row near a boundary,
 * so every fixture is checked split 1, 2, 3 and 8 ways.
 */

type Arrays = {
  positions: number[];
  colors: number[] | null;
  normals: number[] | null;
  intensity: number[] | null;
};

async function sequential(file: string, format: string, colorMode: string): Promise<Arrays> {
  const wasm = (await loadRegistrationWasm()) as any;
  const bytes = fs.readFileSync(file);
  let raw;
  if (format === 'pts') {
    raw = wasm.parse_pts(bytes);
  } else {
    const parser = new wasm.StreamParser(format, colorMode);
    // Odd chunking on purpose: the reference must not share the ranges' cuts.
    for (let at = 0; at < bytes.length; at += 997) {
      parser.push(bytes.subarray(at, at + 997));
    }
    raw = parser.finish();
  }
  return {
    positions: Array.from(raw.take_positions() as Float32Array),
    colors: raw.has_colors ? Array.from(raw.take_colors() as Uint8Array) : null,
    normals: raw.has_normals ? Array.from(raw.take_normals() as Float32Array) : null,
    intensity: raw.has_intensity ? Array.from(raw.take_intensity() as Float32Array) : null,
  };
}

function rows(count: number, row: (i: number) => string): string {
  const lines: string[] = [];
  for (let i = 0; i < count; i++) {
    lines.push(row(i));
    if (i % 997 === 0) {
      lines.push('# a comment row', '');
    }
  }
  // Mixed endings, and no newline after the last row.
  return lines.map((line, i) => (i % 5 === 0 ? `${line}\r` : line)).join('\n');
}

const coordinate = (i: number, axis: number) =>
  (((i * 7919 + axis * 104729) % 100003) / 97).toFixed(1 + (i % 6));

suite('Parallel text point-cloud parse', function () {
  this.timeout(60_000);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ply-parallel-'));
  const xyz = (i: number) => `${coordinate(i, 0)} ${coordinate(i, 1)} ${coordinate(i, 2)}`;
  const fixtures: Array<{ name: string; format: string; colorMode: string; text: string }> = [
    { name: 'plain.xyz', format: 'xyz', colorMode: 'auto', text: rows(20_000, xyz) },
    {
      name: 'colours.xyzrgb',
      format: 'xyzrgb',
      colorMode: 'byte',
      text: rows(20_000, i => `${xyz(i)} ${i % 256} ${(i * 3) % 256} 1`),
    },
    {
      name: 'normals.xyzn',
      format: 'xyzn',
      colorMode: 'auto',
      text: rows(15_000, i => `${xyz(i)} 0 ${(i % 3) - 1} 1`),
    },
    {
      name: 'open3d.pts',
      format: 'pts',
      colorMode: 'auto',
      text: `20000\n${rows(20_000, i => `${xyz(i)} ${i % 50} ${i % 256} 0 255`)}`,
    },
    {
      name: 'cloud.ply',
      format: 'ply',
      colorMode: 'auto',
      text:
        'ply\nformat ascii 1.0\nelement vertex 18000\nproperty float x\nproperty float y\n' +
        'property float z\nproperty uchar red\nproperty uchar green\nproperty uchar blue\nend_header\n' +
        // Rows past the declared count are not part of the cloud.
        rows(18_500, i => `${xyz(i)} ${i % 256} 0 7`),
    },
    {
      name: 'cloud.pcd',
      format: 'pcd',
      colorMode: 'auto',
      text:
        '# .PCD v0.7\nVERSION 0.7\nFIELDS x y z intensity\nSIZE 4 4 4 4\nTYPE F F F F\nCOUNT 1 1 1 1\n' +
        'WIDTH 20000\nHEIGHT 1\nVIEWPOINT 0 0 0 1 0 0 0\nPOINTS 20000\nDATA ascii\n' +
        rows(20_000, i => `${xyz(i)} ${(i % 100) / 100}`),
    },
  ];

  suiteTeardown(() => {
    releaseParseWorkers();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  for (const fixture of fixtures) {
    test(`${fixture.name} matches the sequential parse at every split`, async () => {
      const file = path.join(dir, fixture.name);
      fs.writeFileSync(file, fixture.text);
      const expected = await sequential(file, fixture.format, fixture.colorMode);
      assert.ok(expected.positions.length > 0);
      for (const workers of [1, 2, 3, 8]) {
        const parsed = await parallelParseTextFile(file, fixture.format, fixture.colorMode, {
          workers,
          minParallelBytes: 0,
          minSliceBytes: 1,
        });
        assert.ok(parsed, `${workers} workers produced a result`);
        const actual: Arrays = {
          positions: Array.from(parsed.positionsArray),
          colors: parsed.colorsArray ? Array.from(parsed.colorsArray) : null,
          normals: parsed.normalsArray ? Array.from(parsed.normalsArray) : null,
          intensity: parsed.intensityArray ? Array.from(parsed.intensityArray) : null,
        };
        assert.deepStrictEqual(actual, expected, `${workers} workers`);
        assert.strictEqual(parsed.vertexCount, expected.positions.length / 3);

        // The same parse sent in parts and joined by the webview's assembler.
        const streamId = `${fixture.name}-${workers}`;
        const summary = await parallelStreamTextFile(
          file,
          fixture.format,
          fixture.colorMode,
          async part => addPointStreamPart(streamId, part),
          { workers, minParallelBytes: 0, minSliceBytes: 1 }
        );
        assert.ok(summary, `${workers} workers streamed a result`);
        const joined = finishPointStream(streamId)!;
        // The assembler packs unit normals to snorm16 (utils/normals.ts): equal
        // within half a step once decoded.
        const normals = joined.normalsArray
          ? Array.from(normalsAsFloat32(joined.normalsArray))
          : null;
        assert.strictEqual(
          normals?.length,
          expected.normals?.length,
          `${workers} workers, normals`
        );
        normals?.forEach((value, i) =>
          assert.ok(
            Math.abs(value - expected.normals![i]) <= 0.5 / 32767 + 1e-7,
            `${workers} workers, streamed normal ${i}`
          )
        );
        assert.deepStrictEqual(
          {
            positions: Array.from(joined.positionsArray),
            colors: joined.colorsArray ? Array.from(joined.colorsArray) : null,
            normals: expected.normals,
            intensity: joined.intensityArray ? Array.from(joined.intensityArray) : null,
          },
          expected,
          `${workers} workers, streamed`
        );
        assert.strictEqual(summary.vertexCount, expected.positions.length / 3);
      }
    });
  }

  test('two loads sharing the pool each get their own result', async () => {
    // Jobs of two files land on the same workers; replies must not cross.
    const [a, b] = fixtures.filter(f => f.format === 'xyz' || f.format === 'pts');
    const files = [a, b].map(fixture => {
      const file = path.join(dir, `concurrent-${fixture.name}`);
      fs.writeFileSync(file, fixture.text);
      return { fixture, file };
    });
    const options = { workers: 2, minParallelBytes: 0, minSliceBytes: 1 };
    const [first, second] = await Promise.all(
      files.map(({ fixture, file }) =>
        parallelParseTextFile(file, fixture.format, fixture.colorMode, options)
      )
    );
    for (const [parsed, { fixture, file }] of [
      [first, files[0]],
      [second, files[1]],
    ] as const) {
      const expected = await sequential(file, fixture.format, fixture.colorMode);
      assert.deepStrictEqual(Array.from(parsed!.positionsArray), expected.positions, fixture.name);
    }
  });

  test('small files and meshes are left to the sequential parser', async () => {
    const small = path.join(dir, 'small.xyz');
    fs.writeFileSync(small, '1 2 3\n4 5 6\n');
    assert.strictEqual(await parallelParseTextFile(small, 'xyz'), null);
    const mesh = path.join(dir, 'mesh.ply');
    fs.writeFileSync(
      mesh,
      'ply\nformat ascii 1.0\nelement vertex 3\nproperty float x\nproperty float y\nproperty float z\n' +
        'element face 1\nproperty list uchar int vertex_indices\nend_header\n0 0 0\n1 0 0\n0 1 0\n3 0 1 2\n'
    );
    assert.strictEqual(
      await parallelParseTextFile(mesh, 'ply', 'auto', { minParallelBytes: 0, minSliceBytes: 1 }),
      null
    );
  });
});
