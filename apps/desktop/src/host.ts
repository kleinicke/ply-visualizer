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

export interface FolderEntry {
  name: string;
  path: string;
  directory: boolean;
  document?: import('./documents').FileRef;
  children?: FolderEntry[];
  expanded?: boolean;
}
export interface Workspace {
  id: string;
  name: string;
}
export async function openWorkspace() {
  return native?.core.invoke<Workspace | null>('open_workspace');
}
export async function listDirectory(workspace: string, relative = '') {
  return native!.core.invoke<FolderEntry[]>('list_directory', { workspace, relative });
}
const fileCache = new Map<string, File>();
const MAX_CACHE = 128 * 1024 * 1024;
export async function resolveFile(ref: import('./documents').FileRef): Promise<File> {
  if (ref.file) {
    return ref.file;
  }
  const cached = fileCache.get(ref.id);
  if (cached) {
    fileCache.delete(ref.id);
    fileCache.set(ref.id, cached);
    return cached;
  }
  const bytes = await native!.core.invoke<ArrayBuffer>('read_document', { id: ref.id });
  const file = new File([bytes], ref.name);
  let size = Array.from(fileCache.values()).reduce((sum, file) => sum + file.size, 0);
  while (fileCache.size && size + file.size > MAX_CACHE) {
    const key = fileCache.keys().next().value!;
    size -= fileCache.get(key)!.size;
    fileCache.delete(key);
  }
  if (file.size <= MAX_CACHE) {
    fileCache.set(ref.id, file);
  }
  return file;
}
export async function openReferences() {
  return native!.core.invoke<import('./documents').FileRef[]>('open_files');
}
export async function pendingReferences() {
  return native!.core.invoke<import('./documents').FileRef[]>('pending_files');
}
export async function readText(ref: import('./documents').FileRef) {
  if (!ref.file) {
    return native!.core.invoke<string>('read_text', { id: ref.id });
  }
  const { textPreview } = await import('./documents');
  return textPreview(new Uint8Array(await ref.file.slice(0, 2 * 1024 * 1024 + 1).arrayBuffer()));
}
