import * as THREE from 'three';
import type { WebGPURenderer } from 'three/webgpu';

/**
 * The renderer surface the viewer actually uses.
 *
 * Most modules only need a canvas, a draw call and a few colour/tone settings —
 * all of which `WebGLRenderer` and `WebGPURenderer` expose identically. Typing
 * those modules against this interface instead of the concrete class means a
 * future backend swap does not touch them at all, and it makes the modules that
 * genuinely cannot move (below) visible as the real porting work.
 *
 * This is deliberately a structural interface rather than a
 * `WebGLRenderer | WebGPURenderer` union: the union form requires importing
 * `three/webgpu`, which pulls the WebGPU build into the bundle for every user
 * today. The earlier attempt on this (commit 970ee42, since reverted) did that.
 * `WebGLRenderer` satisfies this interface without any import cost, and so does
 * `WebGPURenderer` — see the two compile-time proofs at the bottom of this file.
 * `rendering/rendererBackend.ts` builds whichever one is asked for.
 *
 * Known WebGL-bound consumers, which reach for `PointCloudVisualizer`'s
 * `webglRenderer` (null on WebGPU) rather than this interface:
 *
 * - `postprocessing/EDLPass.ts` and `edl.ts` — `EffectComposer` and raw GLSL.
 *   WebGPU post-processing is node-based and needs a separate implementation,
 *   so EDL is simply unavailable on the WebGPU backend.
 * - `visualization/splatMode.ts` — Spark reaches into the raw WebGL context
 *   (`renderer.getContext()`, `gl.readPixels`, framebuffer objects), so splat
 *   rendering cannot move until Spark itself supports WebGPU. This is an
 *   upstream constraint, not something this codebase can refactor away.
 *
 * GPU timing was the third such consumer and is no longer one: see
 * `rendering/gpuTimer.ts`, which now has an implementation per backend.
 */
export interface ViewerRenderer {
  readonly domElement: HTMLCanvasElement;
  render(scene: THREE.Object3D, camera: THREE.Camera): void;
  setSize(width: number, height: number, updateStyle?: boolean): void;
  setPixelRatio(value: number): void;
  setClearColor(color: THREE.ColorRepresentation, alpha?: number): void;
  setClearAlpha(alpha: number): void;
  toneMapping: THREE.ToneMapping;
  toneMappingExposure: number;
  // `string`, not `THREE.ColorSpace`: three types WebGLRenderer's own property
  // that way, and narrowing here would make the concrete renderer fail to
  // satisfy the interface.
  outputColorSpace: string;
  sortObjects: boolean;
  clippingPlanes: THREE.Plane[];
  // Only `enabled` is used (it is switched off at startup), and both renderers
  // expose a shadow-map object carrying it.
  shadowMap: { enabled: boolean };
  dispose(): void;
}

/**
 * Compile-time proof that both renderers still satisfy the interface. If a
 * future three.js release changes one of these signatures, this fails here
 * rather than at each of the call sites.
 *
 * The WebGPU proof is a type-only import, which TypeScript erases entirely —
 * it adds nothing to the bundle. The runtime import stays dynamic in
 * `rendering/rendererBackend.ts`.
 */
export type WebGLRendererSatisfiesViewerRenderer = THREE.WebGLRenderer extends ViewerRenderer
  ? true
  : never;

export type WebGPURendererSatisfiesViewerRenderer = WebGPURenderer extends ViewerRenderer
  ? true
  : never;
