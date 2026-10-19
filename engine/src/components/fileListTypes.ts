import type * as THREE from 'three';
import type { SpatialData } from '../interfaces';
import type { FileEntry, FileEntryRegistry } from '../state/fileEntries';
import type { PoseMeta } from '../pose';
import type { SplatModeManager } from '../visualization/splatMode';

/** The file list's data/actions contract, independent of the viewer class. */
export interface FileItemHost {
  fileEntries: FileEntryRegistry;
  spatialFiles: readonly SpatialData[];
  poseMeta: readonly PoseMeta[];
  cameraGroups: readonly THREE.Group[];
  cameraNames: readonly string[];
  cameraShowCoords: readonly boolean[];
  cameraShowLabels: readonly boolean[];
  fileColors: [number, number, number][];
  poseConvention: readonly ('opencv' | 'opengl')[];
  poseMaxUncertaintyThreshold: readonly number[];
  poseMinScoreThreshold: readonly number[];
  poseScaleByScore: readonly boolean[];
  poseScaleByUncertainty: readonly boolean[];
  poseShowLabels: readonly boolean[];
  poseUseDatasetColors: readonly boolean[];
  splatMode: SplatModeManager;
  applyPoseConvention(index: number, convention: 'opencv' | 'opengl'): void;
  applyPoseFilters(index: number): void;
  getColorOptions(index: number): string;
  getTransformationMatrixAsArray(index: number): number[];
  hasIntensityData(data: SpatialData): boolean;
  isDepthDerivedFile(data: SpatialData): boolean;
  onFileColorModeChange(index: number, mode: string): void;
  requestLoadMtl(index: number): void;
  requestRemoveFile(index: number): void;
  requestRender(): void;
  setCameraColorCorrection(
    group: THREE.Group,
    settings: import('../visualization/stonexColorCorrection').StonexColorCorrection
  ): void;
  soloPointCloud(index: number): void;
  toggleCameraProfileCoordinates(index: number, enabled: boolean): void;
  toggleCameraProfileLabels(index: number, enabled: boolean): void;
  toggleFileVisibility(index: number): void;
  toggleUniversalRenderMode(index: number, mode: string): void;
  updatePointSize(index: number, size: number): void;
  updatePoseAppearance(index: number): void;
  updatePoseLabels(index: number): void;
  updatePoseScaling(index: number): void;
}
export interface FileListHost extends FileItemHost {
  pendingLoadDetail: string;
  pendingLoadLabel: string | null;
  sequenceFiles: string[];
  sequenceIndex: number;
  sequenceMode: boolean;
}
export interface FileRow {
  entry: FileEntry;
  index: number;
  kind: 'pointcloud' | 'pose' | 'camera';
  kindIndex: number;
  data: SpatialData | null;
  pose: PoseMeta | null;
  cameraGroup: THREE.Group | null;
  cameraName: string;
}
export function fileRows(host: FileItemHost, entries: readonly FileEntry[]): FileRow[] {
  return entries
    .map<FileRow>((entry, index) => {
      const kindIndex = host.fileEntries.kindIndexAt(index);
      return {
        entry,
        index,
        kindIndex,
        kind: entry.kind === 'spatial' ? 'pointcloud' : entry.kind,
        data: entry.spatial?.data ?? null,
        pose: entry.pose?.meta ?? null,
        cameraGroup: entry.camera?.object ?? null,
        cameraName: entry.camera?.name ?? '',
      };
    })
    .sort(
      (a, b) =>
        (a.entry.state.listOrder ?? Number.MAX_SAFE_INTEGER) -
          (b.entry.state.listOrder ?? Number.MAX_SAFE_INTEGER) || a.index - b.index
    );
}
