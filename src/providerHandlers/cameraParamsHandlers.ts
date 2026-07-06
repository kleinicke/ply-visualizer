import * as vscode from 'vscode';

export async function handleCameraParametersRequest(
  context: vscode.ExtensionContext,
  webviewPanel: vscode.WebviewPanel,
  message: any
): Promise<void> {
  try {
    // Load saved default settings (filter out cx/cy as they should be auto-calculated per image)
    const savedSettings = context.globalState.get('defaultDepthSettings') as any;
    const defaults = savedSettings
      ? {
          fx: savedSettings.fx || 1000,
          fy: savedSettings.fy,
          cameraModel: savedSettings.cameraModel || 'pinhole-ideal',
          depthType: savedSettings.depthType || 'euclidean',
          convention: savedSettings.convention || 'opengl',
          baseline: savedSettings.baseline || 50,
          pngScaleFactor: savedSettings.pngScaleFactor || 1000,
          // Explicitly exclude cx and cy
        }
      : {
          fx: 1000,
          fy: undefined,
          cameraModel: 'pinhole-ideal',
          depthType: 'euclidean',
          convention: 'opengl',
          baseline: 50,
          pngScaleFactor: 1000,
        };

    console.log('🎯 Using default settings for camera parameters dialog:', defaults);

    // Always use saved defaults without showing a customization dialog.
    webviewPanel.webview.postMessage({
      type: 'cameraParams',
      cameraModel: defaults.cameraModel,
      fx: defaults.fx,
      fy: defaults.fy,
      depthType: defaults.depthType,
      baseline: defaults.baseline,
      convention: defaults.convention,
      requestId: message.requestId,
    });
  } catch (error) {
    webviewPanel.webview.postMessage({
      type: 'cameraParamsError',
      error: error instanceof Error ? error.message : String(error),
      requestId: message.requestId,
    });
  }
}

export async function handleCameraParametersWithScaleRequest(
  context: vscode.ExtensionContext,
  webviewPanel: vscode.WebviewPanel,
  message: any
): Promise<void> {
  try {
    // Load saved default settings (filter out cx/cy as they should be auto-calculated per image)
    const savedSettings = context.globalState.get('defaultDepthSettings') as any;
    const defaults = savedSettings
      ? {
          fx: savedSettings.fx || 1000,
          fy: savedSettings.fy,
          cameraModel: savedSettings.cameraModel || 'pinhole-ideal',
          depthType: savedSettings.depthType || 'euclidean',
          convention: savedSettings.convention || 'opengl',
          baseline: savedSettings.baseline || 50,
          pngScaleFactor: savedSettings.pngScaleFactor || 1000,
          // Explicitly exclude cx and cy
        }
      : {
          fx: 1000,
          fy: undefined,
          cameraModel: 'pinhole-ideal',
          depthType: 'euclidean',
          convention: 'opengl',
          baseline: 50,
          pngScaleFactor: 1000, // Default for PNG: millimeters to meters
        };

    console.log('🎯 Using default settings for PNG camera parameters dialog:', defaults);

    // Show option to use defaults directly or customize
    const useDefaults = await vscode.window.showQuickPick(
      [
        {
          label: '⚡ Use Default Settings',
          description: `${defaults.cameraModel}, fx=${defaults.fx}px${defaults.fy ? `, fy=${defaults.fy}px` : ''}, scale=${defaults.pngScaleFactor} (${defaults.pngScaleFactor === 1000 ? 'mm→m' : defaults.pngScaleFactor === 256 ? 'disp÷256' : 'custom'})`,
          value: 'defaults',
        },
        {
          label: '⚙️ Customize Settings',
          description: 'Choose settings manually',
          value: 'customize',
        },
      ],
      {
        placeHolder: 'Convert PNG depth image to point cloud',
        ignoreFocusOut: true,
      }
    );

    if (!useDefaults) {
      webviewPanel.webview.postMessage({
        type: 'cameraParamsCancelled',
        requestId: message.requestId,
      });
      return;
    }

    if (useDefaults.value === 'defaults') {
      // Use saved defaults without showing additional dialogs
      webviewPanel.webview.postMessage({
        type: 'cameraParams',
        cameraModel: defaults.cameraModel,
        fx: defaults.fx,
        fy: defaults.fy,
        depthType: defaults.depthType,
        baseline: defaults.baseline,
        convention: defaults.convention,
        pngScaleFactor: defaults.pngScaleFactor,
        requestId: message.requestId,
      });
      return;
    }

    // Show camera model selection dialog
    const cameraModel = await vscode.window.showQuickPick(
      [
        {
          label: 'Pinhole Camera',
          description:
            defaults.cameraModel === 'pinhole-ideal'
              ? 'Standard perspective projection model (Default)'
              : 'Standard perspective projection model',
          value: 'pinhole-ideal',
        },
        {
          label: 'Fisheye Camera',
          description:
            defaults.cameraModel === 'fisheye'
              ? 'Wide-angle fisheye projection model (Default)'
              : 'Wide-angle fisheye projection model',
          value: 'fisheye',
        },
      ],
      {
        placeHolder: `Select camera model used to capture the depth image (Default: ${defaults.cameraModel})`,
        ignoreFocusOut: true,
      }
    );

    if (!cameraModel) {
      webviewPanel.webview.postMessage({
        type: 'cameraParamsCancelled',
        requestId: message.requestId,
      });
      return;
    }

    // Show scale factor input dialog
    const pngScaleFactorInput = await vscode.window.showInputBox({
      prompt: `Scale factor: depth/disparity is divided to get applied value in meters/disparities (Default: ${defaults.pngScaleFactor})`,
      placeHolder: `${defaults.pngScaleFactor} (1000 for mm, 256 for disparity, 1 for meters)`,
      value: defaults.pngScaleFactor.toString(),
      validateInput: (value: string) => {
        const num = parseFloat(value);
        if (isNaN(num) || num <= 0) {
          return 'Please enter a valid positive number for scale factor';
        }
        return null;
      },
      ignoreFocusOut: true,
    });

    if (!pngScaleFactorInput) {
      webviewPanel.webview.postMessage({
        type: 'cameraParamsCancelled',
        requestId: message.requestId,
      });
      return;
    }

    const pngScaleFactor = parseFloat(pngScaleFactorInput);

    // Show focal length input dialog
    const fxInput = await vscode.window.showInputBox({
      prompt: `Enter fx (focal length x) in pixels (Default: ${defaults.fx})`,
      placeHolder: defaults.fx.toString(),
      value: defaults.fx.toString(),
      validateInput: (value: string) => {
        const num = parseFloat(value);
        if (isNaN(num) || num <= 0) {
          return 'Please enter a valid positive number for fx';
        }
        return null;
      },
      ignoreFocusOut: true,
    });

    if (!fxInput) {
      webviewPanel.webview.postMessage({
        type: 'cameraParamsCancelled',
        requestId: message.requestId,
      });
      return;
    }

    const fx = parseFloat(fxInput);

    // Show fy input dialog (optional)
    const fyInput = await vscode.window.showInputBox({
      prompt: `Enter fy (focal length y) in pixels (Default: same as fx = ${fx})`,
      placeHolder: 'Leave empty to use same as fx',
      value: defaults.fy?.toString() || '',
      validateInput: (value: string) => {
        if (value.trim() === '') {
          return null;
        } // Empty is OK
        const num = parseFloat(value);
        if (isNaN(num) || num <= 0) {
          return 'Please enter a valid positive number for fy, or leave empty';
        }
        return null;
      },
      ignoreFocusOut: true,
    });

    if (fyInput === undefined) {
      // User cancelled
      webviewPanel.webview.postMessage({
        type: 'cameraParamsCancelled',
        requestId: message.requestId,
      });
      return;
    }

    const fy = fyInput.trim() === '' ? undefined : parseFloat(fyInput);

    // Show coordinate convention selection dialog
    const convention = await vscode.window.showQuickPick(
      [
        {
          label: 'OpenGL Convention (Y-up, Z-backward)',
          description:
            defaults.convention === 'opengl'
              ? 'Standard 3D graphics convention (Default)'
              : 'Standard 3D graphics convention',
          value: 'opengl',
        },
        {
          label: 'OpenCV Convention (Y-down, Z-forward)',
          description:
            defaults.convention === 'opencv'
              ? 'Computer vision convention (Default)'
              : 'Computer vision convention',
          value: 'opencv',
        },
      ],
      {
        placeHolder: `Select coordinate convention for the resulting point cloud (Default: ${defaults.convention})`,
        ignoreFocusOut: true,
      }
    );

    if (!convention) {
      webviewPanel.webview.postMessage({
        type: 'cameraParamsCancelled',
        requestId: message.requestId,
      });
      return;
    }

    // Send camera parameters to webview
    webviewPanel.webview.postMessage({
      type: 'cameraParams',
      cameraModel: cameraModel.value,
      fx: fx,
      fy: fy,
      depthType: 'euclidean', // Default for PNG
      pngScaleFactor: pngScaleFactor,
      convention: convention.value,
      requestId: message.requestId,
    });
  } catch (error) {
    webviewPanel.webview.postMessage({
      type: 'cameraParamsError',
      error: error instanceof Error ? error.message : String(error),
      requestId: message.requestId,
    });
  }
}
