import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { StonexX3aParser } from '../../../engine/src/parsers/stonexX3aParser';
import { loadRegistrationWasm } from '../../../engine/src/registration/wasmLoader';

/**
 * The Rust X3R decoder against the TypeScript one, on a real archive.
 *
 * A synthetic record cannot show whether the two agree on what a real file
 * contains — the sentinel values, the sweep geometry and the column layout all
 * come from firmware, not from a spec I can restate in a fixture. So this runs
 * both decoders over an archive in `testfiles/` and compares every point.
 */
const ARCHIVE = path.resolve(__dirname, '../../../../testfiles/lidar/Abschnitt_A.x3a');

/** Pulls the raw bytes of each `.x3r` member out of a CRAX archive. */
function readScanMembers(archive: Buffer): Array<{ name: string; bytes: Uint8Array }> {
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  const count = view.getUint32(80, true);
  const members: Array<{ name: string; bytes: Uint8Array }> = [];
  for (let index = 0; index < count; index++) {
    const entry = 88 + index * 512;
    const offset = Number(view.getBigUint64(entry, true));
    const size = Number(view.getBigUint64(entry + 8, true));
    let length = 0;
    while (length < 496 && archive[entry + 16 + length] !== 0) {
      length++;
    }
    const name = archive.toString('ascii', entry + 16, entry + 16 + length);
    if (/\.x3r$/i.test(name)) {
      members.push({ name, bytes: new Uint8Array(archive.subarray(offset, offset + size)) });
    }
  }
  return members;
}

suite('Stonex X3R decode: Rust matches TypeScript', () => {
  test('produces the same points as the TypeScript parser on a real archive', async function () {
    this.timeout(120_000);
    const wasm = (await loadRegistrationWasm()) as any;
    if (!wasm?.stonex_decode_scan || !fs.existsSync(ARCHIVE)) {
      this.skip();
      return;
    }

    const archive = fs.readFileSync(ARCHIVE);
    const members = readScanMembers(archive);
    assert.ok(members.length > 1, 'expected several scan records');

    // No projector: this compares geometry, and colouring is a separate port.
    const scans = await new StonexX3aParser().parseAll(
      new Uint8Array(archive),
      path.basename(ARCHIVE)
    );
    const byName = new Map(scans.map(scan => [scan.metadata.embeddedScanName as string, scan]));

    for (const member of members) {
      const expected = byName.get(member.name);
      assert.ok(expected, `no TypeScript result for ${member.name}`);

      const decoded = wasm.stonex_decode_scan(member.bytes);
      const count = decoded.point_count;
      const positions = decoded.take_positions() as Float32Array;
      const intensity = decoded.take_intensity() as Float32Array;
      decoded.free?.();

      assert.strictEqual(count, expected!.vertexCount, `${member.name}: point count`);

      // Every coordinate, not a sample: a decoder that agrees on most points
      // and not on the rest is the failure worth catching, and it hides from
      // spot checks.
      const expectedPositions = expected!.positionsArray!;
      for (let i = 0; i < positions.length; i++) {
        if (positions[i] !== expectedPositions[i]) {
          assert.fail(
            `${member.name}: position ${i} (point ${Math.floor(i / 3)}, axis ${i % 3}) ` +
              `rust ${positions[i]} vs ts ${expectedPositions[i]}`
          );
        }
      }
      const expectedIntensity = expected!.intensityArray!;
      for (let i = 0; i < intensity.length; i++) {
        if (intensity[i] !== expectedIntensity[i]) {
          assert.fail(
            `${member.name}: intensity ${i}: rust ${intensity[i]} vs ts ${expectedIntensity[i]}`
          );
        }
      }
    }
  });
});
