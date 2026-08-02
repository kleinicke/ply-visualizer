import * as THREE from 'three';

let roundPointTexture: THREE.Texture | null = null;

/**
 * Lazily build (once, module-wide — one webview only ever needs one texture) a
 * small white circular alpha texture used to make points round. Alpha is 1
 * inside the disc with a 1–2px soft rim for anti-aliasing, 0 in the corners;
 * combined with alphaTest=0.5 this yields clean round points.
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
      img.data[i] = 255;
      img.data[i + 1] = 255;
      img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  roundPointTexture = tex;
  return tex;
}

/**
 * Point sizes at or below this render as roughly one pixel, where a disc and a
 * square are the same handful of fragments. The viewer's universal default is
 * 0.001; the small margin keeps slider values that round to the default on the
 * cheap path.
 */
const ROUND_POINT_MIN_SIZE = 0.0015;

/**
 * Round points cost real frame time on large clouds: sampling the disc texture
 * and discarding the corners forces the fragment shader to run before the depth
 * test can reject anything (a `discard` disables early-Z). Zoomed out, millions
 * of points pile onto the same pixels and every one of those hidden fragments is
 * shaded anyway. Below one pixel there is no disc to see, so skip the texture
 * entirely and let early-Z do its job.
 */
export function shouldUseRoundPoints(size: number): boolean {
  return size > ROUND_POINT_MIN_SIZE;
}

/**
 * Apply the round-vs-square decision for the material's current size.
 *
 * Idempotent by design: flipping `map`/`alphaTest` triggers a shader recompile,
 * so this returns without touching `needsUpdate` when the material is already in
 * the right mode. That makes it safe to call from per-frame paths such as
 * screen-space scaling.
 */
export function applyPointShape(material: THREE.PointsMaterial, allowTransparency: boolean): void {
  const wantRound = shouldUseRoundPoints(material.size);
  const isRound = material.map !== null;

  if (wantRound === isRound) {
    return;
  }

  if (wantRound) {
    material.map = getRoundPointTexture();
    material.alphaTest = 0.5; // keep the disc, discard the corners
  } else {
    material.map = null;
    material.alphaTest = 0;
  }

  // Transparency only affects the soft rim; the disc shape comes from alphaTest.
  material.transparent = allowTransparency;
  material.needsUpdate = true;
}

/**
 * Render points as discs instead of the default GL squares. A small circular
 * alpha texture is sampled per fragment (via gl_PointCoord) and alphaTest
 * discards the corners — so points are round and still opaque (no alpha
 * blending pipeline). The white texture only carries the round mask; the
 * per-vertex color is preserved (PointsMaterial multiplies map × color).
 *
 * Sub-pixel points skip the texture — see applyPointShape.
 */
export function optimizeForPointCount(
  material: THREE.PointsMaterial,
  allowTransparency: boolean
): void {
  if (shouldUseRoundPoints(material.size)) {
    material.map = getRoundPointTexture();
    material.alphaTest = 0.5;
  } else {
    material.map = null;
    material.alphaTest = 0;
  }

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
