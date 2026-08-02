import * as assert from 'assert';
import { StonexX3aParser } from '../../../engine/src/parsers/stonexX3aParser';

function writeAscii(target: Uint8Array, offset: number, value: string): void {
  for (let i = 0; i < value.length; i++) {
    target[offset + i] = value.charCodeAt(i);
  }
}

function makeArchive(): Uint8Array {
  const archiveHeaderBytes = 88;
  const entryBytes = 512;
  const memberOffset = archiveHeaderBytes + entryBytes;
  const memberSize = 16_408 + 48 + 2 * 8 + 8;
  const bytes = new Uint8Array(memberOffset + memberSize);
  const view = new DataView(bytes.buffer);

  writeAscii(bytes, 0, 'CRAX');
  view.setUint32(4, 2, true);
  view.setUint32(80, 1, true);
  view.setBigUint64(88, BigInt(memberOffset), true);
  view.setBigUint64(96, BigInt(memberSize), true);
  writeAscii(bytes, 104, 'scan.x3r');

  writeAscii(bytes, memberOffset, '003X');
  view.setUint32(memberOffset + 4, 14, true);
  writeAscii(bytes, memberOffset + 8, 'DESC');
  view.setUint32(memberOffset + 32, 1, true);
  view.setUint32(memberOffset + 44, 2, true);

  const column = memberOffset + 16_408;
  writeAscii(bytes, column, 'XCOL');
  view.setInt32(column + 20, 0, true);
  view.setInt32(column + 48, 10_000, true);
  view.setUint32(column + 52, 8191, true);
  view.setInt32(column + 56, 0x7fffffff, true);
  view.setUint32(column + 60, 0, true);
  return bytes;
}

suite('Stonex X3A Parser', () => {
  test('decodes valid X3R ranges and filters invalid returns', async () => {
    const result = await new StonexX3aParser().parse(makeArchive(), 'sample.x3a');

    assert.strictEqual(result.vertexCount, 1);
    assert.strictEqual(result.sourcePointCount, 2);
    assert.strictEqual(result.hasIntensity, true);
    assert.strictEqual(result.fileName, 'sample.x3a');
    assert.ok(Math.abs(result.positionsArray[0] - Math.cos((25 * Math.PI) / 180)) < 1e-6);
    assert.ok(Math.abs(result.positionsArray[1]) < 1e-6);
    assert.ok(Math.abs(result.positionsArray[2] + Math.sin((25 * Math.PI) / 180)) < 1e-6);
    assert.ok(Math.abs(result.intensityArray[0] - 8191 / 16383) < 1e-6);
  });

  test('rejects files without a CRAX signature', async () => {
    await assert.rejects(
      () => new StonexX3aParser().parse(new Uint8Array(100)),
      /missing CRAX archive signature/
    );
  });
});
