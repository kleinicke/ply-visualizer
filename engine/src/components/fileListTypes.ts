import type { PointCloudVisualizer } from '../main';

export type FileItemHost = Pick<
  PointCloudVisualizer,
  | 'scene'
  | 'meshes'
  | 'poseGroups'
  | 'applyPoseConvention'
  | 'applyPoseFilters'
  | 'cameraGroups'
  | 'cameraNames'
  | 'cameraShowCoords'
  | 'cameraShowLabels'
  | 'fileColors'
  | 'fileEntries'
  | 'getColorOptions'
  | 'getTransformationMatrixAsArray'
  | 'hasIntensityData'
  | 'isDepthDerivedFile'
  | 'onFileColorModeChange'
  | 'poseConvention'
  | 'poseMaxUncertaintyThreshold'
  | 'poseMeta'
  | 'poseMinScoreThreshold'
  | 'poseScaleByScore'
  | 'poseScaleByUncertainty'
  | 'poseShowLabels'
  | 'poseUseDatasetColors'
  | 'requestLoadMtl'
  | 'requestRemoveFile'
  | 'requestRender'
  | 'soloPointCloud'
  | 'spatialFiles'
  | 'splatMode'
  | 'toggleCameraProfileCoordinates'
  | 'toggleCameraProfileLabels'
  | 'toggleFileVisibility'
  | 'toggleUniversalRenderMode'
  | 'updatePointSize'
  | 'updatePoseAppearance'
  | 'updatePoseLabels'
  | 'updatePoseScaling'
>;

export type FileListHost = FileItemHost &
  Pick<
    PointCloudVisualizer,
    'pendingLoadDetail' | 'pendingLoadLabel' | 'sequenceFiles' | 'sequenceIndex' | 'sequenceMode'
  >;
