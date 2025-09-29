export interface CameraIntrinsics {
  fx: number;
  fy: number;
  cx: number;
  cy: number;
}

export interface StereoCalibration {
  cam0: CameraIntrinsics;
  cam1: CameraIntrinsics;
  baseline: number;
  doffs: number;
  width: number;
  height: number;
  ndisp: number;
  vmin: number;
  vmax: number;
}

export interface DatasetScene {
  name: string;
  displayName: string;
  cached: boolean;
  files: {
    calibration: string;
    disparity: string;
    image: string;
  };
}

export interface DatasetProvider {
  name: string;
  displayName: string;
  getScenes(): Promise<DatasetScene[]>;
  downloadScene(scene: DatasetScene, onProgress?: (progress: DownloadProgress) => void): Promise<CachedSceneFiles>;
  getCachedScene(scene: DatasetScene): Promise<CachedSceneFiles | null>;
}

export interface CachedSceneFiles {
  calibrationPath: string;
  disparityPath: string;
  imagePath: string;
  calibration: StereoCalibration;
}

export interface DownloadProgress {
  file: string;
  loaded: number;
  total: number;
  stage: 'downloading' | 'parsing' | 'complete' | 'extracting' | 'merging' | 'cleanup';
}