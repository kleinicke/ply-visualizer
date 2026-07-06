import { mount, unmount } from 'svelte';
import { CameraParams } from './interfaces';
import DepthCameraParamsDialog from './components/DepthCameraParamsDialog.svelte';

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
    const target = document.createElement('div');
    document.body.appendChild(target);

    const component = mount(DepthCameraParamsDialog, {
      target,
      props: {
        fileName,
        onSubmit: (params: CameraParams) => {
          unmount(component);
          target.remove();
          resolve(params);
        },
        onCancel: () => {
          unmount(component);
          target.remove();
          resolve(null);
        },
      },
    });
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
