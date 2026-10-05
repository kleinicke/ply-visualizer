import type { EntryRequest } from '../hosts/viewerProtocol';
import type { CameraModel } from './types';
import { groupsFromCoefficients, normalizeToOfferedCameraModel } from './cameraModels';
import { parseCalibrationFile } from './calibrationFileParser';

import {
  getDepthForm,
  type CameraCalibration,
  type DepthCalibration,
  type DepthFormHost,
} from './panelState';

export interface CalibrationFormHost extends DepthFormHost {
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
    entryId: host.fileEntries.require(fileIndex).id,
  } satisfies EntryRequest);
}

export async function loadCalibrationFile(
  host: CalibrationFormHost,
  file: File,
  fileIndex: number
): Promise<void> {
  const entry = host.fileEntries.require(fileIndex);
  try {
    const text = await file.text();
    fileIndex = host.fileEntries.indexOf(entry.id);
    if (fileIndex < 0) {
      return;
    }

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
  calibrationData: DepthCalibration['data'],
  fileName: string,
  fileIndex: number
): void {
  const names = Object.keys(calibrationData?.cameras ?? {});
  if (!names.length) {
    throw new Error('No cameras found in the calibration file');
  }
  getDepthForm(host, fileIndex).calibration = {
    fileName,
    selectedCamera: names[0],
    data: calibrationData,
  };
  populateFormFromCalibration(host, calibrationData.cameras[names[0]], fileIndex);
}

export function onCameraSelectionChange(
  host: CalibrationFormHost,
  fileIndex: number,
  selectedCamera: string
): void {
  const calibration = getDepthForm(host, fileIndex).calibration;
  const camera = calibration?.data.cameras[selectedCamera];
  if (!calibration || !camera) {
    return;
  }
  calibration.selectedCamera = selectedCamera;
  populateFormFromCalibration(host, camera, fileIndex);
}

export function populateFormFromCalibration(
  host: CalibrationFormHost,
  cameraData: CameraCalibration,
  fileIndex: number
): void {
  const form = getDepthForm(host, fileIndex);
  for (const key of [
    'fx',
    'fy',
    'cx',
    'cy',
    'baseline',
    'k1',
    'k2',
    'k3',
    'k4',
    'p1',
    'p2',
  ] as const) {
    if (cameraData[key] !== undefined) {
      form[key] = Number(cameraData[key]);
    }
  }
  if (cameraData.baseline !== undefined && form.depthType === 'euclidean') {
    form.depthType = 'disparity';
  }
  const calibrationData = form.calibration?.data;
  if (calibrationData?._calibTxtData?.doffs !== undefined) {
    form.disparityOffset = Number(calibrationData._calibTxtData.doffs);
  }
  const modelMapping: Record<string, CameraModel> = {
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
  const model = cameraData.camera_model
    ? (modelMapping[cameraData.camera_model.toLowerCase()] ?? cameraData.camera_model)
    : form.cameraModel;
  const offered = normalizeToOfferedCameraModel(
    model as CameraModel,
    cameraData.coefficients ?? []
  );
  form.cameraModel = offered.model as import('../interfaces').CameraParams['cameraModel'];
  form.coefficientGroups = groupsFromCoefficients(offered.model, offered.coefficients);
  host.updateSingleDefaultButtonState(fileIndex);
}
