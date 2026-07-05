import { CameraParams, SpatialData } from '../interfaces';
import { isPngDerivedFile } from './commentSettings';

export interface DefaultDepthSettingsHost {
  defaultDepthSettings: CameraParams;
  spatialFiles: SpatialData[];
  fileDepthData: Map<number, { depthDimensions?: { width: number; height: number } }>;
  vscode: { postMessage(message: any): void };
  getDepthSettingsFromFileUI(fileIndex: number): CameraParams;
  showStatus(message: string): void;
  showError(message: string): void;
  scheduleLiveDepthUpdate(fileIndex: number, delayMs?: number): void;
}

export function updateDefaultButtonState(host: DefaultDepthSettingsHost): void {
  // Update all "Use as Default" buttons to reflect current state
  const buttons = document.querySelectorAll('.use-as-default-settings');
  buttons.forEach((_button, index) => {
    updateSingleDefaultButtonState(host, index);
  });
}

export function updateSingleDefaultButtonState(
  host: DefaultDepthSettingsHost,
  fileIndex: number
): void {
  console.log(`🔍 updateSingleDefaultButtonState(${fileIndex}) called`);
  const button = document.querySelector(
    `.use-as-default-settings[data-file-index="${fileIndex}"]`
  ) as HTMLButtonElement;
  if (!button) {
    return;
  }

  try {
    // Get current form values
    const currentParams = host.getDepthSettingsFromFileUI(fileIndex);
    const defaults = host.defaultDepthSettings;

    // Check if current settings match defaults
    const fxMatch = currentParams.fx === defaults.fx;
    const fyMatch =
      (currentParams.fy === undefined && defaults.fy === undefined) ||
      currentParams.fy === defaults.fy;
    const cameraMatch = currentParams.cameraModel === defaults.cameraModel;
    const depthMatch = currentParams.depthType === defaults.depthType;
    const conventionMatch = currentParams.convention === defaults.convention;
    const baselineMatch =
      (currentParams.baseline || undefined) === (defaults.baseline || undefined);
    const depthScaleMatch =
      (currentParams.depthScale !== undefined ? currentParams.depthScale : 1.0) ===
      (defaults.depthScale !== undefined ? defaults.depthScale : 1.0);
    const depthBiasMatch =
      (currentParams.depthBias !== undefined ? currentParams.depthBias : 0.0) ===
      (defaults.depthBias !== undefined ? defaults.depthBias : 0.0);
    // Handle scale factor comparison more carefully (only for PNG files)
    const currentScale = currentParams.pngScaleFactor;
    const defaultScale = defaults.pngScaleFactor;
    const isPngFile =
      fileIndex < host.spatialFiles.length && isPngDerivedFile(host.spatialFiles[fileIndex]);
    const pngScaleFactorMatch = !isPngFile
      ? true // For non-PNG files, scale factor is irrelevant
      : currentScale === undefined && defaultScale === undefined
        ? true
        : currentScale !== undefined && defaultScale !== undefined
          ? currentScale === defaultScale
          : false;

    console.log(
      `  fx match: ${fxMatch} (${currentParams.fx} === ${defaults.fx})\n  fy match: ${fyMatch} (${currentParams.fy} === ${defaults.fy})\n  Camera match: ${cameraMatch} (${currentParams.cameraModel} === ${defaults.cameraModel})\n  Depth match: ${depthMatch} (${currentParams.depthType} === ${defaults.depthType})\n  Convention match: ${conventionMatch} (${currentParams.convention} === ${defaults.convention})\n  Baseline match: ${baselineMatch} (${currentParams.baseline} === ${defaults.baseline})\n  Depth scale match: ${depthScaleMatch} (${currentParams.depthScale} === ${defaults.depthScale})\n  Depth bias match: ${depthBiasMatch} (${currentParams.depthBias} === ${defaults.depthBias})\n  Scale factor match: ${pngScaleFactorMatch} (current: ${currentScale}, default: ${defaultScale}, isPNG: ${isPngFile})`
    );

    const isDefault =
      fxMatch &&
      fyMatch &&
      cameraMatch &&
      depthMatch &&
      conventionMatch &&
      baselineMatch &&
      depthScaleMatch &&
      depthBiasMatch &&
      pngScaleFactorMatch;

    if (isDefault) {
      // Current settings are already default - make button blue
      button.style.background = 'var(--vscode-button-background)';
      button.style.color = 'var(--vscode-button-foreground)';
      button.innerHTML = '✓ Current Default';
    } else {
      // Current settings differ from default - normal secondary style
      button.style.background = 'var(--vscode-button-secondaryBackground)';
      button.style.color = 'var(--vscode-button-secondaryForeground)';
      button.innerHTML = '⭐ Use as Default';
    }
  } catch (error) {
    // If we can't get form values, just show normal state
    button.style.background = 'var(--vscode-button-secondaryBackground)';
    button.style.color = 'var(--vscode-button-secondaryForeground)';
    button.innerHTML = '⭐ Use as Default';
  }
}

export async function useAsDefaultSettings(
  host: DefaultDepthSettingsHost,
  fileIndex: number
): Promise<void> {
  try {
    // Get the current values from the form
    const currentParams = host.getDepthSettingsFromFileUI(fileIndex);

    // Store as default settings for future files (exclude cx and cy as they are auto-calculated per image)
    host.defaultDepthSettings = {
      fx: currentParams.fx,
      fy: currentParams.fy,
      cx: host.defaultDepthSettings.cx, // Keep existing cx, don't update from form
      cy: host.defaultDepthSettings.cy, // Keep existing cy, don't update from form
      cameraModel: currentParams.cameraModel,
      depthType: currentParams.depthType,
      baseline: currentParams.baseline,
      convention: currentParams.convention || 'opengl',
      pngScaleFactor: currentParams.pngScaleFactor,
      depthScale: currentParams.depthScale,
      depthBias: currentParams.depthBias,
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
  try {
    const defaults = host.defaultDepthSettings;
    // Get all the form elements
    const setValue = (elementId: string, value: any) => {
      const element = document.getElementById(elementId) as HTMLInputElement | HTMLSelectElement;
      if (element && value !== undefined && value !== null) {
        element.value = value.toString();
      }
    };

    // Only reset fields that have stars (default values)
    setValue(`camera-model-${fileIndex}`, defaults.cameraModel);
    setValue(`fx-${fileIndex}`, defaults.fx);

    // Handle fy field - clear it if default is same as fx, otherwise set the value
    const fyElement = document.getElementById(`fy-${fileIndex}`) as HTMLInputElement;
    if (fyElement) {
      if (defaults.fy && defaults.fy !== defaults.fx) {
        fyElement.value = defaults.fy.toString();
      } else {
        fyElement.value = ''; // Clear to use "Same as fx"
      }
    }

    setValue(`depth-type-${fileIndex}`, defaults.depthType);
    setValue(`baseline-${fileIndex}`, defaults.baseline);
    setValue(`depth-scale-${fileIndex}`, defaults.depthScale);
    setValue(`depth-bias-${fileIndex}`, defaults.depthBias);
    setValue(`convention-${fileIndex}`, defaults.convention);

    // Handle PNG scale factor only if it exists
    const pngScaleElement = document.getElementById(
      `png-scale-factor-${fileIndex}`
    ) as HTMLInputElement;
    if (pngScaleElement && defaults.pngScaleFactor) {
      pngScaleElement.value = defaults.pngScaleFactor.toString();
    }

    // Update button states
    updateSingleDefaultButtonState(host, fileIndex);
    host.scheduleLiveDepthUpdate(fileIndex, 0);

    host.showStatus('Reset starred fields to default values');
  } catch (error) {
    console.error('Error resetting to default settings:', error);
    host.showError(
      `Failed to reset to default settings: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export function resetMonoParameters(host: DefaultDepthSettingsHost, fileIndex: number): void {
  try {
    // Reset scale to 1.0 and bias to 0.0
    const scaleElement = document.getElementById(`depth-scale-${fileIndex}`) as HTMLInputElement;
    const biasElement = document.getElementById(`depth-bias-${fileIndex}`) as HTMLInputElement;

    if (scaleElement) {
      scaleElement.value = '1.0';
    }
    if (biasElement) {
      biasElement.value = '0.0';
    }

    // Update button state since values changed
    updateSingleDefaultButtonState(host, fileIndex);
    host.scheduleLiveDepthUpdate(fileIndex, 0);

    host.showStatus('Reset mono parameters to Scale=1.0, Bias=0.0');
  } catch (error) {
    console.error('Error resetting mono parameters:', error);
    host.showError(
      `Failed to reset mono parameters: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export function resetDisparityOffset(host: DefaultDepthSettingsHost, fileIndex: number): void {
  try {
    // Reset disparity offset to 0
    const offsetElement = document.getElementById(
      `disparity-offset-${fileIndex}`
    ) as HTMLInputElement;

    if (offsetElement) {
      offsetElement.value = '0';
    }

    host.scheduleLiveDepthUpdate(fileIndex, 0);
    host.showStatus('Reset disparity offset to 0');
  } catch (error) {
    console.error('Error resetting disparity offset:', error);
    host.showError(
      `Failed to reset disparity offset: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export function resetPrinciplePoint(host: DefaultDepthSettingsHost, fileIndex: number): void {
  try {
    // Reset cx and cy to auto-calculated center values based on image dimensions
    const cxElement = document.getElementById(`cx-${fileIndex}`) as HTMLInputElement;
    const cyElement = document.getElementById(`cy-${fileIndex}`) as HTMLInputElement;

    // Get image dimensions from stored depth data
    const depthData = host.fileDepthData.get(fileIndex);
    if (depthData?.depthDimensions) {
      const computedCx = (depthData.depthDimensions.width - 1) / 2;
      const computedCy = (depthData.depthDimensions.height - 1) / 2;

      if (cxElement) {
        cxElement.value = computedCx.toString();
      }
      if (cyElement) {
        cyElement.value = computedCy.toString();
      }

      host.scheduleLiveDepthUpdate(fileIndex, 0);
      host.showStatus(`Reset principle point to center: cx=${computedCx}, cy=${computedCy}`);
    } else {
      // This should not happen for depth-derived files, but handle gracefully
      console.error(`No depth dimensions found for file ${fileIndex}`);
      host.showError('Cannot reset principle point: image dimensions not available');
    }
  } catch (error) {
    console.error('Error resetting principle point:', error);
    host.showError(
      `Failed to reset principle point: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
