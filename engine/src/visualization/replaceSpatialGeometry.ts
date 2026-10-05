import * as THREE from 'three';
import type { SpatialData } from '../interfaces';
import { FileEntry, type EntryPresentation } from '../state/fileEntries';
import { buildFileObject, disposeFileResources, type FileObjectHost } from './fileObject';

export interface GeometryReplacementHost extends FileObjectHost {
  scene: THREE.Scene;
  createNormalsVisualizer(data: SpatialData): THREE.LineSegments;
}

/** Build all resources before publishing data or releasing the displayed object. */
export function replaceSpatialGeometry(
  host: GeometryReplacementHost,
  entry: FileEntry,
  data: SpatialData,
  index: number,
  presentation: Partial<EntryPresentation> = {}
): void {
  const previous = entry.spatial;
  if (!previous) {
    throw new Error('Cannot replace a non-spatial entry');
  }
  const prepared = new FileEntry(entry.id, 'spatial', entry.parentId, {
    ...entry.state,
    ...presentation,
    normalsVisible: data.hasNormals && entry.state.normalsVisible,
  });
  let object: ReturnType<typeof buildFileObject> | undefined;
  try {
    object = buildFileObject(host, data, index, prepared);
    object.position.copy(previous.object.position);
    object.quaternion.copy(previous.object.quaternion);
    object.scale.copy(previous.object.scale);
    object.matrix.copy(previous.object.matrix);
    object.matrixAutoUpdate = previous.object.matrixAutoUpdate;
    object.visible = prepared.state.visible;
    if (prepared.state.normalsVisible) {
      const normals = host.createNormalsVisualizer(data);
      prepared.resources.normals = normals;
      normals.matrix.copy(object.matrix);
      normals.matrixAutoUpdate = false;
      normals.visible = object.visible;
    }
  } catch (error) {
    disposeFileResources(prepared, object);
    throw error;
  }
  // Nothing below constructs resources or awaits another operation.
  host.scene.add(object);
  if (prepared.resources.normals) {
    host.scene.add(prepared.resources.normals);
  }
  disposeFileResources(entry, previous.object, previous.data);
  entry.spatial = { data, object };
  Object.assign(entry.resources, prepared.resources);
  Object.assign(entry.state, prepared.state);
}
