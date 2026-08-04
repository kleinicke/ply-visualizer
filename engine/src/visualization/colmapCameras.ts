import * as THREE from 'three';
import type { SpatialData } from '../interfaces';
import { FileEntryRegistry } from '../state/fileEntries';
import { registerCameraEntry } from '../state/fileEntryState';
import { buildCameraProfile } from '../formats/colmap/colmapReconstruction';
import type { ColmapModel } from '../formats/colmap/colmapModel';

/**
 * Adds the camera frames of a COLMAP reconstruction to the scene.
 *
 * Mirrors stonexCameras.ts and e57Cameras.ts: the loader leaves the parsed
 * model on the point cloud's metadata, and main.ts calls this once the cloud
 * itself is in the scene, so the profile lands after its own cloud in the file
 * list.
 */

interface ColmapCameraHost {
  scene: THREE.Scene;
  spatialFiles: { length: number };
  fileEntries: FileEntryRegistry;
  cameraGroups: THREE.Group[];
  cameraNames: string[];
  cameraShowLabels: boolean[];
  cameraShowCoords: boolean[];
  fileVisibility: boolean[];
  pointSizes: number[];
  individualColorModes: string[];
  transformationMatrices: THREE.Matrix4[];
}

export function addColmapCameraVisualization(host: ColmapCameraHost, data: SpatialData): boolean {
  const model = data.metadata?.colmapModel as ColmapModel | undefined;
  if (!model?.images.length) {
    return false;
  }

  const profileName = (data.metadata?.colmapProfileName as string) || data.fileName || 'COLMAP';
  const textures = data.metadata?.colmapTextures as Map<string, THREE.Texture> | undefined;
  const profile = buildCameraProfile(model, profileName, textures);
  // The panel only offers the image toggle when a frame actually has a plane.
  profile.userData.hasImagePlanes = (textures?.size ?? 0) > 0;
  profile.userData.imagesVisible = false;
  // Declared up front so the panel shows "images 0 / N" on the first render
  // rather than only once the first batch arrives. Cleared when all arrive.
  const alreadyLoaded = textures?.size ?? 0;
  profile.userData.imageProgress =
    alreadyLoaded < model.images.length
      ? { done: alreadyLoaded, total: model.images.length }
      : null;

  // The cloud is shifted by its source origin when one was applied; the
  // cameras are in the same reconstruction frame and must move with it.
  const origin = data.sourceOrigin;
  if (origin) {
    profile.position.set(-origin[0], -origin[1], -origin[2]);
  }

  host.scene.add(profile);
  host.cameraGroups.push(profile);
  host.cameraNames.push(`${profileName} cameras`);
  // The cameras belong to the cloud that carried the model - the entry that
  // was just added, which is the last spatial one. Removing it removes them.
  const parent = host.fileEntries.at(
    host.fileEntries.indexOfKind('spatial', host.spatialFiles.length - 1)
  );
  registerCameraEntry(host, parent?.id ?? null);
  return true;
}
