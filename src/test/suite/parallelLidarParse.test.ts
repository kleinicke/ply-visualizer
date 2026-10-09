import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import {
  decodeInWorker,
  parallelParseE57,
  parallelParseLas,
} from '../../providerHandlers/parallelLidarParse';
import { parseOffWasm, parseStlWasm } from '../../../engine/src/parsers/pointcloudWasm';
import { associateE57Images, marshalLidarScan, takeE57Images } from '../../wasmPointcloud';
import { releaseParseWorkers } from '../../providerHandlers/parsePool';
import { loadRegistrationWasm } from '../../../engine/src/registration/wasmLoader';

/**
 * The extension-host side of the parallel LAS/LAZ decode: workers, the
 * concatenation, the whole-file colour decision and the metadata it fills in.
 * The Rust tests cover chunked LAZ at several splits; this checks that the
 * TypeScript merge reproduces the sequential decoder field for field.
 */
suite('Parallel LAS decode', function () {
  this.timeout(60_000);
  suiteTeardown(() => releaseParseWorkers());

  test('a split LAS decodes exactly as the whole file does', async () => {
    const file = path.join(__dirname, '../../../../engine/test/fixtures/lidar/attributes.las');
    // A Node Buffer, as the extension reads files: its `slice` is a view.
    const bytes = fs.readFileSync(file);
    const wasm = (await loadRegistrationWasm()) as any;
    const collection = wasm.parse_las(bytes, 'attributes.las');
    const scan = collection.take_scan(0);
    const expected = {
      positions: Array.from(scan.take_positions() as Float32Array),
      colors: Array.from(scan.take_colors() as Uint8Array),
      intensity: Array.from(scan.take_intensity() as Float32Array),
      classification: Array.from(scan.take_classification() as Float32Array),
      gpsTime: Array.from(scan.take_gps_time() as Float32Array),
      metadata: JSON.parse(scan.metadata_json),
    };

    const parsed = await parallelParseLas(bytes, 'attributes.las', { workers: 2, minPoints: 0 });
    assert.ok(parsed, 'the parallel decoder accepted the file');
    assert.deepStrictEqual(
      {
        positions: Array.from(parsed.positionsArray),
        colors: Array.from(parsed.colorsArray ?? []),
        intensity: Array.from(parsed.scalarFields.intensity),
        classification: Array.from(parsed.scalarFields.classification),
        gpsTime: Array.from(parsed.scalarFields.gpsTime),
        metadata: parsed.metadata,
      },
      expected
    );
    // GPS times are relative to the first point's, as in the whole-file decode.
    assert.deepStrictEqual(expected.gpsTime, [0, 1]);
  });

  test('a multi-scan E57 decodes scan by scan exactly as the whole file does', async () => {
    const file = path.join(__dirname, '../../../../engine/test/fixtures/lidar/multi-scan.e57');
    const bytes = fs.readFileSync(file);
    const wasm = (await loadRegistrationWasm()) as any;
    const collection = wasm.parse_e57(bytes, 'multi-scan.e57');
    const expected = Array.from({ length: collection.scan_count }, (_, i) =>
      marshalLidarScan(collection.take_scan(i))
    );
    associateE57Images(expected, takeE57Images(collection));
    collection.free();

    const scans = await parallelParseE57(bytes, 'multi-scan.e57', { workers: 2, minPoints: 0 });
    assert.ok(scans, 'the parallel decoder accepted the file');
    const shape = (list: typeof expected) =>
      list.map(scan => ({
        name: scan.name,
        positions: Array.from(scan.positionsArray),
        colors: Array.from(scan.colorsArray ?? []),
        intensity: Array.from(scan.intensityArray ?? []),
        origin: Array.from(scan.sourceOrigin),
        metadata: JSON.stringify(scan.metadata, (key, value) =>
          ArrayBuffer.isView(value) ? Array.from(value as Uint8Array) : value
        ),
      }));
    assert.strictEqual(scans.length, 2);
    assert.deepStrictEqual(shape(scans), shape(expected));
  });

  test('a worker decode returns exactly what the in-process decoder does', async () => {
    const stl = Buffer.from(
      'solid t\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid t\n'
    );
    const off = Buffer.from('COFF\n3 1 0\n0 0 0 255 0 0\n1 0 0 0 255 0\n0 1 0 0 0 255\n3 0 1 2\n');
    const plain = (value: unknown) =>
      JSON.parse(
        JSON.stringify(value, (_key, item) =>
          ArrayBuffer.isView(item) ? Array.from(item as Uint8Array) : item
        )
      );
    assert.deepStrictEqual(
      plain(await decodeInWorker('stl', stl, 't.stl')),
      plain(await parseStlWasm(stl))
    );
    assert.deepStrictEqual(
      plain(await decodeInWorker('off', off, 't.off')),
      plain(await parseOffWasm(off))
    );
    // A file the decoder rejects reports the decoder's own message.
    await assert.rejects(
      decodeInWorker('off', Buffer.from('OFF\n3 1 0\n0 0 0\n1 0 0\n0 1 0\n3 0 1 9\n'), 'bad.off'),
      /invalid vertex index 9/
    );
  });
});
