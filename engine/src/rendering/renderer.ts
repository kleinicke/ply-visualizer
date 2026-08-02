import * as THREE from 'three/webgpu';
import { WebGLRenderer } from 'three/src/renderers/WebGLRenderer.js';

export type ViewerRenderer = THREE.WebGPURenderer | WebGLRenderer;
export type RendererBackend = 'webgpu' | 'webgl';

declare global {
  interface Window {
    __PLY_FORCE_WEBGL__?: boolean;
  }
}

function requestedBackend(): RendererBackend {
  const query = new URLSearchParams(window.location.search).get('renderer');
  if (query === 'webgl' || window.__PLY_FORCE_WEBGL__) {
    return 'webgl';
  }
  return 'webgpu';
}

export async function createViewerRenderer(
  canvas: HTMLCanvasElement
): Promise<{ renderer: ViewerRenderer; backend: RendererBackend }> {
  const backend = requestedBackend();

  if (backend === 'webgl') {
    const renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    });
    return { renderer, backend };
  }

  const renderer = new THREE.WebGPURenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
    // Timestamp queries add measurable per-render overhead. Keep them as an
    // explicit diagnostics option instead of taxing normal point-cloud use.
    trackTimestamp: new URLSearchParams(window.location.search).get('gpuTiming') === '1',
  });
  await renderer.init();

  return {
    renderer,
    backend: (renderer.backend as THREE.WebGPUBackend).isWebGPUBackend ? 'webgpu' : 'webgl',
  };
}

export function isModernRenderer(renderer: ViewerRenderer): renderer is THREE.WebGPURenderer {
  return (renderer as THREE.WebGPURenderer).isWebGPURenderer === true;
}

export function isLegacyWebGLRenderer(renderer: ViewerRenderer): renderer is WebGLRenderer {
  return renderer instanceof WebGLRenderer;
}
