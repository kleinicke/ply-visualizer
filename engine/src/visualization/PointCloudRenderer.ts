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
export const ROUND_POINT_THRESHOLD_PIXELS = 3;

/**
 * Initialize the source material as the square half of the adaptive two-pass
 * pipeline. AdaptivePointRenderer adds the round half before rendering.
 */
export function optimizeForPointCount(
  material: THREE.PointsMaterial,
  allowTransparency: boolean
): void {
  material.map = null;
  material.alphaMap = null;
  material.alphaTest = 0;

  material.transparent = allowTransparency;

  material.depthTest = true;
  material.depthWrite = true;
  material.sizeAttenuation = true; // Keep world-space sizing
  material.side = THREE.FrontSide; // Default for points

  // Force material update
  material.needsUpdate = true;
}

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
