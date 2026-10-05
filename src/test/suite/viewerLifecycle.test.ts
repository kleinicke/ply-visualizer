import { parseXyzWasm, toPointCloudPayload } from '../../../engine/src/parsers/pointcloudWasm';
import { replaceSpatialGeometry } from '../../../engine/src/visualization/replaceSpatialGeometry';
import { convertToUnifiedFormat } from '../../../engine/src/fileHandler';
import { WebGLGpuTimer } from '../../../engine/src/rendering/gpuTimer';
import { validateSpatialData } from '../../../engine/src/visualization/validateSpatialData';
import { ViewerLifetime } from '../../../engine/src/utils/viewerLifetime';
import {
  removeColorImageFromDepth,
  type ColorImageForDepthHost,
} from '../../../engine/src/depth/colorImageForDepth';
import * as assert from 'assert';
import * as THREE from 'three';
import { FileEntryRegistry } from '../../../engine/src/state/fileEntries';
import { buildFileObject, disposeObjects } from '../../../engine/src/visualization/fileObject';
import {
  depthParams,
  resetFormDefaults,
  type DepthForm,
} from '../../../engine/src/depth/panelState';
import { readViewerMessage, readHostMessage } from '../../../engine/src/hosts/viewerProtocol';
import { registerWebviewTransport, sendToWebview } from '../../providerHandlers/webviewTransport';
import { createWebviewReadyGate } from '../../providerHandlers/webviewReadyGate';
import type { SpatialData } from '../../../engine/src/interfaces';
import type * as vscode from 'vscode';

const data = (): SpatialData => ({
  vertices: [{ x: 0, y: 0, z: 0 }],
  faces: [],
  vertexCount: 1,
  faceCount: 0,
  format: 'ascii',
  version: '1.0',
  comments: [],
  hasColors: false,
  hasNormals: false,
});
suite('Viewer lifecycle and boundaries', () => {
  test('failed construction disposes allocated geometry without publishing an entry', () => {
    let notifications = 0,
      disposed = 0;
    const registry = new FileEntryRegistry(undefined, () => notifications++);
    const entry = registry.prepare('spatial');
    const geometry = new THREE.BufferGeometry();
    geometry.addEventListener('dispose', () => disposed++);
    assert.throws(
      () =>
        buildFileObject(
          {
            allowTransparency: false,
            createGeometryFromSpatialData: () => geometry,
            createMaterialForFile: () => {
              throw new Error('Simulated allocation failure');
            },
          },
          data(),
          0,
          entry
        ),
      /allocation failure/
    );
    assert.strictEqual(disposed, 1);
    assert.strictEqual(registry.length, 0);
    assert.strictEqual(notifications, 0);
    registry.commit(registry.prepare('spatial'));
    assert.strictEqual(notifications, 1);
  });
  test('removal disposes shared resources once even when auxiliary roots overlap', () => {
    const geometry = new THREE.BufferGeometry(),
      material = new THREE.MeshBasicMaterial();
    const texture = new THREE.Texture();
    material.map = texture;
    const disposed = [0, 0, 0];
    [geometry, material, texture].forEach((resource, index) =>
      resource.addEventListener('dispose', () => disposed[index]++)
    );
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(geometry, material);
    group.add(mesh, new THREE.Mesh(geometry, material));
    disposeObjects([group, mesh]);
    assert.deepStrictEqual(disposed, [1, 1, 1]);
  });
  test('depth parameters validate edits and resets retain the image principal point', () => {
    const form: DepthForm = {
      cameraModel: 'pinhole-opencv',
      depthType: 'orthogonal',
      fx: 100,
      cx: 4,
      cy: 5,
      coefficientGroups: ['0.1,0.2', '', ''],
    };
    assert.strictEqual(depthParams(form).coefficients?.[0], 0.1);
    form.fx = -2;
    assert.throws(() => depthParams(form), /positive/);
    resetFormDefaults(form, {
      cameraModel: 'fisheye-opencv',
      depthType: 'disparity',
      fx: 200,
      fy: 200,
      baseline: 50,
      coefficients: [1, 2, 3, 4],
    });
    assert.strictEqual(form.cameraModel, 'fisheye624');
    assert.strictEqual(form.fy, undefined);
    assert.deepStrictEqual([form.cx, form.cy], [4, 5]);
    assert.deepStrictEqual(depthParams(form).coefficients?.slice(0, 4), [1, 2, 3, 4]);
    form.coefficientGroups[0] = 'oops';
    assert.throws(() => depthParams(form), /coefficient/);
  });
  test('malformed messages fail at the boundary and unrelated messages are ignored', () => {
    for (const value of [
      null,
      1,
      {},
      { type: 'fileRemoved', fileIndex: -1 },
      { type: 'sequence:init', files: [1], wildcard: '*' },
      { type: 'colorImageData', fileIndex: 0, fileName: 'image', data: 'bad' },
    ]) {
      assert.throws(() => readViewerMessage(value));
    }
    assert.strictEqual(readViewerMessage({ type: 'unrelated-browser-message' }), null);
    assert.throws(() => readHostMessage({ type: 'removeFile', fileIndex: NaN }));
    assert.strictEqual(
      readHostMessage({ type: 'removeFile', fileIndex: 0, entryId: 42 })?.type,
      'removeFile'
    );
  });
  test('transport waits for readiness, stamps a copy, and leaves the API untouched', async () => {
    const sent: unknown[] = [];
    const postMessage = async (message: unknown) => {
      sent.push(message);
      return true;
    };
    const panel = { webview: { postMessage } } as unknown as vscode.WebviewPanel;
    const gate = createWebviewReadyGate();
    registerWebviewTransport(panel, gate, () => 123);
    const message = { type: 'fileData', fileName: 'a.off', data: new Uint8Array([1]) };
    const pending = sendToWebview(panel, message);
    await Promise.resolve();
    assert.strictEqual(sent.length, 0);
    gate.markReady();
    assert.strictEqual(await pending, true);
    assert.strictEqual(panel.webview.postMessage, postMessage);
    assert.ok(!('postedAt' in message));
    assert.strictEqual((sent[0] as { loadStartedAt: number }).loadStartedAt, 123);
    const closed = { webview: { postMessage } } as unknown as vscode.WebviewPanel;
    const closedGate = createWebviewReadyGate();
    registerWebviewTransport(closed, closedGate, () => 0);
    const undelivered = sendToWebview(closed, message);
    closedGate.dispose();
    assert.strictEqual(await undelivered, false);
    assert.strictEqual(sent.length, 1);
  });
  test('agent requests wait for the initial document load, without blocking resource replies', async () => {
    const sent: string[] = [];
    const panel = {
      webview: {
        postMessage: async (message: { type: string }) => {
          sent.push(message.type);
          return true;
        },
      },
    } as unknown as vscode.WebviewPanel;
    const ready = createWebviewReadyGate(),
      loading = createWebviewReadyGate();
    registerWebviewTransport(panel, ready, () => 0, loading);
    ready.markReady();
    const agent = sendToWebview(panel, { type: 'nativeAgentRequest' });
    await sendToWebview(panel, { type: 'modelResourceResult' });
    assert.deepStrictEqual(sent, ['modelResourceResult']);
    loading.markReady();
    await agent;
    assert.deepStrictEqual(sent, ['modelResourceResult', 'nativeAgentRequest']);
  });
  test('a color reprojection cannot write to an entry removed while it was running', async () => {
    const registry = new FileEntryRegistry();
    const entry = registry.add('spatial').entry;
    entry.spatial = {
      data: {
        ...data(),
        depthSource: {
          originalData: new ArrayBuffer(0),
          fileName: 'test.pfm',
          cameraParams: { fx: 1, cameraModel: 'pinhole-ideal', depthType: 'euclidean' },
          depthDimensions: { width: 1, height: 1 },
        },
      },
      object: new THREE.Points(),
    };
    let finish!: (result: never) => void;
    const pending = new Promise<never>(resolve => {
      finish = resolve;
    });
    let errors = 0;
    const host = {
      fileEntries: registry,
      processDepthToPointCloud: () => pending,
      showStatus: () => {},
      showError: () => {
        errors++;
      },
    } as unknown as ColorImageForDepthHost;
    const operation = removeColorImageFromDepth(host, 0);
    registry.removeAt(0);
    finish(null as never);
    await operation;
    assert.strictEqual(errors, 0);
    assert.strictEqual(registry.length, 0);
  });
});

suite('Decoded geometry validation', () => {
  test('point-only WASM readers omit an absent source-row map', async () => {
    const points = await parseXyzWasm(new TextEncoder().encode('0 0 0\n1 0 0\n'), 'xyz');
    assert.strictEqual(points.vertexCount, 2);
    assert.strictEqual(points.sourcePointIndices, undefined);
    for (const format of ['ascii', 'pts', 'binary', 'binary_compressed']) {
      validateSpatialData(
        convertToUnifiedFormat(toPointCloudPayload(points, format), 'points.xyz')
      );
    }
  });
  test('legacy OBJ and binary STL adapters produce valid shared geometry', () => {
    const obj = convertToUnifiedFormat(
      {
        vertices: data().vertices,
        faces: [],
        hasNormals: true,
        normals: [{ nx: 0, ny: 0, nz: 1 }],
        materialGroups: [],
      },
      'normals.obj'
    );
    assert.strictEqual(obj.hasNormals, false);
    validateSpatialData(obj);
    const stl = convertToUnifiedFormat(
      {
        format: 'binary',
        triangles: [
          {
            vertices: [
              { x: 0, y: 0, z: 0 },
              { x: 1, y: 0, z: 0 },
              { x: 0, y: 1, z: 0 },
            ],
            normal: { x: 0, y: 0, z: 1 },
          },
        ],
      },
      'triangle.stl'
    );
    assert.strictEqual(stl.format, 'binary_little_endian');
    validateSpatialData(stl);
  });
  test('rejects inconsistent buffers, attribute counts and out-of-range face indices', () => {
    const valid = (): SpatialData => ({
      ...data(),
      useTypedArrays: true,
      vertices: [],
      positionsArray: new Float32Array(3),
    });
    for (const [patch, expected] of [
      [{ vertexCount: -1 }, /vertexCount/],
      [{ positionsArray: new Float32Array(2) }, /positionsArray/],
      [{ colorsArray: new Uint8Array(4) }, /colorsArray/],
      [{ hasNormals: true }, /normalsArray/],
      [{ scalarFields: { score: new Float32Array(2) } }, /scalarFields.score/],
      [{ sourcePointIndices: new Uint32Array(2) }, /sourcePointIndices/],
      [{ faceCount: 1, indicesArray: new Uint32Array([0, 0, 1]) }, /face index/],
      [{ faceCount: 1, indicesArray: new Uint32Array([0, 0]) }, /indicesArray/],
      [{ faceCount: 1, faces: [{ indices: [0, 0, -1] }] }, /face index/],
    ] as const) {
      assert.throws(() => validateSpatialData({ ...valid(), ...patch }), expected);
    }
    assert.throws(() => validateSpatialData({ ...data(), vertexCount: 2 }), /vertices/);
    assert.throws(() => validateSpatialData({ ...data(), hasColors: true }), /red\/green\/blue/);
  });
  test('accepts empty geometry, polygon faces and intentional missing scalar values', () => {
    validateSpatialData({ ...data(), vertices: [], vertexCount: 0 });
    validateSpatialData({ ...data(), scalarFields: { distance: new Float32Array([NaN]) } });
    validateSpatialData({ ...data(), faceCount: 1, faces: [{ indices: [0, 0, 0, 0] }] });
  });
  test('native model summaries validate their actual scene geometry', () => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3)
    );
    geometry.setIndex([0, 1, 2]);
    const root = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
    const model = { root, dispose() {} };
    const native = { ...data(), faceCount: 1, sceneModel: model };
    validateSpatialData(native);
    geometry.setIndex([0, 1, 3]);
    assert.throws(() => validateSpatialData(native), /scene face index/);
    geometry.setIndex([0, 1, 2]);
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1], 3));
    assert.throws(() => validateSpatialData(native), /scene normal/);
    disposeObjects([root]);
  });
  test('message guards do not claim incomplete geometry is SpatialData', () => {
    assert.throws(
      () =>
        readViewerMessage({
          type: 'spatialData',
          data: { vertexCount: 1, faceCount: 0, vertices: [] },
        }),
      /Invalid geometry/
    );
  });
});

suite('Viewer lifetime ownership', () => {
  test('GPU timer disposal ends and releases pending queries exactly once', () => {
    let next = 0,
      ended = 0;
    const deleted: number[] = [];
    const timer = new WebGLGpuTimer({
      getExtension: () => ({ TIME_ELAPSED_EXT: 1 }),
      createQuery: () => ++next,
      beginQuery() {},
      endQuery: () => ended++,
      deleteQuery: (id: number) => deleted.push(id),
    } as unknown as WebGLRenderingContext);
    timer.begin();
    timer.end();
    timer.begin();
    timer.dispose();
    timer.dispose();
    assert.strictEqual(ended, 2);
    assert.deepStrictEqual(deleted, [1, 2]);
  });
  test('disposal removes callbacks and timers, and is idempotent', async () => {
    const target = new EventTarget();
    let calls = 0,
      cleanups = 0;
    const first = new ViewerLifetime();
    first.listen(target, 'click', () => calls++);
    first.defer(() => calls++);
    first.add(() => cleanups++);
    target.dispatchEvent(new Event('click'));
    first.dispose();
    first.dispose();
    const second = new ViewerLifetime();
    second.listen(target, 'click', () => calls++);
    target.dispatchEvent(new Event('click'));
    await new Promise(resolve => setTimeout(resolve, 5));
    assert.strictEqual(calls, 2);
    assert.strictEqual(cleanups, 1);
    second.dispose();
  });
  test('records and descendant ownership survive mixed-kind removal', () => {
    const registry = new FileEntryRegistry();
    const a = registry.add('spatial').entry;
    a.spatial = { data: data(), object: new THREE.Points() };
    const pose = registry.add('pose').entry;
    pose.pose!.meta.fileName = 'pose';
    pose.pose!.showLabels = true;
    const camera = registry.add('camera', a.id).entry;
    camera.camera!.name = 'owned camera';
    const b = registry.add('spatial').entry;
    b.spatial = { data: { ...data(), fileName: 'second' }, object: new THREE.Points() };
    const obsolete = a.beginDepthWork();
    const signal = a.beginDepthWork();
    assert.ok(obsolete.aborted);
    assert.ok(!signal.aborted);
    const removed = registry.removeAt(0);
    assert.ok(signal.aborted);
    assert.deepStrictEqual(
      removed.map(x => x.entry.id),
      [camera.id, a.id]
    );
    assert.strictEqual(registry.spatial(0), b.spatial);
    assert.strictEqual(registry.pose(0), pose.pose);
    assert.strictEqual(registry.pose(0).showLabels, true);
    assert.strictEqual(registry.pose(0).meta.fileName, 'pose');
    const replacement = new THREE.Points();
    registry.spatial(0).object = replacement;
    assert.strictEqual(b.spatial.object, replacement);
    const pending = b.beginDepthWork();
    registry.clear();
    assert.ok(pending.aborted);
  });
});

suite('Atomic geometry replacement', () => {
  for (const failAt of ['geometry', 'material', 'normals'] as const) {
    test(`a ${failAt} failure retains the old data, state and resources`, () => {
      const registry = new FileEntryRegistry();
      const entry = registry.add('spatial').entry;
      const scene = new THREE.Scene();
      const original = data();
      const object = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial());
      entry.spatial = { data: original, object };
      entry.state.normalsVisible = true;
      scene.add(object);
      let oldDisposed = 0,
        newDisposed = 0;
      object.geometry.addEventListener('dispose', () => oldDisposed++);
      const host = {
        scene,
        allowTransparency: false,
        createGeometryFromSpatialData: () => {
          if (failAt === 'geometry') {throw new Error('geometry failure');}
          const geometry = new THREE.BufferGeometry();
          geometry.addEventListener('dispose', () => newDisposed++);
          return geometry;
        },
        createMaterialForFile: () => {
          if (failAt === 'material') {throw new Error('material failure');}
          const material = new THREE.PointsMaterial();
          material.addEventListener('dispose', () => newDisposed++);
          return material;
        },
        createNormalsVisualizer: () => {
          throw new Error('normals failure');
        },
      };
      assert.throws(
        () =>
          replaceSpatialGeometry(host, entry, { ...data(), hasNormals: true }, 0, {
            colorMode: 'original',
          }),
        /failure/
      );
      assert.strictEqual(entry.spatial.data, original);
      assert.strictEqual(entry.spatial.object, object);
      assert.strictEqual(entry.state.colorMode, 'assigned');
      assert.strictEqual(object.parent, scene);
      assert.strictEqual(oldDisposed, 0);
      assert.strictEqual(newDisposed, failAt === 'geometry' ? 0 : failAt === 'material' ? 1 : 2);
      disposeObjects([object]);
    });
  }
  test('a successful replacement preserves the transform and visibility and releases the old object', () => {
    const entry = new FileEntryRegistry().add('spatial').entry;
    const scene = new THREE.Scene();
    const old = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial());
    entry.spatial = { data: data(), object: old };
    entry.state.visible = false;
    old.position.set(1, 2, 3);
    old.updateMatrix();
    scene.add(old);
    let disposed = 0;
    old.geometry.addEventListener('dispose', () => disposed++);
    const next = data();
    replaceSpatialGeometry(
      {
        scene,
        allowTransparency: false,
        createGeometryFromSpatialData: () => new THREE.BufferGeometry(),
        createMaterialForFile: () => new THREE.PointsMaterial(),
        createNormalsVisualizer: () => new THREE.LineSegments(),
      },
      entry,
      next,
      0
    );
    assert.strictEqual(entry.spatial.data, next);
    assert.deepStrictEqual(entry.spatial.object.matrix.elements, old.matrix.elements);
    assert.strictEqual(entry.spatial.object.visible, false);
    assert.strictEqual(old.parent, null);
    assert.strictEqual(entry.spatial.object.parent, scene);
    assert.strictEqual(disposed, 1);
    disposeObjects([entry.spatial.object]);
  });
});
