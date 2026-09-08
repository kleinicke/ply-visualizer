import '../../../../engine/src/hosts/embeddedViewer';
import { filesState } from '../../../../engine/src/state/files.svelte';
import { handleBrowserFiles } from '../../../../engine/src/browserFileDragDrop';
import { uiState } from '../../../../engine/src/state/ui.svelte';
import { Box3, Vector3 } from 'three';
const host = () => (window as any).visualizer;
const viewer = () => (window as any).embeddedViewer;
let queue = Promise.resolve();
let generation = 0;
let isolated: { index: number; visibility: boolean[] } | null = null;
const scene = {
  async open(file: File, id: string, append = false, preserveCamera = false) {
    const request = ++generation;
    const job = queue.then(async () => {
      if (request !== generation) {
        return false;
      }
      await viewer().ready();
      const saved =
        preserveCamera && host().spatialFiles.length
          ? {
              position: host().camera.position.clone(),
              up: host().camera.up.clone(),
              target: host().controls.target.clone(),
            }
          : null;
      if (!append) {
        isolated = null;
        while (host().spatialFiles.length) {
          host().removeFileByIndex(host().spatialFiles.length - 1);
        }
      }
      // Open through the engine pipeline without the embedding helper's retained
      // document map: workspace previews must release replaced geometry.
      const before = new Set(host().spatialFiles);
      const input = document.getElementById('hiddenFileInput') as HTMLInputElement;
      const transfer = new DataTransfer();
      transfer.items.add(file);
      input.files = transfer.files;
      await handleBrowserFiles(host(), [file]);
      const result = host().spatialFiles.some((data: any) => !before.has(data));
      if (saved) {
        host().camera.position.copy(saved.position);
        host().camera.up.copy(saved.up);
        host().controls.target.copy(saved.target);
        host().camera.lookAt(saved.target);
        host().controls.update();
        host().requestRender();
      } else if (result && !append) {
        scene.fit();
      }
      return request === generation && result;
    });
    queue = job.then(
      () => {},
      () => {}
    );
    return job;
  },
  snapshot() {
    const h = host();
    return {
      objects:
        h?.spatialFiles.map((data: any, index: number) => ({
          id: String(index),
          name: data.fileName || `Object ${index + 1}`,
          count: data.vertexCount,
          faces: data.faceCount,
          visible: h.fileVisibility[index] !== false,
          size: h.pointSizes[index] || 0.001,
          colors: data.hasColors,
          colorMode: filesState.colorModes[index] || 'assigned',
        })) || [],
      fps: uiState.perfStatsText,
    };
  },
  capture() {
    const h = host();
    return {
      objects: scene.snapshot().objects,
      camera: h?.camera
        ? {
            position: h.camera.position.toArray(),
            up: h.camera.up.toArray(),
            target: h.controls.target.toArray(),
          }
        : null,
    };
  },
  restore(saved: any) {
    const h = host();
    for (let index = h.spatialFiles.length - 1; index >= 0; index--) {
      const name = h.spatialFiles[index].fileName;
      const object = saved.objects?.find((o: any) => o.name === name);
      if (!object) {
        h.removeFileByIndex(index);
        continue;
      }
      if ((h.fileVisibility[index] !== false) !== object.visible) {
        scene.visibility(index);
      }
      scene.size(index, object.size);
      scene.color(index, object.colorMode);
    }
    if (saved.camera) {
      h.camera.position.fromArray(saved.camera.position);
      h.camera.up.fromArray(saved.camera.up);
      h.controls.target.fromArray(saved.camera.target);
      h.camera.lookAt(h.controls.target);
      h.controls.update();
      h.requestRender();
    }
  },
  isolate(index: number) {
    const h = host();
    const target =
      isolated?.index === index
        ? isolated.visibility
        : h.spatialFiles.map((_: any, i: number) => i === index);
    if (isolated?.index === index) {
      isolated = null;
    } else {
      isolated = { index, visibility: [...h.fileVisibility] };
    }
    target.forEach((v: boolean, i: number) => {
      if ((h.fileVisibility[i] !== false) !== v) {
        h.setFileEntryVisibility(i, v);
      }
    });
  },
  visibility(index: number) {
    const h = host();
    isolated = null;
    h.setFileEntryVisibility(index, h.fileVisibility[index] === false);
  },
  remove(index: number) {
    host().removeFileByIndex(index);
  },
  size(index: number, value: number) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error('Point size must be positive.');
    }
    host().updatePointSize(index, value);
    filesState.pointSizes[index] = value;
  },
  color(index: number, value: string) {
    host().onFileColorModeChange(index, value);
    filesState.colorModes[index] = value;
  },
  fit() {
    const h = host();
    h.fitCameraToAllObjects();
    // An explicit composition must include every object. The engine's robust
    // single-cloud framing can classify a much larger second mesh as outliers.
    if (h.spatialFiles.length > 1) {
      const bounds = new Box3();
      for (const mesh of h.meshes) {
        bounds.expandByObject(mesh);
      }
      if (!bounds.isEmpty()) {
        const center = bounds.getCenter(new Vector3());
        const radius = bounds.getSize(new Vector3()).length() / 2;
        const vertical = (h.camera.fov * Math.PI) / 180;
        const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * h.camera.aspect);
        const distance = (radius / Math.sin(Math.min(vertical, horizontal) / 2)) * 1.15;
        const direction = h.camera.getWorldDirection(new Vector3());
        h.camera.position.copy(center).addScaledVector(direction, -distance);
        h.controls.target.copy(center);
        h.camera.lookAt(center);
        h.controls.update();
      }
    }
    h.requestRender();
  },
  measure() {
    host().measurementManager?.togglePickMode();
  },
  clearMeasurements() {
    host().measurementManager?.clearAll();
  },
  async exportPng() {
    const canvas = host().renderer.domElement as HTMLCanvasElement;
    host().renderer.render(host().scene, host().camera);
    return new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Screenshot failed'))))
    );
  },
  configureExport(save: (name: string, blob: Blob) => Promise<boolean>) {
    viewer().configureExport(save);
  },
};
(window as any).desktopScene = scene;
export type SceneAdapter = typeof scene;
