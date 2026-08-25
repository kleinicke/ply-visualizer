# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: engine/test/touch-navigation.spec.ts >> one finger preserves the up
  direction chosen by a preceding twist
- Location: engine/test/touch-navigation.spec.ts:152:5

# Error details

```
Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
  - navigating to "/", waiting until "load"

```

# Test source

```ts
  1   | import { expect, Page, test } from '@playwright/test';
  2   |
  3   | async function prepareCamera(page: Page): Promise<void> {
> 4   |   await page.goto('/');
      |              ^ Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
  5   |   await page.waitForFunction(() => Boolean((window as any).visualizer?.controls));
  6   |   await page.evaluate(() => {
  7   |     const viewer: any = (window as any).visualizer;
  8   |     viewer.controls.target.set(0, 0, 0);
  9   |     viewer.camera.position.set(3, 0, 0);
  10  |     viewer.camera.up.set(0, 1, 0);
  11  |     viewer.camera.lookAt(0, 0, 0);
  12  |     viewer.controls.update();
  13  |   });
  14  | }
  15  |
  16  | async function cameraState(page: Page) {
  17  |   return page.evaluate(() => {
  18  |     const viewer: any = (window as any).visualizer;
  19  |     return {
  20  |       position: viewer.camera.position.toArray() as number[],
  21  |       target: viewer.controls.target.toArray() as number[],
  22  |       up: viewer.camera.up.toArray() as number[],
  23  |       distance: viewer.camera.position.distanceTo(viewer.controls.target) as number,
  24  |     };
  25  |   });
  26  | }
  27  |
  28  | async function dispatchTouches(
  29  |   page: Page,
  30  |   type: 'touchstart' | 'touchmove' | 'touchend',
  31  |   points: Array<{ id: number; x: number; y: number }>
  32  | ): Promise<void> {
  33  |   await page.evaluate(
  34  |     ({ type, points }) => {
  35  |       const canvas = document.getElementById('three-canvas')!;
  36  |       const touches = points.map(
  37  |         point =>
  38  |           new Touch({
  39  |             identifier: point.id,
  40  |             target: canvas,
  41  |             clientX: point.x,
  42  |             clientY: point.y,
  43  |           })
  44  |       );
  45  |       canvas.dispatchEvent(
  46  |         new TouchEvent(type, {
  47  |           bubbles: true,
  48  |           cancelable: true,
  49  |           touches,
  50  |           targetTouches: touches,
  51  |           changedTouches: touches,
  52  |         })
  53  |       );
  54  |     },
  55  |     { type, points }
  56  |   );
  57  | }
  58  |
  59  | test('one finger orbits with fixed up independently of Legacy Trackball', async ({ page }) => {
  60  |   await prepareCamera(page);
  61  |   const canvas = (await page.locator('#three-canvas').boundingBox())!;
  62  |   const cx = canvas.x + canvas.width * 0.35;
  63  |   const cy = canvas.y + canvas.height * 0.55;
  64  |   const before = await cameraState(page);
  65  |   await dispatchTouches(page, 'touchstart', [{ id: 1, x: cx, y: cy }]);
  66  |   await dispatchTouches(page, 'touchmove', [{ id: 1, x: cx + 100, y: cy - 50 }]);
  67  |   await dispatchTouches(page, 'touchend', []);
  68  |   const after = await cameraState(page);
  69  |   expect(after.target).toEqual(before.target);
  70  |   expect(after.position).not.toEqual(before.position);
  71  |   expect(after.up[0]).toBeCloseTo(0, 6);
  72  |   expect(after.up[1]).toBeCloseTo(1, 6);
  73  |   expect(after.up[2]).toBeCloseTo(0, 6);
  74  | });
  75  |
  76  | test('two-finger pinch zooms without applying one-finger orbit', async ({ page }) => {
  77  |   await prepareCamera(page);
  78  |   const canvas = (await page.locator('#three-canvas').boundingBox())!;
  79  |   const cx = canvas.x + canvas.width * 0.35;
  80  |   const cy = canvas.y + canvas.height * 0.55;
  81  |   const before = await cameraState(page);
  82  |   await dispatchTouches(page, 'touchstart', [
  83  |     { id: 1, x: cx - 50, y: cy },
  84  |     { id: 2, x: cx + 50, y: cy },
  85  |   ]);
  86  |   await dispatchTouches(page, 'touchmove', [
  87  |     { id: 1, x: cx - 70, y: cy - 40 },
  88  |     { id: 2, x: cx + 150, y: cy - 40 },
  89  |   ]);
  90  |   const after = await cameraState(page);
  91  |   expect(after.distance).toBeLessThan(before.distance * 0.6);
  92  |   expect(after.target).toEqual(before.target);
  93  |   expect(after.up).toEqual(before.up);
  94  |   for (let index = 0; index < 3; index++) {
  95  |     expect(after.position[index] / after.distance).toBeCloseTo(
  96  |       before.position[index] / before.distance,
  97  |       6
  98  |     );
  99  |   }
  100 |   await dispatchTouches(page, 'touchend', []);
  101 |   await expect
  102 |     .poll(() => page.evaluate(() => (window as any).visualizer.controls.enabled))
  103 |     .toBe(true);
  104 | });
```
