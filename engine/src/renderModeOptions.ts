import type { SpatialData } from './interfaces';

export interface RenderModeOption {
  mode: string;
  label: string;
  cls: string;
}

export interface RenderModeOptionsHost {
  splatMode?: { canEnable(data: SpatialData | undefined): boolean };
}

/** The render-mode buttons available to one spatial file row. */
export function getRenderModeOptions(
  host: RenderModeOptionsHost,
  data: SpatialData
): RenderModeOption[] {
  if (data.sceneModel) {
    if (!data.faceCount) {
      return [{ mode: 'mesh', label: '🔷 Model', cls: 'mesh-btn' }];
    }
    return [
      { mode: 'mesh', label: '🔷 Mesh', cls: 'mesh-btn' },
      { mode: 'wireframe', label: '📐 Wireframe', cls: 'wireframe-btn' },
    ];
  }
  const hasFaces = data.faceCount > 0;
  const hasLines = !!(data as any).objData && (data as any).objData.lineCount > 0;
  const hasGeometry = hasFaces || hasLines;
  const hasNormalsData = data.hasNormals || hasFaces;
  const isPtsFile = data.fileName?.toLowerCase().endsWith('.pts');
  const shouldShowNormals =
    hasNormalsData &&
    (!isPtsFile || (data.vertices.length > 0 && data.vertices[0]?.nx !== undefined));

  const buttons: RenderModeOption[] = [{ mode: 'points', label: '👁️ Points', cls: 'points-btn' }];
  if (host.splatMode?.canEnable(data)) {
    buttons.push({ mode: 'splat', label: '✨ Splats', cls: 'splat-btn' });
  }
  if (hasGeometry) {
    buttons.push(
      { mode: 'mesh', label: '🔷 Mesh', cls: 'mesh-btn' },
      { mode: 'wireframe', label: '📐 Wireframe', cls: 'wireframe-btn' }
    );
  }
  if (shouldShowNormals) {
    buttons.push({ mode: 'normals', label: '📏 Normals', cls: 'normals-btn' });
  }
  return buttons;
}

export function hasRenderMode(
  host: RenderModeOptionsHost,
  data: SpatialData,
  mode: string
): boolean {
  return getRenderModeOptions(host, data).some(option => option.mode === mode);
}

export interface RenderModeStateHost {
  spatialFiles: readonly SpatialData[];
  splatMode?: {
    canEnable(data: SpatialData | undefined): boolean;
    isActive(fileIndex: number): boolean;
  };
  fileEntries: {
    require(index: number): {
      state: {
        pointsVisible?: boolean;
        solidVisible?: boolean;
        wireframeVisible?: boolean;
        normalsVisible?: boolean;
      };
    };
  };
}

/** Whether a file's render-mode button shows as on. */
export function isRenderModeActive(
  host: RenderModeStateHost,
  fileIndex: number,
  mode: string
): boolean {
  const fileData = host.spatialFiles[fileIndex];
  const supportsSplats = !!fileData && !!host.splatMode?.canEnable(fileData);
  const fileSplatActive = supportsSplats && !!host.splatMode?.isActive(fileIndex);
  const state = host.fileEntries.require(fileIndex).state;
  switch (mode) {
    case 'points':
      return supportsSplats ? !fileSplatActive : (state.pointsVisible ?? true);
    case 'splat':
      return fileSplatActive;
    case 'mesh':
    case 'solid':
      return state.solidVisible ?? true;
    case 'wireframe':
      return state.wireframeVisible ?? false;
    case 'normals':
      return state.normalsVisible ?? false;
    default:
      return false;
  }
}
