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
  const profile = buildCameraProfile(model, profileName);

  // The cloud is shifted by its source origin when one was applied; the
  // cameras are in the same reconstruction frame and must move with it.
  const origin = data.sourceOrigin;
  if (origin) {
    profile.position.set(-origin[0], -origin[1], -origin[2]);
  }

  host.scene.add(profile);
  host.cameraGroups.push(profile);
  host.cameraNames.push(`${profileName} cameras`);
  registerCameraEntry(host);
  return true;
}
