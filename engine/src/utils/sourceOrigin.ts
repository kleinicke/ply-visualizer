import { SpatialData } from '../interfaces';

/**
 * Put independently decoded georeferenced clouds into the same local scene
 * coordinate system. The first loaded LiDAR origin becomes the scene origin;
 * later clouds are shifted in-place only when their origin differs.
 */
export function alignSourceOrigin(data: SpatialData, existing: SpatialData[]): void {
  if (!data.sourceOrigin || !data.positionsArray) {return;}
  const reference = existing.find(item => item.sourceOrigin)?.sourceOrigin;
  if (!reference) {return;}
  const dx = data.sourceOrigin[0] - reference[0];
  const dy = data.sourceOrigin[1] - reference[1];
  const dz = data.sourceOrigin[2] - reference[2];
  if (dx === 0 && dy === 0 && dz === 0) {return;}
  const positions = data.positionsArray;
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] += dx;
    positions[i + 1] += dy;
    positions[i + 2] += dz;
  }
  data.sourceOrigin = [...reference];
}
