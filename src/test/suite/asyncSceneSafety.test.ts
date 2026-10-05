import * as assert from 'assert';
import { BufferAttribute, BufferGeometry, Points } from 'three';
import { FileEntryRegistry } from '../../../engine/src/state/fileEntries';
import { snapshotRegistrationScene } from '../../../engine/src/registration/sceneSnapshot';
import { estimateSequenceBytes } from '../../../engine/src/sequenceMemory';
import type { SpatialData } from '../../../engine/src/interfaces';

function add(entries: FileEntryRegistry) {
  const entry = entries.prepare('spatial');
  const positionsArray = new Float32Array(12);
  const data: SpatialData = {
    positionsArray,
    vertices: [],
    faces: [],
    vertexCount: 4,
    faceCount: 0,
    format: 'ascii',
    version: '1',
    comments: [],
    hasColors: false,
    hasNormals: false,
  };
  const geometry = new BufferGeometry().setAttribute(
    'position',
    new BufferAttribute(positionsArray, 3)
  );
  entry.spatial = { data, object: new Points(geometry) };
  entries.commit(entry);
  return entry;
}

suite('Async scene safety', () => {
  test('registration rejects removals, replacement geometry and edited transforms', () => {
    for (const change of ['earlier', 'source', 'replace', 'transform', 'depth', 'clear']) {
      const entries = new FileEntryRegistry();
      add(entries);
      const source = add(entries);
      const snapshot = snapshotRegistrationScene(entries);
      assert.ok(snapshot.isCurrent());
      if (change === 'earlier') {
        entries.removeAt(0);
      }
      if (change === 'source') {
        entries.removeAt(1);
      }
      if (change === 'replace') {
        source.spatial = { ...source.spatial! };
      }
      if (change === 'transform') {
        source.transform.makeTranslation(2, 0, 0);
      }
      if (change === 'depth') {
        source.cancelDepthWork();
      }
      if (change === 'clear') {
        entries.clear();
      }
      assert.strictEqual(snapshot.isCurrent(), false, change);
    }
  });

  test('accepted alignment transforms do not invalidate the next solve', () => {
    const entries = new FileEntryRegistry();
    const source = add(entries);
    const snapshot = snapshotRegistrationScene(entries);
    source.transform.makeTranslation(2, 0, 0);
    snapshot.acceptTransform(0);
    assert.ok(snapshot.isCurrent());
    source.transform.makeTranslation(3, 0, 0);
    assert.strictEqual(snapshot.isCurrent(), false);
  });

  test('memory estimate counts shared CPU storage once and GPU attributes separately', () => {
    const entries = new FileEntryRegistry();
    const entry = add(entries);
    const bytes = entry.spatial!.data.positionsArray!.byteLength;
    entry.spatial!.data.scalarFields = {
      alias: entry.spatial!.data.positionsArray!.subarray(0, 4),
    };
    assert.strictEqual(estimateSequenceBytes([entry]), bytes * 2);
    const second = entries.prepare('spatial');
    second.spatial = entry.spatial;
    assert.strictEqual(estimateSequenceBytes([entry, second]), bytes * 2);
    add(entries);
    assert.strictEqual(estimateSequenceBytes(entries.all), bytes * 4);
  });
});
