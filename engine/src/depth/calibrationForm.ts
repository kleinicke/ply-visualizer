import { parseCalibrationFile } from './calibrationFileParser';

export interface CalibrationFormHost {
  calibrationData?: Map<number, any>;
  vscode: { postMessage(message: any): void };
  pendingDepthFiles: Map<string, { sceneMetadata?: any }>;
  updateSingleDefaultButtonState(fileIndex: number): void;
  displayCalibrationInfo(calibrationData: any, fileName: string, fileIndex: number): void;
  showStatus(message: string): void;
  triggerDatasetImageLoading(sceneMetadata: any): Promise<void>;
}

export function openCalibrationFileDialog(host: CalibrationFormHost, fileIndex: number): void {
  // Use VS Code's file picker instead of browser's for better directory control
  host.vscode.postMessage({
    type: 'selectCalibrationFile',
    fileIndex: fileIndex,
  });
}

export async function loadCalibrationFile(
  host: CalibrationFormHost,
  file: File,
  fileIndex: number
): Promise<void> {
  try {
    const text = await file.text();

    // Parse calibration file based on format
    const calibrationData = parseCalibrationFile(text, file.name);
    if (!calibrationData) {
      return; // Error already shown by parseCalibrationFile
    }

    // Display calibration file info and populate camera selection
    host.displayCalibrationInfo(calibrationData, file.name, fileIndex);
  } catch (error) {
    console.error('Error loading calibration file:', error);
    alert(
      `Failed to load calibration file: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export function handleCalibrationFileSelected(host: CalibrationFormHost, message: any): void {
  try {
    const fileIndex = message.fileIndex;
    const fileName = message.fileName;
    const content = message.content;

    // Parse calibration file using the universal parser
    const calibrationData = parseCalibrationFile(content, fileName);
    if (!calibrationData) {
      return; // Error already shown by parseCalibrationFile
    }

    // Display calibration file info and populate camera selection
    host.displayCalibrationInfo(calibrationData, fileName, fileIndex);

    // Check if this is part of a dataset workflow and trigger next step
    const pendingFiles = Array.from(host.pendingDepthFiles.values());
    const datasetFile = pendingFiles.find(f => f.sceneMetadata && f.sceneMetadata.isDatasetScene);

    if (datasetFile && datasetFile.sceneMetadata) {
      console.log(`🎯 Dataset calibration loaded - triggering Step 3: color image loading...`);

      // Step 3: Trigger color image loading after brief delay
      setTimeout(async () => {
        await host.triggerDatasetImageLoading(datasetFile.sceneMetadata);
      }, 1000);

      host.showStatus(
        `📁 Step 2: Calibration loaded for ${datasetFile.sceneMetadata.sceneName} - loading color image next...`
      );
    }
  } catch (error) {
    console.error('Error processing calibration file:', error);
    alert(
      `Failed to process calibration file: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export function displayCalibrationInfo(
  host: CalibrationFormHost,
  calibrationData: any,
  fileName: string,
  fileIndex: number
): void {
  const calibrationInfo = document.getElementById(`calibration-info-${fileIndex}`);
  const calibrationFilename = document.getElementById(`calibration-filename-${fileIndex}`);
  const cameraSelect = document.getElementById(`camera-select-${fileIndex}`) as HTMLSelectElement;

  if (!calibrationInfo || !calibrationFilename || !cameraSelect) {
    console.error('Calibration UI elements not found');
    return;
  }

  // Show calibration info panel
  calibrationInfo.style.display = 'block';
  calibrationFilename.textContent = `📄 ${fileName}`;

  // Clear and populate camera selection dropdown
  cameraSelect.innerHTML = '<option value="">Select camera...</option>';

  // Store calibration data for this file index
  if (!host.calibrationData) {
    host.calibrationData = new Map();
  }
  host.calibrationData.set(fileIndex, calibrationData);

  // Extract camera names from calibration data and automatically select the first one
  if (calibrationData.cameras && typeof calibrationData.cameras === 'object') {
    const cameraNames = Object.keys(calibrationData.cameras);

    // Populate dropdown with all cameras
    cameraNames.forEach(cameraName => {
      const option = document.createElement('option');
      option.value = cameraName;
      option.textContent = cameraName;
      cameraSelect.appendChild(option);
    });

    if (cameraNames.length > 0) {
      // Automatically select the first camera
      const firstCamera = cameraNames[0];
      cameraSelect.value = firstCamera;

      // Auto-populate form fields from the first camera
      const cameraData = calibrationData.cameras[firstCamera];
      populateFormFromCalibration(host, cameraData, fileIndex);

      console.log(
        `📷 Loaded calibration file with ${cameraNames.length} cameras: ${cameraNames.join(', ')}\n✅ Automatically selected first camera: ${firstCamera}`
      );
    } else {
      console.warn('No cameras found in calibration file');
      alert('No cameras found in the calibration file. Please check the file format.');
    }
  } else {
    console.warn('No cameras found in calibration file');
    alert('No cameras found in the calibration file. Please check the file format.');
  }
}

export function onCameraSelectionChange(
  host: CalibrationFormHost,
  fileIndex: number,
  selectedCamera: string
): void {
  if (!selectedCamera || !host.calibrationData || !host.calibrationData.has(fileIndex)) {
    return;
  }

  const calibrationData = host.calibrationData.get(fileIndex);
  const cameraData = calibrationData.cameras[selectedCamera];

  if (!cameraData) {
    console.warn(`Camera "${selectedCamera}" not found in calibration data`);
    return;
  }

  // Auto-populate form fields from camera data
  populateFormFromCalibration(host, cameraData, fileIndex);

  console.log(`📷 Applied calibration for camera "${selectedCamera}" to file ${fileIndex}`);
}

export function populateFormFromCalibration(
  host: CalibrationFormHost,
  cameraData: any,
  fileIndex: number
): void {
  // Get form elements
  const fxInput = document.getElementById(`fx-${fileIndex}`) as HTMLInputElement;
  const fyInput = document.getElementById(`fy-${fileIndex}`) as HTMLInputElement;
  const cxInput = document.getElementById(`cx-${fileIndex}`) as HTMLInputElement;
  const cyInput = document.getElementById(`cy-${fileIndex}`) as HTMLInputElement;
  const cameraModelSelect = document.getElementById(
    `camera-model-${fileIndex}`
  ) as HTMLSelectElement;
  const baselineInput = document.getElementById(`baseline-${fileIndex}`) as HTMLInputElement;
  const depthTypeSelect = document.getElementById(`depth-type-${fileIndex}`) as HTMLSelectElement;

  // Populate focal lengths
  if (cameraData.fx !== undefined && fxInput) {
    fxInput.value = String(cameraData.fx);
  }
  if (cameraData.fy !== undefined && fyInput) {
    fyInput.value = String(cameraData.fy);
  }

  // Populate principal point
  if (cameraData.cx !== undefined && cxInput) {
    cxInput.value = String(cameraData.cx);
  }
  if (cameraData.cy !== undefined && cyInput) {
    cyInput.value = String(cameraData.cy);
  }

  // Populate baseline if available (from calib.txt files)
  if (cameraData.baseline !== undefined && baselineInput) {
    baselineInput.value = String(cameraData.baseline);

    // Smart auto-detection: If baseline is present and depth type is still at default (euclidean),
    // auto-switch to disparity mode since baseline is typically used for disparity data.
    // But only if the user hasn't explicitly changed the depth type from default.
    // TODO: This is very handcrafted and should be more general in the future
    if (depthTypeSelect && depthTypeSelect.value === 'euclidean') {
      console.log(
        `📐 Baseline detected (${cameraData.baseline}mm), auto-switching depth type to 'disparity'`
      );
      depthTypeSelect.value = 'disparity';

      // Show baseline and disparity offset groups since we switched to disparity
      const baselineGroup = document.getElementById(`baseline-group-${fileIndex}`);
      const disparityOffsetGroup = document.getElementById(`disparity-offset-group-${fileIndex}`);
      if (baselineGroup) {
        baselineGroup.style.display = '';
      }
      if (disparityOffsetGroup) {
        disparityOffsetGroup.style.display = '';
      }
    } else if (depthTypeSelect) {
      console.log(
        `📐 Baseline detected but depth type already set to '${depthTypeSelect.value}', keeping user choice`
      );
    }
  }

  // Set disparity offset (doffs) from calib.txt data if available
  const calibrationData = host.calibrationData?.get(fileIndex);
  if (calibrationData && calibrationData._calibTxtData) {
    const disparityOffsetInput = document.getElementById(
      `disparity-offset-${fileIndex}`
    ) as HTMLInputElement;
    if (disparityOffsetInput) {
      disparityOffsetInput.value = String(calibrationData._calibTxtData.doffs);
    }
  }

  // Try to set camera model if available
  if (cameraData.camera_model && cameraModelSelect) {
    // Map common camera model names to our options
    const modelMapping: { [key: string]: string } = {
      pinhole: 'pinhole-ideal',
      pinhole_ideal: 'pinhole-ideal',
      opencv: 'pinhole-opencv',
      pinhole_opencv: 'pinhole-opencv',
      fisheye: 'fisheye-equidistant',
      fisheye_equidistant: 'fisheye-equidistant',
      kannala_brandt_k3: 'fisheye-kb3',
      kb3: 'fisheye-kb3',
      fisheye_radtan_thinprism: 'fisheye624',
      fisheye624: 'fisheye624',
    };

    const modelName =
      modelMapping[cameraData.camera_model.toLowerCase()] || cameraData.camera_model;
    if (modelName) {
      // Check if this model exists in our select options
      const option = Array.from(cameraModelSelect.options).find(opt => opt.value === modelName);
      if (option) {
        cameraModelSelect.value = modelName;
        // CRITICAL FIX: Trigger change event to show/hide distortion parameter fields
        cameraModelSelect.dispatchEvent(new Event('change'));
      }
    }
  }

  if (Array.isArray(cameraData.coefficients)) {
    const coefficientsInput = document.getElementById(
      `camera-coefficients-${fileIndex}`
    ) as HTMLInputElement | null;
    if (coefficientsInput) {
      coefficientsInput.value = cameraData.coefficients.join(',');
    }
  }

  // Populate distortion coefficients if available
  if (cameraData.k1 !== undefined) {
    const k1Input = document.getElementById(`k1-${fileIndex}`) as HTMLInputElement;
    if (k1Input) {
      k1Input.value = String(cameraData.k1);
    }
  }
  if (cameraData.k2 !== undefined) {
    const k2Input = document.getElementById(`k2-${fileIndex}`) as HTMLInputElement;
    if (k2Input) {
      k2Input.value = String(cameraData.k2);
    }
  }
  if (cameraData.k3 !== undefined) {
    const k3Input = document.getElementById(`k3-${fileIndex}`) as HTMLInputElement;
    if (k3Input) {
      k3Input.value = String(cameraData.k3);
    }
  }
  if (cameraData.k4 !== undefined) {
    const k4Input = document.getElementById(`k4-${fileIndex}`) as HTMLInputElement;
    if (k4Input) {
      k4Input.value = String(cameraData.k4);
    }
  }
  if (cameraData.p1 !== undefined) {
    const p1Input = document.getElementById(`p1-${fileIndex}`) as HTMLInputElement;
    if (p1Input) {
      p1Input.value = String(cameraData.p1);
    }
  }
  if (cameraData.p2 !== undefined) {
    const p2Input = document.getElementById(`p2-${fileIndex}`) as HTMLInputElement;
    if (p2Input) {
      p2Input.value = String(cameraData.p2);
    }
  }

  // Trigger update of default button state
  host.updateSingleDefaultButtonState(fileIndex);

  console.log('📐 Camera parameters populated from calibration:', {
    fx: cameraData.fx,
    fy: cameraData.fy,
    cx: cameraData.cx,
    cy: cameraData.cy,
    baseline: cameraData.baseline,
    model: cameraData.camera_model,
  });
}
