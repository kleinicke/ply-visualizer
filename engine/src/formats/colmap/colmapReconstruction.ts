import * as THREE from 'three';
import { createCameraLabel } from '../../cameraProfile';
import {
  createFrustumObjects,
  createImagePlane,
  frustumDepthForExtent,
  IMAGE_PLANE_NAME,
  type FrustumIntrinsics,
  type FrustumOptions,
} from '../../visualization/cameraFrustum';
import type { CameraFrameDetail } from '../../visualization/cameraFrames';
import { focalYIndex, type ColmapCamera, type ColmapImage, type ColmapModel } from './colmapModel';
import { placementFor, verticalFovDegrees } from './colmapPose';
import { spreadOf } from '../../cameraProfile';

/**
 * Scene objects for a COLMAP reconstruction: one camera frame per registered
 * image. Model reading and the sparse cloud live in colmapFiles.ts.
 */

function frameDetails(image: ColmapImage, camera: ColmapCamera | undefined): CameraFrameDetail[] {
  const details: CameraFrameDetail[] = [
    { label: 'Image', value: image.name },
    {
      label: 'Translation',
      value: image.tvec.map(value => value.toFixed(4)).join(', '),
    },
    {
      label: 'Rotation (w, x, y, z)',
      value: image.qvec.map(value => value.toFixed(5)).join(', '),
    },
  ];
  if (camera) {
    details.push(
      { label: 'Camera model', value: `${camera.model} (id ${camera.id})` },
      { label: 'Resolution', value: `${camera.width} x ${camera.height}` },
      {
        label: 'Intrinsics',
        value: camera.params.map(value => Number(value.toFixed(4))).join(', '),
      }
    );
  }
  return details;
}

/**
 * How far in front of the optical centre the look-through target sits. Only the
 * direction matters; the distance just has to be non-zero.
 */
const LOOK_TARGET_DISTANCE = 1;

/**
 * Intrinsics for the frustum, when the model's camera provides them.
 *
 * `fx`/`fy` sit in different slots per model (focalYIndex), and the principal
 * point follows immediately after. Models without a focal length - the
 * equirectangular one - get no intrinsics and fall back to a generic frustum.
 */
function frustumIntrinsicsFor(camera: ColmapCamera | undefined): FrustumIntrinsics | undefined {
  if (!camera) {
    return undefined;
  }
  const fyIndex = focalYIndex(camera.model);
  if (fyIndex === null) {
    return undefined;
  }
  const fx = camera.params[0];
  const fy = camera.params[fyIndex];
  const cx = camera.params[fyIndex + 1];
  const cy = camera.params[fyIndex + 2];
  if (![fx, fy, cx, cy].every(value => Number.isFinite(value) && value !== 0)) {
    return undefined;
  }
  return { fx, fy, cx, cy, imageWidth: camera.width, imageHeight: camera.height };
}

function buildFrame(
  image: ColmapImage,
  camera: ColmapCamera | undefined,
  depth: number,
  texture: THREE.Texture | null
): THREE.Group {
  const group = new THREE.Group();
  group.name = `camera_${image.name}`;

  const { position, quaternion } = placementFor(image);
  group.position.copy(position);
  group.quaternion.copy(quaternion);

  // The frustum is built in camera space - +Z forward, +Y down - which is
  // exactly COLMAP's convention, so it needs no correction. (The old pyramid
  // did: it was modelled +Y up and had to be rolled. See colmapPose.ts.)
  const frustumOptions = {
    depth,
    intrinsics: frustumIntrinsicsFor(camera),
    color: 0x42a5f5,
    texture,
  };
  // Recorded so a photograph decoded later can be given a plane that sits on
  // exactly this frustum - see attachColmapFrameImage.
  group.userData.frustumOptions = frustumOptions;
  for (const object of createFrustumObjects(frustumOptions)) {
    group.add(object);
  }

  const label = createCameraLabel(image.name);
  label.name = 'cameraLabel';
  label.visible = false;
  group.add(label);

  (group as unknown as { originalPosition: unknown }).originalPosition = {
    x: position.x,
    y: position.y,
    z: position.z,
  };

  group.userData.view = {
    forward: new THREE.Vector3(0, 0, LOOK_TARGET_DISTANCE),
    up: new THREE.Vector3(0, -1, 0),
    fovYDegrees: camera
      ? verticalFovDegrees(camera.model, camera.params, camera.height)
      : undefined,
  };
  group.userData.frameDetails = frameDetails(image, camera);

  return group;
}

/**
 * One profile group holding every registered image as a `camera_*` child, which
 * is the shape visualization/cameraFrames.ts expects from any camera source.
 */
export function buildCameraProfile(
  model: ColmapModel,
  profileName: string,
  textures: Map<string, THREE.Texture> = new Map()
): THREE.Group {
  const profile = new THREE.Group();
  profile.name = `colmap_cameras_${profileName}`;
  profile.userData.cameraCount = model.images.length;
  profile.userData.profileName = profileName;
  // Camera frustums sit wherever the reconstruction put them; letting them
  // drive the initial fit would frame empty space rather than the cloud.
  profile.userData.excludeFromFit = true;

  // Registration order is not guaranteed to be sorted, and the panel lists
  // frames in child order.
  // A reconstruction is in arbitrary units, so frustum size comes from how far
  // apart the cameras themselves are rather than from a fixed distance.
  const centres = model.images.map(image => {
    const { position } = placementFor(image);
    return [position.x, position.y, position.z];
  });
  const depth = frustumDepthForExtent(spreadOf(centres));

  const images = [...model.images].sort((a, b) => a.name.localeCompare(b.name));
  for (const image of images) {
    profile.add(
      buildFrame(image, model.cameras.get(image.cameraId), depth, textures.get(image.name) ?? null)
    );
  }
  return profile;
}

/**
 * Adds a photograph to a frame that is already in the scene.
 *
 * Used by the progressive load: the cloud and the camera frames appear as soon
 * as the model is parsed, and images arrive over the following seconds.
 * Returns false when the frame is unknown or already has its image.
 */
export function attachColmapFrameImage(
  profile: THREE.Group,
  imageName: string,
  texture: THREE.Texture
): boolean {
  const frame = profile.getObjectByName(`camera_${imageName}`) as THREE.Group | undefined;
  const options = frame?.userData.frustumOptions as FrustumOptions | undefined;
  if (!frame || !options || frame.getObjectByName(IMAGE_PLANE_NAME)) {
    return false;
  }
  const plane = createImagePlane(options, texture);
  // Match whatever the profile-wide toggle is currently set to, so images
  // arriving after the user switched it on are not invisible.
  plane.visible = profile.userData.imagesVisible === true;
  frame.add(plane);
  return true;
}
