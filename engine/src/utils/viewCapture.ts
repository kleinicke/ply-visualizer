import * as THREE from 'three';

declare const acquireVsCodeApi: () => any;
const isVSCode = typeof acquireVsCodeApi !== 'undefined';

export interface ViewCaptureHost {
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  controls: { target: THREE.Vector3 };
  vscode: { postMessage(message: any): void };
  performRender(): void;
  showStatus(message: string): void;
}

/**
 * Capture the current view as a PNG.
 *
 * The renderer uses preserveDrawingBuffer:false, so the drawing buffer is only
 * valid immediately after a render — render synchronously, then read the
 * canvas in the same task. In VS Code the bytes go to the extension host
 * (webviews can't trigger downloads); in the browser a download is triggered.
 */
export function captureScreenshot(host: ViewCaptureHost): void {
  host.performRender();
  const dataUrl = host.renderer.domElement.toDataURL('image/png');

  const stamp = new Date().toISOString().replace(/[:T]/g, '-').replace(/\..+/, '');
  const fileName = `pointcloud-${stamp}.png`;

  if (isVSCode) {
    host.vscode.postMessage({
      type: 'saveScreenshot',
      dataBase64: dataUrl.slice(dataUrl.indexOf(',') + 1),
      defaultFileName: fileName,
    });
    return;
  }

  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = fileName;
  link.click();
  host.showStatus(`Screenshot saved: ${fileName}`);
}

/**
 * Serializable camera state. Position/target/up are world-space; quaternion is
 * redundant with up+lookAt but included so poses round-trip exactly.
 */
export function buildCameraState(host: ViewCaptureHost): object {
  const c = host.camera;
  return {
    position: c.position.toArray(),
    target: host.controls.target.toArray(),
    up: c.up.toArray(),
    quaternion: c.quaternion.toArray(),
    fov: c.fov,
    near: c.near,
    far: c.far,
  };
}

export async function copyCameraStateToClipboard(host: ViewCaptureHost): Promise<void> {
  const json = JSON.stringify(buildCameraState(host), null, 2);
  try {
    await navigator.clipboard.writeText(json);
    host.showStatus('Camera state copied to clipboard.');
  } catch {
    // Clipboard API can be unavailable (permissions, insecure context).
    console.log('Camera state:\n' + json);
    host.showStatus('Clipboard unavailable — camera state logged to console.');
  }
}
