import { expect, Page, test } from '@playwright/test';

async function prepareCamera(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as any).visualizer?.controls));
  await page.evaluate(() => {
    const viewer: any = (window as any).visualizer;
    viewer.controls.target.set(0, 0, 0);
    viewer.camera.position.set(3, 0, 0);
    viewer.camera.up.set(0, 1, 0);
    viewer.camera.lookAt(0, 0, 0);
    viewer.controls.update();
  });
}

async function cameraState(page: Page) {
  return page.evaluate(() => {
    const viewer: any = (window as any).visualizer;
    return {
      position: viewer.camera.position.toArray() as number[],
      target: viewer.controls.target.toArray() as number[],
      up: viewer.camera.up.toArray() as number[],
      distance: viewer.camera.position.distanceTo(viewer.controls.target) as number,
    };
  });
}

async function dispatchTouches(
  page: Page,
  type: 'touchstart' | 'touchmove' | 'touchend',
  points: Array<{ id: number; x: number; y: number }>
): Promise<void> {
  await page.evaluate(
    ({ type, points }) => {
      const canvas = document.getElementById('three-canvas')!;
      const touches = points.map(
        point =>
          new Touch({
            identifier: point.id,
            target: canvas,
            clientX: point.x,
            clientY: point.y,
          })
      );
      canvas.dispatchEvent(
        new TouchEvent(type, {
          bubbles: true,
          cancelable: true,
          touches,
          targetTouches: touches,
          changedTouches: touches,
        })
      );
    },
    { type, points }
  );
}

test('one finger orbits with fixed up independently of Legacy Trackball', async ({ page }) => {
  await prepareCamera(page);
  const canvas = (await page.locator('#three-canvas').boundingBox())!;
  const cx = canvas.x + canvas.width * 0.35;
  const cy = canvas.y + canvas.height * 0.55;
  const before = await cameraState(page);
  await dispatchTouches(page, 'touchstart', [{ id: 1, x: cx, y: cy }]);
  await dispatchTouches(page, 'touchmove', [{ id: 1, x: cx + 100, y: cy - 50 }]);
  await dispatchTouches(page, 'touchend', []);
  const after = await cameraState(page);
  expect(after.target).toEqual(before.target);
  expect(after.position).not.toEqual(before.position);
  expect(after.up[0]).toBeCloseTo(0, 6);
  expect(after.up[1]).toBeCloseTo(1, 6);
  expect(after.up[2]).toBeCloseTo(0, 6);
});

test('two-finger pinch zooms without applying one-finger orbit', async ({ page }) => {
  await prepareCamera(page);
  const canvas = (await page.locator('#three-canvas').boundingBox())!;
  const cx = canvas.x + canvas.width * 0.35;
  const cy = canvas.y + canvas.height * 0.55;
  const before = await cameraState(page);
  await dispatchTouches(page, 'touchstart', [
    { id: 1, x: cx - 50, y: cy },
    { id: 2, x: cx + 50, y: cy },
  ]);
  await dispatchTouches(page, 'touchmove', [
    { id: 1, x: cx - 70, y: cy - 40 },
    { id: 2, x: cx + 150, y: cy - 40 },
  ]);
  const after = await cameraState(page);
  expect(after.distance).toBeLessThan(before.distance * 0.6);
  expect(after.target).toEqual(before.target);
  expect(after.up).toEqual(before.up);
  for (let index = 0; index < 3; index++) {
    expect(after.position[index] / after.distance).toBeCloseTo(
      before.position[index] / before.distance,
      6
    );
  }
  await dispatchTouches(page, 'touchend', []);
  await expect
    .poll(() => page.evaluate(() => (window as any).visualizer.controls.enabled))
    .toBe(true);
});

test('two-finger twist rolls and changes the up direction', async ({ page }) => {
  await prepareCamera(page);
  const canvas = (await page.locator('#three-canvas').boundingBox())!;
  const cx = canvas.x + canvas.width * 0.35;
  const cy = canvas.y + canvas.height * 0.55;
  const before = await cameraState(page);

  await dispatchTouches(page, 'touchstart', [
    { id: 1, x: cx - 60, y: cy },
    { id: 2, x: cx + 60, y: cy },
  ]);
  await dispatchTouches(page, 'touchmove', [
    { id: 1, x: cx, y: cy - 60 },
    { id: 2, x: cx, y: cy + 60 },
  ]);
  await dispatchTouches(page, 'touchend', []);

  const after = await cameraState(page);
  expect(after.position).toEqual(before.position);
  expect(after.distance).toBeCloseTo(before.distance, 6);
  expect(after.up).not.toEqual(before.up);
  expect(after.target).toEqual(before.target);
});

test('translating two fingers together does not perform one-finger orbit', async ({ page }) => {
  await prepareCamera(page);
  const canvas = (await page.locator('#three-canvas').boundingBox())!;
  const cx = canvas.x + canvas.width * 0.35;
  const cy = canvas.y + canvas.height * 0.55;
  const before = await cameraState(page);

  await dispatchTouches(page, 'touchstart', [
    { id: 1, x: cx - 60, y: cy },
    { id: 2, x: cx + 60, y: cy },
  ]);
  await dispatchTouches(page, 'touchmove', [
    { id: 1, x: cx + 40, y: cy - 80 },
    { id: 2, x: cx + 160, y: cy - 80 },
  ]);
  await dispatchTouches(page, 'touchend', []);

  expect(await cameraState(page)).toEqual(before);
});

test('one finger preserves the up direction chosen by a preceding twist', async ({ page }) => {
  await prepareCamera(page);
  const canvas = (await page.locator('#three-canvas').boundingBox())!;
  const cx = canvas.x + canvas.width * 0.35;
  const cy = canvas.y + canvas.height * 0.55;

  await dispatchTouches(page, 'touchstart', [
    { id: 1, x: cx - 60, y: cy },
    { id: 2, x: cx + 60, y: cy },
  ]);
  await dispatchTouches(page, 'touchmove', [
    { id: 1, x: cx, y: cy - 60 },
    { id: 2, x: cx, y: cy + 60 },
  ]);
  await dispatchTouches(page, 'touchend', [{ id: 1, x: cx, y: cy - 60 }]);
  const afterTwist = await cameraState(page);

  await dispatchTouches(page, 'touchmove', [{ id: 1, x: cx + 80, y: cy - 90 }]);
  await dispatchTouches(page, 'touchend', []);
  const afterOrbit = await cameraState(page);

  expect(afterTwist.up).not.toEqual([0, 1, 0]);
  for (let index = 0; index < 3; index++) {
    expect(afterOrbit.up[index]).toBeCloseTo(afterTwist.up[index], 6);
  }
});

test('Legacy Trackball pointer input is replaced by stable-up touch zoom and orbit', async ({
  page,
}) => {
  await prepareCamera(page);
  const canvas = (await page.locator('#three-canvas').boundingBox())!;
  const cx = canvas.x + canvas.width * 0.35;
  const cy = canvas.y + canvas.height * 0.55;
  const before = await cameraState(page);

  const dispatchPointer = async (
    type: 'pointerdown' | 'pointermove' | 'pointerup',
    id: number,
    x: number,
    y: number
  ) => {
    await page.evaluate(
      ({ type, id, x, y }) => {
        document.getElementById('three-canvas')!.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            pointerId: id,
            pointerType: 'touch',
            clientX: x,
            clientY: y,
          })
        );
      },
      { type, id, x, y }
    );
  };

  await dispatchPointer('pointerdown', 11, cx - 50, cy);
  await dispatchPointer('pointerdown', 12, cx + 50, cy);
  await dispatchPointer('pointermove', 11, cx - 100, cy - 20);
  await dispatchPointer('pointermove', 12, cx + 140, cy - 20);
  await page.waitForTimeout(100);

  const during = await cameraState(page);
  expect(during.distance).toBeLessThan(before.distance * 0.7);
  expect(during.target).toEqual(before.target);

  await dispatchPointer('pointerup', 11, cx - 100, cy - 20);
  await dispatchPointer('pointerup', 12, cx + 140, cy - 20);
  await expect
    .poll(() => page.evaluate(() => (window as any).visualizer.controls.enabled))
    .toBe(true);
});

test('one-finger double-tap uses the desktop rotation-center picking path', async ({ page }) => {
  await prepareCamera(page);
  const canvas = (await page.locator('#three-canvas').boundingBox())!;
  const x = canvas.x + canvas.width * 0.35;
  const y = canvas.y + canvas.height * 0.55;

  await page.evaluate(() => {
    const viewer: any = (window as any).visualizer;
    const selectedPoint = viewer.controls.target.clone().set(1, 2, 3);
    viewer.selectionManager.updateContext = () => {};
    viewer.selectionManager.selectPointWithLoggingAsync = async () => ({
      point: selectedPoint,
      info: 'touch-test point',
    });
  });

  await dispatchTouches(page, 'touchstart', [{ id: 1, x, y }]);
  await dispatchTouches(page, 'touchend', []);
  await expect
    .poll(() => page.evaluate(() => (window as any).visualizer.controls.target.toArray()))
    .toEqual([0, 0, 0]);

  await dispatchTouches(page, 'touchstart', [{ id: 2, x: x + 2, y: y + 2 }]);
  await dispatchTouches(page, 'touchend', []);
  await expect
    .poll(() => page.evaluate(() => (window as any).visualizer.controls.target.toArray()))
    .toEqual([1, 2, 3]);
});

test('measurement mode turns a touch double-tap into a measurement pick', async ({ page }) => {
  await prepareCamera(page);
  const canvas = (await page.locator('#three-canvas').boundingBox())!;
  const x = canvas.x + canvas.width * 0.35;
  const y = canvas.y + canvas.height * 0.55;

  await page.evaluate(() => {
    const viewer: any = (window as any).visualizer;
    const selectedPoint = viewer.controls.target.clone().set(1, 2, 3);
    viewer.selectionManager.updateContext = () => {};
    viewer.selectionManager.selectPointWithLoggingAsync = async () => ({
      point: selectedPoint,
      info: 'touch-measurement point',
    });
    viewer.measurementManager.togglePickMode();
  });

  await dispatchTouches(page, 'touchstart', [{ id: 1, x, y }]);
  await dispatchTouches(page, 'touchend', []);
  await dispatchTouches(page, 'touchstart', [{ id: 2, x: x + 2, y: y + 2 }]);
  await dispatchTouches(page, 'touchend', []);

  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as any).visualizer.measurementManager
          .getPathPoints()
          .map((point: any) => point.toArray())
      )
    )
    .toEqual([
      [0, 0, 0],
      [1, 2, 3],
    ]);
  expect(await cameraState(page)).toMatchObject({ target: [0, 0, 0] });
});

test('rotation-center feedback always contains only the latest red marker', async ({ page }) => {
  await prepareCamera(page);

  const feedback = await page.evaluate(() => {
    const viewer: any = (window as any).visualizer;
    viewer.setRotationCenter(viewer.controls.target.clone().set(1, 2, 3));
    viewer.setRotationCenter(viewer.controls.target.clone().set(4, 5, 6));

    const markers = viewer.scene.children.filter(
      (child: any) => child.name === 'rotation-center-feedback'
    );
    return {
      count: markers.length,
      position: markers[0]?.position.toArray(),
    };
  });

  expect(feedback).toEqual({ count: 1, position: [4, 5, 6] });
});
