import * as assert from 'assert';
import {
  colorFromAllStations,
  type StationFrame,
  type StationScan,
} from '../../../engine/src/parsers/stonexStationColoring';

/**
 * Cross-station colouring, on a scene small enough to reason about by hand.
 *
 * The pass itself is `stonex::stations`, whose own tests cover the rules against
 * hand-built matrices. What this holds is the boundary the Rust cannot see: scan
 * stems resolved to station indices, frames pointing at the right plane in the
 * shared pixel buffer, and each scan's colours copied back into the host's
 * arrays as it finishes. Those are exactly the parts that stay in TypeScript,
 * and a mistake in any of them colours the wrong points from the wrong camera
 * while every cargo test still passes.
 */

const IMAGE = 100;
/** Row-major, as a CAL file declares it: the station's +x is the camera's +z. */
const VIEWER_TO_CAMERA = [0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1];
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const NO_FRAME = 65535;

/** A flat sensor plane, which demosaics to that grey. */
function plane(value: number): Uint8Array {
  return new Uint8Array(IMAGE * IMAGE).fill(value);
}

function makeFrame(overrides: Partial<StationFrame> = {}): StationFrame {
  return {
    frameNumber: 0,
    scanStem: 'station',
    panDegrees: 0,
    pixelOffset: 0,
    rawWidth: IMAGE,
    rawHeight: IMAGE,
    imageWidth: IMAGE,
    imageHeight: IMAGE,
    fx: 50,
    fy: 50,
    cx: IMAGE / 2,
    cy: IMAGE / 2,
    distortionCoefficients: [0, 0, 0, 0, 0],
    viewerToCamera: VIEWER_TO_CAMERA,
    maxNormalizedX: 1,
    maxNormalizedY: 1,
    ...overrides,
  };
}

suite('Stonex cross-station colouring', () => {
  /**
   * The photographed station's own points form a wall at x = 10 — azimuth 0,
   * matching a frame panned to 0 — and the grey scan's points sit wherever the
   * test puts them relative to it.
   */
  function buildScene(greyPoints: number[]) {
    const stationPoints: number[] = [];
    for (let i = 0; i < 40; i++) {
      stationPoints.push(10, (i % 8) * 0.02 - 0.08, Math.floor(i / 8) * 0.02 - 0.05);
    }
    const positions = new Float32Array([...stationPoints, ...greyPoints]);
    const pointCount = positions.length / 3;
    const stationCount = stationPoints.length / 3;
    // The station's own scan is the one that arrived with colour, as it does in
    // a real archive; only the second scan is grey. Without this the station's
    // own wall would count as newly coloured and drown out the assertions.
    const colored = new Uint8Array(pointCount);
    colored.fill(1, 0, stationCount);
    const frameIndices = new Uint16Array(pointCount).fill(NO_FRAME);
    frameIndices.fill(0, 0, stationCount);
    return {
      positions,
      rawColors: new Uint8Array(pointCount * 3),
      frameIndices,
      colored,
      changed: new Uint8Array(pointCount),
      grey: stationCount,
      scans: [
        { scanStem: 'station', pointOffset: 0, pointCount: stationCount, transform: IDENTITY },
        {
          scanStem: 'grey',
          pointOffset: stationCount,
          pointCount: greyPoints.length / 3,
          transform: IDENTITY,
        },
      ] as StationScan[],
    };
  }

  test('colours a grey scan from another station camera', async () => {
    // In front of the wall and in view, so it should take the frame's colour.
    const scene = buildScene([8, 0, 0]);
    const result = await colorFromAllStations(
      scene.positions,
      scene.rawColors,
      scene.frameIndices,
      scene.colored,
      scene.changed,
      plane(120),
      scene.scans,
      [makeFrame({ frameNumber: 3 })]
    );

    assert.strictEqual(result.newlyColored, 1);
    assert.strictEqual(scene.frameIndices[scene.grey], 3, 'attributed to the frame that saw it');
    assert.deepStrictEqual(
      Array.from(scene.rawColors.subarray(scene.grey * 3, scene.grey * 3 + 3)),
      [120, 120, 120]
    );
    assert.strictEqual(scene.changed[scene.grey], 1);
    assert.strictEqual(scene.colored[scene.grey], 1);
  });

  test('own-station diagnostic excludes cross-station photographs', async () => {
    const scene = buildScene([8, 0, 0]);
    const result = await colorFromAllStations(
      scene.positions,
      scene.rawColors,
      scene.frameIndices,
      scene.colored,
      scene.changed,
      plane(120),
      scene.scans,
      [makeFrame()],
      { ownStationOnly: true }
    );

    assert.strictEqual(result.newlyColored, 0);
    assert.strictEqual(scene.frameIndices[scene.grey], NO_FRAME);
  });

  test('refuses to paint through the wall the station measured', async () => {
    // Two metres behind the wall, in the same direction: not visible from there.
    const scene = buildScene([12, 0, 0]);
    const result = await colorFromAllStations(
      scene.positions,
      scene.rawColors,
      scene.frameIndices,
      scene.colored,
      scene.changed,
      plane(120),
      scene.scans,
      [makeFrame()]
    );

    assert.strictEqual(result.newlyColored, 0);
    assert.ok(result.occludedSamples >= 1, 'the rejection is reported');
    assert.strictEqual(scene.frameIndices[scene.grey], NO_FRAME);
  });

  test('leaves colour a scan already has alone by default', async () => {
    const scene = buildScene([8, 0, 0]);
    scene.colored[scene.grey] = 1;
    scene.frameIndices[scene.grey] = 12;
    scene.rawColors.set([1, 2, 3], scene.grey * 3);

    const result = await colorFromAllStations(
      scene.positions,
      scene.rawColors,
      scene.frameIndices,
      scene.colored,
      scene.changed,
      plane(120),
      scene.scans,
      [makeFrame({ frameNumber: 3 })]
    );

    assert.strictEqual(result.newlyColored, 0);
    assert.strictEqual(result.recolored, 0);
    assert.strictEqual(scene.frameIndices[scene.grey], 12, 'the earlier frame keeps the point');
    assert.deepStrictEqual(
      Array.from(scene.rawColors.subarray(scene.grey * 3, scene.grey * 3 + 3)),
      [1, 2, 3]
    );
  });

  test('the most central view wins, and reads that frame own plane', async () => {
    // Off the axis, so the two focal lengths place it at different distances
    // from the principal point: the wider frame sees it nearer the centre.
    const scene = buildScene([8, 0.5, 0]);
    const pixels = new Uint8Array(IMAGE * IMAGE * 2);
    pixels.set(plane(40), 0);
    pixels.set(plane(120), IMAGE * IMAGE);

    await colorFromAllStations(
      scene.positions,
      scene.rawColors,
      scene.frameIndices,
      scene.colored,
      scene.changed,
      pixels,
      scene.scans,
      [
        // Listed first, narrower, so it sees the point further out.
        makeFrame({ frameNumber: 1, fx: 100, fy: 100, pixelOffset: 0 }),
        makeFrame({ frameNumber: 2, pixelOffset: IMAGE * IMAGE }),
      ]
    );

    assert.strictEqual(scene.frameIndices[scene.grey], 2, 'the wider, more central frame wins');
    assert.deepStrictEqual(
      Array.from(scene.rawColors.subarray(scene.grey * 3, scene.grey * 3 + 3)),
      [120, 120, 120],
      'and its colour comes from that frame own plane in the shared buffer'
    );
  });

  test('publishes each scan as it finishes, in order', async () => {
    const scene = buildScene([8, 0, 0]);
    const published: string[] = [];
    await colorFromAllStations(
      scene.positions,
      scene.rawColors,
      scene.frameIndices,
      scene.colored,
      scene.changed,
      plane(120),
      scene.scans,
      [makeFrame()],
      { onScanColored: scan => void published.push(scan.scanStem) }
    );
    assert.deepStrictEqual(published, ['station', 'grey']);
  });

  test('does nothing when no frame belongs to a loaded scan', async () => {
    const scene = buildScene([8, 0, 0]);
    const result = await colorFromAllStations(
      scene.positions,
      scene.rawColors,
      scene.frameIndices,
      scene.colored,
      scene.changed,
      plane(120),
      scene.scans,
      [makeFrame({ scanStem: 'a-station-not-in-this-archive' })]
    );

    assert.strictEqual(result.newlyColored, 0);
    assert.strictEqual(scene.frameIndices[scene.grey], NO_FRAME);
  });
});
