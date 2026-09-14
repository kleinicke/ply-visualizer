import { loadSceneModel, type ModelResource } from './loadSceneModel';
import type { SpatialData } from '../interfaces';
import type { CadResult } from './cadTypes';

export async function handleSceneModelMessage(
  host: {
    vscode: { postMessage(message: any): void };
    displayFiles(data: SpatialData[]): Promise<void>;
    showError(message: string): void;
  },
  message: any
) {
  const data = message.data instanceof Uint8Array ? message.data : new Uint8Array(message.data);
  const readResource = (relative: string) =>
    new Promise<ModelResource>((resolve, reject) => {
      const requestId = crypto.randomUUID();
      const timer = window.setTimeout(() => {
        window.removeEventListener('message', listener);
        reject(new Error(`Timed out reading ${relative}`));
      }, 30000);
      const listener = (event: MessageEvent) => {
        if (event.data?.type !== 'modelResourceResult' || event.data.requestId !== requestId) {
          return;
        }
        clearTimeout(timer);
        window.removeEventListener('message', listener);
        if (event.data.error) {
          reject(new Error(event.data.error));
        } else {
          resolve({ bytes: new Uint8Array(event.data.data) });
        }
      };
      window.addEventListener('message', listener);
      host.vscode.postMessage({
        type: 'modelResourceRequest',
        sourceId: message.sourceId,
        relative,
        requestId,
      });
    });
  try {
    const model = await loadSceneModel({
      bytes: data,
      fileName: message.fileName,
      readResource: message.sourceId ? readResource : undefined,
      files: message.resources?.map((entry: any) => new File([entry.data], entry.name)),
      // The upstream CAD glue generates JS bindings dynamically. Keep it out of
      // the webview's strict CSP by decoding in an extension-host worker.
      decodeCad: (bytes, format) =>
        new Promise<CadResult>((resolve, reject) => {
          const requestId = crypto.randomUUID();
          const timer = window.setTimeout(() => {
            window.removeEventListener('message', listener);
            reject(new Error('CAD conversion timed out.'));
          }, 125_000);
          const listener = (event: MessageEvent) => {
            if (event.data?.type !== 'cadDecodeResult' || event.data.requestId !== requestId)
              {return;}
            clearTimeout(timer);
            window.removeEventListener('message', listener);
            if (event.data.error) {reject(new Error(event.data.error));}
            else {resolve(event.data.result);}
          };
          window.addEventListener('message', listener);
          host.vscode.postMessage({ type: 'cadDecodeRequest', requestId, bytes, format });
        }),
    });
    await host.displayFiles([model]);
  } catch (error) {
    host.showError(
      `Could not load ${message.fileName}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
