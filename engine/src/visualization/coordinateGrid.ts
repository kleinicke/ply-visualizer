import * as THREE from 'three';

export interface GridProjection {
  lines: { x1: number; y1: number; x2: number; y2: number }[];
  labels: { x: number; y: number; text: string; axis: number }[];
}

/** A small number of readable ticks, including for flat and very small scenes. */
export function coordinateTicks(min: number, max: number): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) {return [];}
  const span = max - min || Math.max(Math.abs(min) * 0.1, 1);
  const power = 10 ** Math.floor(Math.log10(span / 5));
  const ratio = span / 5 / power;
  const step = (ratio <= 1 ? 1 : ratio <= 2 ? 2 : ratio <= 5 ? 5 : 10) * power;
  const start = Math.floor(min / step);
  const end = Math.max(start + 1, Math.ceil(max / step));
  return Array.from({ length: Math.min(12, end - start + 1) }, (_, i) => (start + i) * step);
}

export function formatCoordinate(value: number): string {
  if (value === 0) {return '0';}
  return Number(value.toPrecision(12)).toString();
}

/** Uses cached geometry bounds; never walks point arrays during camera movement. */
export function projectCoordinateGrid(host: any, width: number, height: number): GridProjection {
  const result: GridProjection = { lines: [], labels: [] };
  const bounds = new THREE.Box3();
  for (const [index, mesh] of host.meshes.entries()) {
    if (!mesh || !mesh.visible || host.fileVisibility[index] === false) {continue;}
    mesh.updateWorldMatrix(true, true);
    bounds.union(new THREE.Box3().setFromObject(mesh));
  }
  if (bounds.isEmpty()) {return result;}
  const ticks = [0, 1, 2].map(axis =>
    coordinateTicks(bounds.min.getComponent(axis), bounds.max.getComponent(axis))
  );
  if (ticks.some(values => values.length < 2)) {return result;}
  const low = ticks.map(values => values[0]);
  const high = ticks.map(values => values[values.length - 1]);
  host.camera.updateMatrixWorld();
  const camera = host.camera.getWorldPosition(new THREE.Vector3());
  const back = low.map((v, axis) =>
    camera.getComponent(axis) > (v + high[axis]) / 2 ? v : high[axis]
  );
  const project = (point: number[]) => {
    const p = new THREE.Vector3(...point).project(host.camera);
    if (!Number.isFinite(p.x + p.y + p.z) || p.z < -1 || p.z > 1) {return null;}
    return { x: ((p.x + 1) * width) / 2, y: ((1 - p.y) * height) / 2 };
  };
  // Three rear box walls keep the grid legible as the camera rotates.
  for (let fixed = 0; fixed < 3; fixed++) {
    const axes = [0, 1, 2].filter(axis => axis !== fixed);
    for (const axis of axes) {
      const other = axes.find(value => value !== axis)!;
      for (const tick of ticks[axis]) {
        const a = [...back];
        const b = [...back];
        a[axis] = b[axis] = tick;
        a[other] = low[other];
        b[other] = high[other];
        const p = project(a),
          q = project(b);
        if (p && q) {result.lines.push({ x1: p.x, y1: p.y, x2: q.x, y2: q.y });}
      }
    }
  }
  const occupied: { x: number; y: number }[] = [];
  for (let axis = 0; axis < 3; axis++) {
    for (const tick of ticks[axis]) {
      const point = [...back];
      point[axis] = tick;
      const p = project(point);
      if (!p || p.x < 30 || p.x > width - 60 || p.y < 20 || p.y > height - 30) {continue;}
      if (occupied.some(q => Math.abs(q.x - p.x) < 65 && Math.abs(q.y - p.y) < 20)) {continue;}
      occupied.push(p);
      result.labels.push({ ...p, text: `${'XYZ'[axis]} ${formatCoordinate(tick)}`, axis });
    }
  }
  return result;
}

const updates = new WeakMap<object, () => void>();
export function registerSceneGuides(host: object, update: () => void): () => void {
  updates.set(host, update);
  return () => {
    updates.delete(host);
  };
}
export function updateSceneGuides(host: object): void {
  updates.get(host)?.();
}
