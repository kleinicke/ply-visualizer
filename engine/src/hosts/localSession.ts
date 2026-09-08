import { setAgentPointSizeMode } from './agentPointSizing';
/** Local Python/CLI and notebook host; rendering stays in the shared engine. */
import '../main';
import { agentAlignmentBusy, resetAgentAlignment } from './agentAlignment';
import * as THREE from 'three';
import { mount } from 'svelte';
import { handleBrowserFiles, type BrowserFileDragDropHost } from '../browserFileDragDrop';
import { localSessionState as state } from '../state/localSession.svelte';
import { fitAgentView, type ControlHost } from './agentControls';
import { resetAgentSelections } from './agentInspection';
import { viewerState } from '../state/viewer.svelte';
import Toolbar from '../components/LocalSessionToolbar.svelte';
import { handleAgentCommand, type AgentViewerHost } from './agentBridge';

interface Session {
  version: number;
  revision: number;
  files: { id: string; name: string; url: string; batch: number }[];
  batches: string[];
  vectors: number[][][];
  step: number | null;
}
type Host = BrowserFileDragDropHost &
  AgentViewerHost & {
    camera: THREE.PerspectiveCamera;
    controls: { target: THREE.Vector3; update(): void };
    scene: THREE.Scene;
    fitCameraToAllObjects(): void;
    requestRender(): void;
  };

async function start(): Promise<void> {
  const host = (window as Window & { visualizer?: Host }).visualizer!;
  const ui = new URLSearchParams(location.search).get('ui') ?? 'collapsed';
  state.ui = ['full', 'collapsed', 'none'].includes(ui) ? ui : 'full';
  document.documentElement.dataset.sessionUi = state.ui;
  const toolbar = document.createElement('div');
  document.body.append(toolbar);
  mount(Toolbar, {
    target: toolbar,
    props: {
      fit: () => {
        fitAgentView(host);
        host.requestRender();
      },
    },
  });
  const arrows = new THREE.Group();
  arrows.name = 'training-vectors';
  host.scene.add(arrows);
  let revision = -1;
  let selected = -1;
  let loadedIds: string[] = [];

  function clearArrows() {
    for (const arrow of [...arrows.children]) {
      (arrow as THREE.ArrowHelper).dispose();
      arrows.remove(arrow);
    }
  }

  async function refresh() {
    if (state.paused || agentAlignmentBusy(host as unknown as ControlHost)) {
      return;
    }
    const response = await fetch('session.json');
    if (!response.ok) {
      throw new Error('Session unavailable; keep the Python kernel running.');
    }
    const session: Session = await response.json();
    if (session.version !== 1) {
      throw new Error('Unsupported viewer session version');
    }
    state.batches = session.batches;
    state.selected = Math.min(state.selected, state.batches.length - 1);
    const batch = state.selected;
    if (session.revision === revision && selected === batch) {
      return;
    }
    const entries = session.files.filter(file => file.batch === batch);
    const append =
      revision >= 0 &&
      selected === batch &&
      entries.length > loadedIds.length &&
      loadedIds.every((id, i) => entries[i].id === id);
    const pending = append ? entries.slice(loadedIds.length) : entries;
    const files: File[] = [];
    // Fetch before replacing the old scene so expired revisions can be retried.
    for (const source of pending) {
      const data = await fetch(source.url);
      if (data.status === 404) {
        return;
      }
      if (!data.ok) {
        throw new Error(`Cannot read ${source.name} (${data.status})`);
      }
      files.push(new File([await data.blob()], source.name));
    }
    const camera = host.camera.clone();
    const target = host.controls.target.clone();
    if (!append) {
      resetAgentSelections(host as unknown as ControlHost);
      resetAgentAlignment(host as unknown as ControlHost);
      while (host.spatialFiles.length) {
        host.removeFileByIndex(host.spatialFiles.length - 1);
      }
      clearArrows();
    }
    const previousCount = host.spatialFiles.length;
    try {
      await handleBrowserFiles(host, files);
      if (
        host.spatialFiles.length <
        previousCount +
          files.filter(file =>
            /\.(ply|xyz|xyzn|xyzrgb|pcd|pts|obj|stl|off|gltf|glb|fbx|dae|3ds|las|laz|e57|spz|splat|ksplat|sog)$/i.test(
              file.name
            )
          ).length
      ) {
        throw new Error('Could not load the complete scene');
      }
      if (!append) {
        for (const [x, y, z, dx, dy, dz] of session.vectors[batch] ?? []) {
          const direction = new THREE.Vector3(dx, dy, dz);
          const length = direction.length();
          if (length > 0) {
            arrows.add(
              new THREE.ArrowHelper(
                direction.normalize(),
                new THREE.Vector3(x, y, z),
                length,
                0xff55cc
              )
            );
          }
        }
      }
    } catch (error) {
      if (append) {
        while (host.spatialFiles.length > previousCount) {
          host.removeFileByIndex(host.spatialFiles.length - 1);
        }
      }
      throw error;
    } finally {
      if (revision === -1 && host.spatialFiles.length) {
        host.camera.up.set(0, 1, 0);
        viewerState.cameraConvention = 'opengl';
        fitAgentView(host, 'front');
      }
      if (revision !== -1) {
        host.camera.copy(camera);
        host.controls.target.copy(target);
        host.controls.update();
        host.camera.updateProjectionMatrix();
      }
      host.spatialFiles.forEach((file, i) => {
        if (i >= previousCount && !file.faceCount && file.vertexCount <= 100) {
          setAgentPointSizeMode(host as unknown as ControlHost, i, true);
        }
      });
      host.requestRender();
    }
    loadedIds = entries.map(entry => entry.id);
    revision = session.revision;
    selected = batch;
    state.step = session.step;
    state.error = '';
    document.documentElement.dataset.localSession = 'loaded';
    document.documentElement.dataset.sessionRevision = String(revision);
    return true;
  }

  let delay = 500;
  async function poll() {
    let active = false;
    try {
      active = !!(await refresh());
    } catch (error) {
      state.error = error instanceof Error ? error.message : String(error);
      document.documentElement.dataset.localSession = 'error';
    }
    try {
      active = (await handleAgentCommand(host)) || active;
    } catch {
      /* Retry after a transient disconnect. */
    }
    delay = active ? 500 : Math.min(4000, delay * 1.5);
    window.setTimeout((): void => {
      void poll();
    }, delay);
  }
  void poll();
}

if (document.documentElement.dataset.visualizerReady === 'true') {
  void start();
} else {
  window.addEventListener('visualizer-ready', () => void start(), { once: true });
}
