import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';
import { DatasetProvider, DatasetScene, CachedSceneFiles, DownloadProgress } from './types';
import { CalibrationParser } from './calibrationParser';

// Import 7zip-min with error handling
let zip: any;
try {
  zip = require('7zip-min');
  console.log('✅ 7zip-min loaded successfully');
} catch (error) {
  console.error('❌ Failed to load 7zip-min:', error);
  throw error;
}

export class Eth3dProvider implements DatasetProvider {
  name = 'eth3d';
  displayName = 'ETH3D Two-View Stereo';
  
  private baseUrl = 'https://www.eth3d.net/data';
  private cacheDir: string;
  private archiveUrls = {
    training: 'https://www.eth3d.net/data/two_view_training.7z',
    groundTruth: 'https://www.eth3d.net/data/two_view_training_gt.7z'
  };

  constructor(private context: vscode.ExtensionContext) {
    this.cacheDir = path.join(context.globalStorageUri?.fsPath || context.extensionUri.fsPath, 'datasets', 'eth3d');
  }

  private readonly scenes: DatasetScene[] = [
    { name: 'delivery_area_1l', displayName: 'Delivery Area 1L', cached: false, files: { calibration: 'calib.txt', disparity: 'disp0GT.pfm', image: 'im0.png' }},
    { name: 'delivery_area_1s', displayName: 'Delivery Area 1S', cached: false, files: { calibration: 'calib.txt', disparity: 'disp0GT.pfm', image: 'im0.png' }},
    { name: 'delivery_area_2l', displayName: 'Delivery Area 2L', cached: false, files: { calibration: 'calib.txt', disparity: 'disp0GT.pfm', image: 'im0.png' }},
    { name: 'delivery_area_2s', displayName: 'Delivery Area 2S', cached: false, files: { calibration: 'calib.txt', disparity: 'disp0GT.pfm', image: 'im0.png' }},
    { name: 'delivery_area_3l', displayName: 'Delivery Area 3L', cached: false, files: { calibration: 'calib.txt', disparity: 'disp0GT.pfm', image: 'im0.png' }},
    { name: 'delivery_area_3s', displayName: 'Delivery Area 3S', cached: false, files: { calibration: 'calib.txt', disparity: 'disp0GT.pfm', image: 'im0.png' }},
    { name: 'electro_1l', displayName: 'Electro 1L', cached: false, files: { calibration: 'calib.txt', disparity: 'disp0GT.pfm', image: 'im0.png' }},
    { name: 'electro_1s', displayName: 'Electro 1S', cached: false, files: { calibration: 'calib.txt', disparity: 'disp0GT.pfm', image: 'im0.png' }},
    { name: 'electro_2l', displayName: 'Electro 2L', cached: false, files: { calibration: 'calib.txt', disparity: 'disp0GT.pfm', image: 'im0.png' }},
    { name: 'electro_2s', displayName: 'Electro 2S', cached: false, files: { calibration: 'calib.txt', disparity: 'disp0GT.pfm', image: 'im0.png' }},
    { name: 'electro_3l', displayName: 'Electro 3L', cached: false, files: { calibration: 'calib.txt', disparity: 'disp0GT.pfm', image: 'im0.png' }},
    { name: 'electro_3s', displayName: 'Electro 3S', cached: false, files: { calibration: 'calib.txt', disparity: 'disp0GT.pfm', image: 'im0.png' }},
    { name: 'facade_1s', displayName: 'Facade 1S', cached: false, files: { calibration: 'calib.txt', disparity: 'disp0GT.pfm', image: 'im0.png' }},
    { name: 'forest_1s', displayName: 'Forest 1S', cached: false, files: { calibration: 'calib.txt', disparity: 'disp0GT.pfm', image: 'im0.png' }},
    { name: 'forest_2s', displayName: 'Forest 2S', cached: false, files: { calibration: 'calib.txt', disparity: 'disp0GT.pfm', image: 'im0.png' }},
    { name: 'playground_1l', displayName: 'Playground 1L', cached: false, files: { calibration: 'calib.txt', disparity: 'disp0GT.pfm', image: 'im0.png' }},
    { name: 'playground_1s', displayName: 'Playground 1S', cached: false, files: { calibration: 'calib.txt', disparity: 'disp0GT.pfm', image: 'im0.png' }},
    { name: 'playground_2l', displayName: 'Playground 2L', cached: false, files: { calibration: 'calib.txt', disparity: 'disp0GT.pfm', image: 'im0.png' }},
    { name: 'playground_2s', displayName: 'Playground 2S', cached: false, files: { calibration: 'calib.txt', disparity: 'disp0GT.pfm', image: 'im0.png' }},
    { name: 'playground_3l', displayName: 'Playground 3L', cached: false, files: { calibration: 'calib.txt', disparity: 'disp0GT.pfm', image: 'im0.png' }},
    { name: 'playground_3s', displayName: 'Playground 3S', cached: false, files: { calibration: 'calib.txt', disparity: 'disp0GT.pfm', image: 'im0.png' }},
    { name: 'terrace_1s', displayName: 'Terrace 1S', cached: false, files: { calibration: 'calib.txt', disparity: 'disp0GT.pfm', image: 'im0.png' }},
    { name: 'terrace_2s', displayName: 'Terrace 2S', cached: false, files: { calibration: 'calib.txt', disparity: 'disp0GT.pfm', image: 'im0.png' }},
    { name: 'terrains_1l', displayName: 'Terrains 1L', cached: false, files: { calibration: 'calib.txt', disparity: 'disp0GT.pfm', image: 'im0.png' }},
    { name: 'terrains_1s', displayName: 'Terrains 1S', cached: false, files: { calibration: 'calib.txt', disparity: 'disp0GT.pfm', image: 'im0.png' }},
    { name: 'terrains_2l', displayName: 'Terrains 2L', cached: false, files: { calibration: 'calib.txt', disparity: 'disp0GT.pfm', image: 'im0.png' }},
    { name: 'terrains_2s', displayName: 'Terrains 2S', cached: false, files: { calibration: 'calib.txt', disparity: 'disp0GT.pfm', image: 'im0.png' }}
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

    const sceneDir = path.join(this.cacheDir, 'two_view_training', scene.name);
    const calibrationPath = path.join(sceneDir, scene.files.calibration);
    const disparityPath = path.join(sceneDir, scene.files.disparity);
    const imagePath = path.join(sceneDir, scene.files.image);

    try {
      const calibContent = await fs.promises.readFile(calibrationPath, 'utf8');
      const calibration = CalibrationParser.parseMiddleburyCalib(calibContent); // ETH3D uses same format

      return {
        calibrationPath,
        disparityPath,
        imagePath,
        calibration
      };
    } catch (error) {
      console.error(`Failed to load cached ETH3D scene ${scene.name}:`, error);
      return null;
    }
  }

  async downloadScene(scene: DatasetScene, onProgress?: (progress: DownloadProgress) => void): Promise<CachedSceneFiles> {
    console.log(`📦 Starting ETH3D scene download: ${scene.name}`);
    console.log(`📁 Cache directory: ${this.cacheDir}`);
    
    // Check if archives are already downloaded and extracted
    const extractedDir = path.join(this.cacheDir, 'two_view_training');
    const sceneDir = path.join(extractedDir, scene.name);
    
    console.log(`🔍 Checking if scene is cached: ${sceneDir}`);
    const isCached = await this.isSceneCached(scene);
    console.log(`📋 Scene cached: ${isCached}`);
    
    if (!isCached) {
      console.log(`📁 Ensuring cache directory exists: ${this.cacheDir}`);
      await this.ensureDirectoryExists(this.cacheDir);
      
      // Download and extract both archives if not already done
      console.log(`🔍 Checking if archives are extracted...`);
      const archivesExtracted = await this.areArchivesExtracted();
      console.log(`📋 Archives extracted: ${archivesExtracted}`);
      
      if (!archivesExtracted) {
        console.log(`📦 Starting download and extraction process...`);
        await this.downloadAndExtractArchives(onProgress);
      }
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
    const calibration = CalibrationParser.parseMiddleburyCalib(calibContent); // ETH3D uses same format

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

  private async areArchivesExtracted(): Promise<boolean> {
    const extractedDir = path.join(this.cacheDir, 'two_view_training');
    try {
      // Check if at least one scene directory exists
      const testSceneDir = path.join(extractedDir, 'delivery_area_1l');
      await fs.promises.access(testSceneDir, fs.constants.F_OK);
      
      // Check if the test scene has all required files
      const files = ['calib.txt', 'disp0GT.pfm', 'im0.png'];
      for (const file of files) {
        await fs.promises.access(path.join(testSceneDir, file), fs.constants.F_OK);
      }
      return true;
    } catch {
      return false;
    }
  }

  private async downloadAndExtractArchives(onProgress?: (progress: DownloadProgress) => void): Promise<void> {
    console.log(`🚀 Starting ETH3D archive download and extraction process`);
    const archiveNames = ['two_view_training.7z', 'two_view_training_gt.7z'];
    const archivePaths = archiveNames.map(name => path.join(this.cacheDir, name));
    
    console.log(`📦 Will download archives to:`);
    archivePaths.forEach((path, i) => console.log(`  ${i + 1}. ${path}`));
    
    // Download both archives
    for (let i = 0; i < archiveNames.length; i++) {
      const archiveName = archiveNames[i];
      const archivePath = archivePaths[i];
      const url = i === 0 ? this.archiveUrls.training : this.archiveUrls.groundTruth;
      
      console.log(`📥 Starting download: ${archiveName} from ${url}`);
      
      onProgress?.({
        file: archiveName,
        loaded: 0,
        total: 0,
        stage: 'downloading'
      });

      try {
        await this.downloadFile(url, archivePath, (loaded, total) => {
          onProgress?.({
            file: archiveName,
            loaded,
            total,
            stage: 'downloading'
          });
        });
        console.log(`✅ Downloaded: ${archiveName}`);
        
        // Check file size
        const stats = await fs.promises.stat(archivePath);
        console.log(`📏 File size: ${Math.round(stats.size / 1024 / 1024)}MB`);
      } catch (error) {
        console.error(`❌ Failed to download ${archiveName}:`, error);
        throw error;
      }
    }

    // 7zip-min library provides built-in 7z binaries, no external dependency needed

    // Extract both archives into temporary directories
    const tempDir1 = path.join(this.cacheDir, 'temp_training');
    const tempDir2 = path.join(this.cacheDir, 'temp_gt');
    
    onProgress?.({
      file: 'extracting archives',
      loaded: 0,
      total: 2,
      stage: 'extracting'
    });

    console.log(`📦 Extracting training archive to: ${tempDir1}`);
    await this.extract7zWithLibrary(archivePaths[0], tempDir1);
    console.log('✅ Training archive extracted');
    
    onProgress?.({
      file: 'extracting archives',
      loaded: 1,
      total: 2,
      stage: 'extracting'
    });

    console.log(`📦 Extracting ground truth archive to: ${tempDir2}`);
    await this.extract7zWithLibrary(archivePaths[1], tempDir2);
    console.log('✅ Ground truth archive extracted');

    onProgress?.({
      file: 'merging archives',
      loaded: 0,
      total: 1,
      stage: 'merging'
    });

    // Merge the two extracted directories
    console.log('📦 Merging archive contents...');
    await this.mergeDirectories(tempDir1, tempDir2, path.join(this.cacheDir, 'two_view_training'));

    // Clean up temporary files
    onProgress?.({
      file: 'cleanup',
      loaded: 0,
      total: 1,
      stage: 'cleanup'
    });

    console.log('🧹 Cleaning up temporary files...');
    await this.cleanupFiles([
      ...archivePaths,
      tempDir1,
      tempDir2
    ]);

    console.log('✅ ETH3D dataset extraction completed');
  }

  private async extract7zWithLibrary(archivePath: string, extractDir: string): Promise<void> {
    await this.ensureDirectoryExists(extractDir);
    
    // Configure 7zip-min to use the bundled binaries
    const extensionPath = this.context.extensionPath;
    
    // Determine platform-specific binary path
    const platform = process.platform;
    const arch = process.arch;
    let platformDir = '';
    
    if (platform === 'darwin') {
      platformDir = arch === 'arm64' ? 'mac/arm64' : 'mac/x64';
    } else if (platform === 'win32') {
      platformDir = arch === 'x64' ? 'win/x64' : 'win/ia32';
    } else {
      platformDir = arch === 'x64' ? 'linux/x64' : 'linux/ia32';
    }
    
    const binaryName = platform === 'win32' ? '7za.exe' : '7za';
    const binaryPath = path.join(extensionPath, 'out', '7zip-bin', 'node_modules', '7zip-bin', platformDir, binaryName);
    
    // Check if binary exists, fallback to default if not
    try {
      await fs.promises.access(binaryPath, fs.constants.F_OK);
      zip.config({ binaryPath });
      console.log(`Using 7z binary at: ${binaryPath}`);
    } catch (error) {
      console.warn(`Custom 7z binary not found at ${binaryPath}, using default`);
      // Let 7zip-min use its default binary path
    }
    
    return new Promise((resolve, reject) => {
      zip.unpack(archivePath, extractDir, (err: any) => {
        if (err) {
          reject(new Error(`7z extraction failed: ${err.message || err}`));
        } else {
          resolve();
        }
      });
    });
  }

  private async mergeDirectories(sourceDir1: string, sourceDir2: string, targetDir: string): Promise<void> {
    await this.ensureDirectoryExists(targetDir);
    
    console.log(`🔍 Checking source directories:`);
    console.log(`  Source 1: ${sourceDir1}`);
    console.log(`  Source 2: ${sourceDir2}`);
    console.log(`  Target: ${targetDir}`);
    
    // Check what was actually extracted
    try {
      const files1 = await fs.promises.readdir(sourceDir1);
      const files2 = await fs.promises.readdir(sourceDir2);
      console.log(`📁 Source 1 contents: ${files1.join(', ')}`);
      console.log(`📁 Source 2 contents: ${files2.join(', ')}`);
    } catch (error) {
      console.error(`❌ Error reading source directories:`, error);
    }
    
    // The archives might extract directly or to 'two_view_training' subdirectories
    let actualSource1 = sourceDir1;
    let actualSource2 = sourceDir2;
    
    // Check if archives extracted to subdirectories
    const potentialSubDir1 = path.join(sourceDir1, 'two_view_training');
    const potentialSubDir2 = path.join(sourceDir2, 'two_view_training');
    
    if (await this.directoryExists(potentialSubDir1)) {
      actualSource1 = potentialSubDir1;
      console.log(`📂 Using subdirectory for source 1: ${actualSource1}`);
    } else {
      console.log(`📂 Using root directory for source 1: ${actualSource1}`);
    }
    
    if (await this.directoryExists(potentialSubDir2)) {
      actualSource2 = potentialSubDir2;
      console.log(`📂 Using subdirectory for source 2: ${actualSource2}`);
    } else {
      console.log(`📂 Using root directory for source 2: ${actualSource2}`);
    }
    
    // Copy files from first archive (images)
    if (await this.directoryExists(actualSource1)) {
      console.log(`📋 Copying from source 1: ${actualSource1}`);
      await this.copyDirectory(actualSource1, targetDir);
    } else {
      console.warn(`⚠️ Source 1 directory not found: ${actualSource1}`);
    }
    
    // Copy and merge files from second archive (ground truth)
    if (await this.directoryExists(actualSource2)) {
      console.log(`📋 Copying from source 2: ${actualSource2}`);
      await this.copyDirectory(actualSource2, targetDir, true); // merge mode
    } else {
      console.warn(`⚠️ Source 2 directory not found: ${actualSource2}`);
    }
    
    // Verify final result
    try {
      const finalFiles = await fs.promises.readdir(targetDir);
      console.log(`✅ Final target contents: ${finalFiles.join(', ')}`);
      
      if (finalFiles.length === 0) {
        throw new Error('Merge completed but target directory is empty');
      }
    } catch (error) {
      console.error(`❌ Error checking final result:`, error);
      throw error;
    }
  }

  private async copyDirectory(sourceDir: string, targetDir: string, merge: boolean = false): Promise<void> {
    console.log(`🔄 Copying directory: ${sourceDir} → ${targetDir} (merge: ${merge})`);
    const entries = await fs.promises.readdir(sourceDir, { withFileTypes: true });
    console.log(`📁 Found ${entries.length} entries to copy`);
    
    for (const entry of entries) {
      const sourcePath = path.join(sourceDir, entry.name);
      const targetPath = path.join(targetDir, entry.name);
      
      if (entry.isDirectory()) {
        console.log(`📂 Creating directory: ${entry.name}`);
        await this.ensureDirectoryExists(targetPath);
        await this.copyDirectory(sourcePath, targetPath, merge);
      } else {
        // In merge mode, don't overwrite existing files
        if (merge && await this.fileExists(targetPath)) {
          console.log(`⏭️ Skipping existing file: ${entry.name}`);
          continue;
        }
        console.log(`📄 Copying file: ${entry.name}`);
        await fs.promises.copyFile(sourcePath, targetPath);
      }
    }
    console.log(`✅ Finished copying directory: ${sourceDir}`);
  }

  private async directoryExists(dir: string): Promise<boolean> {
    try {
      const stat = await fs.promises.stat(dir);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  private async fileExists(file: string): Promise<boolean> {
    try {
      await fs.promises.access(file, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  private async cleanupFiles(paths: string[]): Promise<void> {
    for (const filePath of paths) {
      try {
        const stat = await fs.promises.stat(filePath);
        if (stat.isDirectory()) {
          await fs.promises.rm(filePath, { recursive: true, force: true });
        } else {
          await fs.promises.unlink(filePath);
        }
      } catch (error) {
        console.warn(`Failed to cleanup ${filePath}:`, error);
      }
    }
  }

  private async isSceneCached(scene: DatasetScene): Promise<boolean> {
    const sceneDir = path.join(this.cacheDir, 'two_view_training', scene.name);
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
      
      // Total download timeout (20 minutes for larger archives)
      const totalTimeout = setTimeout(() => {
        request.destroy();
        fs.unlink(localPath, () => {});
        reject(new Error('Download timeout: Total download time exceeded 20 minutes'));
      }, 1200000); // 20 minutes
      
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

      // Set inactivity timeout to 2 minutes for larger files
      request.setTimeout(120000, () => {
        clearTimeout(totalTimeout);
        request.destroy();
        fs.unlink(localPath, () => {}); // Clean up on timeout
        reject(new Error('Download timeout: No data received for 2 minutes'));
      });
    });
  }
}