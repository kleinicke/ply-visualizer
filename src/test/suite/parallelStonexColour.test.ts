import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { StonexX3aParser, type StonexX3aData } from '../../../engine/src/parsers/stonexX3aParser';
import { stonexCameraProjector } from '../../wasmCameraModels';
import {
  colourStonexScansInParallel,
  decodeStonexScansInParallel,
} from '../../providerHandlers/parallelStonexColour';
import { releaseParseWorkers } from '../../providerHandlers/parsePool';

// Three photographed scans with disjoint frames: three independent groups.
const ARCHIVE = path.resolve(__dirname, '../../../../testfiles/lidar/OHP_FRONT.x3a');

function colourState(scans: StonexX3aData[]) {
  return scans.map(scan => {
    const metadata = scan.metadata as Record<string, any>;
    return {
      raw: Buffer.from(metadata.stonexRawColors ?? []).toString('base64'),
      frames: Buffer.from(
        new Uint8Array(metadata.stonexFrameIndices?.buffer ?? new ArrayBuffer(0))
      ).toString('base64'),
      display: Buffer.from(scan.colorsArray ?? []).toString('base64'),
      coloured: metadata.photographicallyColoredPoints,
      previews: (metadata.cameraFrames ?? []).map((frame: any) =>
        frame.preview ? Buffer.from(frame.preview.rgba).toString('base64') : null
      ),
    };
  });
}

suite('Parallel Stonex colouring', () => {
  teardown(() => releaseParseWorkers());

  test('colours scan groups on the decoder pool exactly as one session does', async function () {
    if (!fs.existsSync(ARCHIVE)) {
      this.skip();
    }
    this.timeout(180_000);
    const bytes = new Uint8Array(fs.readFileSync(ARCHIVE));
    let groups = 0;
    const parallel = await new StonexX3aParser(stonexCameraProjector, async jobs => {
      groups = jobs.length;
      return colourStonexScansInParallel(jobs);
    }).parseAll(bytes, 'OHP_FRONT.x3a');
    const single = await new StonexX3aParser(stonexCameraProjector).parseAll(
      bytes,
      'OHP_FRONT.x3a'
    );

    assert.strictEqual(groups, 3);
    assert.deepStrictEqual(colourState(parallel), colourState(single));

    // Read into shared memory, the scans also decode on the pool.
    const shared = new Uint8Array(new SharedArrayBuffer(bytes.byteLength));
    shared.set(bytes);
    let decodeJobs = 0;
    const pooled = await new StonexX3aParser(
      stonexCameraProjector,
      colourStonexScansInParallel,
      async (jobs, onDecoded) => {
        decodeJobs = jobs.length;
        return decodeStonexScansInParallel(jobs, onDecoded);
      }
    ).parseAll(shared, 'OHP_FRONT.x3a');
    assert.strictEqual(decodeJobs, 8);
    assert.deepStrictEqual(
      pooled.map(scan => Buffer.from(scan.positionsArray.buffer).toString('base64')),
      single.map(scan => Buffer.from(scan.positionsArray.buffer).toString('base64'))
    );
    assert.deepStrictEqual(colourState(pooled), colourState(single));
  });
});
