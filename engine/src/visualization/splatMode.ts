import * as THREE from 'three';
import { SpatialData } from '../interfaces';
import { perfLog } from '../utils/perfLog';

type SparkModule = typeof import('@sparkjsdev/spark');
type SplatMesh = import('@sparkjsdev/spark').SplatMesh;
type SparkRenderer = import('@sparkjsdev/spark').SparkRenderer;

interface MaxSplatSizeData {
  originalScales: Float32Array;
  maxScale: Float32Array;
  largestScale: number;
}

export interface MaxSplatSizeRange {
  min: number;
  max: number;
}

/** File extensions of splat-native container formats Spark can decode. */
export const SPLAT_CONTAINER_EXTENSIONS = ['spz', 'splat', 'ksplat', 'sog'] as const;
export const SPLAT_CONTAINER_REGEX = /\.(spz|splat|ksplat|sog)$/i;

/**
 * Everything the splat mode needs from the visualizer. All fields are live
 * references into PointCloudVisualizer; the two callbacks are assigned by
 * main.ts after construction (they reach private members there).
 */
export interface SplatModeHost {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  spatialFiles: SpatialData[];
  splatModeActive: boolean[];
  fileVisibility: boolean[];
  transformationMatrices: THREE.Matrix4[];
  requestRender(): void;
  showStatus(message: string): void;
}

/**
 * Per-file "render as gaussian splats" mode, backed by Spark
 * (https://sparkjs.dev). Covers two kinds of files:
 *
 * - 3DGS PLY files: open as a DC-colored point cloud, with splat rendering
 *   behind the per-file toggle.
 * - Splat-native containers (.spz/.splat/.ksplat/.sog): decoded by Spark up
 *   front (loadContainer), their gaussian centers extracted into a normal
 *   SpatialData entry, and splat mode enabled automatically after the file
 *   is added (autoEnablePending).
 *
 * The point-cloud representation stays loaded but hidden while splat mode is
 * on — picking/measurement keep working against the gaussian centers
 * (SelectionManager filters on fileVisibility, not mesh.visible).
 *
 * Spark is ~5 MB including its WASM sorter, so it is loaded on first use via
 * dynamic import; users who never touch splats pay nothing.
 */
export class SplatModeManager {
  private host: SplatModeHost;
  private sparkImport: Promise<SparkModule> | null = null;
  private sparkRenderer: SparkRenderer | null = null;
  // Parallel to host.spatialFiles; kept aligned by onFileRemoved().
  private splatMeshes: (SplatMesh | null)[] = [];
  // Identity-based rather than index-based: file indices shift when an entry
  // is removed while Spark is fetching/decoding.
  private pending = new Set<SpatialData>();
  // Actual local-space splat size threshold. Undefined means uncapped.
  private maxSplatSizeValue: (number | undefined)[] = [];
  private maxSplatSizeData = new WeakMap<SplatMesh, MaxSplatSizeData>();
  private filterTimers = new Map<SpatialData, number>();
  // Meshes built by loadContainer() before their file has an index; adopted
  // by enable() (keyed by the SpatialData object, so index shifts are safe).
  private pendingMeshes = new Map<SpatialData, SplatMesh>();

  /** Recompute a file's point/splat visibility; wired to main's private
   *  updateMeshVisibilityAndMaterial. */
  refreshVisibility: (fileIndex: number) => void = () => {};
  /** Re-style the render-mode buttons; wired to renderModeToggles. */
  refreshButtons: () => void = () => {};

  constructor(host: SplatModeHost) {
    this.host = host;
  }

  isActive(fileIndex: number): boolean {
    return !!this.host.splatModeActive[fileIndex];
  }

  anyActive(): boolean {
    return this.host.splatModeActive.some(Boolean);
  }

  /** True when the file is a 3DGS splat whose source is still reachable. */
  canEnable(data: SpatialData | undefined): boolean {
    return (
      !!data?.isGaussianSplat &&
      !!(data.splatSource?.bytes || data.splatSource?.url || this.pendingMeshes.has(data))
    );
  }

  getMesh(fileIndex: number): THREE.Object3D | null {
    return this.splatMeshes[fileIndex] ?? null;
  }

  async toggle(fileIndex: number): Promise<void> {
    const data = this.host.spatialFiles[fileIndex];
    if (!data || this.pending.has(data)) {
      return;
    }
    if (this.isActive(fileIndex)) {
      this.disable(fileIndex);
    } else {
      await this.enable(fileIndex);
    }
  }

  getMaxSplatSizeRange(fileIndex: number): MaxSplatSizeRange {
    const mesh = this.splatMeshes[fileIndex];
    if (!mesh) {
      return { min: 0.01, max: 1 };
    }
    const sizeData = this.ensureMaxSplatSizeData(mesh);
    return {
      min: Math.min(0.01, sizeData.largestScale),
      max: sizeData.largestScale,
    };
  }

  getMaxSplatSizeValue(fileIndex: number): number {
    const range = this.getMaxSplatSizeRange(fileIndex);
    const value = this.maxSplatSizeValue[fileIndex];
    return value === undefined ? range.max : Math.max(range.min, Math.min(range.max, value));
  }

  /** Slider coordinates are 0..100, logarithmically mapped to real splat sizes. */
  getMaxSplatSizeSlider(fileIndex: number): number {
    const range = this.getMaxSplatSizeRange(fileIndex);
    if (range.max <= range.min) {
      return 100;
    }
    const value = this.getMaxSplatSizeValue(fileIndex);
    return (100 * Math.log(value / range.min)) / Math.log(range.max / range.min);
  }

  setMaxSplatSizeSlider(fileIndex: number, sliderValue: number): number {
    const range = this.getMaxSplatSizeRange(fileIndex);
    const position = Math.max(0, Math.min(100, sliderValue)) / 100;
    const value =
      range.max <= range.min ? range.max : range.min * Math.pow(range.max / range.min, position);
    return this.setMaxSplatSizeValue(fileIndex, value);
  }

  setMaxSplatSizeValue(fileIndex: number, value: number): number {
    const data = this.host.spatialFiles[fileIndex];
    if (!data || !Number.isFinite(value) || value <= 0) {
      return this.getMaxSplatSizeValue(fileIndex);
    }
    const range = this.getMaxSplatSizeRange(fileIndex);
    const clampedValue = Math.max(range.min, Math.min(range.max, value));
    this.maxSplatSizeValue[fileIndex] = clampedValue;
    const oldTimer = this.filterTimers.get(data);
    if (oldTimer !== undefined) {
      window.clearTimeout(oldTimer);
    }
    // Re-encoding every splat is intentionally debounced while dragging.
    this.filterTimers.set(
      data,
      window.setTimeout(() => {
        this.filterTimers.delete(data);
        const currentIndex = this.host.spatialFiles.indexOf(data);
        if (currentIndex >= 0) {
          this.applyMaxSplatSize(currentIndex);
        }
      }, 100)
    );
    return clampedValue;
  }

  resetMaxSplatSize(fileIndex: number): number {
    return this.setMaxSplatSizeValue(fileIndex, this.getMaxSplatSizeRange(fileIndex).max);
  }

  private ensureMaxSplatSizeData(mesh: SplatMesh): MaxSplatSizeData {
    const cached = this.maxSplatSizeData.get(mesh);
    if (cached) {
      return cached;
    }

    let count = 0;
    mesh.forEachSplat(index => {
      count = Math.max(count, index + 1);
    });
    const originalScales = new Float32Array(count * 3);
    const maxScale = new Float32Array(count);
    let largestScale = 0;
    mesh.forEachSplat((index, _center, scales) => {
      const i3 = index * 3;
      originalScales[i3] = scales.x;
      originalScales[i3 + 1] = scales.y;
      originalScales[i3 + 2] = scales.z;
      const splatMaxScale = Math.max(Math.abs(scales.x), Math.abs(scales.y), Math.abs(scales.z));
      maxScale[index] = splatMaxScale;
      if (splatMaxScale > 0 && Number.isFinite(splatMaxScale)) {
        largestScale = Math.max(largestScale, splatMaxScale);
      }
    });
    if (!(largestScale > 0)) {
      largestScale = 1;
    }
    const sizeData = { originalScales, maxScale, largestScale };
    this.maxSplatSizeData.set(mesh, sizeData);
    return sizeData;
  }

  private applyMaxSplatSize(fileIndex: number): void {
    const mesh = this.splatMeshes[fileIndex];
    if (!mesh) {
      return;
    }
    const editableSplats = mesh.extSplats ?? mesh.packedSplats;
    if (!editableSplats) {
      this.host.showStatus('Maximum splat size is unavailable for this streamed format.');
      return;
    }

    const filterData = this.ensureMaxSplatSizeData(mesh);
    const threshold = this.getMaxSplatSizeValue(fileIndex);
    const adjustedScales = new THREE.Vector3();
    mesh.forEachSplat((index, center, _scales, quaternion, opacity, color) => {
      const i3 = index * 3;
      adjustedScales.set(
        filterData!.originalScales[i3],
        filterData!.originalScales[i3 + 1],
        filterData!.originalScales[i3 + 2]
      );
      const originalMax = filterData!.maxScale[index];
      if (originalMax > threshold && threshold > 0) {
        adjustedScales.multiplyScalar(threshold / originalMax);
      }
      editableSplats.setSplat(index, center, adjustedScales, quaternion, opacity, color);
    });
    if (mesh.packedSplats) {
      mesh.packedSplats.needsUpdate = true;
    }
    if (mesh.extSplats) {
      mesh.extSplats.textures[0].needsUpdate = true;
      mesh.extSplats.textures[1].needsUpdate = true;
    }
    mesh.updateVersion();
    this.host.showStatus('');
    this.host.requestRender();
  }

  /**
   * Decode a splat-native container (.spz/.splat/.ksplat/.sog) and extract
   * its gaussian centers/colors into a SpatialData entry. The decoded
   * SplatMesh is parked in pendingMeshes so the follow-up enable() (via
   * autoEnablePending) doesn't decode twice.
   */
  async loadContainer(fileName: string, bytes: Uint8Array): Promise<SpatialData> {
    const t0 = performance.now();
    const spark = await this.loadSpark();
    const sparkMs = performance.now() - t0;
    const mesh = new spark.SplatMesh({ fileBytes: bytes, fileName });
    await mesh.initialized;
    const decodeDone = performance.now();

    // Size the arrays via a counting pass — numSplats isn't part of the
    // typed public surface across Spark versions.
    let count = 0;
    mesh.forEachSplat(() => count++);
    const positions = new Float32Array(count * 3);
    const colors = new Uint8Array(count * 3);
    const opacity = new Float32Array(count);
    mesh.forEachSplat((index, center, _scales, _quaternion, alpha, color) => {
      const i3 = index * 3;
      positions[i3] = center.x;
      positions[i3 + 1] = center.y;
      positions[i3 + 2] = center.z;
      colors[i3] = Math.max(0, Math.min(255, Math.round(color.r * 255)));
      colors[i3 + 1] = Math.max(0, Math.min(255, Math.round(color.g * 255)));
      colors[i3 + 2] = Math.max(0, Math.min(255, Math.round(color.b * 255)));
      opacity[index] = alpha;
    });

    const data: SpatialData = {
      vertices: [],
      faces: [],
      format: 'binary_little_endian',
      version: '1.0',
      comments: [`Gaussian splat container (${fileName.split('.').pop()?.toLowerCase()})`],
      vertexCount: count,
      faceCount: 0,
      hasColors: true,
      hasNormals: false,
      hasIntensity: false,
      isGaussianSplat: true,
      splatSource: { bytes },
      fileName,
      useTypedArrays: true,
      positionsArray: positions,
      colorsArray: colors,
      normalsArray: null,
      intensityArray: null,
      scalarFields: { opacity },
    };
    this.pendingMeshes.set(data, mesh);
    perfLog(
      `⏱️ PERF[splat ${fileName}] spark-load ${sparkMs.toFixed(1)}ms · decode ${(decodeDone - t0 - sparkMs).toFixed(1)}ms · extract ${(performance.now() - decodeDone).toFixed(1)}ms | total ${(performance.now() - t0).toFixed(1)}ms  (${count.toLocaleString()} splats · spark)`
    );
    return data;
  }

  /**
   * Enable splat mode for any freshly added container files. Called by
   * main's displayFiles/addNewFiles after file indices exist; idempotent.
   */
  autoEnablePending(): void {
    if (this.pendingMeshes.size === 0) {
      return;
    }
    for (let i = 0; i < this.host.spatialFiles.length; i++) {
      if (this.pendingMeshes.has(this.host.spatialFiles[i]) && !this.isActive(i)) {
        void this.enable(i);
      }
    }
  }

  private loadSpark(): Promise<SparkModule> {
    this.sparkImport ??= import(/* webpackChunkName: "spark" */ '@sparkjsdev/spark');
    return this.sparkImport;
  }

  private async enable(fileIndex: number): Promise<void> {
    const data = this.host.spatialFiles[fileIndex];
    if (!data?.isGaussianSplat || this.pending.has(data)) {
      return;
    }

    this.pending.add(data);
    const t0 = performance.now();
    let fetchMs = 0;
    let sparkMs = 0;
    let decodeMs = 0;
    let builtFresh = false;
    try {
      let mesh = this.pendingMeshes.get(data) ?? null;
      if (mesh) {
        this.pendingMeshes.delete(data);
      } else {
        // Resolve the full original file bytes. When only a URL is known
        // (VS Code webview URI), fetch it ourselves rather than handing the
        // URL to Spark: our own fetch is the proven path in the webview, and
        // failures surface here instead of leaving a silently empty mesh.
        let bytes = data.splatSource?.bytes;
        if (!bytes && data.splatSource?.url) {
          this.host.showStatus('Loading splat source…');
          const response = await fetch(data.splatSource.url);
          if (!response.ok) {
            throw new Error(`fetching splat source failed: HTTP ${response.status}`);
          }
          bytes = new Uint8Array(await response.arrayBuffer());
          fetchMs = performance.now() - t0;
        }
        if (!bytes) {
          this.host.showStatus(
            'Splat rendering unavailable: original file bytes were not retained.'
          );
          return;
        }

        this.host.showStatus('Building gaussian splats…');
        const sparkStart = performance.now();
        const spark = await this.loadSpark();
        sparkMs = performance.now() - sparkStart;
        mesh = new spark.SplatMesh({
          fileBytes: bytes,
          fileName: data.fileName ?? 'splats.ply',
        });
        // Wait for decode + GPU upload; a failure rejects here and lands in
        // the catch below with the points still visible.
        await mesh.initialized;
        decodeMs = performance.now() - sparkStart - sparkMs;
        builtFresh = true;
      }

      const spark = await this.loadSpark();
      const currentIndex = this.host.spatialFiles.indexOf(data);
      if (currentIndex < 0) {
        mesh.dispose();
        this.host.showStatus('');
        return;
      }
      if (!this.sparkRenderer) {
        this.sparkRenderer = new spark.SparkRenderer({
          renderer: this.host.renderer,
          onDirty: () => this.host.requestRender(),
        });
        this.host.scene.add(this.sparkRenderer);
      }

      this.splatMeshes[currentIndex] = mesh;
      this.host.scene.add(mesh);
      this.applyMatrix(currentIndex, this.host.transformationMatrices[currentIndex]);

      this.host.splatModeActive[currentIndex] = true;
      if (this.maxSplatSizeValue[currentIndex] !== undefined) {
        this.applyMaxSplatSize(currentIndex);
      }
      this.refreshVisibility(currentIndex);
      this.syncVisibility(currentIndex);
      this.refreshButtons();
      this.host.showStatus('');
      this.host.requestRender();
      if (builtFresh) {
        perfLog(
          `⏱️ PERF[splat ${data.fileName ?? `file ${fileIndex}`}] fetch ${fetchMs.toFixed(1)}ms · spark-load ${sparkMs.toFixed(1)}ms · decode ${decodeMs.toFixed(1)}ms | total ${(performance.now() - t0).toFixed(1)}ms  (${(data.vertexCount ?? 0).toLocaleString()} splats · spark)`
        );
      }
    } catch (error) {
      console.error('Splat mode failed:', error);
      const currentIndex = this.host.spatialFiles.indexOf(data);
      if (currentIndex >= 0) {
        this.host.showStatus(
          `Splat rendering failed: ${error instanceof Error ? error.message : String(error)}`
        );
        this.disposeMesh(currentIndex);
        this.host.splatModeActive[currentIndex] = false;
        this.refreshVisibility(currentIndex);
      } else {
        this.host.showStatus('');
      }
      this.refreshButtons();
    } finally {
      this.pending.delete(data);
    }
  }

  /** Back to points mode. The SplatMesh is disposed (GPU memory freed);
   *  re-enabling rebuilds it from splatSource. */
  disable(fileIndex: number): void {
    this.host.splatModeActive[fileIndex] = false;
    this.disposeMesh(fileIndex);
    this.refreshVisibility(fileIndex);
    this.refreshButtons();
    this.host.requestRender();
  }

  /** Mirror the file's 4x4 transform onto the splat mesh (same semantics as
   *  transformationMatrix.setObjectMatrix). */
  applyMatrix(fileIndex: number, matrix: THREE.Matrix4 | undefined): void {
    const mesh = this.splatMeshes[fileIndex];
    if (!mesh || !matrix) {
      return;
    }
    mesh.matrix.copy(matrix);
    mesh.matrixAutoUpdate = false;
    mesh.matrixWorldNeedsUpdate = true;
  }

  /** Splat mesh follows the file's visibility checkbox. */
  syncVisibility(fileIndex: number): void {
    const mesh = this.splatMeshes[fileIndex];
    if (mesh) {
      mesh.visible = this.isActive(fileIndex) && (this.host.fileVisibility[fileIndex] ?? true);
    }
  }

  /** Keep the parallel mesh array aligned when main splices its file arrays. */
  onFileRemoved(fileIndex: number): void {
    const data = this.host.spatialFiles[fileIndex];
    const timer = this.filterTimers.get(data);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      this.filterTimers.delete(data);
    }
    const parkedMesh = this.pendingMeshes.get(data);
    if (parkedMesh) {
      parkedMesh.dispose();
      this.pendingMeshes.delete(data);
    }
    this.pending.delete(data);
    this.disposeMesh(fileIndex);
    this.splatMeshes.splice(fileIndex, 1);
    this.maxSplatSizeValue.splice(fileIndex, 1);
  }

  private disposeMesh(fileIndex: number): void {
    const mesh = this.splatMeshes[fileIndex];
    if (mesh) {
      this.host.scene.remove(mesh);
      mesh.dispose();
      this.splatMeshes[fileIndex] = null;
    }
  }
}

/**
 * Webview entry for splat-native container files: the extension sends only
 * the file's webview URI; the bytes are fetched here, decoded by Spark, and
 * the extracted centers join the scene like any other point cloud (with
 * splat rendering enabled automatically).
 */
export async function handleSplatContainerUri(
  host: {
    splatMode: SplatModeManager;
    vscode: { postMessage(message: any): void };
    displayFiles(dataArray: SpatialData[]): Promise<void>;
    addNewFiles(newFiles: SpatialData[]): void;
    showError?(message: string): void;
  },
  message: {
    fileUri?: string;
    /** Raw file bytes for paths without a fetchable URI (webview drag&drop,
     *  and the extension's resend after a failed fetch). */
    data?: ArrayBuffer;
    /** Original vscode document URI, used for the fetch-failure fallback. */
    docUri?: string;
    fileName: string;
    shortPath?: string;
    fileSizeInBytes?: number;
    messageType?: string;
  }
): Promise<void> {
  try {
    let bytes: Uint8Array;
    if (message.data) {
      bytes = new Uint8Array(message.data);
    } else if (message.fileUri) {
      let response: Response;
      try {
        response = await fetch(message.fileUri);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (fetchError) {
        // Files outside the webview's localResourceRoots (e.g. added from a
        // different directory than the opened document) can't be fetched.
        // Ask the extension to re-read and resend the bytes over postMessage
        // — same pattern as the PLY path's 'plyFetchFailed' fallback.
        if (message.docUri) {
          console.warn('[splat] fetch failed, requesting postMessage fallback:', fetchError);
          host.vscode.postMessage({
            type: 'splatContainerFetchFailed',
            docUri: message.docUri,
            fileName: message.fileName,
            shortPath: message.shortPath,
            messageType: message.messageType,
          });
          return;
        }
        throw fetchError;
      }
      bytes = new Uint8Array(await response.arrayBuffer());
    } else {
      throw new Error('no file source provided');
    }
    const data = await host.splatMode.loadContainer(message.fileName, bytes);
    data.shortPath = message.shortPath;
    data.fileSizeInBytes = message.fileSizeInBytes ?? bytes.byteLength;
    if (message.messageType === 'addFiles') {
      host.addNewFiles([data]);
    } else {
      await host.displayFiles([data]);
    }
  } catch (error) {
    const text = `Failed to load ${message.fileName}: ${
      error instanceof Error ? error.message : String(error)
    }`;
    console.error(text, error);
    host.showError?.(text);
  }
}
