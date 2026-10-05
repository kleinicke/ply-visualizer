import { getDepthForm, resetFormDefaults, type DepthFormHost } from './panelState';
import { CameraParams, SpatialData } from '../interfaces';
import { normalizeToOfferedCameraModel } from './cameraModels';
import { isPngDerivedFile } from './commentSettings';

export interface DefaultDepthSettingsHost extends DepthFormHost {
  defaultDepthSettings: CameraParams;
  spatialFiles: readonly SpatialData[];
  vscode: { postMessage(message: any): void };
  getDepthSettings(fileIndex: number): CameraParams;
  showStatus(message: string): void;
  showError(message: string): void;
  scheduleLiveDepthUpdate(fileIndex: number, delayMs?: number): void;
}

export function updateDefaultButtonState(host: DefaultDepthSettingsHost): void {
  // Update all "Use as Default" buttons to reflect current state
  host.spatialFiles.forEach((_file, index) => {
    updateSingleDefaultButtonState(host, index);
  });
}

export function updateSingleDefaultButtonState(
  host: DefaultDepthSettingsHost,
  fileIndex: number
): void {
  const state = host.fileEntries.require(fileIndex).state;
  try {
    const current = host.getDepthSettings(fileIndex);
    const defaults = host.defaultDepthSettings;
    const comparable = (params: CameraParams) => {
      const offered = normalizeToOfferedCameraModel(params.cameraModel, params.coefficients ?? []);
      return {
        camera: offered.model,
        coefficients: offered.coefficients,
        fx: params.fx,
        fy: params.fy ?? params.fx,
        depth: params.depthType,
        convention: params.convention ?? 'opengl',
        baseline: params.depthType === 'disparity' ? (params.baseline ?? 120) : undefined,
        offset: params.depthType === 'disparity' ? (params.disparityOffset ?? 0) : undefined,
        scale: params.depthScale ?? 1,
        bias: params.depthBias ?? 0,
        pngScale: isPngDerivedFile(host.spatialFiles[fileIndex])
          ? (params.pngScaleFactor ?? 1000)
          : undefined,
      };
    };
    state.depthIsDefault =
      JSON.stringify(comparable(current)) === JSON.stringify(comparable(defaults));
  } catch {
    state.depthIsDefault = false;
  }
}

export async function useAsDefaultSettings(
  host: DefaultDepthSettingsHost,
  fileIndex: number
): Promise<void> {
  try {
    // Get the current values from the form
    const currentParams = host.getDepthSettings(fileIndex);

    // Store as default settings for future files (exclude cx and cy as they are auto-calculated per image)
    host.defaultDepthSettings = {
      ...currentParams,
      cx: host.defaultDepthSettings.cx,
      cy: host.defaultDepthSettings.cy,
    };

    // Save to extension global state for persistence across webview instances
    host.vscode.postMessage({
      type: 'saveDefaultDepthSettings',
      settings: host.defaultDepthSettings,
    });

    // Show confirmation message with more detail
    const fyInfo = currentParams.fy ? `, fy=${currentParams.fy}` : '';
    host.showStatus(
      `✅ Default settings saved: ${currentParams.cameraModel}, fx=${currentParams.fx}${fyInfo}px, ${currentParams.depthType}, ${currentParams.convention}`
    );

    // Update button state immediately
    updateDefaultButtonState(host);

    console.log('🎯 Default depth settings updated:', host.defaultDepthSettings);
  } catch (error) {
    console.error('Error saving default settings:', error);
    host.showError(
      `Failed to save default settings: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function resetToDefaultSettings(
  host: DefaultDepthSettingsHost,
  fileIndex: number
): Promise<void> {
  resetFormDefaults(getDepthForm(host, fileIndex), host.defaultDepthSettings);
  updateSingleDefaultButtonState(host, fileIndex);
  host.scheduleLiveDepthUpdate(fileIndex, 0);
  host.showStatus('Reset starred fields to default values');
}
export function resetMonoParameters(host: DefaultDepthSettingsHost, fileIndex: number): void {
  Object.assign(getDepthForm(host, fileIndex), { depthScale: 1, depthBias: 0 });
  updateSingleDefaultButtonState(host, fileIndex);
  host.scheduleLiveDepthUpdate(fileIndex, 0);
}
export function resetDisparityOffset(host: DefaultDepthSettingsHost, fileIndex: number): void {
  getDepthForm(host, fileIndex).disparityOffset = 0;
  host.scheduleLiveDepthUpdate(fileIndex, 0);
}
export function resetPrinciplePoint(host: DefaultDepthSettingsHost, fileIndex: number): void {
  const dimensions = host.spatialFiles[fileIndex]?.depthSource?.depthDimensions;
  if (!dimensions) {
    host.showError('Cannot reset principal point: image dimensions not available');
    return;
  }
  Object.assign(getDepthForm(host, fileIndex), {
    cx: (dimensions.width - 1) / 2,
    cy: (dimensions.height - 1) / 2,
  });
  host.scheduleLiveDepthUpdate(fileIndex, 0);
}
