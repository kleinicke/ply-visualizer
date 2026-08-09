import * as assert from 'assert';
import {
  colorFromAllStations,
  type StationFrame,
  type StationScan,
} from '../../../engine/src/parsers/stonexStationColoring';

/**
 * Cross-station colouring, on a scene small enough to reason about by hand.
 *
 * The whole point of this pass is that it is *selective* — it must colour the
 * grey scans, must not paint through a wall, and must not throw away a good
 * colour for a worse view. Those three are what the assertions below check;
 * the projection maths itself belongs to the shared Rust camera model and is
 * stubbed here so a failure means what it says.
 */

const IMAGE_WIDTH = 100;
const IMAGE_HEIGHT = 100;

/**
 * Stand-in for the Rust batch projector: an ideal camera looking down the
 * station's +x axis, so a point's image position follows from its y and z.
 */
/**
 * The scale comes from the request's own `fx`, so two frames in one pass can
 * project differently — the alternative, keying off call order, breaks as soon
 * as more than one scan is processed.
 */
function pinholeProjector() {
  return (request: {
    positions: Float32Array;
    indices: Uint32Array;
    transform: readonly number[];
    fx: number;
  }): Float32Array => {
    const scale = request.fx;
    const out = new Float32Array(request.indices.length * 2);
    const m = request.transform;
    request.indices.forEach((pointIndex, slot) => {
      const offset = pointIndex * 3;
      const x = request.positions[offset];
      const y = request.positions[offset + 1];
      const z = request.positions[offset + 2];
      const cx = m[0] * x + m[4] * y + m[8] * z + m[12];
      const cy = m[1] * x + m[5] * y + m[9] * z + m[13];
      const cz = m[2] * x + m[6] * y + m[10] * z + m[14];
      // Camera looks along +z after the viewer-to-camera transform below.
      if (!(cz > 0)) {
        out[slot * 2] = NaN;
        out[slot * 2 + 1] = NaN;
        return;
      }
      out[slot * 2] = IMAGE_WIDTH / 2 + (cx / cz) * scale;
      out[slot * 2 + 1] = IMAGE_HEIGHT / 2 + (cy / cz) * scale;
    });
    return out;
  };
}

/** Column-major: maps the station's +x axis onto the camera's +z. */
const VIEWER_TO_CAMERA = [0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1];

function makeFrame(overrides: Partial<StationFrame> = {}): StationFrame {
  return {
    frameNumber: 0,
    scanStem: 'station',
    panDegrees: 0,
    imageWidth: IMAGE_WIDTH,
    imageHeight: IMAGE_HEIGHT,
    fx: 50,
    fy: 50,
    cx: IMAGE_WIDTH / 2,
    cy: IMAGE_HEIGHT / 2,
    distortionCoefficients: [0, 0, 0, 0, 0],
    viewerToCamera: VIEWER_TO_CAMERA,
    maxNormalizedX: 1,
    maxNormalizedY: 1,
    sample: () => [10, 200, 30],
    ...overrides,
  };
}

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

suite('Stonex cross-station colouring', () => {
  /**
   * Station points sit along +x (azimuth 0, matching a frame panned to 0), and
   * the second scan's points sit just in front of them.
   */
  function buildScene(secondScanPoints: number[]) {
    const stationPoints: number[] = [];
    for (let i = 0; i < 40; i++) {
      // A wall at x = 10, spread a little so the depth bins get populated.
      stationPoints.push(10, (i % 8) * 0.02 - 0.08, Math.floor(i / 8) * 0.02 - 0.05);
    }
    const positions = new Float32Array([...stationPoints, ...secondScanPoints]);
    const pointCount = positions.length / 3;
    const stationCount = stationPoints.length / 3;
    // The station's own scan is the one that arrived with colour, as it does in
    // a real archive; only the second scan is grey. Without this the station's
    // own wall would count as newly coloured and drown out the assertions.
    const colored = new Uint8Array(pointCount);
    colored.fill(1, 0, stationCount);
    const frameIndices = new Uint16Array(pointCount).fill(65535);
    frameIndices.fill(0, 0, stationCount);
    return {
      positions,
      rawColors: new Uint8Array(pointCount * 3),
      frameIndices,
      colored,
      scans: [
        {
          scanStem: 'station',
          pointOffset: 0,
          pointCount: stationPoints.length / 3,
          transform: IDENTITY,
        },
        {
          scanStem: 'grey',
          pointOffset: stationPoints.length / 3,
          pointCount: secondScanPoints.length / 3,
          transform: IDENTITY,
        },
      ] as StationScan[],
    };
  }

  test('colours a grey scan from another station camera', () => {
    // A point in front of the wall, in view: it should take the frame's colour.
    const scene = buildScene([8, 0, 0]);
    const visible = scene.scans[1].pointOffset;

    const result = colorFromAllStations(
      scene.positions,
      scene.rawColors,
      scene.frameIndices,
      scene.colored,
      new Uint8Array(scene.positions.length / 3),
      scene.scans,
      [makeFrame()],
      pinholeProjector() as any
    );

    assert.strictEqual(result.newlyColored, 1, 'the visible grey point should gain colour');
    assert.strictEqual(scene.colored[visible], 1);
    assert.deepStrictEqual(
      Array.from(scene.rawColors.slice(visible * 3, visible * 3 + 3)),
      [10, 200, 30]
    );
    assert.strictEqual(scene.frameIndices[visible], 0, 'the frame it came from is recorded');
  });

  test('refuses to paint through the wall the station measured', () => {
    // Same direction, but behind the station's own wall at x = 10.
    const scene = buildScene([14, 0, 0]);

    const result = colorFromAllStations(
      scene.positions,
      scene.rawColors,
      scene.frameIndices,
      scene.colored,
      new Uint8Array(scene.positions.length / 3),
      scene.scans,
      [makeFrame()],
      pinholeProjector() as any
    );

    assert.strictEqual(result.newlyColored, 0, 'a hidden point must stay grey');
    assert.ok(result.occludedSamples > 0, 'and be reported as hidden');
    assert.strictEqual(scene.colored[scene.scans[1].pointOffset], 0);
  });

  test('leaves colour a scan already has alone by default', () => {
    const scene = buildScene([8, 0, 0]);
    const point = scene.scans[1].pointOffset;
    // This grey scan's point already carries colour from somewhere.
    scene.colored[point] = 1;
    scene.rawColors.set([1, 2, 3], point * 3);
    scene.frameIndices[point] = 7;

    const result = colorFromAllStations(
      scene.positions,
      scene.rawColors,
      scene.frameIndices,
      scene.colored,
      new Uint8Array(scene.positions.length / 3),
      scene.scans,
      [makeFrame({ frameNumber: 3, sample: () => [40, 50, 60] })],
      pinholeProjector() as any
    );

    assert.strictEqual(result.recolored, 0, 'default mode must not touch existing colour');
    assert.deepStrictEqual(Array.from(scene.rawColors.slice(point * 3, point * 3 + 3)), [1, 2, 3]);
    assert.strictEqual(scene.frameIndices[point], 7);
  });

  test('when recolouring, the most central view wins', () => {
    // Offset from the axis, so the projector's scale actually moves the pixel:
    // a point dead ahead lands at the image centre whatever the focal length.
    const scene = buildScene([8, 0.9, 0]);
    const point = scene.scans[1].pointOffset;
    scene.colored[point] = 1;
    scene.rawColors.set([1, 2, 3], point * 3);

    // Both frames see it in one pass: one near the edge, one dead centre. The
    // comparison only means anything inside a single call, which is how the
    // parser uses it.
    const result = colorFromAllStations(
      scene.positions,
      scene.rawColors,
      scene.frameIndices,
      scene.colored,
      new Uint8Array(scene.positions.length / 3),
      scene.scans,
      [
        // fx doubles as this stub's focal length: the first lands the point
        // near the frame edge, the second dead centre.
        makeFrame({ frameNumber: 9, fx: 380, sample: () => [250, 250, 250] }),
        makeFrame({ frameNumber: 3, fx: 50, sample: () => [40, 50, 60] }),
      ],
      pinholeProjector() as any,
      { recolorAlreadyColored: true }
    );

    assert.ok(result.recolored > 0, 'recolouring was asked for');
    assert.deepStrictEqual(
      Array.from(scene.rawColors.slice(point * 3, point * 3 + 3)),
      [40, 50, 60],
      'the centred view should win over the edge one'
    );
    assert.strictEqual(scene.frameIndices[point], 3);
  });

  test('does nothing when no frame belongs to a loaded scan', () => {
    const scene = buildScene([8, 0, 0]);
    const result = colorFromAllStations(
      scene.positions,
      scene.rawColors,
      scene.frameIndices,
      scene.colored,
      new Uint8Array(scene.positions.length / 3),
      scene.scans,
      [makeFrame({ scanStem: 'a-station-that-was-not-loaded' })],
      pinholeProjector() as any
    );
    assert.strictEqual(result.newlyColored, 0);
    assert.strictEqual(result.recolored, 0);
  });
});
