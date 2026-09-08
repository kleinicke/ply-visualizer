import { test } from 'node:test';
import assert from 'node:assert/strict';
import { routeDocument, matchesFilter, orderedSources, textPreview } from '../src/documents.ts';
test('routes visual formats and keeps JSON/text out of automatic pose import', () => {
  assert.deepEqual(routeDocument('cloud.PLY'), ['scene']);
  for (const name of ['image.fits', 'scan.dcm', 'layers.psd'])
    assert.deepEqual(routeDocument(name), ['image']);
  assert.deepEqual(routeDocument('depth.tiff'), ['image', 'scene']);
  assert.deepEqual(routeDocument('notes.json'), ['text']);
  assert.deepEqual(routeDocument('movie.mp4'), ['video']);
});
test('file filters are literal except glob stars and question marks; sequences use numeric ordering', () => {
  assert.equal(matchesFilter('scan2.ply', 'scan?.ply'), true);
  assert.equal(matchesFilter('scan22.ply', 'scan?.ply'), false);
  assert.equal(matchesFilter('a[2].tif', 'a[2].*'), true);
  assert.deepEqual(
    orderedSources([{ name: 'frame10.ply' }, { name: 'frame2.ply' }]).map(f => f.name),
    ['frame2.ply', 'frame10.ply']
  );
});
test('text preview rejects binary and bounds displayed text', () => {
  assert.throws(() => textPreview(new Uint8Array([65, 0, 66])), /Binary/);
  assert.match(textPreview(new TextEncoder().encode('<script>literal</script>')), /^<script>/);
  assert.match(textPreview(new Uint8Array(2 * 1024 * 1024 + 1).fill(65)), /limited to 2 MiB/);
});
