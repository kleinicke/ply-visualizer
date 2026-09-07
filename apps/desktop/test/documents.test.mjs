import { test } from 'node:test';
import assert from 'node:assert/strict';
import { routeDocument, providers } from '../src/documents.ts';

test('routes geometry directly to 3D, images to 2D, and depth-capable files to image first', () => {
  for (const name of ['cloud.PLY', 'mesh.glb', 'scan.laz'])
    assert.deepEqual(routeDocument(name), ['scene']);
  for (const name of ['photo.jpg', 'photo.webp']) assert.deepEqual(routeDocument(name), ['image']);
  for (const name of ['depth.tiff', 'depth.npy', 'depth.pfm', 'photo.png'])
    assert.deepEqual(routeDocument(name), ['image', 'scene']);
  assert.throws(() => routeDocument('notes.txt'), /Unsupported/);
});
test('an additional image provider extends routing without modifying the host', () => {
  providers.unshift({
    id: 'future-scientific-images',
    views: name => (name.endsWith('.fits') ? ['image'] : null),
  });
  try {
    assert.deepEqual(routeDocument('sky.fits'), ['image']);
  } finally {
    providers.shift();
  }
});
