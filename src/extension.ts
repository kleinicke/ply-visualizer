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
            await handleTifToPointCloudConversion(uri);
        })
    );

    // Register command for opening multiple files
    context.subscriptions.push(
        vscode.commands.registerCommand('plyViewer.openMultipleFiles', async () => {
            await handleOpenMultipleFiles();
        })
    );

    console.log('PLY Visualizer extension is now active!');
}

async function handleTifToPointCloudConversion(uri: vscode.Uri): Promise<void> {
    try {
        // Show progress and open the TIF file for conversion
        // Camera parameters will be requested by the webview after TIF analysis
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Opening TIF for Point Cloud Conversion',
                cancellable: false
            },
            async (progress) => {
                progress.report({ message: 'Loading TIF file...' });
                
                // Open the TIF file with our custom editor
                // Camera parameters will be requested by the webview after analysis
                await vscode.commands.executeCommand('vscode.openWith', uri, 'plyViewer.plyEditor');
                
                progress.report({ message: 'Analyzing TIF file...' });
                
                // Small delay to show progress
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        );

        // Show info message that parameters will be requested
        vscode.window.showInformationMessage(
            'TIF file opened. Camera parameters will be requested after analyzing the depth image.'
        );
    } catch (error) {
        vscode.window.showErrorMessage(
            `Failed to open TIF for conversion: ${error instanceof Error ? error.message : String(error)}`
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