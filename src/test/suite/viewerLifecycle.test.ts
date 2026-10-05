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
    registry.add('spatial');
    let finish!: (result: never) => void;
    const pending = new Promise<never>(resolve => {
      finish = resolve;
    });
    let errors = 0;
    const host = {
      fileEntries: registry,
      spatialFiles: [
        {
          ...data(),
          depthSource: {
            originalData: new ArrayBuffer(0),
            fileName: 'test.pfm',
            cameraParams: {},
            depthDimensions: { width: 1, height: 1 },
          },
        },
      ],
      processDepthToPointCloud: () => pending,
      showStatus: () => {},
      showError: () => {
        errors++;
      },
    } as unknown as ColorImageForDepthHost;
    const operation = removeColorImageFromDepth(host, 0);
    registry.removeAt(0);
    host.spatialFiles.length = 0;
    finish(null as never);
    await operation;
    assert.strictEqual(errors, 0);
    assert.strictEqual(host.spatialFiles.length, 0);
  });
});
