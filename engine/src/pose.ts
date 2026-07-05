import * as THREE from 'three';

export interface PoseJoint {
  x: number;
  y: number;
  z: number;
  score?: number;
  valid?: boolean;
}

export interface PoseMeta {
  jointCount: number;
  edgeCount: number;
  fileName: string;
  invalidJoints?: number;
  // Dataset extras (Halpe or similar)
  jointColors?: [number, number, number][]; // normalized 0-1
  linkColors?: [number, number, number][]; // normalized 0-1
  keypointNames?: string[];
  skeletonLinks?: Array<[number, number]>;
  jointScores?: number[];
  jointUncertainties?: Array<[number, number, number]>;
}

export interface NormalizedPose {
  joints: PoseJoint[];
  edges: Array<[number, number]>;
}

/**
 * Everything the pose-visualization functions need from PointCloudVisualizer.
 */
export interface PoseHost {
  scene: THREE.Scene;
  spatialFiles: { length: number };
  poseGroups: THREE.Group[];
  poseMeta: PoseMeta[];
  poseJoints: PoseJoint[][];
  poseEdges: Array<Array<[number, number]>>;
  poseUseDatasetColors: boolean[];
  poseShowLabels: boolean[];
  poseScaleByScore: boolean[];
  poseScaleByUncertainty: boolean[];
  poseConvention: ('opencv' | 'opengl')[];
  poseMinScoreThreshold: number[];
  poseMaxUncertaintyThreshold: number[];
  poseLabelsGroups: (THREE.Group | null)[];
  individualColorModes: string[];
  pointSizes: number[];
  readonly fileColors: readonly [number, number, number][];
}

export function autoConnectKnn(
  joints: Array<{ x: number; y: number; z: number }>,
  k: number
): Array<[number, number]> {
  const edges: Array<[number, number]> = [];
  for (let i = 0; i < joints.length; i++) {
    const distances: Array<{ j: number; d: number }> = [];
    for (let j = 0; j < joints.length; j++) {
      if (i === j) {
        continue;
      }
      const dx = joints[i].x - joints[j].x;
      const dy = joints[i].y - joints[j].y;
      const dz = joints[i].z - joints[j].z;
      distances.push({ j, d: dx * dx + dy * dy + dz * dz });
    }
    distances.sort((a, b) => a.d - b.d);
    for (let n = 0; n < Math.min(k, distances.length); n++) {
      const j = distances[n].j;
      const a = Math.min(i, j);
      const b = Math.max(i, j);
      edges.push([a, b]);
    }
  }
  const set = new Set<string>();
  const dedup: Array<[number, number]> = [];
  for (const [a, b] of edges) {
    const key = `${a}-${b}`;
    if (!set.has(key)) {
      set.add(key);
      dedup.push([a, b]);
    }
  }
  return dedup;
}

export function normalizePose(raw: any): NormalizedPose {
  // If already in generic shape
  if (raw && Array.isArray(raw.joints) && Array.isArray(raw.edges)) {
    const joints = raw.joints.map((j: any) => {
      const hasX = j?.x !== null && j?.x !== undefined;
      const hasY = j?.y !== null && j?.y !== undefined;
      const hasZ = j?.z !== null && j?.z !== undefined;
      const x = hasX ? Number(j.x) : NaN;
      const y = hasY ? Number(j.y) : NaN;
      const z = hasZ ? Number(j.z) : NaN;
      const valid = hasX && hasY && hasZ && isFinite(x) && isFinite(y) && isFinite(z);
      return { x: valid ? x : 0, y: valid ? y : 0, z: valid ? z : 0, score: j.score, valid };
    });
    const edges = raw.edges.map((e: any) => [e[0] | 0, e[1] | 0] as [number, number]);
    return { joints, edges };
  }

  // Human3.6M-like: positions_3d + skeleton.connections (and optional confidence array)
  if (raw && Array.isArray(raw.positions_3d)) {
    const joints = raw.positions_3d.map((p: any, idx: number) => {
      const hasX = Array.isArray(p) && p.length > 0 && p[0] !== null && p[0] !== undefined;
      const hasY = Array.isArray(p) && p.length > 1 && p[1] !== null && p[1] !== undefined;
      const hasZ = Array.isArray(p) && p.length > 2 && p[2] !== null && p[2] !== undefined;
      const x = hasX ? Number(p[0]) : NaN;
      const y = hasY ? Number(p[1]) : NaN;
      const z = hasZ ? Number(p[2]) : NaN;
      const valid = hasX && hasY && hasZ && isFinite(x) && isFinite(y) && isFinite(z);
      return {
        x: valid ? x : 0,
        y: valid ? y : 0,
        z: valid ? z : 0,
        score:
          Array.isArray(raw.confidence) && typeof raw.confidence[idx] === 'number'
            ? +raw.confidence[idx]
            : undefined,
        valid,
      };
    });
    let edges: Array<[number, number]> = [];
    if (raw.skeleton && Array.isArray(raw.skeleton.connections)) {
      edges = raw.skeleton.connections.map((e: any) => [e[0] | 0, e[1] | 0] as [number, number]);
    } else if (Array.isArray(raw.connections)) {
      edges = raw.connections.map((e: any) => [e[0] | 0, e[1] | 0] as [number, number]);
    } else {
      edges = autoConnectKnn(joints, 2);
    }
    return { joints, edges };
  }

  // Halpe meta format: meta_info + instance_info array
  if (raw && raw.meta_info && Array.isArray(raw.instance_info)) {
    // Use skeleton_links when available
    const links: Array<[number, number]> = Array.isArray(raw.meta_info.skeleton_links)
      ? raw.meta_info.skeleton_links.map((e: any) => [e[0] | 0, e[1] | 0] as [number, number])
      : [];

    // If multiple instances, we only normalize the first here; caller will split if needed
    const inst = raw.instance_info[0];
    const rawKpts: any[] = Array.isArray(inst?.keypoints) ? inst.keypoints : [];
    const joints: PoseJoint[] = rawKpts.map((p: any, idx: number) => {
      const hasX = Array.isArray(p) && p.length > 0 && p[0] !== null && p[0] !== undefined;
      const hasY = Array.isArray(p) && p.length > 1 && p[1] !== null && p[1] !== undefined;
      const hasZ = Array.isArray(p) && p.length > 2 && p[2] !== null && p[2] !== undefined;
      const x = hasX ? Number(p[0]) : NaN;
      const y = hasY ? Number(p[1]) : NaN;
      const z = hasZ ? Number(p[2]) : NaN;
      const isValid = hasX && hasY && hasZ && isFinite(x) && isFinite(y) && isFinite(z);
      const score =
        Array.isArray(inst.keypoint_scores) && typeof inst.keypoint_scores[idx] === 'number'
          ? Number(inst.keypoint_scores[idx])
          : undefined;
      return {
        x: isValid ? x : 0,
        y: isValid ? y : 0,
        z: isValid ? z : 0,
        score,
        valid: isValid,
      };
    });

    // Filter edges to valid joint indices
    const edges = (links.length > 0 ? links : autoConnectKnn(joints, 2)).filter(
      ([a, b]) => a >= 0 && a < joints.length && b >= 0 && b < joints.length
    );
    // Attach dataset extras to the last meta entry provisionally (will be moved per-pose)
    const toColor = (arr: any): [number, number, number][] => {
      if (!arr || !Array.isArray(arr.__ndarray__)) {
        return [];
      }
      return arr.__ndarray__.map((rgb: number[]) => [rgb[0] / 255, rgb[1] / 255, rgb[2] / 255]);
    };
    const jointColors = toColor(raw.meta_info.keypoint_colors);
    const linkColors = toColor(raw.meta_info.skeleton_link_colors);
    // Store on a temporary field of raw to pass through
    (raw as any).__poseExtras = {
      jointColors,
      linkColors,
      keypointNames: raw.meta_info.keypoint_id2name,
      skeletonLinks: links,
    };
    return { joints, edges };
  }

  // OpenPose / Halpe flat arrays: people[0].pose_keypoints_3d or _2d
  if (raw && Array.isArray(raw.people) && raw.people.length > 0) {
    const p = raw.people[0];
    const arr = p.pose_keypoints_3d || p.pose_keypoints_2d;
    if (Array.isArray(arr)) {
      const step = p.pose_keypoints_3d ? 4 : 3; // x,y,z,(c?) or x,y,c
      const joints: PoseJoint[] = [];
      for (let i = 0; i + (step - 1) < arr.length; i += step) {
        const hasX = arr[i] !== null && arr[i] !== undefined;
        const hasY = arr[i + 1] !== null && arr[i + 1] !== undefined;
        const hasZ = step === 4 ? arr[i + 2] !== null && arr[i + 2] !== undefined : true;
        const x = hasX ? Number(arr[i]) : NaN;
        const y = hasY ? Number(arr[i + 1]) : NaN;
        const z = step === 4 ? (hasZ ? Number(arr[i + 2]) : NaN) : 0;
        const cRaw = step === 4 ? arr[i + 3] : arr[i + 2];
        const c = Number(cRaw);
        const valid =
          hasX &&
          hasY &&
          (step === 4 ? hasZ : true) &&
          isFinite(x) &&
          isFinite(y) &&
          (step === 4 ? isFinite(z) : true);
        joints.push({
          x: valid ? x : 0,
          y: valid ? y : 0,
          z: valid ? z : 0,
          score: isFinite(c) ? c : undefined,
          valid,
        });
      }
      let edges: Array<[number, number]> = [];
      if (Array.isArray((raw as any).connections)) {
        edges = (raw as any).connections.map((e: any) => [e[0] | 0, e[1] | 0] as [number, number]);
      } else {
        edges = autoConnectKnn(joints, 2);
      }
      return { joints, edges };
    }
  }

  // COCO-like flat keypoints
  if (raw && Array.isArray(raw.keypoints)) {
    const arr = raw.keypoints;
    const step = arr.length % 4 === 0 ? 4 : 3;
    const joints: PoseJoint[] = [];
    for (let i = 0; i + (step - 1) < arr.length; i += step) {
      const hasX = arr[i] !== null && arr[i] !== undefined;
      const hasY = arr[i + 1] !== null && arr[i + 1] !== undefined;
      const hasZ = step === 4 ? arr[i + 2] !== null && arr[i + 2] !== undefined : true;
      const x = hasX ? Number(arr[i]) : NaN;
      const y = hasY ? Number(arr[i + 1]) : NaN;
      const z = step === 4 ? (hasZ ? Number(arr[i + 2]) : NaN) : 0;
      const cRaw = step === 4 ? arr[i + 3] : arr[i + 2];
      const c = Number(cRaw);
      const valid =
        hasX &&
        hasY &&
        (step === 4 ? hasZ : true) &&
        isFinite(x) &&
        isFinite(y) &&
        (step === 4 ? isFinite(z) : true);
      joints.push({
        x: valid ? x : 0,
        y: valid ? y : 0,
        z: valid ? z : 0,
        score: isFinite(c) ? c : undefined,
        valid,
      });
    }
    const edges = Array.isArray((raw as any).connections)
      ? (raw as any).connections.map((e: any) => [e[0] | 0, e[1] | 0] as [number, number])
      : autoConnectKnn(joints, 2);
    return { joints, edges };
  }

  // Generic arrays
  if (raw && Array.isArray(raw.points)) {
    const joints = raw.points.map((p: any) => {
      const rx = Array.isArray(p) ? p[0] : p?.x;
      const ry = Array.isArray(p) ? p[1] : p?.y;
      const rz = Array.isArray(p) ? p[2] : p?.z;
      const hasX = rx !== null && rx !== undefined;
      const hasY = ry !== null && ry !== undefined;
      const hasZ = rz !== null && rz !== undefined;
      const x = hasX ? Number(rx) : NaN;
      const y = hasY ? Number(ry) : NaN;
      const z = hasZ ? Number(rz) : NaN;
      const valid = hasX && hasY && hasZ && isFinite(x) && isFinite(y) && isFinite(z);
      return { x: valid ? x : 0, y: valid ? y : 0, z: valid ? z : 0, valid };
    });
    const edges = Array.isArray(raw.connections)
      ? raw.connections.map((e: any) => [e[0] | 0, e[1] | 0] as [number, number])
      : autoConnectKnn(joints, 2);
    return { joints, edges };
  }

  // Last resort: array of [x,y,(z)]
  if (Array.isArray(raw) && raw.length && Array.isArray(raw[0])) {
    const joints = raw.map((p: any[]) => {
      const hasX = Array.isArray(p) && p.length > 0 && p[0] !== null && p[0] !== undefined;
      const hasY = Array.isArray(p) && p.length > 1 && p[1] !== null && p[1] !== undefined;
      const hasZ = Array.isArray(p) && p.length > 2 && p[2] !== null && p[2] !== undefined;
      const x = hasX ? Number(p[0]) : NaN;
      const y = hasY ? Number(p[1]) : NaN;
      const z = hasZ ? Number(p[2]) : NaN;
      const valid = hasX && hasY && (hasZ ? isFinite(z) : true) && isFinite(x) && isFinite(y);
      return { x: valid ? x : 0, y: valid ? y : 0, z: valid ? (isFinite(z) ? z : 0) : 0, valid };
    });
    const edges = autoConnectKnn(joints, 2);
    return { joints, edges };
  }
  throw new Error('Unsupported pose JSON structure');
}

export function buildPoseGroup(host: PoseHost, pose: NormalizedPose): THREE.Group {
  const group = new THREE.Group();
  const unifiedIndex = host.spatialFiles.length + host.poseGroups.length;
  // Default pose color: use assigned color for this index
  const colorMode = host.individualColorModes[unifiedIndex] ?? 'assigned';
  let baseRGB: [number, number, number];
  if (colorMode === 'assigned') {
    baseRGB = host.fileColors[unifiedIndex % host.fileColors.length] as [number, number, number];
  } else {
    const colorIndex = parseInt(colorMode as string);
    if (!isNaN(colorIndex) && colorIndex >= 0 && colorIndex < host.fileColors.length) {
      baseRGB = host.fileColors[colorIndex] as [number, number, number];
    } else {
      baseRGB = host.fileColors[unifiedIndex % host.fileColors.length] as [number, number, number];
    }
  }
  const baseColor = new THREE.Color(baseRGB[0], baseRGB[1], baseRGB[2]);

  // Joints as instanced spheres (only for valid joints)
  const radius = host.pointSizes[unifiedIndex] ?? 0.02; // 2 cm default
  const sphereGeo = new THREE.SphereGeometry(1, 12, 12);
  const mat = new THREE.MeshBasicMaterial({ color: baseColor, transparent: true, opacity: 0.95 });
  const validJointIndices: number[] = [];
  for (let i = 0; i < pose.joints.length; i++) {
    const p = pose.joints[i] as any;
    if (p && p.valid === true) {
      validJointIndices.push(i);
    }
  }
  const inst = new THREE.InstancedMesh(sphereGeo, mat, validJointIndices.length);
  const dummy = new THREE.Object3D();
  for (let k = 0; k < validJointIndices.length; k++) {
    const p = pose.joints[validJointIndices[k]];
    dummy.position.set(p.x, p.y, p.z);
    dummy.scale.setScalar(radius);
    dummy.updateMatrix();
    inst.setMatrixAt(k, dummy.matrix);
  }
  inst.instanceMatrix.needsUpdate = true;
  group.add(inst);
  // Store mapping and references for later updates
  (group as any).userData = (group as any).userData || {};
  (group as any).userData.validJointIndices = validJointIndices.slice();
  (group as any).userData.instancedMesh = inst;

  // Edges as line segments (skip invalid joints)
  if (pose.edges.length > 0) {
    const tempPositions: number[] = [];
    for (const [a, b] of pose.edges) {
      const pa = pose.joints[a] as any;
      const pb = pose.joints[b] as any;
      if (!(pa && pb)) {
        continue;
      }
      if (pa.valid !== true || pb.valid !== true) {
        continue;
      }
      // Also skip edges where endpoint equals origin due to sanitized NaN
      const aIsOrigin = pa.x === 0 && pa.y === 0 && pa.z === 0;
      const bIsOrigin = pb.x === 0 && pb.y === 0 && pb.z === 0;
      if (aIsOrigin || bIsOrigin) {
        continue;
      }
      tempPositions.push(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z);
    }
    const lineGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(tempPositions);
    if (positions.length > 0) {
      lineGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    } else {
      lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3));
    }
    const lineMat = new THREE.LineBasicMaterial({
      color: baseColor,
      transparent: true,
      opacity: 0.8,
    });
    const lines = new THREE.LineSegments(lineGeo, lineMat);
    group.add(lines);
    (group as any).userData.lineSegments = lines;
  }

  return group;
}

export function updatePoseAppearance(host: PoseHost, fileIndex: number): void {
  const poseIndex = fileIndex - host.spatialFiles.length;
  if (poseIndex < 0 || poseIndex >= host.poseGroups.length) {
    return;
  }
  const group = host.poseGroups[poseIndex];
  const meta = host.poseMeta[poseIndex];
  const useDataset = host.poseUseDatasetColors[fileIndex];
  const paletteColor = host.fileColors[fileIndex % host.fileColors.length];
  group.traverse(obj => {
    if ((obj as any).isInstancedMesh && obj instanceof THREE.InstancedMesh) {
      const material = obj.material as THREE.MeshBasicMaterial;
      if (useDataset && meta.jointColors && meta.jointColors.length > 0) {
        // Apply per-instance colors
        const count = obj.count;
        const colors = new Float32Array(count * 3);
        for (let k = 0; k < count; k++) {
          const c = meta.jointColors[k % meta.jointColors.length];
          colors[k * 3] = c[0];
          colors[k * 3 + 1] = c[1];
          colors[k * 3 + 2] = c[2];
        }
        obj.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
        if (obj.instanceColor) {
          (obj.instanceColor as any).needsUpdate = true;
        }
        material.vertexColors = true;
        material.needsUpdate = true;
      } else {
        // Use single color
        obj.instanceColor = null;
        material.vertexColors = false;
        material.color.setRGB(paletteColor[0], paletteColor[1], paletteColor[2]);
        material.needsUpdate = true;
      }
    } else if ((obj as any).isLineSegments && obj instanceof THREE.LineSegments) {
      const material = obj.material as THREE.LineBasicMaterial;
      if (useDataset && meta.linkColors && meta.linkColors.length > 0) {
        // Build a new color buffer matching current positions
        const posAttr = obj.geometry.getAttribute('position') as THREE.BufferAttribute;
        const segCount = posAttr.count / 2;
        const colors = new Float32Array(posAttr.count * 3);
        for (let s = 0; s < segCount; s++) {
          const lc = meta.linkColors[s % meta.linkColors.length];
          // two vertices per segment
          colors[2 * s * 3] = lc[0];
          colors[2 * s * 3 + 1] = lc[1];
          colors[2 * s * 3 + 2] = lc[2];
          colors[(2 * s + 1) * 3] = lc[0];
          colors[(2 * s + 1) * 3 + 1] = lc[1];
          colors[(2 * s + 1) * 3 + 2] = lc[2];
        }
        // Remove old color attribute first to avoid interleaved conflicts
        if (obj.geometry.getAttribute('color')) {
          obj.geometry.deleteAttribute('color');
        }
        obj.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        material.vertexColors = true;
        material.needsUpdate = true;
      } else {
        // Remove per-vertex colors and set solid color
        if (obj.geometry.getAttribute('color')) {
          obj.geometry.deleteAttribute('color');
        }
        material.vertexColors = false;
        material.color.setRGB(paletteColor[0], paletteColor[1], paletteColor[2]);
        material.needsUpdate = true;
      }
    }
  });
}

export function updatePoseLabels(host: PoseHost, fileIndex: number): void {
  const poseIndex = fileIndex - host.spatialFiles.length;
  if (poseIndex < 0 || poseIndex >= host.poseGroups.length) {
    return;
  }
  const show = host.poseShowLabels[fileIndex];
  const group = host.poseGroups[poseIndex];
  const joints = host.poseJoints[poseIndex] || [];
  const validMap: number[] = (group as any).userData?.validJointIndices || [];
  // Remove existing labels
  const existing = host.poseLabelsGroups[poseIndex];
  if (existing) {
    host.scene.remove(existing);
    host.poseLabelsGroups[poseIndex] = null;
  }
  if (!show) {
    return;
  }
  // Build a new labels group using simple Sprites
  const labelsGroup = new THREE.Group();
  const meta = host.poseMeta[poseIndex];
  const names = meta.keypointNames || [];
  const count = validMap.length > 0 ? validMap.length : joints.length;
  const makeLabel = (text: string): THREE.Sprite => {
    const canvas = document.createElement('canvas');
    const size = 256;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#ffffff';
    ctx.font = '48px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, size / 2, size / 2);
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, depthTest: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(0.1, 0.1, 1); // 10cm label size
    return sprite;
  };
  for (let k = 0; k < count; k++) {
    const originalIndex = validMap.length === count ? validMap[k] : k;
    const j = joints[originalIndex];
    if (!j || j.valid !== true) {
      continue;
    }
    const label = makeLabel(names[originalIndex] || `${originalIndex}`);
    label.position.set(j.x, j.y + (host.pointSizes[fileIndex] ?? 0.02) * 1.5, j.z);
    labelsGroup.add(label);
  }
  host.scene.add(labelsGroup);
  host.poseLabelsGroups[poseIndex] = labelsGroup;
}

export function updatePoseScaling(host: PoseHost, fileIndex: number): void {
  const poseIndex = fileIndex - host.spatialFiles.length;
  if (poseIndex < 0 || poseIndex >= host.poseGroups.length) {
    return;
  }
  const group = host.poseGroups[poseIndex];
  const baseRadius = host.pointSizes[fileIndex] ?? 0.02;
  const scaleByScore = host.poseScaleByScore[fileIndex];
  const scaleByUnc = host.poseScaleByUncertainty[fileIndex];
  // Fetch scores/uncertainties if available
  const meta = host.poseMeta[poseIndex];
  // Traverse instances and update scales
  group.traverse(obj => {
    if ((obj as any).isInstancedMesh && obj instanceof THREE.InstancedMesh) {
      const count = obj.count;
      const dummy = new THREE.Object3D();
      for (let k = 0; k < count; k++) {
        obj.getMatrixAt(k, dummy.matrix);
        dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
        let factor = 1.0;
        if (
          scaleByScore &&
          meta.jointScores &&
          meta.jointScores[k] != null &&
          isFinite(meta.jointScores[k]!)
        ) {
          const s = Math.max(0.01, Math.min(1.0, meta.jointScores[k]!));
          factor *= 0.5 + 0.5 * s; // 0.5x .. 1x
        }
        if (scaleByUnc && meta.jointUncertainties && meta.jointUncertainties[k]) {
          const u = meta.jointUncertainties[k];
          const mag = Math.sqrt(u[0] * u[0] + u[1] * u[1] + u[2] * u[2]);
          const mapped = 1.0 / (1.0 + mag); // higher uncertainty → smaller
          factor *= 0.5 + 0.5 * mapped;
        }
        dummy.scale.setScalar(baseRadius * factor);
        dummy.updateMatrix();
        obj.setMatrixAt(k, dummy.matrix);
      }
      obj.instanceMatrix.needsUpdate = true;
    }
  });
}

export function applyPoseConvention(
  host: PoseHost,
  fileIndex: number,
  conv: 'opengl' | 'opencv'
): void {
  const poseIndex = fileIndex - host.spatialFiles.length;
  if (poseIndex < 0 || poseIndex >= host.poseGroups.length) {
    return;
  }
  const group = host.poseGroups[poseIndex];
  const prev = host.poseConvention[fileIndex] || 'opengl';
  if (prev === conv) {
    return;
  } // already applied
  // Toggle flip each time we switch; inverse = same flip
  const mat = new THREE.Matrix4().set(1, 0, 0, 0, 0, -1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1);
  group.applyMatrix4(mat);
  group.updateMatrixWorld(true);
  host.poseConvention[fileIndex] = conv;
}

export function applyPoseFilters(host: PoseHost, fileIndex: number): void {
  const poseIndex = fileIndex - host.spatialFiles.length;
  if (poseIndex < 0 || poseIndex >= host.poseGroups.length) {
    return;
  }
  const group = host.poseGroups[poseIndex];
  const meta = host.poseMeta[poseIndex];
  const minScore = host.poseMinScoreThreshold[fileIndex] ?? 0;
  const maxUnc = host.poseMaxUncertaintyThreshold[fileIndex] ?? 1;
  // Compute uncertainty magnitude per joint if available
  const uncMag = (meta.jointUncertainties || []).map(u =>
    Math.sqrt(u[0] * u[0] + u[1] * u[1] + u[2] * u[2])
  );
  group.traverse(obj => {
    if ((obj as any).isInstancedMesh && obj instanceof THREE.InstancedMesh) {
      const count = obj.count;
      const dummy = new THREE.Object3D();
      // Map instance index back to original joint index
      const validMap: number[] = (group as any).userData?.validJointIndices || [];
      for (let k = 0; k < count; k++) {
        obj.getMatrixAt(k, dummy.matrix);
        dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
        // Determine visibility by thresholds
        let visible = true;
        const originalIndex = validMap.length === count ? validMap[k] : k;
        if (
          meta.jointScores &&
          meta.jointScores[originalIndex] != null &&
          isFinite(meta.jointScores[originalIndex]!)
        ) {
          if (meta.jointScores[originalIndex]! < minScore) {
            visible = false;
          }
        }
        if (uncMag && uncMag[originalIndex] != null && isFinite(uncMag[originalIndex]!)) {
          if (uncMag[originalIndex]! > maxUnc) {
            visible = false;
          }
        }
        const targetScale = visible ? (host.pointSizes[fileIndex] ?? 0.02) : 0;
        dummy.scale.setScalar(targetScale);
        dummy.updateMatrix();
        obj.setMatrixAt(k, dummy.matrix);
      }
      obj.instanceMatrix.needsUpdate = true;
    } else if ((obj as any).isLineSegments && obj instanceof THREE.LineSegments) {
      // Rebuild edges to drop hidden joints based on thresholds
      const joints = host.poseJoints[poseIndex] || [];
      const edges = host.poseEdges[poseIndex] || [];
      const hidden = new Set<number>();
      // Determine hidden joints via thresholds
      const uncMagArr = (meta.jointUncertainties || []).map(u =>
        Math.sqrt(u[0] * u[0] + u[1] * u[1] + u[2] * u[2])
      );
      for (let k = 0; k < joints.length; k++) {
        const scoreOk = !(
          meta.jointScores &&
          meta.jointScores[k] != null &&
          isFinite(meta.jointScores[k]!) &&
          meta.jointScores[k]! < minScore
        );
        const uncOk = !(
          uncMagArr &&
          uncMagArr[k] != null &&
          isFinite(uncMagArr[k]!) &&
          uncMagArr[k]! > maxUnc
        );
        const visible = scoreOk && uncOk && joints[k] && joints[k].valid === true;
        if (!visible) {
          hidden.add(k);
        }
      }
      const tempPositions: number[] = [];
      for (const [a, b] of edges) {
        if (hidden.has(a) || hidden.has(b)) {
          continue;
        }
        const pa = joints[a];
        const pb = joints[b];
        if (!pa || !pb) {
          continue;
        }
        tempPositions.push(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z);
      }
      const newGeo = new THREE.BufferGeometry();
      newGeo.setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array(tempPositions), 3)
      );
      obj.geometry.dispose();
      obj.geometry = newGeo;
    }
  });
}
