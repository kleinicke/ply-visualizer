import * as THREE from 'three';
import type { SpatialData } from '../../../engine/src/interfaces';
import {
  handlePointData,
  type FormatDataHandlersHost,
} from '../../../engine/src/formatDataHandlers';
import * as assert from 'assert';
import { FileEntryRegistry } from '../../../engine/src/state/fileEntries';
import { convertToUnifiedFormat, decodesInViewer } from '../../../engine/src/fileHandler';
import { decodeFileMessage, readFileDataMessage } from '../../../engine/src/formats/fileMessage';

suite('File entry ownership and decoding contracts', () => {
  test('state, transform and pending work follow identity across insertions and removal', () => {
    const entries = new FileEntryRegistry();
    const camera = entries.add('camera').entry;
    camera.state.visible = false;
    camera.state.pointSize = 7;
    camera.transform.makeTranslation(1, 2, 3);
    camera.depthUpdate.version = 4;
    const cloud = entries.add('spatial').entry;
    assert.strictEqual(entries.indexOf(camera.id), 1);
    entries.removeAt(entries.indexOf(cloud.id));
    assert.strictEqual(entries.require(0), camera);
    assert.strictEqual(camera.state.visible, false);
    assert.strictEqual(camera.state.pointSize, 7);
    assert.deepStrictEqual(camera.transform.elements.slice(12, 15), [1, 2, 3]);
    assert.strictEqual(camera.depthUpdate.version, 4);
    entries.removeAt(0);
    assert.strictEqual(entries.get(camera.id), undefined);
    assert.strictEqual(camera.depthUpdate.version, 5);
    assert.notStrictEqual(entries.add('camera').entry.id, camera.id);
  });

  test('entry defaults are independent and descendants are removed together', () => {
    const entries = new FileEntryRegistry();
    const parent = entries.add('spatial').entry;
    const child = entries.add('camera', parent.id).entry;
    entries.add('camera', child.id);
    child.state.colorMode = 'original';
    assert.strictEqual(parent.state.colorMode, 'assigned');
    assert.strictEqual(entries.removeAt(0).length, 3);
    assert.strictEqual(entries.length, 0);
    assert.throws(() => entries.require(0), RangeError);
  });

  test('normalization preserves mesh indices, source origin and scalar buffers without copies', () => {
    const positionsArray = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    const indicesArray = new Uint32Array([0, 1, 2]);
    const sourceOrigin = [100, 200, 300];
    const metadata = { source: 'test' };
    const data = convertToUnifiedFormat(
      {
        positionsArray,
        indicesArray,
        sourceOrigin,
        metadata,
        vertexCount: 3,
        useTypedArrays: true,
        hasColors: false,
        hasNormals: false,
      },
      'mesh.ply'
    );
    assert.strictEqual(data.positionsArray, positionsArray);
    assert.strictEqual(data.indicesArray, indicesArray);
    assert.strictEqual(data.sourceOrigin, sourceOrigin);
    assert.strictEqual(data.metadata, metadata);
    assert.strictEqual(data.faceCount, 1);
  });

  test('loading never builds a normals visualizer, even when another load finishes first', async () => {
    // Normals start hidden and are built on first toggle, for the entry that
    // was toggled; building them during a load cost two extra vertices per
    // point and could attach them to whichever entry finished last.
    const fileEntries = new FileEntryRegistry();
    const spatialFiles: SpatialData[] = [];
    let built = 0;
    const host = {
      fileEntries,
      spatialFiles,
      scene: new THREE.Scene(),
      createNormalsVisualizer: () => {
        built++;
        return new THREE.LineSegments();
      },
      showStatus() {},
      async displayFiles(files: SpatialData[]) {
        files[0].fileIndex = 0;
        spatialFiles.push(files[0], { ...files[0], fileIndex: 1 });
        fileEntries.add('spatial');
        fileEntries.add('spatial');
      },
    } as unknown as FormatDataHandlersHost;
    await handlePointData(host, {
      type: 'npyData',
      fileName: 'normals.npy',
      data: {
        vertices: [],
        faces: [],
        format: 'ascii',
        version: '1.0',
        comments: [],
        vertexCount: 1,
        faceCount: 0,
        hasColors: false,
        hasNormals: true,
        positionsArray: new Float32Array([1, 2, 3]),
        normalsArray: new Float32Array([0, 0, 1]),
      },
    });
    assert.strictEqual(built, 0);
    assert.strictEqual(fileEntries.require(0).resources.normals, null);
    assert.strictEqual(fileEntries.require(1).resources.normals, null);
  });

  test('raw-file boundary rejects malformed payloads before parsing', () => {
    for (const data of [
      null,
      'text',
      [],
      {},
      { type: 'fileData', fileName: 'a.off', data: [] },
      { type: 'fileData', fileName: 'a.off', data: new Uint8Array(), isAddFile: 'yes' },
    ]) {
      assert.throws(() => readFileDataMessage(data), /Invalid file message/);
    }
  });

  test('registered raw-file route decodes OFF and KITTI without host-specific branches', async () => {
    assert.strictEqual(decodesInViewer('scan.CSV'), true);
    // OFF decodes in the extension host now; the raw-file route still reads it.
    assert.strictEqual(decodesInViewer('model.off'), false);
    assert.strictEqual(decodesInViewer('points.bin'), true);
    assert.strictEqual(decodesInViewer('scan.ply'), false);
    const off = await decodeFileMessage({
      type: 'fileData',
      fileName: 'triangle.off',
      data: new TextEncoder().encode('OFF\n3 1 0\n0 0 0\n1 0 0\n0 1 0\n3 0 1 2\n'),
    });
    assert.strictEqual(off.vertexCount, 3);
    assert.strictEqual(off.faceCount, 1);
    const bin = await decodeFileMessage({
      type: 'fileData',
      fileName: 'scan.bin',
      data: new Uint8Array(new Float32Array([1, 2, 3, 0.5]).buffer),
    });
    assert.deepStrictEqual(Array.from(bin.positionsArray!), [1, 2, 3]);
    assert.deepStrictEqual(Array.from(bin.intensityArray!), [0.5]);
  });
});
