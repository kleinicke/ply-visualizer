/* eslint-disable @typescript-eslint/naming-convention -- Python MCP wire-format keys */
/** Install the MCP transport before starting the ordinary shared viewer host. */
import { agentBuild } from './agentBuild';
import darkTheme from '../themes/dark-modern.json';
import lightTheme from '../themes/light-modern.json';
import { App } from '@modelcontextprotocol/ext-apps';

declare global {
  interface Window {
    __PLY_ASSETS__: Record<string, string>;
  }
}
function assetBytes(address: string) {
  const name = address.split('/__ply_assets__/')[1];
  const encoded = name && window.__PLY_ASSETS__[name];
  return encoded ? Uint8Array.from(atob(encoded), char => char.charCodeAt(0)) : null;
}
// webpack lazy chunks are delivered inline, without script-src/network exceptions.
const append = document.head.appendChild.bind(document.head);
document.head.appendChild = function <T extends Node>(node: T): T {
  if (node instanceof HTMLScriptElement && node.src.includes('/__ply_assets__/')) {
    const address = node.src;
    const install = (bytes: Uint8Array) => {
      node.removeAttribute('src');
      node.textContent = new TextDecoder().decode(bytes);
      append(node);
      queueMicrotask(() => node.dispatchEvent(new Event('load')));
    };
    const bytes = assetBytes(address);
    if (bytes) {
      install(bytes);
    } else {
      void readBytes('assets/' + address.split('/__ply_assets__/')[1])
        .then(install)
        .catch(() => node.dispatchEvent(new Event('error')));
    }
    return node;
  }
  return append(node);
};
// Sandboxed chat widgets may have an opaque origin and no persistent storage.
for (const name of ['localStorage', 'sessionStorage'] as const) {
  try {
    window[name].getItem('ply-storage-check');
  } catch {
    const values = new Map<string, string>();
    const storage: Storage = {
      get length() {
        return values.size;
      },
      clear: () => values.clear(),
      key: i => [...values.keys()][i] ?? null,
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => {
        values.set(String(key), String(value));
      },
      removeItem: key => {
        values.delete(key);
      },
    };
    Object.defineProperty(window, name, { value: storage });
  }
}
const app = new App({ name: 'ply-visualizer', version: agentBuild.package_version }, {});
let sceneId = '';
let ready: () => void;
const sceneReady = new Promise<void>(resolve => {
  ready = resolve;
});
const nativeFetch = window.fetch.bind(window);
// Explicitly supplied model buffers already live in this widget. Serve loader
// blob fetches from memory even when the host CSP forbids network connections.
const localBlobs = new Map<string, Blob>();
const createBlobUrl = URL.createObjectURL.bind(URL);
const revokeBlobUrl = URL.revokeObjectURL.bind(URL);
URL.createObjectURL = object => {
  const url = createBlobUrl(object);
  if (object instanceof Blob) {
    localBlobs.set(url, object);
  }
  return url;
};
URL.revokeObjectURL = url => {
  localBlobs.delete(url);
  revokeBlobUrl(url);
};

async function call(name: string, args: Record<string, unknown>) {
  const result = await app.callServerTool({ name, arguments: args });
  if (result.isError) {
    throw new Error(
      result.content?.find(item => item.type === 'text')?.text ?? 'Viewer disconnected'
    );
  }
  return (
    result.structuredContent ?? JSON.parse(result.content.find(item => item.type === 'text')!.text)
  );
}

window.fetch = async (input, init) => {
  const address = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const localBlob = localBlobs.get(address);
  if (localBlob) {
    return new Response(localBlob);
  }
  // WebAssembly bytes bundled into the resource must not need network/CSP fetch access.
  if (address.startsWith('data:')) {
    const [header, body] = address.split(',', 2);
    const bytes = Uint8Array.from(atob(body), char => char.charCodeAt(0));
    return new Response(bytes, { headers: { 'Content-Type': header.slice(5).split(';')[0] } });
  }
  if (address === 'src/themes/dark-modern.json') {
    return Response.json(darkTheme);
  }
  if (address === 'src/themes/light-modern.json') {
    return Response.json(lightTheme);
  }
  const bundled = assetBytes(address);
  if (bundled) {
    return new Response(bundled, {
      headers: {
        'Content-Type': address.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream',
      },
    });
  }
  if (address.includes('/__ply_assets__/')) {
    await sceneReady;
    const bytes = await readBytes('assets/' + address.split('/__ply_assets__/')[1]);
    return new Response(bytes, {
      headers: {
        'Content-Type': address.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream',
      },
    });
  }
  const [path, query = ''] = address.replace(/^\.\//, '').split('?', 2);
  if (
    !['session.json', 'agent/command', 'agent/result'].includes(path) &&
    !path.startsWith('files/')
  ) {
    return nativeFetch(input, init);
  }
  await sceneReady;
  if (path === 'agent/result') {
    return Response.json(
      await call('submit_viewer_reply', {
        scene_id: sceneId,
        reply: JSON.parse(String(init?.body)),
      })
    );
  }
  if (!path.startsWith('files/')) {
    const value = await call('read_viewer_data', {
      scene_id: sceneId,
      resource: path,
      ...(path === 'agent/command'
        ? { renderer_id: new URLSearchParams(query).get('renderer_id') }
        : {}),
    });
    return Response.json(path === 'agent/command' ? value.command : value);
  }
  return new Response(new Blob([(await readBytes(path)).buffer as ArrayBuffer]));
};

async function readBytes(resource: string): Promise<Uint8Array<ArrayBuffer>> {
  await sceneReady;
  const first = await call('read_viewer_data', { scene_id: sceneId, resource, offset: 0 });
  const chunkSize = 512 * 1024;
  if (!Number.isSafeInteger(first.size) || first.size < 0) {
    throw new Error('Invalid viewer data size');
  }
  const result = new Uint8Array(first.size);
  function copy(chunk: any, offset: number) {
    const bytes = Uint8Array.from(atob(chunk.data), char => char.charCodeAt(0));
    if (
      chunk.size !== result.length ||
      chunk.offset !== offset ||
      bytes.length !== Math.min(chunkSize, result.length - offset)
    ) {
      throw new Error('Incomplete or inconsistent viewer data transfer');
    }
    result.set(bytes, offset);
  }
  copy(first, 0);
  let next = chunkSize;
  // Four bounded workers; one final allocation, no retained base64 chunk list.
  await Promise.all(
    Array.from(
      { length: Math.max(0, Math.min(4, Math.ceil(result.length / chunkSize) - 1)) },
      async () => {
        while (next < result.length) {
          const offset = next;
          next += chunkSize;
          copy(await call('read_viewer_data', { scene_id: sceneId, resource, offset }), offset);
        }
      }
    )
  );
  return result;
}

app.ontoolresult = result => {
  const text = result.content?.find(item => item.type === 'text');
  const scene = result.structuredContent ?? (text?.type === 'text' ? JSON.parse(text.text) : null);
  if (typeof scene?.scene_id === 'string') {
    // Each widget owns one scene; unrelated tool results must not replace it.
    if (sceneId && sceneId !== scene.scene_id) {
      return;
    }
    sceneId = scene.scene_id;
    ready();
  }
};
document.documentElement.dataset.mcpApp = 'true';
document.documentElement.dataset.sessionUi = 'collapsed';
void app
  .connect()
  .then(() => import('./localSession'))
  .catch(error => {
    document.documentElement.dataset.localSession = 'error';
    document.body.textContent = `Unable to connect the 3D viewer: ${error.message}`;
  });
