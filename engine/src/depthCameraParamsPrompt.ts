import { CameraParams } from './interfaces';

export interface DepthCameraParamsHost {
  pendingDepthFiles: Map<
    string,
    {
      data: ArrayBuffer;
      fileName: string;
      shortPath?: string;
      isAddFile: boolean;
      requestId: string;
      sceneMetadata?: any;
    }
  >;
  showError(message: string): void;
  processDepthWithParams(requestId: string, cameraParams: CameraParams): Promise<void>;
}

export async function promptForCameraParameters(fileName: string): Promise<CameraParams | null> {
  return new Promise(resolve => {
    // Create dialog overlay
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.right = '0';
    overlay.style.bottom = '0';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '10000';

    // Create dialog box
    const dialog = document.createElement('div');
    dialog.style.backgroundColor = 'var(--vscode-editor-background)';
    dialog.style.color = 'var(--vscode-editor-foreground)';
    dialog.style.padding = '20px';
    dialog.style.borderRadius = '8px';
    dialog.style.border = '1px solid var(--vscode-input-border)';
    dialog.style.minWidth = '400px';
    dialog.style.maxWidth = '600px';
    dialog.style.maxHeight = '80vh';
    dialog.style.overflow = 'auto';

    dialog.innerHTML = `
        <h3 style="margin-top: 0;">Camera Parameters for ${fileName}</h3>
        <p style="color: var(--vscode-descriptionForeground); margin-bottom: 20px;">
          Enter camera intrinsic parameters to convert depth image to point cloud:
        </p>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
          <div>
            <label style="display: block; margin-bottom: 5px;">Focal Length X (fx):</label>
            <input type="number" id="depth-fx" step="0.1" value="525" style="width: 100%; padding: 8px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 4px;">
          </div>
          <div>
            <label style="display: block; margin-bottom: 5px;">Focal Length Y (fy):</label>
            <input type="number" id="depth-fy" step="0.1" placeholder="Same as fx" style="width: 100%; padding: 8px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 4px;">
          </div>
          <div>
            <label style="display: block; margin-bottom: 5px;">Principal Point X (cx):</label>
            <input type="number" id="depth-cx" step="0.1" placeholder="Auto (width/2)" style="width: 100%; padding: 8px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 4px;">
          </div>
          <div>
            <label style="display: block; margin-bottom: 5px;">Principal Point Y (cy):</label>
            <input type="number" id="depth-cy" step="0.1" placeholder="Auto (height/2)" style="width: 100%; padding: 8px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 4px;">
          </div>
        </div>

        <div style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 5px;">Depth Type:</label>
          <select id="depth-type" style="width: 100%; padding: 8px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 4px;">
            <option value="euclidean">Euclidean Distance (depth)</option>
            <option value="orthogonal">Orthogonal Distance (z)</option>
            <option value="disparity">Disparity</option>
            <option value="inverse_depth">Inverse Depth</option>
          </select>
        </div>

        <div id="disparity-params" style="display: none; margin-bottom: 20px; padding: 15px; background: var(--vscode-sideBar-background); border-radius: 4px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
            <div>
              <label style="display: block; margin-bottom: 5px;">Baseline (mm):</label>
              <input type="number" id="depth-baseline" step="0.1" value="120" style="width: 100%; padding: 8px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 4px;">
            </div>
            <div>
              <label style="display: block; margin-bottom: 5px;">Disparity Offset:</label>
              <input type="number" id="depth-disparity-offset" step="0.1" value="0" style="width: 100%; padding: 8px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 4px;">
            </div>
          </div>
        </div>

        <div style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 5px;">Camera Model:</label>
          <select id="camera-model" style="width: 100%; padding: 8px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 4px;">
            <option value="pinhole-ideal">Pinhole (Ideal)</option>
            <option value="pinhole-opencv">Pinhole (OpenCV)</option>
            <option value="fisheye-equidistant">Fisheye (Equidistant)</option>
            <option value="fisheye-opencv">Fisheye (OpenCV)</option>
            <option value="fisheye-kannala-brandt">Fisheye (Kannala-Brandt)</option>
          </select>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 10px;">
          <button id="depth-cancel" style="padding: 10px 20px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: 1px solid var(--vscode-input-border); border-radius: 4px; cursor: pointer;">Cancel</button>
          <button id="depth-ok" style="padding: 10px 20px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 4px; cursor: pointer;">Convert to Point Cloud</button>
        </div>
      `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // Handle depth type selection
    const depthTypeSelect = dialog.querySelector('#depth-type') as HTMLSelectElement;
    const disparityParams = dialog.querySelector('#disparity-params') as HTMLElement;

    depthTypeSelect.addEventListener('change', () => {
      disparityParams.style.display = depthTypeSelect.value === 'disparity' ? 'block' : 'none';
    });

    // Handle buttons
    const cancelButton = dialog.querySelector('#depth-cancel') as HTMLButtonElement;
    const okButton = dialog.querySelector('#depth-ok') as HTMLButtonElement;

    const cleanup = () => document.body.removeChild(overlay);

    cancelButton.addEventListener('click', () => {
      cleanup();
      resolve(null);
    });

    okButton.addEventListener('click', () => {
      const fx = parseFloat((dialog.querySelector('#depth-fx') as HTMLInputElement).value);
      const fyInput = (dialog.querySelector('#depth-fy') as HTMLInputElement).value;
      const fy = fyInput ? parseFloat(fyInput) : fx;
      const cxInput = (dialog.querySelector('#depth-cx') as HTMLInputElement).value;
      const cyInput = (dialog.querySelector('#depth-cy') as HTMLInputElement).value;
      const cx = cxInput ? parseFloat(cxInput) : undefined;
      const cy = cyInput ? parseFloat(cyInput) : undefined;
      const depthType = (dialog.querySelector('#depth-type') as HTMLSelectElement).value as
        | 'euclidean'
        | 'orthogonal'
        | 'disparity'
        | 'inverse_depth';
      const cameraModel = (dialog.querySelector('#camera-model') as HTMLSelectElement).value as
        | 'pinhole-ideal'
        | 'pinhole-opencv'
        | 'fisheye-equidistant'
        | 'fisheye-opencv'
        | 'fisheye-kannala-brandt';
      const baseline = parseFloat(
        (dialog.querySelector('#depth-baseline') as HTMLInputElement).value
      );
      const disparityOffset = parseFloat(
        (dialog.querySelector('#depth-disparity-offset') as HTMLInputElement).value
      );

      if (isNaN(fx) || fx <= 0) {
        alert('Invalid focal length X (fx)');
        return;
      }

      if (depthType === 'disparity' && (isNaN(baseline) || baseline <= 0)) {
        alert('Invalid baseline for disparity mode');
        return;
      }

      const cameraParams: CameraParams = {
        fx,
        fy,
        cx,
        cy,
        depthType,
        cameraModel,
        baseline: depthType === 'disparity' ? baseline : undefined,
        disparityOffset: depthType === 'disparity' ? disparityOffset : undefined,
      };

      cleanup();
      resolve(cameraParams);
    });

    // Focus the fx input
    setTimeout(() => (dialog.querySelector('#depth-fx') as HTMLInputElement).focus(), 100);
  });
}

export function saveCameraParams(params: CameraParams): void {
  try {
    localStorage.setItem('SpatialVisualizerCameraParams', JSON.stringify(params));
    console.log('Camera parameters saved for future use');
  } catch (error) {
    console.warn('Failed to save camera parameters:', error);
  }
}

export async function handleCameraParams(host: DepthCameraParamsHost, message: any): Promise<void> {
  try {
    const requestId = message.requestId;
    if (!requestId || !host.pendingDepthFiles.has(requestId)) {
      throw new Error('No Deptn data available for processing');
    }

    console.log('Processing Depth with camera params:', message);

    const cameraParams: CameraParams = {
      cameraModel: message.cameraModel,
      fx: message.fx,
      fy: message.fy,
      cx: message.cx, // Will be calculated from image dimensions if not provided
      cy: message.cy, // Will be calculated from image dimensions if not provided
      depthType: message.depthType || 'euclidean', // Default to euclidean for backward compatibility
      baseline: message.baseline,
      convention: message.convention || 'opengl', // Default to OpenGL convention
    };

    // Save camera parameters for future use
    saveCameraParams(cameraParams);
    console.log('✅ Camera parameters saved for future Depth files');

    // Process the depth file (could be TIF or PFM)
    await host.processDepthWithParams(requestId, cameraParams);
  } catch (error) {
    console.error('Error processing Depth with camera params:', error);
    host.showError(
      `Depth conversion failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export function handleCameraParamsCancelled(host: DepthCameraParamsHost, requestId?: string): void {
  console.log('Camera parameter selection cancelled');
  if (requestId && host.pendingDepthFiles.has(requestId)) {
    // Remove only the specific cancelled Depth file
    const depthData = host.pendingDepthFiles.get(requestId);
    host.pendingDepthFiles.delete(requestId);
    host.showError(`Depth conversion cancelled for ${depthData?.fileName || 'file'}`);
  } else {
    // Fallback: clear all pending Depth files
    host.pendingDepthFiles.clear();
    host.showError('Depth conversion cancelled by user');
  }
}

export function handleCameraParamsError(
  host: DepthCameraParamsHost,
  error: string,
  requestId?: string
): void {
  console.error('Camera parameter error:', error);
  if (requestId && host.pendingDepthFiles.has(requestId)) {
    // Remove only the specific Deptj file with error
    const depthData = host.pendingDepthFiles.get(requestId);
    host.pendingDepthFiles.delete(requestId);
    host.showError(`Camera parameter error for ${depthData?.fileName || 'file'}: ${error}`);
  } else {
    // Fallback: clear all pending Depth files
    host.pendingDepthFiles.clear();
    host.showError(`Camera parameter error: ${error}`);
  }
}
