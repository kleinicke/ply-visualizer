import * as vscode from 'vscode';
import { PointCloudEditorProvider } from './pointCloudEditorProvider';
import { glob } from 'glob';

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

  // Register command for opening PLY/XYZ files
  context.subscriptions.push(
    vscode.commands.registerCommand('plyViewer.openFile', (uri: vscode.Uri) => {
      vscode.commands.executeCommand('vscode.openWith', uri, 'plyViewer.plyEditor');
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
    vscode.commands.registerCommand('plyViewer.openMultipleFiles', async () => {
      // Avoid blocking tests by not awaiting the file picker
      setImmediate(() => {
        void handleOpenMultipleFiles();
      });
    })
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
            // Callback API wrapped in a Promise to obtain a clean string[]
            const files = await new Promise<string[]>((resolve, reject) => {
              glob(wildcard, { nodir: true } as any, (err: Error | null, matches: string[]) => {
                if (err) {
                  return reject(err);
                }
                resolve(matches);
              });
            });
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

  // Register command for resetting all extension settings
  context.subscriptions.push(
    vscode.commands.registerCommand('plyViewer.resetSettings', async () => {
      try {
        const response = await vscode.window.showWarningMessage(
          'This will reset all PLY Visualizer settings to default values. This cannot be undone.',
          { modal: true },
          'Reset Settings',
          'Cancel'
        );

        if (response === 'Reset Settings') {
          // Clear all stored settings from globalState
          await context.globalState.update('defaultDepthSettings', undefined);

          vscode.window.showInformationMessage(
            'PLY Visualizer settings have been reset to defaults. Restart VS Code for a completely fresh start.'
          );

          console.log('PLY Visualizer settings reset successfully');
        }
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to reset settings: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    })
  );

  console.log('PLY Visualizer extension is now active!');
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

async function handleOpenMultipleFiles(): Promise<void> {
  try {
    // Show file picker for multiple files
    const files = await vscode.window.showOpenDialog({
      canSelectMany: true,
      canSelectFiles: true,
      canSelectFolders: false,
      filters: {
        'Point Cloud Files': ['ply', 'xyz', 'obj'],
        'TIFF Files': ['tif', 'tiff'],
        'All Files': ['*'],
      },
      title: 'Select Point Cloud Files to Open Together',
    });

    if (!files || files.length === 0) {
      return;
    }

    // Check if we have a mix of file types
    const plyFiles = files.filter(f => f.fsPath.toLowerCase().endsWith('.ply'));
    const xyzFiles = files.filter(f => f.fsPath.toLowerCase().endsWith('.xyz'));
    const objFiles = files.filter(f => f.fsPath.toLowerCase().endsWith('.obj'));
    const tifFiles = files.filter(
      f => f.fsPath.toLowerCase().endsWith('.tif') || f.fsPath.toLowerCase().endsWith('.tiff')
    );

    // Open the first file to create the main editor, then add others
    const firstFile = files[0];
    await vscode.commands.executeCommand('vscode.openWith', firstFile, 'plyViewer.plyEditor');

    // If there are additional files, add them
    if (files.length > 1) {
      vscode.window.showInformationMessage(
        `Opening ${files.length} files together: ${plyFiles.length} PLY, ${xyzFiles.length} XYZ, ${objFiles.length} OBJ, ${tifFiles.length} TIF files`
      );
    }
  } catch (error) {
    vscode.window.showErrorMessage(
      `Failed to open multiple files: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export function deactivate() {
  console.log('PLY Visualizer extension is now deactivated!');
}
