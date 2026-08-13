import * as assert from 'assert';
import {
  cameraCoefficientsFromParameters,
  fitCoefficientsToModel,
  resolveCameraModel,
} from '../../../engine/src/depth/cameraModels';

/**
 * Coefficient lists have to match the camera model the kernel is asked for.
 *
 * The depth panel keeps distortion values across a change of model, so
 * switching from an OpenCV fisheye to an ideal pinhole leaves four k's behind.
 * The kernel refuses a list of the wrong length, and that used to be invisible:
 * the projection failed and a JavaScript fallback quietly produced an
 * undistorted result. With the fallback gone it surfaced as "pinhole-ideal
 * requires exactly 0 coefficients, got 4" and no point cloud at all.
 */
suite('Camera coefficient fitting', () => {
  test('models that take no coefficients get none, whatever is left over', () => {
    for (const model of ['pinhole-ideal', 'fisheye-equidistant', 'e57-spherical'] as const) {
      assert.deepStrictEqual(fitCoefficientsToModel(model, [0.1, 0.2, 0.3, 0.4]), []);
      assert.deepStrictEqual(
        cameraCoefficientsFromParameters({
          cameraModel: model,
          fx: 100,
          coefficients: [0.1, 0.2, 0.3, 0.4],
        }),
        [],
        `${model} must not receive another model's coefficients`
      );
    }
  });

  test('the reported failure: fisheye-opencv values, then a switch to pinhole-ideal', () => {
    const shared = { fx: 500, fy: 500, cx: 320, cy: 240, coefficients: [-0.02, 0.001, 0, 0] };

    const fisheye = cameraCoefficientsFromParameters({
      ...shared,
      cameraModel: 'fisheye-opencv',
    });
    assert.strictEqual(fisheye.length, 4, 'fisheye-opencv keeps its four coefficients');

    const pinhole = cameraCoefficientsFromParameters({ ...shared, cameraModel: 'pinhole-ideal' });
    assert.deepStrictEqual(pinhole, [], 'the same settings on an ideal pinhole carry none');
  });

  test('a rectified image is an ideal pinhole even when the file names a model', () => {
    assert.deepStrictEqual(
      cameraCoefficientsFromParameters({
        cameraModel: 'fisheye-opencv',
        fx: 500,
        coefficients: [0.1, 0.2, 0.3, 0.4],
        imageRectified: true,
      }),
      []
    );
  });

  test('fixed-count models are padded or truncated to their count', () => {
    assert.deepStrictEqual(fitCoefficientsToModel('fisheye-opencv', [0.5]), [0.5, 0, 0, 0]);
    assert.deepStrictEqual(
      fitCoefficientsToModel('fisheye-opencv', [1, 2, 3, 4, 5, 6]),
      [1, 2, 3, 4]
    );
    assert.strictEqual(fitCoefficientsToModel('fisheye624', [1, 2, 3]).length, 12);
  });

  test('OpenCV pinhole keeps any of its accepted layouts and grows to the next one', () => {
    for (const count of [4, 5, 8, 12, 14]) {
      const values = Array.from({ length: count }, (_, i) => i / 100);
      assert.strictEqual(
        fitCoefficientsToModel('pinhole-opencv', values).length,
        count,
        `${count} coefficients is a valid OpenCV layout and must be left alone`
      );
    }
    // Not a layout: grows to the next one that is, rather than being refused.
    assert.strictEqual(fitCoefficientsToModel('pinhole-opencv', [1, 2, 3]).length, 4);
    assert.strictEqual(fitCoefficientsToModel('pinhole-opencv', [1, 2, 3, 4, 5, 6]).length, 8);
    assert.strictEqual(fitCoefficientsToModel('pinhole-opencv', new Array(20).fill(1)).length, 14);
  });

  test('individual k/p parameters still build the list when no array is given', () => {
    assert.deepStrictEqual(
      cameraCoefficientsFromParameters({
        cameraModel: 'pinhole-opencv',
        fx: 100,
        k1: -0.1,
        k2: 0.01,
        p1: 0.001,
        p2: 0.002,
        k3: 0.0001,
      } as any),
      [-0.1, 0.01, 0.001, 0.002, 0.0001]
    );
    assert.deepStrictEqual(
      cameraCoefficientsFromParameters({
        cameraModel: 'fisheye-opencv',
        fx: 100,
        k1: 1,
        k2: 2,
        k3: 3,
        k4: 4,
      } as any),
      [1, 2, 3, 4]
    );
  });

  test('a non-finite coefficient becomes zero rather than reaching the kernel', () => {
    // The kernel rejects the whole call on a NaN, which would again mean no
    // point cloud; a missing distortion term is meaningfully zero.
    assert.deepStrictEqual(fitCoefficientsToModel('fisheye-opencv', [Number.NaN, 1]), [0, 1, 0, 0]);
  });

  test('an all-zero distortion set drops to the closed-form model', () => {
    // Not cosmetic: the distorted models have no closed-form unprojection, so
    // every pixel runs a Newton solve. A 5120x5120 fisheye624 depth image with
    // twelve zeros took about twenty seconds to produce exactly what the
    // equidistant model gives immediately.
    const zeros = (n: number) => new Array(n).fill(0);

    assert.deepStrictEqual(
      resolveCameraModel({ cameraModel: 'fisheye624', fx: 2000, coefficients: zeros(12) }),
      { model: 'fisheye-equidistant', coefficients: [] }
    );
    assert.deepStrictEqual(
      resolveCameraModel({ cameraModel: 'fisheye-opencv', fx: 2000, coefficients: zeros(4) }),
      { model: 'fisheye-equidistant', coefficients: [] }
    );
    assert.deepStrictEqual(
      resolveCameraModel({ cameraModel: 'fisheye-kb3', fx: 2000, coefficients: zeros(4) }),
      { model: 'fisheye-equidistant', coefficients: [] }
    );
    assert.deepStrictEqual(
      resolveCameraModel({ cameraModel: 'pinhole-opencv', fx: 2000, coefficients: zeros(5) }),
      { model: 'pinhole-ideal', coefficients: [] }
    );
  });

  test('a model with no coefficients entered at all is treated as undistorted', () => {
    // What the reported file did: fisheye624 selected, every k and p left unset.
    assert.deepStrictEqual(resolveCameraModel({ cameraModel: 'fisheye624', fx: 2000 }), {
      model: 'fisheye-equidistant',
      coefficients: [],
    });
  });

  test('one non-zero coefficient keeps the distorted model', () => {
    const coefficients = new Array(12).fill(0);
    coefficients[3] = 1e-4;
    const resolved = resolveCameraModel({ cameraModel: 'fisheye624', fx: 2000, coefficients });
    assert.strictEqual(resolved.model, 'fisheye624');
    assert.strictEqual(resolved.coefficients.length, 12);
    assert.strictEqual(resolved.coefficients[3], 1e-4);
  });

  test('a single non-zero k on an OpenCV pinhole is still distorted', () => {
    const resolved = resolveCameraModel({
      cameraModel: 'pinhole-opencv',
      fx: 1000,
      k1: -0.05,
    } as any);
    assert.strictEqual(resolved.model, 'pinhole-opencv');
    assert.deepStrictEqual(resolved.coefficients, [-0.05, 0, 0, 0, 0]);
  });
});
