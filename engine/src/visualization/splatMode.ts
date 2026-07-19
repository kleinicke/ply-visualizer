import * as THREE from 'three';
import { SpatialData } from '../interfaces';

type SparkModule = typeof import('@sparkjsdev/spark');
type SplatMesh = import('@sparkjsdev/spark').SplatMesh;
type SparkRenderer = import('@sparkjsdev/spark').SparkRenderer;

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
  private pending = new Set<number>();
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
    if (this.pending.has(fileIndex)) {
      return;
    }
    if (this.isActive(fileIndex)) {
      this.disable(fileIndex);
    } else {
      await this.enable(fileIndex);
    }
  }

  /**
   * Decode a splat-native container (.spz/.splat/.ksplat/.sog) and extract
   * its gaussian centers/colors into a SpatialData entry. The decoded
   * SplatMesh is parked in pendingMeshes so the follow-up enable() (via
   * autoEnablePending) doesn't decode twice.
   */
  async loadContainer(fileName: string, bytes: Uint8Array): Promise<SpatialData> {
    const spark = await this.loadSpark();
    const mesh = new spark.SplatMesh({ fileBytes: bytes, fileName });
    await mesh.initialized;

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
    if (!data?.isGaussianSplat || this.pending.has(fileIndex)) {
      return;
    }

    this.pending.add(fileIndex);
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
        }
        if (!bytes) {
          this.host.showStatus(
            'Splat rendering unavailable: original file bytes were not retained.'
          );
          return;
        }

        this.host.showStatus('Building gaussian splats…');
        const spark = await this.loadSpark();
        mesh = new spark.SplatMesh({
          fileBytes: bytes,
          fileName: data.fileName ?? 'splats.ply',
        });
        // Wait for decode + GPU upload; a failure rejects here and lands in
        // the catch below with the points still visible.
        await mesh.initialized;
      }

      const spark = await this.loadSpark();
      if (!this.sparkRenderer) {
        this.sparkRenderer = new spark.SparkRenderer({ renderer: this.host.renderer });
        this.host.scene.add(this.sparkRenderer);
      }

      this.splatMeshes[fileIndex] = mesh;
      this.host.scene.add(mesh);
      this.applyMatrix(fileIndex, this.host.transformationMatrices[fileIndex]);

      this.host.splatModeActive[fileIndex] = true;
      this.refreshVisibility(fileIndex);
      this.syncVisibility(fileIndex);
      this.refreshButtons();
      this.host.showStatus('');
      this.host.requestRender();
    } catch (error) {
      console.error('Splat mode failed:', error);
      this.host.showStatus(
        `Splat rendering failed: ${error instanceof Error ? error.message : String(error)}`
      );
      this.disposeMesh(fileIndex);
      this.host.splatModeActive[fileIndex] = false;
      this.refreshVisibility(fileIndex);
      this.refreshButtons();
    } finally {
      this.pending.delete(fileIndex);
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
    this.pendingMeshes.delete(this.host.spatialFiles[fileIndex]);
    this.disposeMesh(fileIndex);
    this.splatMeshes.splice(fileIndex, 1);
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
    displayFiles(dataArray: SpatialData[]): Promise<void>;
    addNewFiles(newFiles: SpatialData[]): void;
    showError?(message: string): void;
  },
  message: {
    fileUri: string;
    fileName: string;
    shortPath?: string;
    fileSizeInBytes?: number;
    messageType?: string;
  }
): Promise<void> {
  try {
    const response = await fetch(message.fileUri);
    if (!response.ok) {
      throw new Error(`fetch failed: HTTP ${response.status}`);
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
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
