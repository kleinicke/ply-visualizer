import * as THREE from 'three';

let roundPointTexture: THREE.Texture | null = null;

/**
 * Lazily build (once, module-wide — one webview only ever needs one texture) a
 * circular scalar mask used as PointsMaterial.alphaMap. Keeping the mask out
 * of `map` is important: a regular map multiplies RGB as well as alpha, and
 * filtering its transparent edge visibly darkens round points.
 */
export function getRoundPointTexture(): THREE.Texture {
  if (roundPointTexture) {
    return roundPointTexture;
  }
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const c = (size - 1) / 2;
  const smooth = (e0: number, e1: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - c) / c;
      const dy = (y - c) / c;
      const d = Math.sqrt(dx * dx + dy * dy); // 0 at center, 1 at edge
      const a = 1 - smooth(0.9, 1.0, d);
      const i = (y * size + x) * 4;
      const mask = Math.round(a * 255);
      // alphaMap samples the green channel. Keep the texture itself opaque so
      // browser canvas premultiplication cannot contaminate the scalar mask.
      img.data[i] = mask;
      img.data[i + 1] = mask;
      img.data[i + 2] = mask;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  roundPointTexture = tex;
  return tex;
}

/**
 * Universal default point size, in world units, for every format.
 *
 * **This value is only visible because of a WebGL behaviour.** At 0.001 world
 * units a point is far below one pixel at normal viewing distances; WebGL
 * clamps `gl_PointSize` up to the minimum of `ALIASED_POINT_SIZE_RANGE`, which
 * is at least 1, so the point still covers a pixel and the cloud is visible.
 *
 * No such implicit clamp exists elsewhere. The abandoned WebGPU attempt
 * (commit 970ee42) drew points as sprite quads, which are *not* clamped, and
 * the entire cloud disappeared at this default — that was the bug that stopped
 * the port, not anything about the port itself. Any future backend must apply
 * a one-pixel minimum explicitly.
 */
export const DEFAULT_POINT_SIZE = 0.001;

/** Minimum size a point must cover to remain visible, in device pixels. */
export const MIN_POINT_PIXELS = 1;

/** Switch to circular sprites only once their shape is visually resolvable. */
export const ROUND_POINT_THRESHOLD_PIXELS = 4;

/** Prevent shader recompiles from thrashing while zooming around the threshold. */
export const ROUND_POINT_HYSTERESIS_PIXELS = 0.5;

export function shouldUseRoundPoints(projectedPixels: number, currentlyRound: boolean): boolean {
  if (currentlyRound) {
    return projectedPixels > ROUND_POINT_THRESHOLD_PIXELS - ROUND_POINT_HYSTERESIS_PIXELS;
  }
  return projectedPixels > ROUND_POINT_THRESHOLD_PIXELS;
}

/**
 * Apply the round-vs-square decision for the material's projected size.
 *
 * Idempotent by design: flipping `map`/`alphaTest` triggers a shader recompile,
 * so this returns without touching `needsUpdate` when the material is already in
 * the right mode. That makes it safe to call from per-frame paths such as
 * screen-space scaling.
 */
export function applyPointShape(
  material: THREE.PointsMaterial,
  allowTransparency: boolean,
  projectedPixels: number
): void {
  const isRound = material.alphaMap !== null;
  const wantRound = shouldUseRoundPoints(projectedPixels, isRound);

  if (wantRound === isRound) {
    return;
  }

  if (wantRound) {
    material.map = null;
    material.alphaMap = getRoundPointTexture();
    material.alphaTest = 0.5; // keep the disc, discard the corners
  } else {
    material.map = null;
    material.alphaMap = null;
    material.alphaTest = 0;
  }

  // Transparency only affects the soft rim; the disc shape comes from alphaTest.
  material.transparent = allowTransparency;
  material.needsUpdate = true;
}

/**
 * Initialize the original point pipeline: every point uses the circular alpha
 * mask. Adaptive rendering is an explicit experiment and must not silently
 * replace the baseline.
 */
export function optimizeForPointCount(
  material: THREE.PointsMaterial,
  allowTransparency: boolean
): void {
  material.map = null;
  material.alphaMap = getRoundPointTexture();
  material.alphaTest = 0.5;

  material.transparent = allowTransparency;

  material.depthTest = true;
  material.depthWrite = true;
  material.sizeAttenuation = true; // Keep world-space sizing
  material.side = THREE.FrontSide; // Default for points

  // Force material update
  material.needsUpdate = true;
}

/**
 * Estimate the point size produced by Three's size-attenuation shader for a
 * representative near portion of the cloud. `viewportHeight` is the drawing-
 * buffer height, because gl_PointSize and the 4 px threshold are both measured
 * in rendered pixels.
 */
export function projectedPointPixels(
  points: THREE.Points,
  camera: THREE.PerspectiveCamera,
  viewportHeight: number
): number {
  const material = points.material;
  if (!(material instanceof THREE.PointsMaterial)) {return 0;}
  if (!material.sizeAttenuation) {return material.size;}

  camera.updateMatrixWorld();
  points.updateWorldMatrix(true, false);
  _modelView.multiplyMatrices(camera.matrixWorldInverse, points.matrixWorld);

  // A cloud center can be hundreds of metres behind the surface currently
  // being inspected. Sample actual vertices and use the near 10th percentile:
  // round mode turns on only when a meaningful portion of visible points is
  // large, without one close outlier forcing the expensive shader globally.
  const positions = points.geometry.getAttribute('position');
  if (!positions || positions.count === 0) {return 0;}
  _sampleDepths.length = 0;
  _visibleSampleDepths.length = 0;
  const stride = Math.max(1, Math.ceil(positions.count / PROJECTED_SIZE_SAMPLES));
  for (let index = 0; index < positions.count; index += stride) {
    _projectedPoint
      .set(positions.getX(index), positions.getY(index), positions.getZ(index))
      .applyMatrix4(_modelView);
    const depth = -_projectedPoint.z;
    if (depth <= camera.near || depth >= camera.far) {continue;}
    _sampleDepths.push(depth);
    _clipPoint.copy(_projectedPoint).applyMatrix4(camera.projectionMatrix);
    if (Math.abs(_clipPoint.x) <= 1 && Math.abs(_clipPoint.y) <= 1) {
      _visibleSampleDepths.push(depth);
    }
  }
  // A deeply zoomed view can be narrower than the 512-point sample and contain
  // no sampled vertex at all. Falling back to front-facing samples keeps the
  // adaptive mode responsive instead of getting stuck square.
  const depths = _visibleSampleDepths.length > 0 ? _visibleSampleDepths : _sampleDepths;
  if (depths.length === 0) {return 0;}
  depths.sort((a, b) => a - b);
  const depth = depths[Math.floor((depths.length - 1) * 0.1)];

  // Matches Three.js' points vertex shader: size * (viewportHeight / 2) / depth.
  return (material.size * viewportHeight * 0.5) / depth;
}

export function updateProjectedPointShapes(
  clouds: THREE.Points[],
  camera: THREE.PerspectiveCamera,
  viewportHeight: number,
  allowTransparency: boolean
): void {
  for (const cloud of clouds) {
    if (!(cloud.material instanceof THREE.PointsMaterial)) {continue;}
    applyPointShape(
      cloud.material,
      allowTransparency,
      projectedPointPixels(cloud, camera, viewportHeight)
    );
  }
}

const PROJECTED_SIZE_SAMPLES = 512;
const _modelView = new THREE.Matrix4();
const _projectedPoint = new THREE.Vector3();
const _clipPoint = new THREE.Vector3();
const _sampleDepths: number[] = [];
const _visibleSampleDepths: number[] = [];

export function createOptimizedPointCloud(
  geometry: THREE.BufferGeometry,
  material: THREE.PointsMaterial
): THREE.Points {
  // Optimize geometry for GPU
  const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
  if (positions && positions.count > 50000) {
    // For very large point clouds, try to reduce vertex data transfer
    geometry.deleteAttribute('normal'); // Points don't need normals
    geometry.computeBoundingBox(); // Help with frustum culling
    geometry.computeBoundingSphere();
  }

  return new THREE.Points(geometry, material);
}
