/**
 * Generic multi-camera rig JSON reader.
 *
 * Rig files differ mostly in spelling: the camera list sits under `cams`,
 * `cameras`, `frames`, `views` or at the root; poses come as a 4x4/3x4 matrix,
 * a 3x3 rotation or quaternion plus a centre or translation; intrinsics as
 * `fx/fy/cx/cy`, `fl_x/fl_y`, a `K` matrix or a NeRF `camera_angle_x`. All of
 * that is recognised by key name.
 *
 * What a name cannot tell is the convention: a bare `R` with `C` may be
 * world->camera or camera->world, in OpenCV (+Z forward, +Y down) or OpenGL
 * (-Z forward, +Y up) axes. Keys that do say (`c2w`, `w2c`, NeRF
 * `transform_matrix`) are trusted. Otherwise the reader tries each reading and
 * keeps the one whose optical axes converge on a common point in front of the
 * cameras - rigs film a subject - provided it wins clearly. Without a clear
 * winner it falls back to the most common default for those keys.
 *
 * Output is always camera->world with OpenCV camera axes, which is how
 * `cameraFrustum.ts` builds its frame. Pure math, no DOM or three.js.
 */

type Vec3 = [number, number, number];
/** Row-major 3x3. */
type Mat3 = [number, number, number, number, number, number, number, number, number];

export interface RigIntrinsics {
  fx: number;
  fy: number;
  cx: number;
  cy: number;
  imageWidth: number;
  imageHeight: number;
}

export interface RigCamera {
  name: string;
  /** Optical centre in world coordinates. */
  position: Vec3;
  /** Camera->world rotation, row-major, OpenCV camera axes. */
  rotation: Mat3;
  intrinsics?: RigIntrinsics;
  /** Human-readable description of the convention used, e.g. "R camera→world, OpenCV (inferred)". */
  convention: string;
}

type Direction = 'c2w' | 'w2c';
type Axes = 'opencv' | 'opengl';

/** A pose as read, before its convention is settled. */
interface RawPose {
  rotation: Mat3;
  /** Either the optical centre or the world->camera translation. */
  vector: Vec3;
  vectorIsCentre: boolean;
  /** Fixed by the key name, or undefined when it has to be inferred. */
  direction?: Direction;
  axes?: Axes;
  /** Default when inference is inconclusive. */
  defaultDirection: Direction;
  defaultAxes: Axes;
  label: string;
}

interface RawCamera {
  name: string;
  pose: RawPose;
  intrinsics?: RigIntrinsics;
}

const LIST_KEYS = ['cams', 'cameras', 'frames', 'views', 'sensors', 'rig', 'calibration'];

const C2W_MATRIX_KEYS = [
  'transform_matrix',
  'c2w',
  'cam2world',
  'camera_to_world',
  'cameraToWorld',
  'pose',
];
const W2C_MATRIX_KEYS = [
  'w2c',
  'world2cam',
  'world_to_camera',
  'worldToCamera',
  'extrinsic',
  'extrinsics',
  'Rt',
  'RT',
];
const ROTATION_KEYS = ['R', 'rotation', 'rotation_matrix', 'rot', 'Rot'];
const QUATERNION_KEYS = ['qvec', 'quaternion', 'quat', 'q', 'rotation_quaternion', 'orientation'];
const CENTRE_KEYS = ['C', 'center', 'centre', 'camera_center', 'position', 'location', 'origin'];
const TRANSLATION_KEYS = ['t', 'T', 'tvec', 'translation'];
/** Sub-objects some formats nest the pose or intrinsics in. */
const NESTED_KEYS = ['extrinsics', 'extrinsic', 'pose', 'intrinsics', 'intrinsic', 'calibration'];

/**
 * Reads every camera of a rig JSON, or returns null when the document does
 * not look like one (so pose and other JSON keep their own readers).
 */
export function parseCameraRig(data: unknown): RigCamera[] | null {
  const raws = readRawCameras(data);
  if (!raws || raws.length === 0) {
    return null;
  }
  return resolveConventions(raws);
}

function readRawCameras(data: unknown): RawCamera[] | null {
  const root = isObject(data) ? data : undefined;
  const isNerf = !!root && Array.isArray(root.frames);
  for (const list of candidateLists(data)) {
    const raws: RawCamera[] = [];
    for (const [index, [key, value]] of list.entries()) {
      if (!isObject(value)) {
        continue;
      }
      const pose = readPose(value, isNerf);
      if (!pose) {
        continue;
      }
      raws.push({
        name: cameraName(value, key, index),
        pose,
        intrinsics: readIntrinsics(value) ?? (root ? readIntrinsics(root) : undefined),
      });
    }
    // Most entries must be cameras, so a list of other objects that happen
    // to carry a `position` is not taken for a rig.
    if (raws.length > 0 && raws.length * 2 >= list.length) {
      return raws;
    }
  }
  return null;
}

/** Camera lists to try, each as [key-or-index, value] pairs. */
function candidateLists(data: unknown): Array<Array<[string | undefined, unknown]>> {
  const lists: Array<Array<[string | undefined, unknown]>> = [];
  const add = (value: unknown) => {
    if (Array.isArray(value)) {
      lists.push(value.map(item => [undefined, item]));
    } else if (isObject(value)) {
      lists.push(Object.entries(value));
    }
  };
  if (Array.isArray(data)) {
    add(data);
  } else if (isObject(data)) {
    for (const key of LIST_KEYS) {
      if (key in data) {
        add(data[key]);
        if (isObject(data[key])) {
          for (const inner of LIST_KEYS) {
            if (inner in (data[key] as Record<string, unknown>)) {
              add((data[key] as Record<string, unknown>)[inner]);
            }
          }
        }
      }
    }
  }
  return lists;
}

function cameraName(camera: Record<string, unknown>, key: string | undefined, index: number) {
  for (const field of ['name', 'id', 'camera_id', 'serial', 'label']) {
    const value = camera[field];
    if (typeof value === 'string' || typeof value === 'number') {
      return String(value);
    }
  }
  const filePath = camera.file_path ?? camera.image ?? camera.image_name;
  if (typeof filePath === 'string') {
    return filePath.split(/[\\/]/).pop() || filePath;
  }
  return key ?? `camera_${index}`;
}

function readPose(camera: Record<string, unknown>, isNerf: boolean): RawPose | null {
  const scopes = [camera, ...nestedScopes(camera)];

  for (const scope of scopes) {
    for (const key of C2W_MATRIX_KEYS) {
      const m = readMatrix4(scope[key]);
      if (m) {
        // NeRF / nerfstudio transform_matrix is camera->world in OpenGL axes.
        const nerf = key === 'transform_matrix' || isNerf;
        return {
          ...m,
          vectorIsCentre: true,
          direction: 'c2w',
          axes: nerf ? 'opengl' : undefined,
          defaultDirection: 'c2w',
          defaultAxes: nerf ? 'opengl' : 'opencv',
          label: `${key} (4×4)`,
        };
      }
    }
    for (const key of W2C_MATRIX_KEYS) {
      const m = readMatrix4(scope[key]);
      if (m) {
        return {
          ...m,
          vectorIsCentre: false,
          direction: 'w2c',
          defaultDirection: 'w2c',
          defaultAxes: 'opencv',
          label: `${key} (4×4)`,
        };
      }
    }
  }

  let rotation: Mat3 | undefined;
  let rotationLabel = '';
  for (const scope of scopes) {
    for (const key of ROTATION_KEYS) {
      const r = readMatrix3(scope[key]);
      if (r) {
        rotation = r;
        rotationLabel = key;
        break;
      }
    }
    if (!rotation) {
      for (const key of QUATERNION_KEYS) {
        const q = readQuaternion(scope, key);
        if (q) {
          rotation = q;
          rotationLabel = key;
          break;
        }
      }
    }
    if (!rotation) {
      const q = readQuaternionFields(scope, false);
      if (q) {
        rotation = q;
        rotationLabel = 'qw/qx/qy/qz';
      }
    }
    if (rotation) {
      break;
    }
  }
  if (!rotation) {
    return null;
  }

  for (const scope of scopes) {
    for (const key of CENTRE_KEYS) {
      const v = readVec3(scope[key]);
      if (v) {
        return {
          rotation,
          vector: v,
          vectorIsCentre: true,
          // Either direction is common; inferred from the rig, and by
          // default a rotation beside a camera position is its orientation.
          direction: undefined,
          defaultDirection: 'c2w',
          defaultAxes: 'opencv',
          label: `${rotationLabel} + ${key}`,
        };
      }
    }
    for (const key of TRANSLATION_KEYS) {
      const v = readVec3(scope[key]);
      if (v) {
        return {
          rotation,
          vector: v,
          vectorIsCentre: false,
          // R and t together is the OpenCV/COLMAP world->camera extrinsic.
          direction: key === 'tvec' || rotationLabel === 'qvec' ? 'w2c' : undefined,
          defaultDirection: 'w2c',
          defaultAxes: 'opencv',
          label: `${rotationLabel} + ${key}`,
        };
      }
    }
  }
  return null;
}

function nestedScopes(camera: Record<string, unknown>): Array<Record<string, unknown>> {
  return NESTED_KEYS.map(key => camera[key]).filter(isObject);
}

function readIntrinsics(scope: Record<string, unknown>): RigIntrinsics | undefined {
  const scopes = [scope, ...nestedScopes(scope)];
  let fx: number | undefined;
  let fy: number | undefined;
  let cx: number | undefined;
  let cy: number | undefined;
  let width: number | undefined;
  let height: number | undefined;
  let angleX: number | undefined;
  let angleY: number | undefined;

  for (const s of scopes) {
    const k = readMatrix3(s.K ?? s.camera_matrix ?? s.intrinsic_matrix ?? s.k);
    if (k) {
      fx ??= k[0];
      fy ??= k[4];
      cx ??= k[2];
      cy ??= k[5];
    }
    fx ??= num(s.fx ?? s.fl_x ?? s.focal_length_x ?? s.f ?? s.focal);
    fy ??= num(s.fy ?? s.fl_y ?? s.focal_length_y);
    cx ??= num(s.cx ?? s.ppx ?? s.principal_point_x);
    cy ??= num(s.cy ?? s.ppy ?? s.principal_point_y);
    if (Array.isArray(s.principal_point)) {
      cx ??= num(s.principal_point[0]);
      cy ??= num(s.principal_point[1]);
    }
    width ??= num(s.w ?? s.width ?? s.image_width ?? s.imageWidth);
    height ??= num(s.h ?? s.height ?? s.image_height ?? s.imageHeight);
    const size = s.resolution ?? s.image_size ?? s.imageSize ?? s.size;
    if (Array.isArray(size) && size.length >= 2) {
      width ??= num(size[0]);
      height ??= num(size[1]);
    }
    angleX ??= num(s.camera_angle_x);
    angleY ??= num(s.camera_angle_y);
  }

  if (width === undefined || height === undefined) {
    return undefined;
  }
  if (fx === undefined && angleX !== undefined) {
    fx = (0.5 * width) / Math.tan(angleX / 2);
  }
  if (fy === undefined && angleY !== undefined) {
    fy = (0.5 * height) / Math.tan(angleY / 2);
  }
  fy ??= fx;
  fx ??= fy;
  if (!(fx! > 0) || !(fy! > 0)) {
    return undefined;
  }
  return {
    fx: fx!,
    fy: fy!,
    cx: cx ?? width / 2,
    cy: cy ?? height / 2,
    imageWidth: width,
    imageHeight: height,
  };
}

// ---------------------------------------------------------------- conventions

const READINGS: Array<[Direction, Axes]> = [
  ['c2w', 'opencv'],
  ['w2c', 'opencv'],
  ['c2w', 'opengl'],
  ['w2c', 'opengl'],
];

/** Inference only overrides a default when the axes clearly converge. */
const MIN_SCORE = 0.5;
const MIN_MARGIN = 0.15;

function resolveConventions(raws: RawCamera[]): RigCamera[] {
  // One convention for the whole file: decide it on cameras that share the
  // same kind of pose, which in practice is all of them.
  const first = raws[0].pose;
  const allowed = READINGS.filter(
    ([direction, axes]) =>
      (first.direction === undefined || first.direction === direction) &&
      (first.axes === undefined || first.axes === axes)
  );
  let chosen: [Direction, Axes] = [
    first.direction ?? first.defaultDirection,
    first.axes ?? first.defaultAxes,
  ];
  let inferred = false;
  if (allowed.length > 1 && raws.length >= 3) {
    const scored = allowed
      .map(reading => ({
        reading,
        score: convergenceScore(raws.map(raw => toWorld(raw.pose, reading))),
      }))
      .sort((a, b) => b.score - a.score);
    const best = scored[0];
    const defaultScore = scored.find(
      s => s.reading[0] === chosen[0] && s.reading[1] === chosen[1]
    )?.score;
    if (
      best.score >= MIN_SCORE &&
      (defaultScore === undefined || best.score - defaultScore >= MIN_MARGIN)
    ) {
      chosen = best.reading;
      inferred = true;
    }
  }

  const convention =
    `${first.label}: ${chosen[0] === 'c2w' ? 'camera→world' : 'world→camera'}, ` +
    `${chosen[1] === 'opencv' ? 'OpenCV' : 'OpenGL'} axes${inferred ? ' (inferred)' : ''}`;
  return raws.map(raw => ({
    name: raw.name,
    ...toWorld(raw.pose, chosen),
    intrinsics: raw.intrinsics,
    convention,
  }));
}

/** Pose under one reading, as camera->world OpenCV rotation and centre. */
function toWorld(pose: RawPose, [direction, axes]: [Direction, Axes]) {
  let rotation = direction === 'c2w' ? pose.rotation : transpose(pose.rotation);
  let position: Vec3;
  if (pose.vectorIsCentre) {
    position = pose.vector;
  } else if (direction === 'w2c') {
    // x_cam = R X + t, so the centre is -Rᵀ t.
    const c = mulVec(rotation, pose.vector);
    position = [-c[0], -c[1], -c[2]];
  } else {
    position = pose.vector;
  }
  if (axes === 'opengl') {
    // OpenGL camera axes are OpenCV's turned 180° about X: flip Y and Z.
    rotation = [
      rotation[0],
      -rotation[1],
      -rotation[2],
      rotation[3],
      -rotation[4],
      -rotation[5],
      rotation[6],
      -rotation[7],
      -rotation[8],
    ];
  }
  return { position, rotation };
}

/**
 * How well the cameras look at one common point: the least-squares point
 * nearest every optical axis, then the mean cosine between each camera's
 * forward direction and the direction to that point. 1 means every camera
 * looks straight at it; values near 0 or below mean no shared subject.
 */
export function convergenceScore(cameras: Array<{ position: Vec3; rotation: Mat3 }>): number {
  const a = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  const b = [0, 0, 0];
  const forwards = cameras.map(({ rotation }) =>
    normalize([rotation[2], rotation[5], rotation[8]])
  );
  cameras.forEach(({ position }, i) => {
    const d = forwards[i];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const m = (r === c ? 1 : 0) - d[r] * d[c];
        a[r * 3 + c] += m;
        b[r] += m * position[c];
      }
    }
  });
  const target = solve3(a as Mat3, b as Vec3);
  if (!target) {
    return 0;
  }
  let sum = 0;
  cameras.forEach(({ position }, i) => {
    const to = normalize([
      target[0] - position[0],
      target[1] - position[1],
      target[2] - position[2],
    ]);
    sum += forwards[i][0] * to[0] + forwards[i][1] * to[1] + forwards[i][2] * to[2];
  });
  return sum / cameras.length;
}

// ---------------------------------------------------------------- readers

function readVec3(value: unknown): Vec3 | undefined {
  const flat = flatNumbers(value);
  if (flat && flat.length === 3) {
    return [flat[0], flat[1], flat[2]];
  }
  if (isObject(value)) {
    const x = num(value.x);
    const y = num(value.y);
    const z = num(value.z);
    if (x !== undefined && y !== undefined && z !== undefined) {
      return [x, y, z];
    }
  }
  return undefined;
}

function readMatrix3(value: unknown): Mat3 | undefined {
  const flat = flatNumbers(value);
  if (!flat || flat.length !== 9) {
    return undefined;
  }
  return flat as Mat3;
}

/** A 3x4 or 4x4 [R|t], row-major (nested rows or flat). */
function readMatrix4(value: unknown): { rotation: Mat3; vector: Vec3 } | undefined {
  const flat = flatNumbers(value);
  if (!flat || (flat.length !== 16 && flat.length !== 12)) {
    return undefined;
  }
  return {
    rotation: [flat[0], flat[1], flat[2], flat[4], flat[5], flat[6], flat[8], flat[9], flat[10]],
    vector: [flat[3], flat[7], flat[11]],
  };
}

/**
 * Quaternion arrays: COLMAP `qvec` and anything marked wxyz are scalar-first;
 * everything else is read as x, y, z, w (three.js, scipy, ROS).
 */
function readQuaternion(scope: Record<string, unknown>, key: string): Mat3 | undefined {
  const value = scope[key];
  if (isObject(value)) {
    return readQuaternionFields(value, true);
  }
  const flat = flatNumbers(value);
  if (!flat || flat.length !== 4) {
    return undefined;
  }
  const order = String(
    scope.quaternion_order ?? scope.quat_order ?? scope.type ?? ''
  ).toLowerCase();
  const scalarFirst = key === 'qvec' || order.includes('wxyz') || order.includes('blender');
  const [w, x, y, z] = scalarFirst
    ? [flat[0], flat[1], flat[2], flat[3]]
    : [flat[3], flat[0], flat[1], flat[2]];
  return quaternionToMatrix(w, x, y, z);
}

/**
 * Quaternion as named fields. Bare w/x/y/z only counts inside a quaternion
 * object; on the camera itself x/y/z would be a position, so there it takes
 * the q-prefixed names.
 */
function readQuaternionFields(
  scope: Record<string, unknown>,
  allowBare: boolean
): Mat3 | undefined {
  const pick = (name: string) => num(scope[`q${name}`] ?? (allowBare ? scope[name] : undefined));
  const w = pick('w');
  const x = pick('x');
  const y = pick('y');
  const z = pick('z');
  if (w === undefined || x === undefined || y === undefined || z === undefined) {
    return undefined;
  }
  return quaternionToMatrix(w, x, y, z);
}

function quaternionToMatrix(w: number, x: number, y: number, z: number): Mat3 | undefined {
  const n = Math.hypot(w, x, y, z);
  if (!(n > 0)) {
    return undefined;
  }
  w /= n;
  x /= n;
  y /= n;
  z /= n;
  return [
    1 - 2 * (y * y + z * z),
    2 * (x * y - w * z),
    2 * (x * z + w * y),
    2 * (x * y + w * z),
    1 - 2 * (x * x + z * z),
    2 * (y * z - w * x),
    2 * (x * z - w * y),
    2 * (y * z + w * x),
    1 - 2 * (x * x + y * y),
  ];
}

function flatNumbers(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const out: number[] = [];
  for (const item of value) {
    if (Array.isArray(item)) {
      for (const inner of item) {
        if (typeof inner !== 'number' || !Number.isFinite(inner)) {
          return undefined;
        }
        out.push(inner);
      }
    } else if (typeof item === 'number' && Number.isFinite(item)) {
      out.push(item);
    } else {
      return undefined;
    }
  }
  return out;
}

// ---------------------------------------------------------------- math

function transpose(m: Mat3): Mat3 {
  return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
}

function mulVec(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

function normalize(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

function solve3(a: Mat3, b: Vec3): Vec3 | undefined {
  const det =
    a[0] * (a[4] * a[8] - a[5] * a[7]) -
    a[1] * (a[3] * a[8] - a[5] * a[6]) +
    a[2] * (a[3] * a[7] - a[4] * a[6]);
  if (Math.abs(det) < 1e-9) {
    return undefined;
  }
  const inv = [
    a[4] * a[8] - a[5] * a[7],
    a[2] * a[7] - a[1] * a[8],
    a[1] * a[5] - a[2] * a[4],
    a[5] * a[6] - a[3] * a[8],
    a[0] * a[8] - a[2] * a[6],
    a[2] * a[3] - a[0] * a[5],
    a[3] * a[7] - a[4] * a[6],
    a[1] * a[6] - a[0] * a[7],
    a[0] * a[4] - a[1] * a[3],
  ].map(x => x / det);
  return mulVec(inv as Mat3, b);
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
