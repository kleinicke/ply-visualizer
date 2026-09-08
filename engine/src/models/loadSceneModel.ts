import * as THREE from 'three';
import { readRemoteModelResource } from './remoteModelResource';
import { SceneModel, modelSpatialData } from './sceneModel';

export interface ModelResource {
  bytes: Uint8Array<ArrayBuffer>;
  mime?: string;
}
export interface ModelSource {
  bytes: Uint8Array<ArrayBuffer>;
  fileName: string;
  baseUrl?: string;
  readResource?: (relative: string) => Promise<ModelResource>;
  files?: File[];
}

/** Preload declared resources so loaders can use ordinary browser blob URLs in
 * both hosts. This is also how remote VS Code assets avoid browser CORS. */
async function prepareResources(source: ModelSource, manager: THREE.LoadingManager) {
  const urls = new Map<string, string>();
  const warnings: string[] = [];
  const resourceErrors = new Map<string, string>();
  const normalize = (name: string) => {
    try {
      name = decodeURIComponent(name);
    } catch {}
    return name.replace(/\\/g, '/').replace(/^\.\//, '').toLowerCase();
  };
  const references = new Set<string>();
  let json: any;
  const text = new TextDecoder().decode(source.bytes);
  if (/\.gltf$/i.test(source.fileName)) {
    json = JSON.parse(text);
  } else if (/\.glb$/i.test(source.fileName)) {
    const view = new DataView(
      source.bytes.buffer,
      source.bytes.byteOffset,
      source.bytes.byteLength
    );
    const length = view.getUint32(12, true);
    json = JSON.parse(new TextDecoder().decode(source.bytes.subarray(20, 20 + length)));
  }
  if (json) {
    for (const entry of [...(json.buffers || []), ...(json.images || [])]) {
      if (entry.uri && !entry.uri.startsWith('data:')) {
        references.add(entry.uri);
      }
    }
  } else if (/\.dae$/i.test(source.fileName)) {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    for (const entry of doc.querySelectorAll('library_images image init_from')) {
      const value = entry.textContent?.trim();
      if (value) {
        references.add(value);
      }
    }
  } else {
    // FBX/3DS store external texture filenames as strings even in binary files.
    // Keep basename matching for old DOS/absolute exporter paths.
    for (const match of text.matchAll(/[\w .\-/\\:]+\.(?:png|jpe?g|tga|bmp|webp)/gi)) {
      const name = match[0].trim().replace(/^.*?([A-Za-z]:[\\/])/, '$1');
      if (name.length < 512) {
        references.add(name);
      }
    }
  }
  const read = async (relative: string): Promise<ModelResource> => {
    const exact = source.files?.find(
      file => normalize(file.webkitRelativePath || file.name) === normalize(relative)
    );
    const basename = normalize(relative).split('/').pop();
    const candidates = source.files?.filter(file => normalize(file.name) === basename) || [];
    const file = exact || (candidates.length === 1 ? candidates[0] : undefined);
    if (file) {
      return { bytes: new Uint8Array(await file.arrayBuffer()), mime: file.type };
    }
    if (source.readResource) {
      return source.readResource(relative);
    }
    if (!source.baseUrl) {
      throw new Error(`Select the model together with its supporting file: ${relative}`);
    }
    return readRemoteModelResource(relative, source.baseUrl);
  };
  await Promise.all(
    [...references].map(async name => {
      try {
        const resource = await read(name);
        const type =
          resource.mime ||
          (/\.png$/i.test(name)
            ? 'image/png'
            : /\.jpe?g$/i.test(name)
              ? 'image/jpeg'
              : 'application/octet-stream');
        urls.set(normalize(name), URL.createObjectURL(new Blob([resource.bytes], { type })));
      } catch (error) {
        resourceErrors.set(
          normalize(name),
          `${name}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    })
  );
  manager.setURLModifier(url => {
    if (/^(data|blob):/.test(url)) {
      return url;
    }
    const normalized = normalize(url);
    const found =
      urls.get(normalized) ||
      [...urls].find(
        ([name]) =>
          normalized.endsWith('/' + name) || normalized.split('/').pop() === name.split('/').pop()
      )?.[1];
    // Do not silently fetch unresolved local paths from the website's origin.
    if (found) {
      return found;
    }
    const warning = resourceErrors.get(normalized) || `Missing model resource: ${url}`;
    if (!warnings.includes(warning)) {
      warnings.push(warning);
    }
    return 'data:application/octet-stream;base64,';
  });
  manager.onError = url =>
    warnings.push(
      `Could not load model resource: ${url.startsWith('blob:') ? 'texture or buffer' : url}`
    );
  return {
    warnings,
    release: () => {
      for (const url of urls.values()) {
        URL.revokeObjectURL(url);
      }
    },
  };
}

export async function loadSceneModel(source: ModelSource) {
  const manager = new THREE.LoadingManager();
  const resources = await prepareResources(source, manager);
  // Texture loaders finish after synchronous FBX/DAE/3DS parsing. Hold the file
  // open until their loading manager settles so screenshots and errors are final.
  let resolveTextures: () => void;
  const textures = new Promise<void>(resolve => {
    resolveTextures = resolve;
  });
  manager.onLoad = () => resolveTextures();
  manager.itemStart('scene-model');
  try {
    let root: THREE.Object3D;
    let clips: THREE.AnimationClip[] = [];
    const extension = source.fileName.split('.').pop()!.toLowerCase();
    if (extension === 'gltf' || extension === 'glb') {
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
      const gltf = await new GLTFLoader(manager).parseAsync(source.bytes.buffer, '');
      root = gltf.scene;
      clips = gltf.animations;
    } else if (extension === 'fbx') {
      const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
      root = new FBXLoader(manager).parse(source.bytes.buffer, '');
      clips = root.animations;
    } else if (extension === 'dae') {
      const { ColladaLoader } = await import('three/examples/jsm/loaders/ColladaLoader.js');
      const collada = new ColladaLoader(manager).parse(new TextDecoder().decode(source.bytes), '');
      if (!collada) {
        throw new Error('Invalid Collada document');
      }
      root = collada.scene;
      clips = root.animations;
    } else {
      const { TDSLoader } = await import('three/examples/jsm/loaders/TDSLoader.js');
      root = new TDSLoader(manager).parse(source.bytes.buffer, '');
    }
    manager.itemEnd('scene-model');
    await textures;
    return modelSpatialData(
      new SceneModel(root, clips, resources.warnings, resources.release),
      source.fileName,
      source.bytes.byteLength
    );
  } catch (error) {
    resources.release();
    throw error;
  }
}
