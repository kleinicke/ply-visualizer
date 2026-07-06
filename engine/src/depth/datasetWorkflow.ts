export interface DatasetWorkflowHost {
  vscode: { postMessage(message: any): void };
  datasetTextures: Map<
    string,
    { fileName: string; sceneName: string; data: ArrayBuffer; arrayBuffer: ArrayBuffer }
  >;
  showStatus(message: string): void;
  showError(message: string): void;
}

export async function triggerDatasetCalibrationLoading(
  host: DatasetWorkflowHost,
  sceneMetadata: any
): Promise<void> {
  try {
    console.log('📁 Step 1: Triggering calibration file loading...');

    // Step 1: Load calibration file using VS Code extension
    host.vscode.postMessage({
      type: 'loadDatasetCalibration',
      calibrationPath: sceneMetadata.calibrationPath,
      fileIndex: 0, // Assuming depth file is file index 0
      sceneName: sceneMetadata.sceneName,
    });

    // Note: We'll trigger next steps when we receive the calibration response
  } catch (error) {
    console.error('Error triggering dataset calibration loading:', error);
    host.showError(
      `Failed to load dataset calibration: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function triggerDatasetImageLoading(
  host: DatasetWorkflowHost,
  sceneMetadata: any
): Promise<void> {
  try {
    console.log('📷 Step 3: Triggering color image loading...');

    // Step 3: Load color image using VS Code extension
    host.vscode.postMessage({
      type: 'loadDatasetImage',
      imagePath: sceneMetadata.texturePath,
      fileIndex: 0, // Assuming depth file is file index 0
      sceneName: sceneMetadata.sceneName,
    });
  } catch (error) {
    console.error('Error triggering dataset image loading:', error);
    host.showError(
      `Failed to load dataset image: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function handleDatasetTexture(host: DatasetWorkflowHost, message: any): Promise<void> {
  try {
    console.log(`📷 Received dataset texture: ${message.fileName} for ${message.sceneName}`);

    // Store texture data for later use when depth conversion happens
    // Don't add as a separate file - it will be applied to the point cloud
    const textureData = {
      fileName: message.fileName,
      sceneName: message.sceneName,
      data: message.data,
      arrayBuffer: message.data,
    };

    // Store in a class property for later use
    host.datasetTextures.set(message.sceneName, textureData);

    host.showStatus(
      `📷 Pre-loaded dataset texture: ${message.fileName} for ${message.sceneName} (will apply during depth conversion)`
    );
  } catch (error) {
    console.error('Error handling dataset texture:', error);
    host.showError(
      `Failed to handle texture: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
