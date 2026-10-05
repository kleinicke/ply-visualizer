import { BufferGeometry, Material, Texture } from 'three';
import type { FileEntry } from './state/fileEntries';

/** Estimated retained CPU buffers and GPU payload, not a process-memory limit. */
export function estimateSequenceBytes(entries: Iterable<FileEntry>): number {
  const buffers = new Set<ArrayBufferLike>();
  const gpuBuffers = new Set<object>();
  const textures = new Set<Texture>();
  const visited = new Set<object>();
  let bytes = 0;
  const retain = (value: unknown): void => {
    if (!value || typeof value !== 'object' || visited.has(value)) {
      return;
    }
    visited.add(value);
    if (ArrayBuffer.isView(value)) {
      buffers.add(value.buffer);
    } else if (value instanceof ArrayBuffer) {
      buffers.add(value);
    } else if (Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype) {
      for (const child of Object.values(value)) {
        retain(child);
      }
    }
  };
  for (const entry of entries) {
    const spatial = entry.spatial;
    if (!spatial) {
      continue;
    }
    const { vertices, faces, sceneModel, ...data } = spatial.data;
    retain(data);
    // JS object overhead varies by runtime; keep a conservative per-record allowance.
    bytes += vertices.length * 128;
    for (const face of faces) {
      bytes += 64 + face.indices.length * 8;
    }
    const roots = [
      spatial.object,
      entry.resources.normals,
      entry.resources.vertexPoints,
      entry.resources.materialGroup,
    ];
    for (const root of roots) {
      root?.traverse(object => {
        const { geometry, material } = object as typeof object & {
          geometry?: BufferGeometry;
          material?: Material | Material[];
        };
        if (geometry) {
          const attributes = [
            geometry.index,
            ...Object.values(geometry.attributes),
            ...Object.values(geometry.morphAttributes).flat(),
          ];
          for (const attribute of attributes) {
            if (!attribute) {
              continue;
            }
            const storage = 'data' in attribute ? attribute.data : attribute;
            retain(storage.array);
            if (!gpuBuffers.has(storage)) {
              gpuBuffers.add(storage);
              bytes += storage.array.byteLength;
            }
          }
        }
        for (const mat of Array.isArray(material) ? material : material ? [material] : []) {
          for (const value of Object.values(mat)) {
            if (!(value instanceof Texture) || textures.has(value)) {
              continue;
            }
            textures.add(value);
            const image = value.image;
            if (image?.data) {
              retain(image.data);
            }
            // RGBA plus mipmaps; decoded image and driver overhead can differ.
            bytes +=
              (image?.width ?? 0) * (image?.height ?? 0) * 4 * (value.generateMipmaps ? 4 / 3 : 1);
          }
        }
      });
    }
    for (const clip of sceneModel?.clips ?? []) {
      for (const track of clip.tracks) {
        retain(track.times);
        retain(track.values);
      }
    }
  }
  for (const buffer of buffers) {
    bytes += buffer.byteLength;
  }
  return bytes;
}
