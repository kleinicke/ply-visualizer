import * as assert from 'assert';
import {
  cameraCoefficientsFromParameters,
  coefficientsFromGroups,
  fitCoefficientsToModel,
  groupsFromCoefficients,
  normalizeToOfferedCameraModel,
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

  test('one non-zero coefficient keeps a distorted model', () => {
    // Index 3 is inside the first four radial terms, which is Kannala-Brandt's
    // territory — so the honest answer is kb3, not fisheye624.
    const radial = new Array(12).fill(0);
    radial[3] = 1e-4;
    assert.deepStrictEqual(
      resolveCameraModel({ cameraModel: 'fisheye624', fx: 2000, coefficients: radial }),
      { model: 'fisheye-kb3', coefficients: [0, 0, 0, 1e-4] }
    );

    // A term only fisheye624 has keeps fisheye624.
    const prism = new Array(12).fill(0);
    prism[8] = 1e-4;
    const resolved = resolveCameraModel({
      cameraModel: 'fisheye624',
      fx: 2000,
      coefficients: prism,
    });
    assert.strictEqual(resolved.model, 'fisheye624');
    assert.strictEqual(resolved.coefficients.length, 12);
    assert.strictEqual(resolved.coefficients[8], 1e-4);
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

  test('fisheye624 with only its radial terms is Kannala-Brandt, and says so', () => {
    // The radial polynomial is the same one KB3 uses with two further terms,
    // and the other six coefficients are the tangential and thin-prism parts.
    // Naming the cheaper model matters: the radial inversion is a bisection of
    // up to 512 steps, each evaluating the polynomial, so six terms instead of
    // four costs a third of the total time for identical output (1.71s vs
    // 1.39s on a 1024x1024 depth image, measured).
    const radial = [-0.05, 0.01, 0.001, 0.0001];
    assert.deepStrictEqual(
      resolveCameraModel({
        cameraModel: 'fisheye624',
        fx: 500,
        coefficients: [...radial, 0, 0, 0, 0, 0, 0, 0, 0],
      }),
      { model: 'fisheye-kb3', coefficients: radial }
    );
  });

  test('a real fifth or sixth radial term keeps fisheye624', () => {
    const withK5 = [-0.05, 0.01, 0.001, 0.0001, 0, 1e-6, 0, 0, 0, 0, 0, 0];
    const resolved = resolveCameraModel({
      cameraModel: 'fisheye624',
      fx: 500,
      coefficients: withK5,
    });
    assert.strictEqual(resolved.model, 'fisheye624');
    assert.strictEqual(resolved.coefficients.length, 12);
  });

  test('a tangential or prism term keeps fisheye624 even with four radial terms', () => {
    const withPrism = [-0.05, 0.01, 0.001, 0.0001, 0, 0, 1e-4, 0, 0, 0, 0, 0];
    assert.strictEqual(
      resolveCameraModel({ cameraModel: 'fisheye624', fx: 500, coefficients: withPrism }).model,
      'fisheye624'
    );
  });
});

/**
 * The panel groups coefficients by family — all the radial terms in one box,
 * the tangential pair in another. That grouping is not the order the kernel
 * takes them in: OpenCV's pinhole layout is k1,k2,p1,p2,k3,k4,k5,k6,…, so the
 * radial terms are split around the tangential pair. Getting that mapping wrong
 * silently files a radial term as a tangential one, which is a plausible-looking
 * wrong image rather than an error.
 */
suite('Coefficient grouping', () => {
  test('OpenCV pinhole radial terms skip the tangential slots', () => {
    const ordered = coefficientsFromGroups('pinhole-opencv', [
      '0.1,0.2,0.3,0.4,0.5,0.6', // k1,k2,k3,k4,k5,k6
      '0.7,0.8', // p1,p2
      '0.9,1.0,1.1,1.2', // s1..s4
      '1.3,1.4', // tauX,tauY
    ]);
    // k1,k2 then p1,p2 then k3..k6 then s1..s4 then tau — the OpenCV order.
    assert.deepStrictEqual(
      ordered,
      [0.1, 0.2, 0.7, 0.8, 0.3, 0.4, 0.5, 0.6, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4]
    );
  });

  test('the fisheye groups are contiguous', () => {
    const ordered = coefficientsFromGroups('fisheye624', ['1,2,3,4,5,6', '7,8', '9,10,11,12']);
    assert.deepStrictEqual(ordered, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  test('a partly filled box leaves the rest of its family at zero', () => {
    // The whole point: a calibration giving two radial terms is two numbers.
    assert.deepStrictEqual(
      coefficientsFromGroups('fisheye624', ['-0.05,0.01', '', '']),
      [-0.05, 0.01, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    );
    assert.deepStrictEqual(
      coefficientsFromGroups('pinhole-opencv', ['-0.28', '', '', '']),
      [-0.28, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    );
  });

  test('groups and ordered arrays round-trip', () => {
    for (const model of ['pinhole-opencv', 'fisheye624'] as const) {
      const groups =
        model === 'pinhole-opencv'
          ? ['0.1,0.2,0.3,0.4,0.5,0.6', '0.7,0.8', '0.9,1,1.1,1.2', '1.3,1.4']
          : ['1,2,3,4,5,6', '7,8', '9,10,11,12'];
      const ordered = coefficientsFromGroups(model, groups);
      assert.deepStrictEqual(
        coefficientsFromGroups(model, groupsFromCoefficients(model, ordered)),
        ordered,
        `${model} must survive the trip through its boxes`
      );
    }
  });

  test('trailing zeros are not shown back to the user', () => {
    // A box reading "-0.05" says as much as "-0.05,0,0,0,0,0" and is readable.
    assert.deepStrictEqual(
      groupsFromCoefficients('fisheye624', [-0.05, 0.01, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
      ['-0.05,0.01', '', '']
    );
  });
});

/**
 * The picker offers two general models, but calibration files name specific
 * ones — COLMAP, ZED, RealSense, TUM and the YAML parsers all emit
 * `pinhole-ideal`, `pinhole-opencv` or `fisheye-opencv`, and settings saved
 * before the consolidation carry those names too. Each has to land on an
 * offered model with its coefficients in the slots that model expects; a name
 * the picker does not carry leaves the select blank instead.
 */
suite('Compatibility with calibration files and saved settings', () => {
  test('every model a calibration parser emits maps onto an offered one', () => {
    const offered = ['pinhole-opencv', 'fisheye624'];
    for (const model of [
      'pinhole-ideal',
      'pinhole-opencv',
      'fisheye-ideal' as any,
      'fisheye-equidistant',
      'fisheye-opencv',
      'fisheye-kb3',
      'fisheye624',
    ] as const) {
      if (model === ('fisheye-ideal' as any)) {
        continue; // not a model this codebase has
      }
      const mapped = normalizeToOfferedCameraModel(model as any, []);
      assert.ok(
        offered.includes(mapped.model),
        `${model} mapped to ${mapped.model}, which the picker does not offer`
      );
    }
  });

  test('an OpenCV fisheye calibration keeps its four k values in the first four slots', () => {
    const mapped = normalizeToOfferedCameraModel(
      'fisheye-opencv',
      [-0.02, 0.001, -0.0004, 0.00001]
    );
    assert.strictEqual(mapped.model, 'fisheye624');
    assert.strictEqual(mapped.coefficients.length, 12);
    assert.deepStrictEqual(mapped.coefficients.slice(0, 4), [-0.02, 0.001, -0.0004, 0.00001]);
    assert.deepStrictEqual(mapped.coefficients.slice(4), new Array(8).fill(0));

    // And the mapped configuration still resolves to the cheap model, because
    // only the first four radial terms are set.
    assert.strictEqual(
      resolveCameraModel({ cameraModel: mapped.model, fx: 500, coefficients: mapped.coefficients })
        .model,
      'fisheye-kb3'
    );
  });

  test('an OpenCV pinhole calibration keeps its layout', () => {
    const five = [-0.28, 0.07, 0.001, 0.002, -0.01];
    const mapped = normalizeToOfferedCameraModel('pinhole-opencv', five);
    assert.strictEqual(mapped.model, 'pinhole-opencv');
    assert.strictEqual(mapped.coefficients.length, 14);
    assert.deepStrictEqual(mapped.coefficients.slice(0, 5), five);
  });

  test('a mapped calibration survives the trip through the panel boxes', () => {
    // What the user sees after loading a calibration must be what the kernel
    // then gets: file -> offered model -> grouped boxes -> ordered array.
    const mapped = normalizeToOfferedCameraModel('fisheye-opencv', [-0.02, 0.001, 0, 0]);
    const boxes = groupsFromCoefficients(mapped.model, mapped.coefficients);
    assert.deepStrictEqual(boxes, ['-0.02,0.001', '', '']);
    assert.deepStrictEqual(
      coefficientsFromGroups(mapped.model, boxes),
      mapped.coefficients,
      'the boxes must reassemble exactly what the calibration gave'
    );
  });

  test('an ideal pinhole from a calibration becomes a zero-distortion pinhole', () => {
    const mapped = normalizeToOfferedCameraModel('pinhole-ideal', []);
    assert.strictEqual(mapped.model, 'pinhole-opencv');
    assert.deepStrictEqual(mapped.coefficients, new Array(14).fill(0));
    // ...which resolves straight back to the ideal pinhole for the kernel.
    assert.strictEqual(
      resolveCameraModel({ cameraModel: mapped.model, fx: 500, coefficients: mapped.coefficients })
        .model,
      'pinhole-ideal'
    );
  });
});
