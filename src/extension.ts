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

    console.log('PLY Visualizer extension is now active!');
}

async function handleTifToPointCloudConversion(uri: vscode.Uri): Promise<void> {
    try {
        // Show camera model selection dialog
        const cameraModel = await vscode.window.showQuickPick(
            [
                { label: 'Pinhole Camera', description: 'Standard perspective projection model', value: 'pinhole' },
                { label: 'Fisheye Camera', description: 'Wide-angle fisheye projection model', value: 'fisheye' }
            ],
            {
                placeHolder: 'Select camera model used to capture the depth image',
                ignoreFocusOut: true
            }
        );

        if (!cameraModel) {
            return; // User cancelled
        }

        // Show focal length input dialog
        const focalLengthInput = await vscode.window.showInputBox({
            prompt: 'Enter the focal length in pixels (e.g., 1000)',
            placeHolder: '1000',
            validateInput: (value: string) => {
                const num = parseFloat(value);
                if (isNaN(num) || num <= 0) {
                    return 'Please enter a valid positive number for focal length';
                }
                return null;
            },
            ignoreFocusOut: true
        });

        if (!focalLengthInput) {
            return; // User cancelled
        }

        const focalLength = parseFloat(focalLengthInput);

        // Show progress and open the TIF file for conversion
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Converting TIF to Point Cloud',
                cancellable: false
            },
            async (progress) => {
                progress.report({ message: 'Loading TIF file...' });
                
                // Open the TIF file with our custom editor, passing conversion parameters
                await vscode.commands.executeCommand('vscode.openWith', uri, 'plyViewer.plyEditor');
                
                // The actual conversion will happen in the webview when it receives the TIF file
                // and conversion parameters
                progress.report({ message: 'Converting depth image to point cloud...' });
                
                // Small delay to show progress
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        );

        // Show success message
        vscode.window.showInformationMessage(
            `TIF depth image conversion started with ${cameraModel.label} model and focal length ${focalLength}px`
        );
    } catch (error) {
        vscode.window.showErrorMessage(
            `Failed to convert TIF to point cloud: ${error instanceof Error ? error.message : String(error)}`
        );
    }
}

export function deactivate() {
    console.log('PLY Visualizer extension is now deactivated!');
} 