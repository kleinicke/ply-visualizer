import * as vscode from 'vscode';
import { isColmapModelFile } from '../engine/src/formats/colmap/colmapFiles';
import { PointCloudEditorProvider } from './pointCloudEditorProvider';
import { DatasetManager } from './dataset/datasetManager';
import { glob } from 'glob';
import { buildDicomSeriesNrrd, scanDicomFolder } from './providerHandlers/dicomFolderLoader';

export function activate(context: vscode.ExtensionContext) {
  // Register the PLY editor provider
  const provider = new PointCloudEditorProvider(context);
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider('plyViewer.plyEditor', provider, {
      webviewOptions: {
        retainContextWhenHidden: true,
      },
      supportsMultipleEditorsPerDocument: false,
    })
  );

  // Second registration for KITTI BIN scans. Uses a distinct viewType
  // with priority "option" (see package.json) so the extension never hijacks
  // arbitrary .bin files as their default editor — users opt in via
  // "Open With..." or the explorer context menu.
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider('plyViewer.kittiBin', provider, {
      webviewOptions: {
        retainContextWhenHidden: true,
      },
      supportsMultipleEditorsPerDocument: false,
    })
  );

  // Register command for opening PLY/XYZ files
  context.subscriptions.push(
    vscode.commands.registerCommand('plyViewer.openFile', (uri: vscode.Uri) => {
      const viewType = uri.fsPath.toLowerCase().endsWith('.bin')
        ? 'plyViewer.kittiBin'
        : 'plyViewer.plyEditor';
      vscode.commands.executeCommand('vscode.openWith', uri, viewType);
    })
  );

  // Register command for TIF to Point Cloud conversion
  context.subscriptions.push(
    vscode.commands.registerCommand('plyViewer.convertTifToPointCloud', async (uri: vscode.Uri) => {
      await handleDepthToPointCloudConversion(uri, 'TIF');
    })
  );

  // Register command for PFM to Point Cloud conversion
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'plyViewer.convertDepthToPointCloud',
      async (uri: vscode.Uri) => {
        await handleDepthToPointCloudConversion(uri, 'PFM');
      }
    )
  );

  // Register command for NPY/NPZ to Point Cloud conversion
  context.subscriptions.push(
    vscode.commands.registerCommand('plyViewer.convertNpyToPointCloud', async (uri: vscode.Uri) => {
      await handleDepthToPointCloudConversion(uri, 'NPY');
    })
  );

  // Register command for PNG to Point Cloud conversion
  context.subscriptions.push(
    vscode.commands.registerCommand('plyViewer.convertPngToPointCloud', async (uri: vscode.Uri) => {
      await handleDepthToPointCloudConversion(uri, 'PNG');
    })
  );

  // Register command for EXR to Point Cloud conversion
  context.subscriptions.push(
    vscode.commands.registerCommand('plyViewer.convertExrToPointCloud', async (uri: vscode.Uri) => {
      await handleDepthToPointCloudConversion(uri, 'EXR');
    })
  );

  // Register command for opening multiple files
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'plyViewer.openMultipleFiles',
      async (provided?: readonly vscode.Uri[]) => {
        if (Array.isArray(provided) && provided.length > 0) {
          await provider.openFilesTogether(provided);
          return;
        }
        // Avoid blocking tests by not awaiting the file picker
        setImmediate(() => {
          void handleOpenMultipleFiles(provider);
        });
      }
    )
  );

  // Register command for playing a point cloud sequence via wildcard
  context.subscriptions.push(
    vscode.commands.registerCommand('plyViewer.playPointCloudSequence', async () => {
      try {
        const wildcard = await vscode.window.showInputBox({
          prompt: 'Enter a file wildcard (e.g., /path/to/frames_*.ply)',
          placeHolder: '/absolute/path/prefix_*.{ply,xyz,obj}',
          ignoreFocusOut: true,
        });
        if (!wildcard) {
          return;
        }

        // Resolve wildcard to absolute file paths (non-blocking UI progress)
        const matched = await vscode.window.withProgress<string[]>(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Scanning files for sequence…',
            cancellable: false,
          },
          async () => {
            const files = await glob(wildcard, { nodir: true });
            files.sort((a: string, b: string) => a.localeCompare(b, undefined, { numeric: true }));
            return files;
          }
        );

        if (!matched || matched.length === 0) {
          vscode.window.showWarningMessage('No files matched the provided wildcard.');
          return;
        }

        // Use the currently active custom editor if possible; otherwise open the first file
        const active = vscode.window.activeTextEditor?.document.uri;
        const host = active && active.scheme === 'file' ? active : vscode.Uri.file(matched[0]);
        await vscode.commands.executeCommand('vscode.openWith', host, 'plyViewer.plyEditor');
        // Start the sequence in the panel hosting that file
        provider.startSequenceFor(host.fsPath, matched, wildcard);
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to start sequence: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    })
  );

  // Register command for loading JSON as 3D Pose
  context.subscriptions.push(
    vscode.commands.registerCommand('plyViewer.loadJsonAsPose', async (uri: vscode.Uri) => {
      try {
        // Open or focus the viewer
        await vscode.commands.executeCommand('vscode.openWith', uri, 'plyViewer.plyEditor');
        // resolveCustomEditor handles .json by posting poseData
      } catch (err) {
        vscode.window.showErrorMessage(
          `Failed to load JSON as pose: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    })
  );

  // Register command for opening a COLMAP reconstruction folder
  context.subscriptions.push(
    vscode.commands.registerCommand('plyViewer.openColmapReconstruction', async () => {
      setImmediate(() => {
        void handleOpenColmapReconstruction();
      });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('plyViewer.openDicomFolder', async () => {
      await handleOpenDicomFolder(context, provider);
    })
  );

  // Register command for resetting all extension settings
  context.subscriptions.push(
    vscode.commands.registerCommand('plyViewer.resetSettings', async () => {
      try {
        const response = await vscode.window.showWarningMessage(
          'This will reset all 3D Visualizer settings to default values. This cannot be undone.',
          { modal: true },
          'Reset Settings',
          'Cancel'
        );

        if (response === 'Reset Settings') {
          // Clear all stored settings from globalState
          await context.globalState.update('defaultDepthSettings', undefined);

          vscode.window.showInformationMessage(
            '3D Visualizer settings have been reset to defaults. Restart VS Code for a completely fresh start.'
          );

          console.log('3D Visualizer settings reset successfully');
        }
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to reset settings: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    })
  );

  // Initialize dataset manager
  const datasetManager = new DatasetManager(context);

  // Register command for dataset selection
  context.subscriptions.push(
    vscode.commands.registerCommand('plyViewer.selectDataset', async () => {
      await datasetManager.showDatasetPicker();
    })
  );

  // Register command for clearing dataset cache
  context.subscriptions.push(
    vscode.commands.registerCommand('plyViewer.clearDatasetCache', async () => {
      await datasetManager.clearAllCache();
    })
  );

  console.log('3D Visualizer extension is now active!');
}

async function handleDepthToPointCloudConversion(
  uri: vscode.Uri,
  fileType: 'TIF' | 'PFM' | 'NPY' | 'PNG' | 'EXR'
): Promise<void> {
  try {
    // Show progress and open the depth file for conversion
    // Camera parameters will be requested by the webview after analysis
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Opening ${fileType} for Point Cloud Conversion`,
        cancellable: false,
      },
      async progress => {
        progress.report({ message: `Loading ${fileType} file...` });

        // Open the depth file with our custom editor
        // Camera parameters will be requested by the webview after analysis
        await vscode.commands.executeCommand('vscode.openWith', uri, 'plyViewer.plyEditor');

        progress.report({ message: `Analyzing ${fileType} file...` });

        // Small delay to show progress
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    );

    // Show info message that parameters will be requested
    vscode.window.showInformationMessage(
      `${fileType} file opened. Camera parameters will be requested after analyzing the depth image.`
    );
  } catch (error) {
    vscode.window.showErrorMessage(
      `Failed to open ${fileType} for conversion: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

async function handleOpenMultipleFiles(provider: PointCloudEditorProvider): Promise<void> {
  try {
    // Show file picker for multiple files
    const files = await vscode.window.showOpenDialog({
      canSelectMany: true,
      canSelectFiles: true,
      canSelectFolders: false,
      filters: {
        'Point Cloud Files': ['ply', 'xyz', 'obj'],
        'Volume Files': ['nrrd', 'nhdr'],
        'TIFF Files': ['tif', 'tiff'],
        'All Files': ['*'],
      },
      title: 'Select Point Cloud Files to Open Together',
    });

    if (!files || files.length === 0) {
      return;
    }

    // Check if we have a mix of file types
    const spatialFiles = files.filter(f => f.fsPath.toLowerCase().endsWith('.ply'));
    const xyzFiles = files.filter(f => f.fsPath.toLowerCase().endsWith('.xyz'));
    const objFiles = files.filter(f => f.fsPath.toLowerCase().endsWith('.obj'));
    const tifFiles = files.filter(
      f => f.fsPath.toLowerCase().endsWith('.tif') || f.fsPath.toLowerCase().endsWith('.tiff')
    );
    const volumeFiles = files.filter(
      f => f.fsPath.toLowerCase().endsWith('.nrrd') || f.fsPath.toLowerCase().endsWith('.nhdr')
    );

    await provider.openFilesTogether(files);

    // If there are additional files, add them
    if (files.length > 1) {
      vscode.window.showInformationMessage(
        `Opened ${files.length} files together: ${spatialFiles.length} PLY, ${xyzFiles.length} XYZ, ` +
          `${objFiles.length} OBJ, ${tifFiles.length} TIF, ${volumeFiles.length} volume files`
      );
    }
  } catch (error) {
    vscode.window.showErrorMessage(
      `Failed to open multiple files: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export function deactivate() {
  console.log('3D Visualizer extension is now deactivated!');
}

async function handleOpenDicomFolder(
  context: vscode.ExtensionContext,
  provider: PointCloudEditorProvider
): Promise<void> {
  try {
    const picked = await vscode.window.showOpenDialog({
      canSelectMany: false,
      canSelectFiles: false,
      canSelectFolders: true,
      title: 'Select a folder containing DICOM images',
      openLabel: 'Scan DICOM Folder',
    });
    if (!picked?.length) {
      return;
    }

    const series = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Scanning DICOM folder',
        cancellable: true,
      },
      async (progress, token) =>
        scanDicomFolder(
          picked[0],
          (done, total, name) =>
            progress.report({
              message: `${done} / ${total} · ${name}`,
              increment: total ? 100 / total : undefined,
            }),
          () => token.isCancellationRequested
        )
    );
    if (!series.length) {
      vscode.window.showWarningMessage(
        'No native, uncompressed grayscale DICOM image series was found in that folder.'
      );
      return;
    }

    let selected = series;
    if (series.length > 1) {
      const choices = series.map(item => ({ label: item.label, series: item, picked: true }));
      const choice = await vscode.window.showQuickPick(choices, {
        title: 'Select DICOM series to open as volumes',
        canPickMany: true,
        placeHolder: 'Each selected series becomes one volume',
      });
      if (!choice?.length) {
        return;
      }
      selected = choice.map(item => item.series);
    }

    const handoffFolder = vscode.Uri.joinPath(
      context.globalStorageUri,
      `dicom-volume-${Date.now()}`
    );
    await vscode.workspace.fs.createDirectory(handoffFolder);
    const targets: vscode.Uri[] = [];
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Building DICOM volume',
        cancellable: false,
      },
      async progress => {
        for (let index = 0; index < selected.length; index++) {
          progress.report({
            message: `${index + 1} / ${selected.length} · ${selected[index].label}`,
          });
          const bytes = buildDicomSeriesNrrd(selected[index]);
          const target = vscode.Uri.joinPath(handoffFolder, `series-${index + 1}.nrrd`);
          await vscode.workspace.fs.writeFile(target, bytes);
          targets.push(target);
        }
      }
    );
    await provider.openFilesTogether(targets);
  } catch (error) {
    vscode.window.showErrorMessage(
      `Could not open the DICOM folder: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Opens a COLMAP reconstruction from a folder.
 *
 * The model files live in a `sparse` directory that may or may not have a
 * numbered sub-model inside it, and users think in terms of the dataset folder
 * rather than of `cameras.bin`. This accepts any of those: the dataset root,
 * `sparse`, or `sparse/0`.
 */
async function handleOpenColmapReconstruction(): Promise<void> {
  try {
    const picked = await vscode.window.showOpenDialog({
      canSelectMany: false,
      canSelectFiles: false,
      canSelectFolders: true,
      title: 'Select a COLMAP reconstruction folder',
      openLabel: 'Open Reconstruction',
    });
    if (!picked || picked.length === 0) {
      return;
    }

    const modelFile = await findColmapModelFile(picked[0]);
    if (!modelFile) {
      vscode.window.showErrorMessage(
        'No COLMAP model found. Expected cameras/images/points3D files in the folder, in "sparse", or in "sparse/0".'
      );
      return;
    }

    // The provider recognises a model file and reads the rest of the set from
    // the same directory.
    await vscode.commands.executeCommand('vscode.openWith', modelFile, 'plyViewer.plyEditor');
  } catch (error) {
    vscode.window.showErrorMessage(
      `Failed to open COLMAP reconstruction: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/** Searches a folder and the usual COLMAP sub-folders for a model file. */
async function findColmapModelFile(folder: vscode.Uri): Promise<vscode.Uri | null> {
  const candidates = [folder, vscode.Uri.joinPath(folder, 'sparse')];
  for (const directory of candidates) {
    let entries: [string, vscode.FileType][];
    try {
      entries = await vscode.workspace.fs.readDirectory(directory);
    } catch {
      continue;
    }

    const model = entries.find(
      ([name, kind]) => kind === vscode.FileType.File && isColmapModelFile(name)
    );
    if (model) {
      return vscode.Uri.joinPath(directory, model[0]);
    }

    // Numbered sub-models: sparse/0, sparse/1, ... Take the lowest.
    const subModels = entries
      .filter(([name, kind]) => kind === vscode.FileType.Directory && /^\d+$/.test(name))
      .sort((a, b) => Number(a[0]) - Number(b[0]));
    for (const [name] of subModels) {
      const subDirectory = vscode.Uri.joinPath(directory, name);
      const subEntries = await vscode.workspace.fs.readDirectory(subDirectory);
      const subModel = subEntries.find(
        ([entryName, kind]) => kind === vscode.FileType.File && isColmapModelFile(entryName)
      );
      if (subModel) {
        return vscode.Uri.joinPath(subDirectory, subModel[0]);
      }
    }
  }
  return null;
}
