import * as THREE from 'three';
import {
  createCameraBodyGeometry,
  createCameraLabel,
  createCameraUpArrow,
} from '../../cameraProfile';
import type { CameraFrameDetail } from '../../visualization/cameraFrames';
import type { ColmapCamera, ColmapImage, ColmapModel } from './colmapModel';
import { BODY_ROLL_ABOUT_Z, placementFor, verticalFovDegrees } from './colmapPose';

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

function buildFrame(image: ColmapImage, camera: ColmapCamera | undefined): THREE.Group {
  const group = new THREE.Group();
  group.name = `camera_${image.name}`;

  const { position, quaternion } = placementFor(image);
  group.position.copy(position);
  group.quaternion.copy(quaternion);

  // The body looks along +Z with +Y up; COLMAP's up is -Y. Rolling the body
  // about its own Z maps one onto the other without disturbing the direction
  // it points - see colmapPose.ts for why a group-level fix cannot work.
  const body = createCameraBodyGeometry();
  const bodyHolder = new THREE.Group();
  bodyHolder.rotation.z = BODY_ROLL_ABOUT_Z;
  bodyHolder.add(body);
  bodyHolder.add(createCameraUpArrow());
  group.add(bodyHolder);

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
export function buildCameraProfile(model: ColmapModel, profileName: string): THREE.Group {
  const profile = new THREE.Group();
  profile.name = `colmap_cameras_${profileName}`;
  profile.userData.cameraCount = model.images.length;
  profile.userData.profileName = profileName;
  // Camera frustums sit wherever the reconstruction put them; letting them
  // drive the initial fit would frame empty space rather than the cloud.
  profile.userData.excludeFromFit = true;

  // Registration order is not guaranteed to be sorted, and the panel lists
  // frames in child order.
  const images = [...model.images].sort((a, b) => a.name.localeCompare(b.name));
  for (const image of images) {
    profile.add(buildFrame(image, model.cameras.get(image.cameraId)));
  }
  return profile;
}
