import * as THREE from 'three';
import {
  getRoundPointTexture,
  updateProjectedPointShapes,
} from './visualization/PointCloudRenderer';

export type PointExperimentMode =
  | 'baseline'
  | 'adaptive'
  | 'adaptive-two-pass'
  | 'no-alpha'
  | 'transparent'
  | 'front-to-back'
  | 'depth-prepass';

export type PointExperimentPose = 'normal' | 'degenerate';

export interface PointExperimentResult {
  mode: PointExperimentMode;
  pose: PointExperimentPose;
  pointFraction: number;
  renderedPoints: number;
  medianFrameMs: number;
  p95FrameMs: number;
  gpuMs: number;
  frames: number;
}

interface CameraPose {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  target: THREE.Vector3;
}

interface ExperimentHost {
  camera: THREE.PerspectiveCamera;
  controls: { target: THREE.Vector3; enabled: boolean; update(): void };
  scene: THREE.Scene;
  renderer: { domElement: HTMLCanvasElement };
  meshes: (THREE.Mesh | THREE.Points | THREE.LineSegments)[];
  webglRenderer: THREE.WebGLRenderer | null;
  rendererBackend: string;
  gpuTimer: { averageMs: number };
  allowTransparency: boolean;
  requestRender(): void;
  fitCameraToAllObjects(): void;
}

interface ChunkView {
  source: THREE.Points;
  group: THREE.Group;
  chunks: THREE.Points[];
}

interface TwoPassView {
  source: THREE.Points;
  group: THREE.Group;
  square: THREE.Points;
  round: THREE.Points;
}

export const POINT_EXPERIMENT_LABELS: Record<PointExperimentMode, string> = {
  baseline: 'Baseline — original round points',
  adaptive: 'Adaptive — whole cloud at 4 px',
  'adaptive-two-pass': 'Adaptive 2-pass — per point at 4 px',
  'no-alpha': 'A — square, no alpha test',
  transparent: 'B — round, transparent',
  'front-to-back': 'D — square, front-to-back chunks',
  'depth-prepass': 'C — square, depth prepass',
};

const SAMPLE_FRAMES = 120;
const WARMUP_FRAMES = 30;
const RENDER_CHUNK_POINTS = 250_000;

/**
 * Runtime-only point-rendering laboratory. It deliberately changes no saved
 * setting and restores normal rendering when reset or when the webview closes.
 */
export class PointRenderingExperiments {
  private mode: PointExperimentMode = 'baseline';
  private pointFraction = 1;
  private readonly originalDrawRanges = new Map<
    THREE.BufferGeometry,
    { start: number; count: number }
  >();
  private readonly originalIndices = new Map<THREE.BufferGeometry, THREE.BufferAttribute | null>();
  private readonly decimatedIndices = new Map<THREE.BufferGeometry, THREE.BufferAttribute>();
  private readonly chunkViews: ChunkView[] = [];
  private readonly twoPassViews: TwoPassView[] = [];
  private normalPose: CameraPose | null = null;
  private degeneratePose: CameraPose | null = null;
  private measuring = false;

  constructor(private readonly host: ExperimentHost) {}

  get currentMode(): PointExperimentMode {
    return this.mode;
  }

  get currentPointFraction(): number {
    return this.pointFraction;
  }

  hasNormalPose(): boolean {
    return this.normalPose !== null;
  }

  captureNormalPose(): void {
    this.normalPose = this.capturePose();
    this.degeneratePose = this.makeDegeneratePose(this.normalPose);
  }

  fitAndCaptureNormalPose(): void {
    this.host.fitCameraToAllObjects();
    this.captureNormalPose();
    this.host.requestRender();
  }

  applyPose(pose: PointExperimentPose): void {
    if (!this.normalPose) {
      this.fitAndCaptureNormalPose();
    }
    const saved = pose === 'normal' ? this.normalPose : this.degeneratePose;
    if (!saved) {
      throw new Error('Load a point cloud before setting an experiment pose.');
    }
    this.host.camera.position.copy(saved.position);
    this.host.camera.quaternion.copy(saved.quaternion);
    this.host.controls.target.copy(saved.target);
    this.host.controls.update();
    this.host.requestRender();
  }

  applyMode(mode: PointExperimentMode): void {
    this.removeChunkViews();
    this.removeTwoPassViews();
    this.mode = mode;
    const round = mode === 'baseline' || mode === 'transparent';
    const transparent = mode === 'transparent';

    for (const points of this.pointClouds()) {
      const material = points.material as THREE.PointsMaterial;
      material.map = null;
      material.alphaMap = round ? getRoundPointTexture() : null;
      material.alphaTest = round ? 0.5 : 0;
      material.transparent =
        mode === 'baseline' || mode === 'adaptive' || mode === 'adaptive-two-pass'
          ? this.host.allowTransparency
          : transparent;
      material.depthTest = true;
      material.depthWrite = true;
      material.needsUpdate = true;
    }

    if (mode === 'front-to-back') {
      this.createChunkViews();
    }
    if (mode === 'adaptive-two-pass') {
      this.createTwoPassViews();
    }
    if (mode === 'adaptive') {
      updateProjectedPointShapes(
        this.pointClouds(false),
        this.host.camera,
        this.host.renderer.domElement.height,
        this.host.allowTransparency
      );
    }
    this.applyPointFraction(this.pointFraction);
    this.host.requestRender();
  }

  applyPointFraction(fraction: number): void {
    this.pointFraction = Math.max(0.01, Math.min(1, fraction));
    for (const points of this.pointClouds(false)) {
      const geometry = points.geometry;
      if (!this.originalDrawRanges.has(geometry)) {
        this.originalDrawRanges.set(geometry, { ...geometry.drawRange });
        this.originalIndices.set(geometry, geometry.index);
      }
      const positionCount = geometry.getAttribute('position')?.count ?? 0;
      const originalIndex = this.originalIndices.get(geometry) ?? null;
      const total = originalIndex?.count ?? positionCount;
      if (this.pointFraction >= 1) {
        geometry.setIndex(originalIndex);
        const range = this.originalDrawRanges.get(geometry)!;
        geometry.setDrawRange(range.start, range.count);
      } else {
        const count = Math.max(1, Math.floor(total * this.pointFraction));
        let index = this.decimatedIndices.get(geometry);
        if (!index || index.count !== count) {
          const values = new Uint32Array(count);
          const stride = total / count;
          for (let i = 0; i < count; i++) {
            const sourceIndex = Math.min(total - 1, Math.floor(i * stride));
            values[i] = originalIndex ? originalIndex.getX(sourceIndex) : sourceIndex;
          }
          index = new THREE.BufferAttribute(values, 1);
          this.decimatedIndices.set(geometry, index);
        }
        geometry.setIndex(index);
        geometry.setDrawRange(0, count);
      }
    }
    if (this.mode === 'front-to-back') {
      this.removeChunkViews();
      this.createChunkViews();
    }
    this.host.requestRender();
  }

  beforeRender(): void {
    if (this.mode === 'adaptive') {
      updateProjectedPointShapes(
        this.pointClouds(false),
        this.host.camera,
        this.host.renderer.domElement.height,
        this.host.allowTransparency
      );
      return;
    }
    if (this.mode === 'adaptive-two-pass') {
      for (const view of this.twoPassViews) {
        syncExperimentTransform(view.source, view.group);
        const source = view.source.material as THREE.PointsMaterial;
        for (const points of [view.square, view.round]) {
          const material = points.material as THREE.PointsMaterial;
          material.size = source.size;
          material.color.copy(source.color);
          material.opacity = source.opacity;
        }
      }
      return;
    }
    if (this.mode !== 'front-to-back') {
      return;
    }
    const cameraPosition = this.host.camera.position;
    for (const view of this.chunkViews) {
      view.chunks
        .map(chunk => {
          _world.copy(chunk.userData.experimentCenter);
          view.group.localToWorld(_world);
          return { chunk, distance: cameraPosition.distanceToSquared(_world) };
        })
        .sort((a, b) => a.distance - b.distance)
        .forEach((entry, index) => (entry.chunk.renderOrder = index));
    }
  }

  /** Returns true when this mode rendered the complete frame itself. */
  renderDepthPrepass(): boolean {
    if (this.mode !== 'depth-prepass' || !this.host.webglRenderer) {
      return false;
    }
    const renderer = this.host.webglRenderer;
    const points = this.pointClouds();
    const hidden: THREE.Object3D[] = [];
    const colorWrites: boolean[] = [];

    this.host.scene.traverse(object => {
      if (object.visible && !(object instanceof THREE.Points) && object !== this.host.scene) {
        hidden.push(object);
        object.visible = false;
      }
    });
    points.forEach((cloud, index) => {
      const material = cloud.material as THREE.PointsMaterial;
      colorWrites[index] = material.colorWrite;
      material.colorWrite = false;
    });

    const autoClear = renderer.autoClear;
    try {
      renderer.autoClear = true;
      renderer.render(this.host.scene, this.host.camera);
      points.forEach((cloud, index) => {
        (cloud.material as THREE.PointsMaterial).colorWrite = colorWrites[index];
      });
      hidden.forEach(object => (object.visible = true));
      renderer.autoClear = false;
      renderer.render(this.host.scene, this.host.camera);
    } finally {
      renderer.autoClear = autoClear;
      points.forEach((cloud, index) => {
        (cloud.material as THREE.PointsMaterial).colorWrite = colorWrites[index];
      });
      hidden.forEach(object => (object.visible = true));
    }
    return true;
  }

  async measure(
    pose: PointExperimentPose,
    sampleFrames = SAMPLE_FRAMES,
    warmupFrames = WARMUP_FRAMES
  ): Promise<PointExperimentResult> {
    if (this.measuring) {
      throw new Error('A point-rendering measurement is already running.');
    }
    if (this.pointClouds(false).length === 0) {
      throw new Error('Load a point cloud before running the benchmark.');
    }
    this.measuring = true;
    const controlsEnabled = this.host.controls.enabled;
    this.host.controls.enabled = false;
    try {
      this.applyPose(pose);
      const samples = await this.sampleFrames(warmupFrames + sampleFrames);
      const warm = samples.slice(warmupFrames).sort((a, b) => a - b);
      const renderedPoints = this.pointClouds(false).reduce((sum, cloud) => {
        return sum + geometryDrawCount(cloud.geometry);
      }, 0);
      return {
        mode: this.mode,
        pose,
        pointFraction: this.pointFraction,
        renderedPoints,
        medianFrameMs: percentile(warm, 0.5),
        p95FrameMs: percentile(warm, 0.95),
        gpuMs: this.host.gpuTimer.averageMs,
        frames: warm.length,
      };
    } finally {
      this.host.controls.enabled = controlsEnabled;
      this.measuring = false;
    }
  }

  reset(): void {
    this.removeChunkViews();
    this.removeTwoPassViews();
    for (const [geometry, range] of this.originalDrawRanges) {
      geometry.setIndex(this.originalIndices.get(geometry) ?? null);
      geometry.setDrawRange(range.start, range.count);
    }
    this.originalDrawRanges.clear();
    this.originalIndices.clear();
    this.decimatedIndices.clear();
    this.pointFraction = 1;
    this.applyMode('baseline');
  }

  private pointClouds(includeChunkViews = true): THREE.Points[] {
    const result: THREE.Points[] = [];
    for (const mesh of this.host.meshes) {
      if (mesh instanceof THREE.Points && mesh.material instanceof THREE.PointsMaterial) {
        result.push(mesh);
      }
    }
    if (includeChunkViews) {
      for (const view of this.chunkViews) {
        result.push(...view.chunks);
      }
    }
    return result;
  }

  private capturePose(): CameraPose {
    return {
      position: this.host.camera.position.clone(),
      quaternion: this.host.camera.quaternion.clone(),
      target: this.host.controls.target.clone(),
    };
  }

  private makeDegeneratePose(normal: CameraPose): CameraPose {
    const direction = normal.position.clone().sub(normal.target);
    const normalDistance = Math.max(direction.length(), 0.001);
    // A normally fitted cloud occupies most of the shorter viewport axis.
    // Moving 150x farther away makes it roughly a five-pixel speck at 720px.
    const distance = normalDistance * 150;
    const position = normal.target.clone().add(direction.normalize().multiplyScalar(distance));
    return {
      ...normal,
      position,
      quaternion: normal.quaternion.clone(),
      target: normal.target.clone(),
    };
  }

  private sampleFrames(count: number): Promise<number[]> {
    return new Promise(resolve => {
      const samples: number[] = [];
      let previous = performance.now();
      const tick = (now: number) => {
        samples.push(now - previous);
        previous = now;
        this.host.requestRender();
        if (samples.length < count) {
          requestAnimationFrame(tick);
        } else {
          resolve(samples);
        }
      };
      this.host.requestRender();
      requestAnimationFrame(tick);
    });
  }

  private createChunkViews(): void {
    for (const source of this.pointClouds(false)) {
      if (!source.visible) {continue;}
      const position = source.geometry.getAttribute('position');
      if (!position) {continue;}
      const visibleCount = geometryDrawCount(source.geometry);
      const group = new THREE.Group();
      group.name = 'point-rendering-experiment-chunks';
      group.position.copy(source.position);
      group.quaternion.copy(source.quaternion);
      group.scale.copy(source.scale);
      const chunks: THREE.Points[] = [];
      for (let start = 0; start < visibleCount; start += RENDER_CHUNK_POINTS) {
        const count = Math.min(RENDER_CHUNK_POINTS, visibleCount - start);
        const geometry = new THREE.BufferGeometry();
        for (const name of Object.keys(source.geometry.attributes)) {
          geometry.setAttribute(name, source.geometry.getAttribute(name));
        }
        geometry.setIndex(source.geometry.index);
        geometry.setDrawRange(start, count);
        const cloud = new THREE.Points(geometry, source.material);
        cloud.frustumCulled = false;
        cloud.userData.experimentCenter = chunkCenter(position, start, count);
        group.add(cloud);
        chunks.push(cloud);
      }
      source.visible = false;
      this.host.scene.add(group);
      this.chunkViews.push({ source, group, chunks });
    }
  }

  private removeChunkViews(): void {
    for (const view of this.chunkViews) {
      view.source.visible = true;
      this.host.scene.remove(view.group);
      for (const chunk of view.chunks) {chunk.geometry.dispose();}
    }
    this.chunkViews.length = 0;
  }

  private createTwoPassViews(): void {
    for (const source of this.pointClouds(false)) {
      if (!source.visible) {continue;}
      const sourceMaterial = source.material as THREE.PointsMaterial;
      const square = new THREE.Points(source.geometry, pointBandMaterial(sourceMaterial, 'square'));
      const round = new THREE.Points(source.geometry, pointBandMaterial(sourceMaterial, 'round'));
      square.frustumCulled = source.frustumCulled;
      round.frustumCulled = source.frustumCulled;

      const group = new THREE.Group();
      group.name = 'point-rendering-experiment-two-pass';
      syncExperimentTransform(source, group);
      group.add(square, round);
      source.visible = false;
      this.host.scene.add(group);
      this.twoPassViews.push({ source, group, square, round });
    }
  }

  private removeTwoPassViews(): void {
    for (const view of this.twoPassViews) {
      view.source.visible = true;
      this.host.scene.remove(view.group);
      (view.square.material as THREE.Material).dispose();
      (view.round.material as THREE.Material).dispose();
    }
    this.twoPassViews.length = 0;
  }
}

const _world = new THREE.Vector3();

type PointBand = 'square' | 'round';

/** Keep the visible experiment proxies on the source cloud's exact transform. */
function syncExperimentTransform(source: THREE.Points, proxy: THREE.Group): void {
  if (source.matrixAutoUpdate) {source.updateMatrix();}
  proxy.matrix.copy(source.matrix);
  proxy.matrixAutoUpdate = false;
  proxy.matrixWorldNeedsUpdate = true;
}

/**
 * Clone one source material into an exact projected-size band. Both passes
 * share geometry, but only the matching pass reaches rasterization: the cheap
 * square fragment shader therefore contains no texture lookup or discard.
 */
function pointBandMaterial(source: THREE.PointsMaterial, band: PointBand): THREE.PointsMaterial {
  const material = source.clone();
  const inheritedCompile = source.onBeforeCompile;
  const inheritedCacheKey = source.customProgramCacheKey.bind(source);
  const round = band === 'round';
  material.map = null;
  material.alphaMap = round ? getRoundPointTexture() : null;
  material.alphaTest = round ? 0.5 : 0;
  material.needsUpdate = true;
  material.onBeforeCompile = (shader, renderer) => {
    inheritedCompile.call(source, shader, renderer);
    const reject = round ? 'gl_PointSize <= 4.0' : 'gl_PointSize > 4.0';
    shader.vertexShader = shader.vertexShader.replace(
      '#include <logdepthbuf_vertex>',
      `if (${reject}) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); }\n#include <logdepthbuf_vertex>`
    );
  };
  material.customProgramCacheKey = () => `${inheritedCacheKey()}|point-band:${band}`;
  return material;
}

function chunkCenter(
  position: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  start: number,
  count: number
): THREE.Vector3 {
  const center = new THREE.Vector3();
  const stride = Math.max(1, Math.floor(count / 256));
  let samples = 0;
  for (let i = start; i < start + count; i += stride) {
    center.x += position.getX(i);
    center.y += position.getY(i);
    center.z += position.getZ(i);
    samples++;
  }
  return center.multiplyScalar(1 / Math.max(samples, 1));
}

function percentile(sorted: number[], fraction: number): number {
  if (sorted.length === 0) {return 0;}
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
}

function geometryDrawCount(geometry: THREE.BufferGeometry): number {
  const available = geometry.index?.count ?? geometry.getAttribute('position')?.count ?? 0;
  return Math.max(0, Math.min(available - geometry.drawRange.start, geometry.drawRange.count));
}
