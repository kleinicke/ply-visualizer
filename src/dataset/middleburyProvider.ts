import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';
import { DatasetProvider, DatasetScene, CachedSceneFiles, DownloadProgress } from './types';
import { CalibrationParser } from './calibrationParser';

export class MiddleburyProvider implements DatasetProvider {
  name = 'middlebury';
  displayName = 'Middlebury Stereo 2014';
  
  private baseUrl = 'https://vision.middlebury.edu/stereo/data/scenes2014/datasets';
  private cacheDir: string;

  constructor(private context: vscode.ExtensionContext) {
    this.cacheDir = path.join(context.globalStorageUri?.fsPath || context.extensionUri.fsPath, 'datasets', 'middlebury');
  }

  private readonly scenes: DatasetScene[] = [
    { name: 'Adirondack-perfect', displayName: 'Adirondack', cached: false, files: { calibration: 'calib.txt', disparity: 'disp0.pfm', image: 'im0.png' }},
    { name: 'Backpack-perfect', displayName: 'Backpack', cached: false, files: { calibration: 'calib.txt', disparity: 'disp0.pfm', image: 'im0.png' }},
    { name: 'Bicycle1-perfect', displayName: 'Bicycle1', cached: false, files: { calibration: 'calib.txt', disparity: 'disp0.pfm', image: 'im0.png' }},
    { name: 'Cable-perfect', displayName: 'Cable', cached: false, files: { calibration: 'calib.txt', disparity: 'disp0.pfm', image: 'im0.png' }},
    { name: 'Classroom1-perfect', displayName: 'Classroom1', cached: false, files: { calibration: 'calib.txt', disparity: 'disp0.pfm', image: 'im0.png' }},
    { name: 'Couch-perfect', displayName: 'Couch', cached: false, files: { calibration: 'calib.txt', disparity: 'disp0.pfm', image: 'im0.png' }},
    { name: 'Flowers-perfect', displayName: 'Flowers', cached: false, files: { calibration: 'calib.txt', disparity: 'disp0.pfm', image: 'im0.png' }},
    { name: 'Jadeplant-perfect', displayName: 'Jadeplant', cached: false, files: { calibration: 'calib.txt', disparity: 'disp0.pfm', image: 'im0.png' }},
    { name: 'Mask-perfect', displayName: 'Mask', cached: false, files: { calibration: 'calib.txt', disparity: 'disp0.pfm', image: 'im0.png' }},
    { name: 'Motorcycle-perfect', displayName: 'Motorcycle', cached: false, files: { calibration: 'calib.txt', disparity: 'disp0.pfm', image: 'im0.png' }},
    { name: 'Piano-perfect', displayName: 'Piano', cached: false, files: { calibration: 'calib.txt', disparity: 'disp0.pfm', image: 'im0.png' }},
    { name: 'Pipes-perfect', displayName: 'Pipes', cached: false, files: { calibration: 'calib.txt', disparity: 'disp0.pfm', image: 'im0.png' }},
    { name: 'Playroom-perfect', displayName: 'Playroom', cached: false, files: { calibration: 'calib.txt', disparity: 'disp0.pfm', image: 'im0.png' }},
    { name: 'Playtable-perfect', displayName: 'Playtable', cached: false, files: { calibration: 'calib.txt', disparity: 'disp0.pfm', image: 'im0.png' }},
    { name: 'Recycle-perfect', displayName: 'Recycle', cached: false, files: { calibration: 'calib.txt', disparity: 'disp0.pfm', image: 'im0.png' }},
    { name: 'Shelves-perfect', displayName: 'Shelves', cached: false, files: { calibration: 'calib.txt', disparity: 'disp0.pfm', image: 'im0.png' }},
    { name: 'Shopvac-perfect', displayName: 'Shopvac', cached: false, files: { calibration: 'calib.txt', disparity: 'disp0.pfm', image: 'im0.png' }},
    { name: 'Sticks-perfect', displayName: 'Sticks', cached: false, files: { calibration: 'calib.txt', disparity: 'disp0.pfm', image: 'im0.png' }},
    { name: 'Storage-perfect', displayName: 'Storage', cached: false, files: { calibration: 'calib.txt', disparity: 'disp0.pfm', image: 'im0.png' }},
    { name: 'Sword1-perfect', displayName: 'Sword1', cached: false, files: { calibration: 'calib.txt', disparity: 'disp0.pfm', image: 'im0.png' }},
    { name: 'Sword2-perfect', displayName: 'Sword2', cached: false, files: { calibration: 'calib.txt', disparity: 'disp0.pfm', image: 'im0.png' }},
    { name: 'Umbrella-perfect', displayName: 'Umbrella', cached: false, files: { calibration: 'calib.txt', disparity: 'disp0.pfm', image: 'im0.png' }},
    { name: 'Vintage-perfect', displayName: 'Vintage', cached: false, files: { calibration: 'calib.txt', disparity: 'disp0.pfm', image: 'im0.png' }}
  ];

  async getScenes(): Promise<DatasetScene[]> {
    // Check cached status for each scene
    const updatedScenes = await Promise.all(
      this.scenes.map(async scene => ({
        ...scene,
        cached: await this.isSceneCached(scene)
      }))
    );
    return updatedScenes;
  }

  async getCachedScene(scene: DatasetScene): Promise<CachedSceneFiles | null> {
    if (!await this.isSceneCached(scene)) {
      return null;
    }

    const sceneDir = path.join(this.cacheDir, scene.name);
    const calibrationPath = path.join(sceneDir, scene.files.calibration);
    const disparityPath = path.join(sceneDir, scene.files.disparity);
    const imagePath = path.join(sceneDir, scene.files.image);

    try {
      const calibContent = await fs.promises.readFile(calibrationPath, 'utf8');
      const calibration = CalibrationParser.parseMiddleburyCalib(calibContent);

      return {
        calibrationPath,
        disparityPath,
        imagePath,
        calibration
      };
    } catch (error) {
      console.error(`Failed to load cached scene ${scene.name}:`, error);
      return null;
    }
  }

  async downloadScene(scene: DatasetScene, onProgress?: (progress: DownloadProgress) => void): Promise<CachedSceneFiles> {
    const sceneDir = path.join(this.cacheDir, scene.name);
    await this.ensureDirectoryExists(sceneDir);

    const files = [scene.files.calibration, scene.files.disparity, scene.files.image];
    
    // Download each file
    for (const filename of files) {
      onProgress?.({
        file: filename,
        loaded: 0,
        total: 0,
        stage: 'downloading'
      });

      const url = `${this.baseUrl}/${scene.name}/${filename}`;
      const localPath = path.join(sceneDir, filename);
      
      await this.downloadFile(url, localPath, (loaded, total) => {
        onProgress?.({
          file: filename,
          loaded,
          total,
          stage: 'downloading'
        });
      });
    }

    onProgress?.({
      file: 'calibration',
      loaded: 1,
      total: 1,
      stage: 'parsing'
    });

    // Parse calibration
    const calibrationPath = path.join(sceneDir, scene.files.calibration);
    const calibContent = await fs.promises.readFile(calibrationPath, 'utf8');
    const calibration = CalibrationParser.parseMiddleburyCalib(calibContent);

    onProgress?.({
      file: 'complete',
      loaded: 1,
      total: 1,
      stage: 'complete'
    });

    return {
      calibrationPath,
      disparityPath: path.join(sceneDir, scene.files.disparity),
      imagePath: path.join(sceneDir, scene.files.image),
      calibration
    };
  }

  private async isSceneCached(scene: DatasetScene): Promise<boolean> {
    const sceneDir = path.join(this.cacheDir, scene.name);
    const files = [scene.files.calibration, scene.files.disparity, scene.files.image];
    
    try {
      for (const filename of files) {
        const filePath = path.join(sceneDir, filename);
        await fs.promises.access(filePath, fs.constants.F_OK);
      }
      return true;
    } catch {
      return false;
    }
  }

  private async ensureDirectoryExists(dir: string): Promise<void> {
    try {
      await fs.promises.access(dir);
    } catch {
      await fs.promises.mkdir(dir, { recursive: true });
    }
  }

  private async downloadFile(url: string, localPath: string, onProgress?: (loaded: number, total: number) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(localPath);
      
      // Total download timeout (10 minutes for entire download)
      const totalTimeout = setTimeout(() => {
        request.destroy();
        fs.unlink(localPath, () => {});
        reject(new Error('Download timeout: Total download time exceeded 10 minutes'));
      }, 600000); // 10 minutes
      
      const request = https.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }

        const total = parseInt(response.headers['content-length'] || '0');
        let loaded = 0;

        response.on('data', (chunk) => {
          loaded += chunk.length;
          onProgress?.(loaded, total);
        });

        response.pipe(file);

        file.on('finish', () => {
          clearTimeout(totalTimeout);
          file.close();
          resolve();
        });

        file.on('error', (err) => {
          clearTimeout(totalTimeout);
          fs.unlink(localPath, () => {}); // Clean up on error
          reject(err);
        });

      }).on('error', (err) => {
        clearTimeout(totalTimeout);
        reject(err);
      });

      // Set inactivity timeout to 100 seconds (10x longer than default)
      request.setTimeout(100000, () => {
        clearTimeout(totalTimeout);
        request.destroy();
        fs.unlink(localPath, () => {}); // Clean up on timeout
        reject(new Error('Download timeout: No data received for 100 seconds'));
      });
    });
  }
}