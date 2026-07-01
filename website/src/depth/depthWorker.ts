import { CameraParams, DepthConversionResult } from '../interfaces';
import { DepthConverter } from './DepthConverter';
import { applyColorToDepthResult } from './applyColorToDepthResult';
import { ensureTiffWasmGlueLoaded } from './readers/tiffWasm';

interface DepthWorkerRequest {
  id: number;
  depthData: ArrayBuffer;
  fileName: string;
  cameraParams: CameraParams;
  colorImageData?: ImageData;
  geotiffUrl?: string;
  tiffWasmGlueUrl?: string;
  tiffWasmUrl?: string;
}

interface DepthWorkerSuccess {
  id: number;
  ok: true;
  result: DepthConversionResult;
}

interface DepthWorkerFailure {
  id: number;
  ok: false;
  error: string;
}

const converter = new DepthConverter();
const importedScripts = new Set<string>();

function importClassicScript(url?: string): void {
  if (!url || importedScripts.has(url)) {
    return;
  }
  const importScriptsFn = (globalThis as any).importScripts as
    | ((...urls: string[]) => void)
    | undefined;
  if (typeof importScriptsFn !== 'function') {
    return;
  }
  importScriptsFn(url);
  importedScripts.add(url);
}

function transferListFor(result: DepthConversionResult): Transferable[] {
  const transfers: Transferable[] = [result.vertices.buffer];
  if (result.colors) {
    transfers.push(result.colors.buffer);
  }
  if (result.pixelCoords) {
    transfers.push(result.pixelCoords.buffer);
  }
  return transfers;
}

self.onmessage = async (event: MessageEvent<DepthWorkerRequest>) => {
  const message = event.data;
  try {
    if (message.tiffWasmUrl) {
      (globalThis as any).__TIFF_WASM_URL__ = message.tiffWasmUrl;
    }
    ensureTiffWasmGlueLoaded(message.tiffWasmGlueUrl);
    importClassicScript(message.geotiffUrl);

    const result = await converter.processDepthToPointCloud(
      message.depthData,
      message.fileName,
      message.cameraParams
    );

    if (message.colorImageData) {
      applyColorToDepthResult(result, message.colorImageData, message.cameraParams);
    }

    const response: DepthWorkerSuccess = {
      id: message.id,
      ok: true,
      result,
    };
    (self as any).postMessage(response, transferListFor(result));
  } catch (error) {
    const response: DepthWorkerFailure = {
      id: message.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
    (self as any).postMessage(response);
  }
};
