import * as THREE from 'three';

/**
 * One camera keyframe of the video-mode timeline. All vectors are world-space
 * arrays so a keyframe project serializes to JSON as-is.
 */
export interface CameraKeyframe {
  name: string;
  position: [number, number, number];
  target: [number, number, number];
  /** Camera orientation at capture time (redundant with position/target/up but exact). */
  quaternion: [number, number, number, number];
  fov: number;
  /** Seconds traveling from this keyframe to the next one. */
  duration: number;
  /** Seconds holding still at this keyframe before traveling on. */
  dwell: number;
}

export interface TimelineSample {
  position: THREE.Vector3;
  target: THREE.Vector3;
  up: THREE.Vector3;
  fov: number;
}

/**
 * Total timeline length. With `loop`, the last keyframe's duration is the
 * travel time of the closing segment back to the first keyframe (so loops fly
 * home along the path instead of teleporting).
 */
export function timelineDuration(keyframes: CameraKeyframe[], loop = false): number {
  let total = 0;
  for (let i = 0; i < keyframes.length; i++) {
    total += Math.max(0, keyframes[i].dwell);
    if (i < keyframes.length - 1 || (loop && keyframes.length > 1)) {
      total += Math.max(0.01, keyframes[i].duration);
    }
  }
  return total;
}

/** Uniform Catmull-Rom basis for one segment (p1 → p2 with p0/p3 as tangent hints). */
function catmullRomComponent(p0: number, p1: number, p2: number, p3: number, u: number): number {
  const u2 = u * u;
  const u3 = u2 * u;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * u +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * u3)
  );
}

function catmullRom(
  points: Array<[number, number, number]>,
  segment: number,
  u: number,
  loop: boolean
): THREE.Vector3 {
  const n = points.length;
  const wrap = (i: number) => ((i % n) + n) % n;
  const p0 = loop ? points[wrap(segment - 1)] : points[Math.max(0, segment - 1)];
  const p1 = points[segment];
  const p2 = points[wrap(segment + 1)];
  const p3 = loop ? points[wrap(segment + 2)] : points[Math.min(n - 1, segment + 2)];
  return new THREE.Vector3(
    catmullRomComponent(p0[0], p1[0], p2[0], p3[0], u),
    catmullRomComponent(p0[1], p1[1], p2[1], p3[1], u),
    catmullRomComponent(p0[2], p1[2], p2[2], p3[2], u)
  );
}

/**
 * Per-segment time easing driven by the boundary conditions: ease only where
 * the camera actually rests (dwell > 0, or the non-loop path ends). Keyframes
 * with dwell 0 are flown through at speed instead of decelerating to a stop —
 * the easing curves have zero derivative only on eased ends and slope 1 on
 * flow-through ends.
 */
function segmentEase(u: number, easeIn: boolean, easeOut: boolean): number {
  if (easeIn && easeOut) {
    return u * u * (3 - 2 * u); // smoothstep
  }
  if (easeIn) {
    return u * u * (2 - u); // f'(0)=0, f'(1)=1
  }
  if (easeOut) {
    const v = 1 - u;
    return 1 - v * v * (2 - v); // f'(0)=1, f'(1)=0
  }
  return u;
}

function keyframePose(key: CameraKeyframe): TimelineSample {
  const q = new THREE.Quaternion().fromArray(key.quaternion);
  return {
    position: new THREE.Vector3().fromArray(key.position),
    target: new THREE.Vector3().fromArray(key.target),
    up: new THREE.Vector3(0, 1, 0).applyQuaternion(q),
    fov: key.fov,
  };
}

/**
 * Preserve distance for a pure orbit segment. Interpolating the two world
 * positions directly follows a chord (or a Cartesian spline close to it),
 * which looks like a zoom toward the target before the camera rotates.
 */
function orbitPosition(
  from: CameraKeyframe,
  to: CameraKeyframe,
  interpolatedTarget: THREE.Vector3,
  u: number
): THREE.Vector3 | null {
  const targetA = new THREE.Vector3().fromArray(from.target);
  const targetB = new THREE.Vector3().fromArray(to.target);
  const offsetA = new THREE.Vector3().fromArray(from.position).sub(targetA);
  const offsetB = new THREE.Vector3().fromArray(to.position).sub(targetB);
  const radiusA = offsetA.length();
  const radiusB = offsetB.length();
  const scale = Math.max(1, radiusA, radiusB);

  // This branch is deliberately narrow: only poses that are effectively the
  // same orbit qualify. Dolly shots and moving-target shots retain the normal
  // world-space spline.
  if (
    radiusA < 1e-9 ||
    radiusB < 1e-9 ||
    targetA.distanceTo(targetB) > scale * 1e-4 ||
    Math.abs(radiusA - radiusB) > scale * 1e-4
  ) {
    return null;
  }

  const directionA = offsetA.multiplyScalar(1 / radiusA);
  const directionB = offsetB.multiplyScalar(1 / radiusB);
  const rotation = new THREE.Quaternion().setFromUnitVectors(directionA, directionB);
  const direction = directionA
    .clone()
    .applyQuaternion(new THREE.Quaternion().slerpQuaternions(new THREE.Quaternion(), rotation, u))
    .normalize();
  const radius = THREE.MathUtils.lerp(radiusA, radiusB, u);
  return interpolatedTarget.clone().addScaledVector(direction, radius);
}

/**
 * Evaluate the camera timeline at time `t` (seconds from the start).
 *
 * Positions and targets normally follow a Catmull-Rom spline through the
 * keyframes so the camera flows through intermediate keyframes without hard
 * corners. Pure rotations around a shared target use spherical interpolation
 * of the camera offset instead, preserving their captured orbit radius;
 * orientation is a per-segment quaternion slerp (the sampled `up` is derived
 * from the slerped quaternion); FOV interpolates linearly. Easing is boundary
 * dependent (see segmentEase): motion only slows into keyframes where it
 * actually rests. With `loop`, a closing segment travels from the last
 * keyframe back to the first (using the last keyframe's duration) and the
 * spline wraps, so a looping path is seamless.
 */
export function sampleTimeline(
  keyframes: CameraKeyframe[],
  t: number,
  loop = false
): TimelineSample {
  if (keyframes.length === 0) {
    throw new Error('sampleTimeline called with no keyframes');
  }
  const n = keyframes.length;
  if (n === 1) {
    return keyframePose(keyframes[0]);
  }

  const positions = keyframes.map(k => k.position);
  const targets = keyframes.map(k => k.target);

  let remaining = Math.max(0, t);
  for (let i = 0; i < n; i++) {
    const dwell = Math.max(0, keyframes[i].dwell);
    if (remaining < dwell) {
      return keyframePose(keyframes[i]);
    }
    remaining -= dwell;

    const isLast = i === n - 1;
    if (isLast && !loop) {
      return keyframePose(keyframes[i]);
    }

    const j = (i + 1) % n;
    const duration = Math.max(0.01, keyframes[i].duration);
    if (remaining < duration) {
      const easeIn = keyframes[i].dwell > 0 || (i === 0 && !loop);
      const easeOut = keyframes[j].dwell > 0 || (!loop && j === n - 1);
      const u = segmentEase(remaining / duration, easeIn, easeOut);
      const qa = new THREE.Quaternion().fromArray(keyframes[i].quaternion);
      const qb = new THREE.Quaternion().fromArray(keyframes[j].quaternion);
      const q = qa.slerp(qb, u);
      const target = catmullRom(targets, i, u, loop);
      const position =
        orbitPosition(keyframes[i], keyframes[j], target, u) ?? catmullRom(positions, i, u, loop);
      return {
        position,
        target,
        up: new THREE.Vector3(0, 1, 0).applyQuaternion(q),
        fov: THREE.MathUtils.lerp(keyframes[i].fov, keyframes[j].fov, u),
      };
    }
    remaining -= duration;
  }

  // Past the end: a looping timeline lands back on the first keyframe.
  return keyframePose(keyframes[loop ? 0 : n - 1]);
}

/** Validate parsed JSON into a keyframe list; returns null when malformed. */
export function parseKeyframeProject(data: unknown): CameraKeyframe[] | null {
  const isVec = (v: unknown, n: number) =>
    Array.isArray(v) && v.length === n && v.every(x => typeof x === 'number' && Number.isFinite(x));

  const list = (data as any)?.keyframes;
  if (!Array.isArray(list) || list.length === 0) {
    return null;
  }
  const result: CameraKeyframe[] = [];
  for (let i = 0; i < list.length; i++) {
    const k = list[i];
    if (!isVec(k?.position, 3) || !isVec(k?.target, 3) || !isVec(k?.quaternion, 4)) {
      return null;
    }
    result.push({
      name: typeof k.name === 'string' ? k.name : `Keyframe ${i + 1}`,
      position: k.position,
      target: k.target,
      quaternion: k.quaternion,
      fov: typeof k.fov === 'number' && Number.isFinite(k.fov) ? k.fov : 75,
      duration: typeof k.duration === 'number' && k.duration > 0 ? k.duration : 2,
      dwell: typeof k.dwell === 'number' && k.dwell >= 0 ? k.dwell : 0,
    });
  }
  return result;
}
