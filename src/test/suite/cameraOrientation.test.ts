import * as assert from 'assert';
import {
  shouldApplySavedViewConvention,
  shouldOrientZUp,
} from '../../../engine/src/cameraOrientation';

suite('Camera orientation policy', () => {
  test('treats X3A, X3R, and E57 as format-defined Z-up scenes', () => {
    const scenes = [
      [{ fileName: 'survey.x3a' }],
      [{ fileName: 'embedded-station.x3r' }],
      [{ fileName: 'scan without extension', metadata: { format: 'E57' } }],
    ];

    for (const files of scenes) {
      assert.strictEqual(shouldOrientZUp(files), true);
      assert.strictEqual(shouldApplySavedViewConvention(files), false);
    }
  });

  test('allows a saved convention before loading and for formats without a defined up axis', () => {
    assert.strictEqual(shouldApplySavedViewConvention([]), true);
    assert.strictEqual(shouldApplySavedViewConvention([{ fileName: 'model.ply' }]), true);
  });

  test('recognizes split container scan names', () => {
    const files = [{ fileName: 'site.x3a — scan 1' }, { fileName: 'second.ply' }];

    assert.strictEqual(shouldApplySavedViewConvention(files), false);
  });
});
