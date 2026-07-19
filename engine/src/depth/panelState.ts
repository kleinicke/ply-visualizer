import { CameraParams } from '../interfaces';

export interface DepthPanelStateHost {
  fileDepthData: Map<number, { depthDimensions: { width: number; height: number } }>;
  liveDepthUpdateFiles: Set<number>;
  setLiveDepthUpdateEnabled(fileIndex: number, enabled: boolean): void;
  updatePrinciplePointFields(
    fileIndex: number,
    dimensions: { width: number; height: number }
  ): void;
}

export interface DepthFormValues {
  fx: string | null;
  fy: string | null;
  cx: string | null;
  cy: string | null;
  cameraModel: string | null;
  depthType: string | null;
  baseline: string | null;
  disparityOffset: string | null;
  convention: string | null;
  pngScaleFactor: string | null;
  depthScale: string | null;
  depthBias: string | null;
  k1: string | null;
  k2: string | null;
  k3: string | null;
  k4: string | null;
  k5: string | null;
  p1: string | null;
  p2: string | null;
  coefficients: string | null;
  imageRectified: string;
  liveUpdate: string;
}

export function captureDepthPanelStates(
  host: DepthPanelStateHost
): Map<number, { panelOpen: boolean; formValues: DepthFormValues }> {
  const states = new Map<number, { panelOpen: boolean; formValues: DepthFormValues }>();

  // Look for all depth settings panels and capture their display state
  const panels = document.querySelectorAll('[id^="depth-panel-"]');
  panels.forEach(panel => {
    const id = panel.id;
    const match = id.match(/depth-panel-(\d+)/);
    if (match) {
      const fileIndex = parseInt(match[1]);
      const displayStyle = (panel as HTMLElement).style.display;
      const isVisible =
        displayStyle === 'block' ||
        (displayStyle === '' && (panel as HTMLElement).offsetHeight > 0);

      // Capture current form values
      const formValues = captureDepthFormValues(host, fileIndex);

      states.set(fileIndex, {
        panelOpen: isVisible,
        formValues: formValues,
      });

      console.log(
        `📋 Captured state for file ${fileIndex}: ${isVisible ? 'open' : 'closed'}, fx=${formValues.fx}, cx=${formValues.cx}`
      );
    }
  });

  return states;
}

/**
 * Capture current form values for a depth settings panel
 */
export function captureDepthFormValues(
  host: DepthPanelStateHost,
  fileIndex: number
): DepthFormValues {
  const getValue = (id: string) => {
    const element = document.getElementById(id) as HTMLInputElement | HTMLSelectElement;
    return element ? element.value : null;
  };

  return {
    fx: getValue(`fx-${fileIndex}`),
    fy: getValue(`fy-${fileIndex}`),
    cx: getValue(`cx-${fileIndex}`),
    cy: getValue(`cy-${fileIndex}`),
    cameraModel: getValue(`camera-model-${fileIndex}`),
    depthType: getValue(`depth-type-${fileIndex}`),
    baseline: getValue(`baseline-${fileIndex}`),
    disparityOffset: getValue(`disparity-offset-${fileIndex}`),
    convention: getValue(`convention-${fileIndex}`),
    pngScaleFactor: getValue(`png-scale-factor-${fileIndex}`),
    depthScale: getValue(`depth-scale-${fileIndex}`),
    depthBias: getValue(`depth-bias-${fileIndex}`),
    k1: getValue(`k1-${fileIndex}`),
    k2: getValue(`k2-${fileIndex}`),
    k3: getValue(`k3-${fileIndex}`),
    k4: getValue(`k4-${fileIndex}`),
    k5: getValue(`k5-${fileIndex}`),
    p1: getValue(`p1-${fileIndex}`),
    p2: getValue(`p2-${fileIndex}`),
    coefficients: getValue(`camera-coefficients-${fileIndex}`),
    imageRectified: (document.getElementById(`image-rectified-${fileIndex}`) as HTMLInputElement)
      ?.checked
      ? 'true'
      : 'false',
    liveUpdate: host.liveDepthUpdateFiles.has(fileIndex) ? 'true' : 'false',
  };
}

/**
 * Restore the open/closed state of depth settings panels and form values
 */
export function restoreDepthPanelStates(
  host: DepthPanelStateHost,
  states: Map<number, { panelOpen: boolean; formValues: DepthFormValues }>
): void {
  // Wait a bit for the DOM to be updated
  setTimeout(() => {
    // First, restore panel visibility states and form values
    states.forEach((state, fileIndex) => {
      const panel = document.getElementById(`depth-panel-${fileIndex}`);
      const toggleButton = document.querySelector(
        `[data-file-index="${fileIndex}"].depth-settings-toggle`
      ) as HTMLElement;

      if (panel && toggleButton) {
        console.log(
          `🔄 Restoring state for file ${fileIndex}: ${state.panelOpen ? 'open' : 'closed'}`
        );

        // Restore panel visibility
        if (state.panelOpen) {
          (panel as HTMLElement).style.display = 'block';
          const icon = toggleButton.querySelector('.toggle-icon');
          if (icon) {
            icon.textContent = '▼';
          }
        } else {
          (panel as HTMLElement).style.display = 'none';
          const icon = toggleButton.querySelector('.toggle-icon');
          if (icon) {
            icon.textContent = '▶';
          }
        }

        // Restore form values
        restoreDepthFormValues(host, fileIndex, state.formValues);
      } else {
        console.warn(`⚠️ Could not find panel or toggle button for file ${fileIndex}`);
      }
    });

    // For any depth files not captured in states (edge case), restore dimensions
    host.fileDepthData.forEach((depthData, fileIndex) => {
      if (!states.has(fileIndex)) {
        const panel = document.getElementById(`depth-panel-${fileIndex}`);
        if (panel) {
          console.log(
            `📐 Restoring dimensions for uncaptured file ${fileIndex}: ${depthData.depthDimensions.width}×${depthData.depthDimensions.height}`
          );
          host.updatePrinciplePointFields(fileIndex, depthData.depthDimensions);
        }
      }
    });
  }, 10);
}

/**
 * Restore form values for a depth settings panel
 */
export function restoreDepthFormValues(
  host: DepthPanelStateHost,
  fileIndex: number,
  formValues: DepthFormValues
): void {
  const setValue = (id: string, value: string | null) => {
    if (value !== null) {
      const element = document.getElementById(id) as HTMLInputElement | HTMLSelectElement;
      if (element) {
        element.value = value;
      }
    }
  };

  // Restore all captured form values
  setValue(`fx-${fileIndex}`, formValues.fx);
  setValue(`fy-${fileIndex}`, formValues.fy);
  setValue(`cx-${fileIndex}`, formValues.cx);
  setValue(`cy-${fileIndex}`, formValues.cy);
  setValue(`camera-model-${fileIndex}`, formValues.cameraModel);
  setValue(`depth-type-${fileIndex}`, formValues.depthType);
  setValue(`baseline-${fileIndex}`, formValues.baseline);
  setValue(`disparity-offset-${fileIndex}`, formValues.disparityOffset);
  setValue(`convention-${fileIndex}`, formValues.convention);
  setValue(`png-scale-factor-${fileIndex}`, formValues.pngScaleFactor);
  setValue(`depth-scale-${fileIndex}`, formValues.depthScale);
  setValue(`depth-bias-${fileIndex}`, formValues.depthBias);
  setValue(`k1-${fileIndex}`, formValues.k1);
  setValue(`k2-${fileIndex}`, formValues.k2);
  setValue(`k3-${fileIndex}`, formValues.k3);
  setValue(`k4-${fileIndex}`, formValues.k4);
  setValue(`k5-${fileIndex}`, formValues.k5);
  setValue(`p1-${fileIndex}`, formValues.p1);
  setValue(`p2-${fileIndex}`, formValues.p2);
  setValue(`camera-coefficients-${fileIndex}`, formValues.coefficients);
  const rectifiedInput = document.getElementById(
    `image-rectified-${fileIndex}`
  ) as HTMLInputElement | null;
  if (rectifiedInput) {rectifiedInput.checked = formValues.imageRectified === 'true';}

  const liveUpdate = formValues.liveUpdate === 'true';
  host.setLiveDepthUpdateEnabled(fileIndex, liveUpdate);
  const liveUpdateCheckbox = document.querySelector(
    `.live-depth-update[data-file-index="${fileIndex}"]`
  ) as HTMLInputElement | null;
  if (liveUpdateCheckbox) {
    liveUpdateCheckbox.checked = liveUpdate;
  }

  // Show/hide distortion parameters based on camera model
  const distortionGroup = document.getElementById(`distortion-params-${fileIndex}`);
  const pinholeParams = document.getElementById(`pinhole-params-${fileIndex}`);
  const fisheyeOpencvParams = document.getElementById(`fisheye-opencv-params-${fileIndex}`);
  const kannalaBrandtParams = document.getElementById(`kannala-brandt-params-${fileIndex}`);

  if (distortionGroup && pinholeParams && fisheyeOpencvParams && kannalaBrandtParams) {
    // Hide all parameter sections first
    pinholeParams.style.display = 'none';
    fisheyeOpencvParams.style.display = 'none';
    kannalaBrandtParams.style.display = 'none';

    // Show appropriate parameter section based on model
    if (formValues.cameraModel === 'pinhole-opencv') {
      distortionGroup.style.display = '';
      pinholeParams.style.display = '';
    } else if (formValues.cameraModel === 'fisheye-opencv') {
      distortionGroup.style.display = '';
      fisheyeOpencvParams.style.display = '';
    } else if (
      formValues.cameraModel === 'fisheye-kb3' ||
      formValues.cameraModel === 'fisheye624'
    ) {
      distortionGroup.style.display = '';
      kannalaBrandtParams.style.display = '';
    } else {
      distortionGroup.style.display = 'none';
    }
  }

  // Also ensure dimensions are displayed correctly
  const depthData = host.fileDepthData.get(fileIndex);
  if (depthData) {
    const imageSizeDiv = document.getElementById(`image-size-${fileIndex}`);
    if (imageSizeDiv) {
      imageSizeDiv.textContent = `Image Size: Width: ${depthData.depthDimensions.width}, Height: ${depthData.depthDimensions.height}`;
      console.log(
        `📐 Restored image size display for file ${fileIndex}: ${depthData.depthDimensions.width}×${depthData.depthDimensions.height}`
      );
    }

    // Backfill cx/cy if blank but dimensions are known
    const cxEl = document.getElementById(`cx-${fileIndex}`) as HTMLInputElement | null;
    const cyEl = document.getElementById(`cy-${fileIndex}`) as HTMLInputElement | null;
    const cxBlank = !cxEl?.value || cxEl.value.trim() === '';
    const cyBlank = !cyEl?.value || cyEl.value.trim() === '';
    if (cxBlank || cyBlank) {
      host.updatePrinciplePointFields(fileIndex, depthData.depthDimensions);
    }
  }

  console.log(
    `📝 Restored form values for file ${fileIndex}: fx=${formValues.fx}, cx=${formValues.cx}`
  );
}

export function getDepthSettingsFromFileUI(fileIndex: number): CameraParams {
  console.log(`📋 getDepthSettingsFromFileUI(${fileIndex}) called`);
  const cameraModelSelect = document.getElementById(
    `camera-model-${fileIndex}`
  ) as HTMLSelectElement;
  const fxInput = document.getElementById(`fx-${fileIndex}`) as HTMLInputElement;
  const fyInput = document.getElementById(`fy-${fileIndex}`) as HTMLInputElement;
  const cxInput = document.getElementById(`cx-${fileIndex}`) as HTMLInputElement;
  const cyInput = document.getElementById(`cy-${fileIndex}`) as HTMLInputElement;
  const depthTypeSelect = document.getElementById(`depth-type-${fileIndex}`) as HTMLSelectElement;
  const baselineInput = document.getElementById(`baseline-${fileIndex}`) as HTMLInputElement;
  const disparityOffsetInput = document.getElementById(
    `disparity-offset-${fileIndex}`
  ) as HTMLInputElement;
  const depthScaleInput = document.getElementById(`depth-scale-${fileIndex}`) as HTMLInputElement;
  const depthBiasInput = document.getElementById(`depth-bias-${fileIndex}`) as HTMLInputElement;
  const conventionSelect = document.getElementById(`convention-${fileIndex}`) as HTMLSelectElement;
  const pngScaleFactorInput = document.getElementById(
    `png-scale-factor-${fileIndex}`
  ) as HTMLInputElement;
  const rgb24ConversionModeSelect = document.getElementById(
    `rgb24-conversion-mode-${fileIndex}`
  ) as HTMLSelectElement;
  const rgb24ScaleFactorInput = document.getElementById(
    `rgb24-scale-factor-${fileIndex}`
  ) as HTMLInputElement;

  // Get distortion coefficient inputs
  const k1Input = document.getElementById(`k1-${fileIndex}`) as HTMLInputElement;
  const k2Input = document.getElementById(`k2-${fileIndex}`) as HTMLInputElement;
  const k3Input = document.getElementById(`k3-${fileIndex}`) as HTMLInputElement;
  const k4Input = document.getElementById(`k4-${fileIndex}`) as HTMLInputElement;
  const k5Input = document.getElementById(`k5-${fileIndex}`) as HTMLInputElement;
  const p1Input = document.getElementById(`p1-${fileIndex}`) as HTMLInputElement;
  const p2Input = document.getElementById(`p2-${fileIndex}`) as HTMLInputElement;
  const coefficientsInput = document.getElementById(
    `camera-coefficients-${fileIndex}`
  ) as HTMLInputElement;
  const imageRectifiedInput = document.getElementById(
    `image-rectified-${fileIndex}`
  ) as HTMLInputElement;

  const cx = cxInput?.value && cxInput.value.trim() !== '' ? parseFloat(cxInput.value) : undefined; // Will be auto-calculated if not provided
  const cy = cyInput?.value && cyInput.value.trim() !== '' ? parseFloat(cyInput.value) : undefined; // Will be auto-calculated if not provided
  const fx = parseFloat(fxInput?.value || '1000');
  const fyValue = fyInput?.value?.trim();
  const fy = fyValue && fyValue !== '' ? parseFloat(fyValue) : undefined;

  // Parse distortion coefficients (only if they have values)
  const k1 = k1Input?.value && k1Input.value.trim() !== '' ? parseFloat(k1Input.value) : undefined;
  const k2 = k2Input?.value && k2Input.value.trim() !== '' ? parseFloat(k2Input.value) : undefined;
  const k3 = k3Input?.value && k3Input.value.trim() !== '' ? parseFloat(k3Input.value) : undefined;
  const k4 = k4Input?.value && k4Input.value.trim() !== '' ? parseFloat(k4Input.value) : undefined;
  const k5 = k5Input?.value && k5Input.value.trim() !== '' ? parseFloat(k5Input.value) : undefined;
  const p1 = p1Input?.value && p1Input.value.trim() !== '' ? parseFloat(p1Input.value) : undefined;
  const p2 = p2Input?.value && p2Input.value.trim() !== '' ? parseFloat(p2Input.value) : undefined;
  const coefficients = coefficientsInput?.value
    ? coefficientsInput.value.split(',').map(value => Number(value.trim()))
    : undefined;

  return {
    cameraModel: (cameraModelSelect?.value as any) || 'pinhole-ideal',
    fx: fx,
    fy: fy,
    cx: cx,
    cy: cy,
    depthType:
      (depthTypeSelect?.value as 'euclidean' | 'orthogonal' | 'disparity' | 'inverse_depth') ||
      'euclidean',
    baseline:
      depthTypeSelect?.value === 'disparity'
        ? parseFloat(baselineInput?.value || '120')
        : undefined,
    disparityOffset:
      depthTypeSelect?.value === 'disparity'
        ? parseFloat(disparityOffsetInput?.value || '0')
        : undefined,
    depthScale: depthScaleInput?.value ? parseFloat(depthScaleInput.value) : undefined,
    depthBias: depthBiasInput?.value ? parseFloat(depthBiasInput.value) : undefined,
    convention: (conventionSelect?.value as 'opengl' | 'opencv') || 'opengl',
    pngScaleFactor: pngScaleFactorInput
      ? parseFloat(pngScaleFactorInput.value || '1000') || 1000
      : undefined,
    rgb24ConversionMode:
      (rgb24ConversionModeSelect?.value as 'shift' | 'multiply' | 'red' | 'green' | 'blue') ||
      'shift',
    rgb24ScaleFactor: rgb24ScaleFactorInput
      ? parseFloat(rgb24ScaleFactorInput.value || '1000') || 1000
      : undefined,
    k1: k1,
    k2: k2,
    k3: k3,
    k4: k4,
    k5: k5,
    p1: p1,
    p2: p2,
    coefficients,
    imageRectified: imageRectifiedInput?.checked || false,
  };
}
