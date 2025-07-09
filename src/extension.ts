import * as vscode from 'vscode';
import * as path from 'path';
import { PlyEditorProvider } from './plyEditorProvider';
import { TifConverter } from './tifConverter';

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

    // Register command for opening PLY files
    context.subscriptions.push(
        vscode.commands.registerCommand('plyViewer.openFile', (uri: vscode.Uri) => {
            vscode.commands.executeCommand('vscode.openWith', uri, 'plyViewer.plyEditor');
        })
    );

    // Register command for opening XYZ files
    context.subscriptions.push(
        vscode.commands.registerCommand('plyViewer.openXyzFile', (uri: vscode.Uri) => {
            vscode.commands.executeCommand('vscode.openWith', uri, 'plyViewer.plyEditor');
        })
    );

    // Register command for converting TIF files to point clouds
    context.subscriptions.push(
        vscode.commands.registerCommand('plyViewer.convertTifToPointCloud', async () => {
            await handleTifConversion(context);
        })
    );

    console.log('PLY Visualizer extension is now active!');
}

async function handleTifConversion(context: vscode.ExtensionContext): Promise<void> {
    try {
        // Step 1: Select TIF file
        const tifUris = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            openLabel: 'Select TIF File',
            filters: {
                'TIF Files': ['tif', 'tiff']
            }
        });

        if (!tifUris || tifUris.length === 0) {
            return; // User cancelled
        }

        const tifUri = tifUris[0];

        // Step 2: Ask for camera type
        const cameraType = await vscode.window.showQuickPick(
            [
                { label: 'equidistant', description: 'Fisheye camera (wide-angle lens)' },
                { label: 'pinhole', description: 'Standard perspective camera' }
            ],
            {
                placeHolder: 'Select camera type',
                canPickMany: false
            }
        );

        if (!cameraType) {
            return; // User cancelled
        }

        const cameraTypeValue = (cameraType.label as unknown) as 'equidistant' | 'pinhole';

        // Step 3: Ask for focal length
        const focalLengthInput = await vscode.window.showInputBox({
            prompt: 'Enter focal length (in pixels)',
            value: '1000',
            validateInput: (value) => {
                const num = parseFloat(value);
                if (isNaN(num) || num <= 0) {
                    return 'Please enter a valid positive number';
                }
                return null;
            }
        });

        if (!focalLengthInput) {
            return; // User cancelled
        }

        const focalLength = parseFloat(focalLengthInput);

        // Step 3.5: Ask for noise threshold (optional)
        const noiseThresholdInput = await vscode.window.showInputBox({
            prompt: 'Enter noise threshold (0-100%, leave empty for auto)',
            value: '',
            validateInput: (value) => {
                if (value === '') return null; // Allow empty for auto
                const num = parseFloat(value);
                if (isNaN(num) || num < 0 || num > 100) {
                    return 'Please enter a valid percentage between 0 and 100';
                }
                return null;
            }
        });

        const noiseThreshold = noiseThresholdInput ? parseFloat(noiseThresholdInput) / 100 : null;

        // Step 4: Ask if user wants to add to existing visualization or create new
        const addToExisting = await vscode.window.showQuickPick(
            ['Create new visualization', 'Add to existing visualization'],
            {
                placeHolder: 'Choose how to display the converted point cloud',
                canPickMany: false
            }
        );

        if (!addToExisting) {
            return; // User cancelled
        }

        const shouldAddToExisting = addToExisting === 'Add to existing visualization';

        // Step 5: Convert TIF to point cloud using the webview-based converter
        const converter = new TifConverter(context);
        
        // Show info about large file handling
        const fileName = path.basename(tifUri.fsPath);
        vscode.window.showInformationMessage(
            `Starting TIF conversion for ${fileName}. Large images will be automatically sampled for performance.`
        );
        
        await converter.convertTifToPointCloud(tifUri, cameraTypeValue, focalLength, shouldAddToExisting, noiseThreshold);

    } catch (error) {
        console.error('TIF conversion error:', error);
        vscode.window.showErrorMessage(
            `Failed to convert TIF file: ${error instanceof Error ? error.message : String(error)}`
        );
    }
}

export function deactivate() {
    console.log('PLY Visualizer extension is now deactivated!');
} 