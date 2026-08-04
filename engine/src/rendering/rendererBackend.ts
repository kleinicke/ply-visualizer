import * as THREE from 'three';
import type { ViewerRenderer } from './viewerRenderer';
import { useAntialiasing } from './rendererOptions';

declare global {
  interface Window {
    __PLY_WEBGPU__?: boolean;
  }
}

export type RendererBackend = 'webgl' | 'webgpu';

export interface RendererSelection {
  /** The renderer to use. Always present — WebGPU failures fall back to WebGL. */
  renderer: ViewerRenderer;
  /** What was actually created, which is not always what was requested. */
  backend: RendererBackend;
  /** The concrete WebGL renderer, or null on WebGPU. EDL and Spark need this. */
  webglRenderer: THREE.WebGLRenderer | null;
  /** Set when WebGPU was asked for and could not be delivered. */
  fallbackReason: string | null;
}

/**
 * Whether to ask for the WebGPU backend.
 *
 * Off by default: WebGPU is an experiment for measuring backend cost, not the
 * shipping configuration. See `WEBGPU_CAVEATS` for what changes when it is on,
 * and docs/WEBGPU_READINESS.md for the full picture.
 *
 * Turn it on with `?webgpu=1` (standalone page) or by setting
 * `window.__PLY_WEBGPU__ = true` before the viewer boots, which is how the two
 * backends get compared on the same build — the same switch shape as
 * `useAntialiasing()`.
 */
export function useWebGPU(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  if (window.__PLY_WEBGPU__ !== undefined) {
    return window.__PLY_WEBGPU__;
  }
  return new URLSearchParams(window.location.search).get('webgpu') === '1';
}

/**
 * Differences a WebGPU run has to be read with. These are properties of the
 * backend and of three's WebGPU path, not bugs to be fixed here.
 */
export const WEBGPU_CAVEATS = [
  'Points render at exactly 1 pixel: WebGPU has no gl_PointSize, and three only ' +
    'honours point size for Sprite-based instancing, not for THREE.Points. ' +
    'Frame times are therefore only comparable to WebGL at the default point size, ' +
    'where WebGL clamps to 1 pixel too.',
  'EDL is disabled: it is an EffectComposer/GLSL pass with no WebGPU implementation.',
  'Gaussian splat mode is disabled: Spark reaches into the raw WebGL context.',
  'sRGB decode of 8-bit vertex colours is skipped: it is injected through ' +
    'onBeforeCompile, which the WebGPU path ignores. Colours may look brighter.',
] as const;

/**
 * Creates the renderer for the requested backend.
 *
 * Asynchronous because WebGPU needs both a dynamic import (keeping three's
 * ~1.5MB WebGPU build out of the default bundle — the mistake commit 970ee42
 * made) and an `await renderer.init()` before its first draw.
 *
 * Every WebGPU failure path falls back to WebGL rather than throwing, so a
 * missing or broken WebGPU implementation degrades to the normal viewer.
 */
export async function createViewerRenderer(canvas: HTMLCanvasElement): Promise<RendererSelection> {
  if (!useWebGPU()) {
    return webglSelection(canvas, null);
  }

  const unavailable = await webgpuUnavailableReason();
  if (unavailable) {
    return webglSelection(canvas, unavailable);
  }

  try {
    const { WebGPURenderer } = await import(/* webpackChunkName: "three-webgpu" */ 'three/webgpu');
    const renderer = new WebGPURenderer({
      canvas,
      antialias: useAntialiasing(),
      alpha: true,
      powerPreference: 'high-performance',
      // Enables timestamp queries, which rendering/gpuTimer.ts reads back.
      // Costs nothing when the adapter does not support the feature.
      trackTimestamp: true,
      // Without this, three silently falls back to its own WebGL backend, and
      // a "WebGPU" measurement would really be WebGL through a slower path.
      forceWebGL: false,
      // three defaults WebGPU's output buffer to HalfFloatType, where
      // WebGLRenderer writes 8-bit straight to the canvas. On a 7.9M-point
      // cloud that extra write bandwidth measured as most of the backend gap,
      // so match WebGL rather than comparing a 16-bit path against an 8-bit
      // one. The viewer has no HDR content that would benefit.
      outputBufferType: THREE.UnsignedByteType,
    });
    await renderer.init();
    return {
      renderer: renderer as unknown as ViewerRenderer,
      backend: 'webgpu',
      webglRenderer: null,
      fallbackReason: null,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    // A canvas keeps the first context it was given. If WebGPU got far enough
    // to configure the canvas, asking the same element for WebGL now fails, so
    // the WebGL fallback has to start from a clean element.
    return webglSelection(replaceCanvas(canvas), `WebGPU renderer failed to start: ${reason}`);
  }
}

/**
 * Checks for WebGPU without touching the canvas, so the WebGL fallback can
 * still use it. `navigator.gpu` existing is not enough — VS Code's Electron
 * build has shipped the object while returning no adapter.
 */
async function webgpuUnavailableReason(): Promise<string | null> {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
  if (!gpu) {
    return 'WebGPU requested but navigator.gpu is undefined in this environment.';
  }
  try {
    const adapter = await gpu.requestAdapter();
    if (!adapter) {
      return 'WebGPU requested but no adapter was returned.';
    }
  } catch (error) {
    return `WebGPU adapter request failed: ${error instanceof Error ? error.message : String(error)}`;
  }
  return null;
}

function webglSelection(
  canvas: HTMLCanvasElement,
  fallbackReason: string | null
): RendererSelection {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    // Off by default: MSAA multiplies the per-sample depth work that dominates
    // zoomed-out point clouds, and smooths nothing on 1-pixel points.
    // See rendering/rendererOptions.ts; `?antialias=1` restores it.
    antialias: useAntialiasing(),
    alpha: true,
    preserveDrawingBuffer: false, // better performance
    powerPreference: 'high-performance', // Keep discrete GPU preference
  });
  return { renderer, backend: 'webgl', webglRenderer: renderer, fallbackReason };
}

/** Swaps in a fresh, context-free canvas with the same id, size and position. */
function replaceCanvas(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const replacement = canvas.cloneNode(false) as HTMLCanvasElement;
  canvas.replaceWith(replacement);
  return replacement;
}
