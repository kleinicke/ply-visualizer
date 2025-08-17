import * as vscode from 'vscode';
import { PlyEditorProvider } from './plyEditorProvider';

export function activate(context: vscode.ExtensionContext) {
    // Register the PLY editor provider
    context.subscriptions.push(
        vscode.window.registerCustomEditorProvider(
            'plyViewer.plyEditor',
            new PlyEditorProvider(context),
            {
                webviewOptions: {
                    retainContextWhenHidden: true,
                },
                supportsMultipleEditorsPerDocument: false,
            }
        )
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
        vscode.commands.registerCommand('plyViewer.convertDepthToPointCloud', async (uri: vscode.Uri) => {
            await handleDepthToPointCloudConversion(uri, 'PFM');
        })
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
            setImmediate(() => { void handleOpenMultipleFiles(); });
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
                vscode.window.showErrorMessage(`Failed to load JSON as pose: ${err instanceof Error ? err.message : String(err)}`);
            }
        })
    );

    console.log('PLY Visualizer extension is now active!');
}

async function handleDepthToPointCloudConversion(uri: vscode.Uri, fileType: 'TIF' | 'PFM' | 'NPY' | 'PNG' | 'EXR'): Promise<void> {
    try {
        // Show progress and open the depth file for conversion
        // Camera parameters will be requested by the webview after analysis
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Opening ${fileType} for Point Cloud Conversion`,
                cancellable: false
            },
            async (progress) => {
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
                'All Files': ['*']
            },
            title: 'Select Point Cloud Files to Open Together'
        });

        if (!files || files.length === 0) {
            return;
        }

        // Check if we have a mix of file types
        const plyFiles = files.filter(f => f.fsPath.toLowerCase().endsWith('.ply'));
        const xyzFiles = files.filter(f => f.fsPath.toLowerCase().endsWith('.xyz'));
        const objFiles = files.filter(f => f.fsPath.toLowerCase().endsWith('.obj'));
        const tifFiles = files.filter(f => f.fsPath.toLowerCase().endsWith('.tif') || f.fsPath.toLowerCase().endsWith('.tiff'));

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