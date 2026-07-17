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

export function timelineDuration(keyframes: CameraKeyframe[]): number {
  let total = 0;
  for (let i = 0; i < keyframes.length; i++) {
    total += Math.max(0, keyframes[i].dwell);
    if (i < keyframes.length - 1) {
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
  u: number
): THREE.Vector3 {
  const p0 = points[Math.max(0, segment - 1)];
  const p1 = points[segment];
  const p2 = points[segment + 1];
  const p3 = points[Math.min(points.length - 1, segment + 2)];
  return new THREE.Vector3(
    catmullRomComponent(p0[0], p1[0], p2[0], p3[0], u),
    catmullRomComponent(p0[1], p1[1], p2[1], p3[1], u),
    catmullRomComponent(p0[2], p1[2], p2[2], p3[2], u)
  );
}

function smoothstep(u: number): number {
  return u * u * (3 - 2 * u);
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
 * Evaluate the camera timeline at time `t` (seconds from the start).
 *
 * Positions and targets follow a Catmull-Rom spline through the keyframes so
 * the camera flows through intermediate keyframes without hard corners;
 * orientation is a per-segment quaternion slerp (the sampled `up` is derived
 * from the slerped quaternion); FOV interpolates linearly. Each travel
 * segment is eased with smoothstep so motion starts and ends gently, which
 * also makes dwells look deliberate rather than like stalls.
 */
export function sampleTimeline(keyframes: CameraKeyframe[], t: number): TimelineSample {
  if (keyframes.length === 0) {
    throw new Error('sampleTimeline called with no keyframes');
  }

  const positions = keyframes.map(k => k.position);
  const targets = keyframes.map(k => k.target);

  let remaining = Math.max(0, t);
  for (let i = 0; i < keyframes.length; i++) {
    const dwell = Math.max(0, keyframes[i].dwell);
    if (remaining < dwell || i === keyframes.length - 1) {
      return keyframePose(keyframes[i]);
    }
    remaining -= dwell;

    const duration = Math.max(0.01, keyframes[i].duration);
    if (remaining < duration) {
      const u = smoothstep(remaining / duration);
      const qa = new THREE.Quaternion().fromArray(keyframes[i].quaternion);
      const qb = new THREE.Quaternion().fromArray(keyframes[i + 1].quaternion);
      const q = qa.slerp(qb, u);
      return {
        position: catmullRom(positions, i, u),
        target: catmullRom(targets, i, u),
        up: new THREE.Vector3(0, 1, 0).applyQuaternion(q),
        fov: THREE.MathUtils.lerp(keyframes[i].fov, keyframes[i + 1].fov, u),
      };
    }
    remaining -= duration;
  }

  return keyframePose(keyframes[keyframes.length - 1]);
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
