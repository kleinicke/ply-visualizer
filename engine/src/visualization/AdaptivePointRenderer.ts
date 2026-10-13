import * as THREE from 'three';
import { getRoundPointTexture, ROUND_POINT_THRESHOLD_PIXELS } from './PointCloudRenderer';
import { CHUNK_POINTS, chunkBoxes, nearestBoxDepth, retainChunkBounds } from './chunkBounds';
import { computePositionBounds } from './fastBounds';

interface AdaptivePointRendererHost {
  meshes: readonly (THREE.Mesh | THREE.Points | THREE.LineSegments)[];
  rendererBackend: string;
  camera: THREE.Camera;
  renderer: { getPixelRatio(): number; getSize(target: THREE.Vector2): THREE.Vector2 };
  /** Asked once a cloud's chunk bounds are ready, so the trimmed range is used. */
  requestRender(): void;
}

interface AdaptivePointView {
  sourceMaterial: THREE.PointsMaterial;
  sourceMaterialVersion: number;
  roundPoints: THREE.Points;
  roundMaterial: THREE.PointsMaterial;
  /** Shares the source's attributes (and GL buffers) with its own draw range. */
  roundGeometry: THREE.BufferGeometry;
}

type PointBand = 'square' | 'round';

/**
 * Relative slack on the projected-size bounds. The bounds are exact for every
 * point inside the bounding sphere; the margin only absorbs float rounding
 * between this JS estimate and the vertex shader, so a pass is skipped only
 * when it provably rejects every point.
 */
const BAND_MARGIN = 0.05;

const scratchSize = new THREE.Vector2();
const scratchCenter = new THREE.Vector3();
const scratchModelView = new THREE.Matrix4();

/**
 * Renders small points as cheap square sprites and larger points as discs.
 *
 * Both passes share the source's vertex buffers. The source Points object is
 * the square pass; a child Points object is the round pass, so file transforms,
 * alignment, visibility, and removal are inherited without maintaining proxy
 * transforms. Each vertex reaches rasterization in exactly one pass. The round
 * pass draws through its own geometry object so it can be limited to the
 * chunks whose points can reach the disc threshold.
 */
export class AdaptivePointRenderer {
  private readonly views = new Map<THREE.Points, AdaptivePointView>();

  constructor(private readonly host: AdaptivePointRendererHost) {}

  beforeRender(): void {
    // The size-band hook below is GLSL/WebGL-specific. WebGPU remains an opt-in
    // backend and keeps its ordinary point rendering rather than double-drawing.
    if (this.host.rendererBackend !== 'webgl') {
      this.removeAllViews();
      return;
    }

    const sources = new Set(this.pointClouds());
    for (const [source, view] of this.views) {
      if (!sources.has(source) || source.material !== view.sourceMaterial) {
        this.removeView(source, view);
      }
    }
    const drawn = new Set<THREE.BufferAttribute>();
    for (const source of sources) {
      const position = source.geometry.getAttribute('position');
      if (position instanceof THREE.BufferAttribute) {
        drawn.add(position);
      }
    }
    retainChunkBounds(drawn);

    const camera = this.host.camera;
    const perspective = (camera as THREE.PerspectiveCamera).isPerspectiveCamera === true;
    if (perspective) {
      camera.updateMatrixWorld();
    }
    const pixelRatio = this.host.renderer.getPixelRatio();
    const scale = this.host.renderer.getSize(scratchSize).y * 0.5;
    // A material can briefly serve two clouds (see createView), so its square
    // pass stays on while any of them needs it.
    const squareNeeded = new Map<THREE.PointsMaterial, boolean>();
    for (const source of sources) {
      let view = this.views.get(source);
      if (!view) {
        view = this.createView(source);
        this.views.set(source, view);
      }
      this.syncView(source, view);
      const [minPixels, maxPixels] = this.pixelRange(source, view, perspective, pixelRatio, scale);
      view.roundPoints.visible =
        maxPixels > ROUND_POINT_THRESHOLD_PIXELS &&
        this.limitRoundRange(source, view, perspective, pixelRatio, scale);
      const square = view.sourceMaterial;
      squareNeeded.set(
        square,
        (squareNeeded.get(square) ?? false) || minPixels <= ROUND_POINT_THRESHOLD_PIXELS
      );
    }
    for (const [material, needed] of squareNeeded) {
      material.visible = needed;
    }
  }

  /**
   * Each pass runs every vertex through its shader even when the band test
   * rejects all of them; on an 8M-point overview that idle round pass was
   * ~17% of the frame. A pass is skipped when no point can reach its band,
   * judged from the bounding sphere's nearest and farthest view depth with
   * three's own `gl_PointSize` formula (`size * pixelRatio * scale / depth`).
   */
  private pixelRange(
    source: THREE.Points,
    view: AdaptivePointView,
    perspective: boolean,
    pixelRatio: number,
    scale: number
  ): [number, number] {
    const unknown: [number, number] = [0, Infinity];
    const material = view.sourceMaterial;
    const size = material.size * pixelRatio;
    if (!material.sizeAttenuation || !perspective) {
      return [size * (1 - BAND_MARGIN), size * (1 + BAND_MARGIN)];
    }
    // Frustum culling already trusts this sphere; a cloud that opts out of
    // culling may not keep it current.
    const sphere = source.frustumCulled ? source.geometry.boundingSphere : null;
    if (!sphere || !Number.isFinite(sphere.radius) || sphere.radius < 0) {
      return unknown;
    }
    source.updateMatrixWorld();
    const center = scratchCenter
      .copy(sphere.center)
      .applyMatrix4(source.matrixWorld)
      .applyMatrix4(this.host.camera.matrixWorldInverse);
    const radius = sphere.radius * source.matrixWorld.getMaxScaleOnAxis();
    const depth = -center.z;
    const nearest = depth - radius;
    const farthest = depth + radius;
    if (!(nearest > 0) || !Number.isFinite(farthest)) {
      // The camera is inside or beside the cloud: depths reach zero, so any
      // size is possible and both passes must run.
      return unknown;
    }
    return [
      ((size * scale) / farthest) * (1 - BAND_MARGIN),
      ((size * scale) / nearest) * (1 + BAND_MARGIN),
    ];
  }

  /**
   * Narrow the round pass to the span of chunks that can produce a disc.
   * Clouds are stored in scan or image order, so the near chunks are usually
   * a short run, and at a fitted overview often none: on an 8M-point scan that
   * took ~20% off the frame. Returns false when no chunk can. Until the chunk
   * bounds exist, the full range is drawn.
   */
  private limitRoundRange(
    source: THREE.Points,
    view: AdaptivePointView,
    perspective: boolean,
    pixelRatio: number,
    scale: number
  ): boolean {
    const range = source.geometry.drawRange;
    const sourceEnd = range.start + range.count;
    view.roundGeometry.setDrawRange(range.start, range.count);
    const position = source.geometry.getAttribute('position');
    const material = view.sourceMaterial;
    if (
      !perspective ||
      !material.sizeAttenuation ||
      // An indexed draw range counts indices, not the points the boxes cover.
      source.geometry.index ||
      !(position instanceof THREE.BufferAttribute)
    ) {
      return true;
    }
    const boxes = chunkBoxes(position, () => this.host.requestRender());
    if (!boxes) {
      return true;
    }
    source.updateMatrixWorld();
    scratchModelView.multiplyMatrices(this.host.camera.matrixWorldInverse, source.matrixWorld);
    // A point reaches the disc band only when nearer than this depth.
    const depthLimit =
      (material.size * pixelRatio * scale * (1 + BAND_MARGIN)) / ROUND_POINT_THRESHOLD_PIXELS;
    let first = -1;
    let last = -1;
    for (let chunk = 0; chunk < boxes.length / 6; chunk++) {
      const nearest = nearestBoxDepth(boxes, chunk, scratchModelView);
      if (!(nearest >= depthLimit)) {
        if (first < 0) {
          first = chunk;
        }
        last = chunk;
      }
    }
    if (first < 0) {
      return false;
    }
    const start = Math.max(range.start, first * CHUNK_POINTS);
    const end = Math.min(sourceEnd, (last + 1) * CHUNK_POINTS);
    if (end <= start) {
      return false;
    }
    view.roundGeometry.setDrawRange(start, end - start);
    return true;
  }

  private pointClouds(): THREE.Points[] {
    return this.host.meshes.filter(
      (mesh): mesh is THREE.Points =>
        mesh instanceof THREE.Points && mesh.material instanceof THREE.PointsMaterial
    );
  }

  private createView(source: THREE.Points): AdaptivePointView {
    const sourceMaterial = source.material as THREE.PointsMaterial;
    // The material's *own* hooks, never a band wrapper this class installed
    // earlier. A material can reach here twice — a depth reconversion assigns
    // the new material to the existing mesh, which builds a view, and then
    // hands the same material to the replacement mesh, which builds another —
    // and capturing the wrapper as "inherited" made the second round pass
    // inherit the square pass's rejection on top of its own. The two are
    // complementary, so between them they rejected every point: everything
    // above the pixel threshold was drawn by nobody, and raising the point
    // size only pushed more points over it.
    const { compile: inheritedCompile, cacheKey: inheritedCacheKey } =
      originalHooks(sourceMaterial);
    const roundMaterial = sourceMaterial.clone();

    configurePointBand(sourceMaterial, 'square', inheritedCompile, inheritedCacheKey);
    configurePointBand(roundMaterial, 'round', inheritedCompile, inheritedCacheKey);

    const roundGeometry = new THREE.BufferGeometry();
    shareAttributes(roundGeometry, source.geometry);
    const roundPoints = new THREE.Points(roundGeometry, roundMaterial);
    roundPoints.name = 'adaptive-round-pass';
    roundPoints.frustumCulled = source.frustumCulled;
    source.add(roundPoints);
    return {
      sourceMaterial,
      sourceMaterialVersion: sourceMaterial.version,
      roundPoints,
      roundMaterial,
      roundGeometry,
    };
  }

  private syncView(source: THREE.Points, view: AdaptivePointView): void {
    const square = view.sourceMaterial;
    const round = view.roundMaterial;
    shareAttributes(view.roundGeometry, source.geometry);
    view.roundPoints.frustumCulled = source.frustumCulled;

    round.size = square.size;
    round.color.copy(square.color);
    round.opacity = square.opacity;

    // `needsUpdate` increments Material.version. Mirror that invalidation so
    // shader-affecting changes such as the sRGB decode mode reach both passes.
    let requiresUpdate = view.sourceMaterialVersion !== square.version;
    view.sourceMaterialVersion = square.version;
    const sync = <K extends keyof THREE.PointsMaterial>(key: K) => {
      if (round[key] !== square[key]) {
        (round[key] as THREE.PointsMaterial[K]) = square[key];
        requiresUpdate = true;
      }
    };
    sync('transparent');
    sync('blending');
    sync('depthTest');
    sync('depthWrite');
    sync('depthFunc');
    sync('colorWrite');
    sync('fog');
    sync('vertexColors');
    sync('sizeAttenuation');
    sync('toneMapped');
    sync('premultipliedAlpha');
    sync('dithering');
    sync('alphaHash');
    sync('alphaToCoverage');
    if (requiresUpdate) {
      round.needsUpdate = true;
    }
  }

  private removeView(source: THREE.Points, view: AdaptivePointView): void {
    view.sourceMaterial.visible = true;
    source.remove(view.roundPoints);
    view.roundMaterial.dispose();
    // Disposing a geometry deletes its attributes' GL buffers, which belong
    // to the source. Detach them first; this releases only the round VAO.
    for (const name of Object.keys(view.roundGeometry.attributes)) {
      view.roundGeometry.deleteAttribute(name);
    }
    view.roundGeometry.dispose();
    this.views.delete(source);
  }

  dispose(): void {
    this.removeAllViews();
  }

  private removeAllViews(): void {
    for (const [source, view] of this.views) {
      this.removeView(source, view);
    }
  }
}

/** Point `target` at the source's attribute objects and bounds; no data is copied. */
function shareAttributes(target: THREE.BufferGeometry, source: THREE.BufferGeometry): void {
  for (const name of Object.keys(source.attributes)) {
    if (target.attributes[name] !== source.attributes[name]) {
      target.setAttribute(name, source.attributes[name]);
    }
  }
  for (const name of Object.keys(target.attributes)) {
    if (!(name in source.attributes)) {
      target.deleteAttribute(name);
    }
  }
  if (target.index !== source.index) {
    target.setIndex(source.index);
  }
  // Frustum culling would otherwise compute a sphere over every point - for
  // this pass too, when a cloud arrives without bounds (three computes the
  // source's on this frame anyway; the fast path gives the same sphere).
  if (!source.boundingSphere && source.getAttribute('position')) {
    computePositionBounds(source);
  }
  target.boundingSphere = source.boundingSphere;
  target.boundingBox = source.boundingBox;
}

/**
 * The pristine `onBeforeCompile` / `customProgramCacheKey` for a material.
 *
 * Stashed on first sight and returned unchanged afterwards, so configuring a
 * band is idempotent however many times a material passes through a view.
 */
const PRISTINE_HOOKS = new WeakMap<
  THREE.Material,
  { compile: THREE.Material['onBeforeCompile']; cacheKey: () => string }
>();

function originalHooks(material: THREE.PointsMaterial): {
  compile: THREE.Material['onBeforeCompile'];
  cacheKey: () => string;
} {
  const existing = PRISTINE_HOOKS.get(material);
  if (existing) {
    return existing;
  }
  const hooks = {
    compile: material.onBeforeCompile,
    cacheKey: material.customProgramCacheKey.bind(material),
  };
  PRISTINE_HOOKS.set(material, hooks);
  return hooks;
}

function configurePointBand(
  material: THREE.PointsMaterial,
  band: PointBand,
  inheritedCompile: THREE.Material['onBeforeCompile'],
  inheritedCacheKey: () => string
): void {
  const round = band === 'round';
  material.map = null;
  material.alphaMap = round ? getRoundPointTexture() : null;
  material.alphaTest = round ? 0.5 : 0;
  material.onBeforeCompile = (shader, renderer) => {
    inheritedCompile.call(material, shader, renderer);
    const cutoff = ROUND_POINT_THRESHOLD_PIXELS.toFixed(1);
    const reject = round ? `gl_PointSize <= ${cutoff}` : `gl_PointSize > ${cutoff}`;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <logdepthbuf_vertex>',
      `if (${reject}) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); }\n#include <logdepthbuf_vertex>`
    );
  };
  material.customProgramCacheKey = () => `${inheritedCacheKey()}|point-band:${band}`;
  material.needsUpdate = true;
}
