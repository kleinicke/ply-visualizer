import * as THREE from 'three';
import { getRoundPointTexture, ROUND_POINT_THRESHOLD_PIXELS } from './PointCloudRenderer';

interface AdaptivePointRendererHost {
  meshes: (THREE.Mesh | THREE.Points | THREE.LineSegments)[];
  rendererBackend: string;
}

interface AdaptivePointView {
  sourceMaterial: THREE.PointsMaterial;
  sourceMaterialVersion: number;
  roundPoints: THREE.Points;
  roundMaterial: THREE.PointsMaterial;
}

type PointBand = 'square' | 'round';

/**
 * Renders small points as cheap square sprites and larger points as discs.
 *
 * Both passes share the source geometry. The source Points object is the square
 * pass; a child Points object is the round pass, so file transforms, alignment,
 * visibility, and removal are inherited without maintaining proxy transforms.
 * Each vertex reaches rasterization in exactly one pass.
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

    for (const source of sources) {
      let view = this.views.get(source);
      if (!view) {
        view = this.createView(source);
        this.views.set(source, view);
      }
      this.syncView(source, view);
    }
  }

  private pointClouds(): THREE.Points[] {
    return this.host.meshes.filter(
      (mesh): mesh is THREE.Points =>
        mesh instanceof THREE.Points && mesh.material instanceof THREE.PointsMaterial
    );
  }

  private createView(source: THREE.Points): AdaptivePointView {
    const sourceMaterial = source.material as THREE.PointsMaterial;
    const inheritedCompile = sourceMaterial.onBeforeCompile;
    const inheritedCacheKey = sourceMaterial.customProgramCacheKey.bind(sourceMaterial);
    const roundMaterial = sourceMaterial.clone();

    configurePointBand(sourceMaterial, 'square', inheritedCompile, inheritedCacheKey);
    configurePointBand(roundMaterial, 'round', inheritedCompile, inheritedCacheKey);

    const roundPoints = new THREE.Points(source.geometry, roundMaterial);
    roundPoints.name = 'adaptive-round-pass';
    roundPoints.frustumCulled = source.frustumCulled;
    source.add(roundPoints);
    return {
      sourceMaterial,
      sourceMaterialVersion: sourceMaterial.version,
      roundPoints,
      roundMaterial,
    };
  }

  private syncView(source: THREE.Points, view: AdaptivePointView): void {
    const square = view.sourceMaterial;
    const round = view.roundMaterial;
    view.roundPoints.geometry = source.geometry;
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
    source.remove(view.roundPoints);
    view.roundMaterial.dispose();
    this.views.delete(source);
  }

  private removeAllViews(): void {
    for (const [source, view] of this.views) {
      this.removeView(source, view);
    }
  }
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
