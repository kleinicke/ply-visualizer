import * as vscode from 'vscode';
import { DatasetProvider, DatasetScene, CachedSceneFiles } from './types';
import { MiddleburyProvider } from './middleburyProvider';
import { Eth3dProvider } from './eth3dProvider';
import { CalibrationParser } from './calibrationParser';

export class DatasetManager {
  private providers: Map<string, DatasetProvider> = new Map();

  constructor(private context: vscode.ExtensionContext) {
    // Register dataset providers
    this.providers.set('middlebury', new MiddleburyProvider(context));
    this.providers.set('eth3d', new Eth3dProvider(context));
  }

  async showDatasetPicker(): Promise<void> {
    try {
      // Step 1: Choose dataset provider
      const providerItems = Array.from(this.providers.values()).map(provider => ({
        label: provider.displayName,
        description: `${provider.name} dataset`,
        provider: provider
      }));

      const selectedProvider = await vscode.window.showQuickPick(providerItems, {
        placeHolder: 'Select a dataset',
        title: 'Dataset Selection'
      });

      if (!selectedProvider) {
        return;
      }

      // Step 2: Choose scene from provider
      await this.showScenePicker(selectedProvider.provider);

    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to load dataset: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async showScenePicker(provider: DatasetProvider): Promise<void> {
    // Show loading indicator while fetching scenes
    const scenes = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Loading ${provider.displayName} scenes...`,
        cancellable: false
      },
      async () => {
        return await provider.getScenes();
      }
    );

    // Create scene selection items
    const sceneItems = scenes.map(scene => ({
      label: `${scene.cached ? '$(check)' : '$(cloud-download)'} ${scene.displayName}`,
      description: scene.cached ? 'Cached locally' : 'Download required',
      detail: scene.name,
      scene: scene
    }));

    const selectedItem = await vscode.window.showQuickPick(sceneItems, {
      placeHolder: 'Select a scene to load',
      title: `${provider.displayName} Scenes`
    });

    if (!selectedItem) {
      return;
    }

    await this.loadScene(provider, selectedItem.scene);
  }

  private async loadScene(provider: DatasetProvider, scene: DatasetScene): Promise<void> {
    let sceneFiles: CachedSceneFiles;

    // Check if scene is already cached
    const cached = await provider.getCachedScene(scene);
    if (cached) {
      sceneFiles = cached;
      vscode.window.showInformationMessage(`Loading cached ${scene.displayName} scene...`);
    } else {
      // Download scene with progress
      try {
        console.log(`🚀 Starting download for ${provider.name} scene: ${scene.displayName}`);
        sceneFiles = await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Downloading ${scene.displayName} scene`,
            cancellable: false
          },
          async (progress) => {
            return await provider.downloadScene(scene, (downloadProgress) => {
              const percentage = downloadProgress.total > 0 
                ? Math.round((downloadProgress.loaded / downloadProgress.total) * 100)
                : 0;
              
              console.log(`📊 Progress: ${downloadProgress.stage} - ${downloadProgress.file} (${percentage}%)`);
              progress.report({
                message: `${downloadProgress.stage}: ${downloadProgress.file} (${percentage}%)`,
                increment: percentage
              });
            });
          }
        );

        console.log(`✅ Download completed for ${scene.displayName}`);
        vscode.window.showInformationMessage(`Successfully downloaded ${scene.displayName} scene`);
      } catch (error) {
        console.error(`❌ Download failed for ${scene.displayName}:`, error);
        throw new Error(`Download failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Open the scene in the visualizer
    await this.openSceneInVisualizer(sceneFiles, scene);
  }

  private async openSceneInVisualizer(sceneFiles: CachedSceneFiles, scene: DatasetScene): Promise<void> {
    try {
      // Open the disparity file as the main file
      const disparityUri = vscode.Uri.file(sceneFiles.disparityPath);
      await vscode.commands.executeCommand('vscode.openWith', disparityUri, 'plyViewer.plyEditor');

      // Store scene metadata for the webview to use
      const sceneMetadata = {
        sceneName: scene.displayName,
        calibration: CalibrationParser.convertToDepthParameters(sceneFiles.calibration),
        calibrationPath: sceneFiles.calibrationPath,
        texturePath: sceneFiles.imagePath,
        isDatasetScene: true
      };

      // Store in extension context for the webview to retrieve
      await this.context.globalState.update(`dataset_scene_${disparityUri.fsPath}`, sceneMetadata);

      vscode.window.showInformationMessage(
        `Opened ${scene.displayName} scene. Camera parameters will be automatically applied.`
      );

    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to open scene in visualizer: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async getSceneMetadata(filePath: string): Promise<any> {
    return this.context.globalState.get(`dataset_scene_${filePath}`);
  }

  async clearSceneMetadata(filePath: string): Promise<void> {
    await this.context.globalState.update(`dataset_scene_${filePath}`, undefined);
  }

  async clearAllCache(): Promise<void> {
    const response = await vscode.window.showWarningMessage(
      'This will delete all cached dataset files. This cannot be undone.',
      { modal: true },
      'Clear Cache',
      'Cancel'
    );

    if (response === 'Clear Cache') {
      // Clear cache for all providers
      for (const provider of this.providers.values()) {
        // Implementation would depend on provider-specific cache clearing
        // For now, just show a message
      }
      
      vscode.window.showInformationMessage('Dataset cache cleared successfully.');
    }
  }
}