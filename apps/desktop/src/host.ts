interface NativeFile {
  id: string;
  name: string;
  size: number;
}
interface TauriApi {
  core: {
    invoke<T>(
      command: string,
      args?: Record<string, unknown> | Uint8Array,
      options?: { headers: Record<string, string> }
    ): Promise<T>;
  };
  event: {
    listen<T>(event: string, callback: (event: { payload: T }) => void): Promise<() => void>;
  };
}
declare global {
  interface Window {
    __TAURI__?: TauriApi;
  }
}
export const native = window.__TAURI__;
export async function readNativeFiles(
  files: NativeFile[]
): Promise<Array<{ id: string; file: File }>> {
  const result = [];
  for (const doc of files) {
    const bytes = await native!.core.invoke<ArrayBuffer>('read_document', { id: doc.id });
    result.push({ id: doc.id, file: new File([bytes], doc.name) });
  }
  return result;
}
export async function openNative() {
  return readNativeFiles(await native!.core.invoke<NativeFile[]>('open_files'));
}
export async function pendingNative() {
  return readNativeFiles(await native!.core.invoke<NativeFile[]>('pending_files'));
}
export async function saveExport(name: string, blob: Blob) {
  if (native) {
    void native.core.invoke('diagnostic', { message: `Saving ${name} (${blob.size} bytes)` });
    return native.core.invoke<boolean>('save_export', new Uint8Array(await blob.arrayBuffer()), {
      headers: { 'x-file-name': encodeURIComponent(name) },
    });
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
