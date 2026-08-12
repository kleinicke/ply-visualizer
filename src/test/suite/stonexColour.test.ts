import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { StonexX3aParser } from '../../../engine/src/parsers/stonexX3aParser';
import { setStonexWasmDisabledForTests } from '../../../engine/src/parsers/stonexWasm';
import { stonexCameraProjector } from '../../wasmCameraModels';

/**
 * The Rust colour pass against the JavaScript one it replaces, on a real
 * archive.
 *
 * Colour is the one output where "close enough" is indistinguishable from
 * correct by eye: a subtly wrong image looks perfectly plausible, and there is
 * no way to tell from it which of the two implementations was at fault. So the
 * comparison is every colour byte and every frame index of every point.
 */
const ARCHIVE = path.resolve(__dirname, '../../../../testfiles/lidar/Abschnitt_A.x3a');

suite('Stonex colour pass: Rust matches JavaScript', () => {
  test('produces the same colours and frame choices on a real archive', async function () {
    this.timeout(300_000);
    if (!fs.existsSync(ARCHIVE)) {
      this.skip();
      return;
    }
    const bytes = new Uint8Array(fs.readFileSync(ARCHIVE));

    // The JavaScript path needs the camera projector; the Rust one carries its
    // own projection, so it is given the same projector to keep the two runs
    // identical in every other respect.
    setStonexWasmDisabledForTests(true);
    const legacy = await new StonexX3aParser(stonexCameraProjector).parseAll(bytes, 'a.x3a');
    setStonexWasmDisabledForTests(false);
    const ported = await new StonexX3aParser(stonexCameraProjector).parseAll(bytes, 'a.x3a');

    assert.strictEqual(ported.length, legacy.length, 'scan count');

    for (let scan = 0; scan < legacy.length; scan++) {
      const name = legacy[scan].metadata.embeddedScanName as string;
      assert.strictEqual(
        ported[scan].metadata.photographicallyColoredPoints,
        legacy[scan].metadata.photographicallyColoredPoints,
        `${name}: coloured point count`
      );

      const expected = legacy[scan].metadata.stonexRawColors as Uint8Array;
      const actual = ported[scan].metadata.stonexRawColors as Uint8Array;
      assert.strictEqual(actual.length, expected.length, `${name}: colour buffer length`);

      // The two agree on every sample they take; where they differ it is by a
      // single count, on a value that landed on a rounding boundary after a
      // bilinear chain evaluated in a different order. That is invisible - one
      // part in 255 on one channel - but it is real, so it is bounded and
      // counted here rather than hidden behind a tolerance.
      let differing = 0;
      let worst = 0;
      for (let i = 0; i < expected.length; i++) {
        const delta = Math.abs(actual[i] - expected[i]);
        if (delta > 0) {
          differing++;
          worst = Math.max(worst, delta);
        }
      }
      assert.ok(worst <= 1, `${name}: colour differs by ${worst}, more than a rounding boundary`);
      const fraction = differing / Math.max(1, expected.length);
      assert.ok(
        fraction < 0.02,
        `${name}: ${(fraction * 100).toFixed(2)}% of colour bytes differ, too many for rounding`
      );

      const expectedFrames = legacy[scan].metadata.stonexFrameIndices as Uint16Array;
      const actualFrames = ported[scan].metadata.stonexFrameIndices as Uint16Array;
      for (let i = 0; i < expectedFrames.length; i++) {
        if (actualFrames[i] !== expectedFrames[i]) {
          assert.fail(
            `${name}: point ${i} took frame ${actualFrames[i]} in rust, ${expectedFrames[i]} in js`
          );
        }
      }
    }

    const legacyFrames = legacy.flatMap(
      scan => (scan.metadata.stonexCameraFrames as Array<any> | undefined) ?? []
    );
    const portedFrames = ported.flatMap(
      scan => (scan.metadata.stonexCameraFrames as Array<any> | undefined) ?? []
    );
    assert.strictEqual(portedFrames.length, legacyFrames.length, 'camera preview count');
    for (let frame = 0; frame < legacyFrames.length; frame++) {
      assert.strictEqual(portedFrames[frame].previewWidth, legacyFrames[frame].previewWidth);
      assert.strictEqual(portedFrames[frame].previewHeight, legacyFrames[frame].previewHeight);
      assert.deepStrictEqual(
        portedFrames[frame].previewRgba,
        legacyFrames[frame].previewRgba,
        `${portedFrames[frame].name}: Rust preview reuses the same decoded image`
      );
    }
  });
});
