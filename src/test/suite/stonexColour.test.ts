import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { StonexX3aParser } from '../../../engine/src/parsers/stonexX3aParser';
import { stonexCameraProjector } from '../../wasmCameraModels';

/**
 * The Rust colour pass on a real archive.
 *
 * This used to be a differential test: the same file coloured twice, once by
 * the Rust session and once by the JavaScript pass, compared byte for byte.
 * That comparison did its job — it is what made deleting the JavaScript pass
 * safe — and with the second implementation gone there is nothing left to
 * differ from. `stonex::colour`'s own tests cover the rules (a point behind the
 * camera is never coloured, only columns a frame faces are, the more central of
 * two frames wins); what this holds is the integration: a real archive comes
 * out coloured, plausibly, and with its frame attribution intact.
 */
const ARCHIVE = path.resolve(__dirname, '../../../../testfiles/lidar/Abschnitt_A.x3a');

suite('Stonex colour pass on a real archive', () => {
  test('colours a real archive and attributes every colour to a frame', async function () {
    this.timeout(300_000);
    if (!fs.existsSync(ARCHIVE)) {
      this.skip();
      return;
    }
    const bytes = new Uint8Array(fs.readFileSync(ARCHIVE));
    const scans = await new StonexX3aParser(stonexCameraProjector).parseAll(bytes, 'a.x3a');

    assert.ok(scans.length > 0, 'the archive holds at least one scan');

    let totalPoints = 0;
    let totalColoured = 0;
    for (const scan of scans) {
      const name = scan.metadata.embeddedScanName as string;
      const colours = scan.metadata.stonexRawColors as Uint8Array | null;
      const frames = scan.metadata.stonexFrameIndices as Uint16Array | null;
      assert.ok(colours, `${name}: has colours`);
      assert.ok(frames, `${name}: has frame attribution`);
      assert.strictEqual(colours!.length, scan.vertexCount * 3, `${name}: one colour per point`);
      assert.strictEqual(frames!.length, scan.vertexCount, `${name}: one frame id per point`);

      const coloured = scan.metadata.photographicallyColoredPoints as number;
      assert.ok(
        coloured > 0 && coloured <= scan.vertexCount,
        `${name}: coloured ${coloured} of ${scan.vertexCount} points`
      );
      // A scan photographed from thirty frames should have most of its points
      // seen by at least one of them; a fraction near zero means the projection
      // or the candidate window is wrong rather than the data being sparse.
      assert.ok(
        coloured / scan.vertexCount > 0.1,
        `${name}: only ${((coloured / scan.vertexCount) * 100).toFixed(1)}% of points were coloured`
      );

      // Every point that carries a colour must say which frame it came from,
      // and every point that does not must not.
      const NO_FRAME = 0xffff;
      let attributed = 0;
      for (let index = 0; index < scan.vertexCount; index++) {
        if (frames![index] !== NO_FRAME) {
          attributed++;
        }
      }
      assert.strictEqual(attributed, coloured, `${name}: attribution matches the coloured count`);

      totalPoints += scan.vertexCount;
      totalColoured += coloured;
    }

    assert.ok(totalPoints > 0 && totalColoured > 0);
  });

  test('frame previews are decoded once and carried on the scan', async function () {
    this.timeout(300_000);
    if (!fs.existsSync(ARCHIVE)) {
      this.skip();
      return;
    }
    const bytes = new Uint8Array(fs.readFileSync(ARCHIVE));
    const scans = await new StonexX3aParser(stonexCameraProjector).parseAll(bytes, 'a.x3a');
    const frames = scans.flatMap(
      scan => (scan.metadata.stonexCameraFrames as Array<any> | undefined) ?? []
    );

    assert.ok(frames.length > 0, 'the archive carries camera frames');
    for (const frame of frames) {
      assert.ok(frame.previewWidth > 0 && frame.previewHeight > 0, `${frame.name}: preview size`);
      assert.strictEqual(
        frame.previewRgba.length,
        frame.previewWidth * frame.previewHeight * 4,
        `${frame.name}: preview is RGBA at its declared size`
      );
    }
  });
});
