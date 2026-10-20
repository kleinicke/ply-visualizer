import { readViewerMessage, type ViewerMessage, type MessageOf } from './viewerProtocol';
import type { FileEntryRegistry } from '../state/fileEntries';
import { uiState } from '../state/ui.svelte';
export type ViewerRoutes = {
  [K in ViewerMessage['type']]: (message: MessageOf<K>) => void | Promise<void>;
};
const BACKGROUND_CHANGE_MESSAGES = new Set([
  'stonexColorReady',
  'spatialData',
  'multiSpatialData',
  'sceneModelData',
  'splatContainerUri',
  'ultimateRawBinaryData',
  'ultimateRawBinaryUri',
  'directTypedArrayData',
  'binarySpatialData',
  'addFiles',
  'startLargeFile',
  'largeFileChunk',
  'largeFileComplete',
  'depthData',
  'objData',
  'stlData',
  'xyzData',
  'fileData',
  'browserFiles',
  'pcdData',
  'ptsData',
  'kittiBinData',
  'offData',
  'gltfData',
  'volumeData',
  'colmapModelFiles',
  'colmapImages',
  'npyData',
  'xyzVariantData',
  'pointStreamEnd',
  'poseData',
]);

export async function dispatchViewerMessage(
  registry: FileEntryRegistry,
  routes: ViewerRoutes,
  value: unknown
): Promise<void> {
  let message = readViewerMessage(value);
  if (!message) {
    return;
  }
  if (message.entryId !== undefined) {
    const index = registry.indexOf(message.entryId);
    if (index < 0) {
      return;
    }
    message = { ...message, fileIndex: index };
  }
  const tracks = BACKGROUND_CHANGE_MESSAGES.has(message.type);
  if (tracks) {
    uiState.backgroundChanges++;
  }
  try {
    // The key and payload share the same discriminant; indexing a mapped union
    // otherwise produces an impossible intersection of all payload types.
    const route = routes[message.type] as (message: ViewerMessage) => void | Promise<void>;
    await route(message);
  } finally {
    if (tracks) {
      uiState.backgroundChanges = Math.max(0, uiState.backgroundChanges - 1);
    }
  }
}
export function listenForViewerMessages(
  registry: FileEntryRegistry,
  routes: ViewerRoutes,
  onError: (message: string) => void
): () => void {
  const listener = (event: MessageEvent<unknown>) => {
    void dispatchViewerMessage(registry, routes, event.data).catch(error =>
      onError(error instanceof Error ? error.message : String(error))
    );
  };
  window.addEventListener('message', listener);
  return () => window.removeEventListener('message', listener);
}
