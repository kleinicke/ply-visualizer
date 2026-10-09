import * as assert from 'assert';
import { decodeInWorker } from '../../providerHandlers/parallelLidarParse';
import { parallelParsePcd } from '../../providerHandlers/parallelPcdParse';
import { releaseParseWorkers } from '../../providerHandlers/parsePool';

/**
 * Binary PCD decoded in row ranges must be the very payload the whole-file
 * decode produces: every array byte for byte, the extra fields, the header
 * facts, and the source-row map of a cloud with NaN rows.
 */
function binaryPcd(rows: number, nanEvery: number): Uint8Array {
  const header = Buffer.from(
    'VERSION .7\nFIELDS x y z rgb normal_x normal_y normal_z label\n' +
      'SIZE 4 4 4 4 4 4 4 4\nTYPE F F F F F F F U\nCOUNT 1 1 1 1 1 1 1 1\n' +
      `WIDTH ${rows}\nHEIGHT 1\nVIEWPOINT 1 2 3 1 0 0 0\nPOINTS ${rows}\nDATA binary\n`,
    'latin1'
  );
  const body = Buffer.alloc(rows * 32);
  for (let row = 0; row < rows; row++) {
    const at = row * 32;
    body.writeFloatLE(nanEvery && row % nanEvery === 5 ? Number.NaN : row * 0.25, at);
    body.writeFloatLE(-row, at + 4);
    body.writeFloatLE(Math.sin(row), at + 8);
    body.writeUInt32LE(
      (0xff000000 | ((row % 256) << 16) | (((row * 7) % 256) << 8) | 9) >>> 0,
      at + 12
    );
    body.writeFloatLE(0, at + 16);
    body.writeFloatLE(0, at + 20);
    body.writeFloatLE(1, at + 24);
    body.writeUInt32LE(row * 3, at + 28);
  }
  return new Uint8Array(Buffer.concat([header, body]));
}

function comparable(payload: Record<string, any>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (ArrayBuffer.isView(value)) {
      out[key] = Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString('base64');
    } else if (key === 'scalarFields') {
      out[key] = comparable(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

suite('Parallel binary PCD decode', function () {
  this.timeout(60_000);
  suiteTeardown(() => releaseParseWorkers());

  for (const [label, nanEvery] of [
    ['every row kept', 0],
    ['NaN rows dropped', 7],
  ] as const) {
    test(`row ranges reproduce the whole-file payload (${label})`, async () => {
      const bytes = binaryPcd(30_001, nanEvery);
      const whole = await decodeInWorker<Record<string, any>>('pcd', bytes, 'cloud.pcd');
      const split = await parallelParsePcd(bytes, { workers: 3, minRows: 0 });
      assert.ok(split, 'the parallel decoder accepted the file');
      assert.deepStrictEqual(comparable(split), comparable(whole));
      if (nanEvery) {
        assert.ok(whole.sourcePointIndices, 'NaN rows leave a real row map');
      } else {
        assert.strictEqual(whole.sourceRowsIdentity, true);
      }
    });
  }

  test('ASCII PCD is left to the whole-file decoder', async () => {
    const ascii = new TextEncoder().encode(
      'FIELDS x y z\nSIZE 4 4 4\nTYPE F F F\nCOUNT 1 1 1\nWIDTH 1\nHEIGHT 1\nPOINTS 1\nDATA ascii\n1 2 3\n'
    );
    assert.strictEqual(await parallelParsePcd(ascii, { workers: 3, minRows: 0 }), null);
  });
});
