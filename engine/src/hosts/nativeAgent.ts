import { detectFileTypeWithContent } from '../fileHandler';
 
import * as THREE from 'three';
import type { ControlHost } from './agentControls';
import { executeAgentCommand, type AgentViewerHost } from './agentBridge';
import { handleBrowserFiles } from '../browserFileDragDrop';
import { projectAgentDepth } from '../depth/agentDepth';
import { resetAgentSelections } from './agentInspection';
import { resetAgentAlignment, agentAlignmentBusy } from './agentAlignment';
import { setAgentPointSizeMode } from './agentPointSizing';
import { uiState } from '../state/ui.svelte';
import type { SpatialData } from '../interfaces';

const arrows = new WeakMap<ControlHost, THREE.Group>();
const revisions = new WeakMap<ControlHost, number>();
function cloud(points: number[][], colors: number[][] | undefined, name: string): SpatialData {
  if (
    !points.length ||
    points.length > 20000 ||
    points.some(p => p.length !== 3 || !p.every(Number.isFinite))
  ) {
    throw new Error('Expected 1..20000 finite XYZ triples');
  }
  if (
    colors &&
    (colors.length !== points.length ||
      colors.some(c => c.length !== 3 || c.some(v => !Number.isInteger(v) || v < 0 || v > 255)))
  ) {
    throw new Error('RGB must match points and contain integer triples in 0..255');
  }
  return {
    vertices: [],
    faces: [],
    format: 'binary_little_endian',
    version: '1.0',
    comments: [],
    vertexCount: points.length,
    faceCount: 0,
    hasColors: !!colors,
    hasNormals: false,
    useTypedArrays: true,
    positionsArray: Float32Array.from(points.flat()),
    colorsArray: colors ? Uint8Array.from(colors.flat()) : undefined,
    fileName: name,
  };
}

async function load(host: ControlHost, a: Record<string, any>) {
  if (agentAlignmentBusy(host)) {
    throw new Error('Alignment is running; wait before replacing or appending geometry');
  }
  const camera = host.camera.clone(),
    target = host.controls.target.clone();
  const before = host.spatialFiles.length;
  if (!before && !a.replace) {
    host.setOpenGLCameraConvention();
  }
  const prepared: SpatialData[] = [];
  const files = (a.files ?? []).map(
    (f: any) => new File([Uint8Array.from(atob(f.base64), c => c.charCodeAt(0))], f.name)
  );
  if (!a.depth) {
    for (const file of files) {
      const type = await detectFileTypeWithContent(
        file.name,
        new Uint8Array(await file.arrayBuffer())
      );
      if (type?.isDepthFile) {
        throw new Error('Use open_depth_image with explicit calibration for depth rasters');
      }
    }
  }
  if (a.depth) {
    prepared.push(await projectAgentDepth(a.depth, files));
  }
  if (a.points) {
    prepared.push(cloud(a.points, a.colors, 'Points'));
    if (a.target) {
      prepared.push(cloud(a.target, undefined, 'Target'));
    }
    if (
      a.vectors &&
      (a.vectors.length !== a.points.length ||
        a.vectors.some((v: number[]) => v.length !== 3 || !v.every(Number.isFinite)))
    ) {
      throw new Error('Vectors must match points and contain finite XYZ triples');
    }
  }
  try {
    if (a.replace) {
      resetAgentSelections(host);
      resetAgentAlignment(host);
      while (host.spatialFiles.length) {
        host.removeFileByIndex(host.spatialFiles.length - 1);
      }
      const old = arrows.get(host);
      if (old) {
        host.scene.remove(old);
        old.traverse(o => {
          (o as THREE.Mesh).geometry?.dispose();
          const m = (o as THREE.Mesh).material;
          if (m) {
            for (const item of Array.isArray(m) ? m : [m]) {
              item.dispose();
            }
          }
        });
      }
    }
    if (prepared.length) {
      await host.displayFiles(prepared);
    }
    if (files.length && !a.depth) {
      // Browser loader is the shared decoder; it renders into this host's scene.
      // Convert UI-only errors to an agent error rather than claiming a partial load succeeded.
      const priorError = uiState.errorMessage;
      uiState.errorMessage = '';
      try {
        await handleBrowserFiles(host, files);
      } finally {
        // This load is completed here, not by the ordinary extension parser.
        host.completeBackgroundOperation();
      }
      if (uiState.errorMessage) {
        throw new Error(uiState.errorMessage);
      }
      uiState.errorMessage = priorError;
    }
    if (a.vectors) {
      const group = new THREE.Group();
      a.vectors.forEach((v: number[], i: number) => {
        const vector = new THREE.Vector3(...v).multiplyScalar(a.vector_scale ?? 1);
        const length = vector.length();
        if (length) {
          group.add(
            new THREE.ArrowHelper(
              vector.normalize(),
              new THREE.Vector3(...a.points[i]),
              length,
              0xff55cc
            )
          );
        }
      });
      host.scene.add(group);
      arrows.set(host, group);
    }
    if (!host.spatialFiles.length) {
      throw new Error(
        'No geometry loaded; use open_depth_image with explicit calibration for depth rasters'
      );
    }
    revisions.set(host, (revisions.get(host) ?? 0) + 1);
  } catch (error) {
    if (!a.replace) {
      while (host.spatialFiles.length > before) {
        host.removeFileByIndex(host.spatialFiles.length - 1);
      }
    }
    throw error;
  } finally {
    if (before || a.replace) {
      host.camera.copy(camera);
      host.controls.target.copy(target);
      host.controls.update();
      host.camera.updateProjectionMatrix();
    }
    host.spatialFiles.forEach((file, i) => {
      if (i >= (a.replace ? 0 : before) && !file.faceCount && file.vertexCount <= 100) {
        setAgentPointSizeMode(host, i, true);
      }
    });
    host.requestRender();
  }
}

export async function handleNativeAgentRequest(host: ControlHost, message: any): Promise<void> {
  try {
    // Existing editor loads use the ordinary message pipeline. Wait for their
    // geometry/GPU work before acting on object indices or capturing evidence.
    const deadline = Date.now() + 110000;
    while (uiState.backgroundChanges || uiState.fileLoading || uiState.loadingVisible) {
      if (Date.now() > deadline) {
        throw new Error('Scene is still loading; inspect again after it completes');
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    if (message.operation === 'native_load') {
      await load(host, message.arguments);
    }
    document.documentElement.dataset.sessionRevision = String(revisions.get(host) ?? 0);
    const reply = await executeAgentCommand(host as unknown as AgentViewerHost, {
      ...message,
      operation: message.operation === 'native_load' ? 'inspect' : message.operation,
    });
    host.vscode.postMessage({ type: 'nativeAgentReply', ...reply });
  } catch (error) {
    host.vscode.postMessage({
      type: 'nativeAgentReply',
      id: message.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
