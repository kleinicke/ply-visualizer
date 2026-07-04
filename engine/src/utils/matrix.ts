import * as THREE from 'three';

export function createRotationMatrix(axis: 'x' | 'y' | 'z', angle: number): THREE.Matrix4 {
  const matrix = new THREE.Matrix4();
  switch (axis) {
    case 'x':
      matrix.makeRotationX(angle);
      break;
    case 'y':
      matrix.makeRotationY(angle);
      break;
    case 'z':
      matrix.makeRotationZ(angle);
      break;
  }
  return matrix;
}

export function createTranslationMatrix(x: number, y: number, z: number): THREE.Matrix4 {
  const matrix = new THREE.Matrix4();
  matrix.makeTranslation(x, y, z);
  return matrix;
}

export function createQuaternionMatrix(x: number, y: number, z: number, w: number): THREE.Matrix4 {
  const quaternion = new THREE.Quaternion(x, y, z, w);
  quaternion.normalize();
  const matrix = new THREE.Matrix4();
  matrix.makeRotationFromQuaternion(quaternion);
  return matrix;
}

export function createAngleAxisMatrix(axis: THREE.Vector3, angle: number): THREE.Matrix4 {
  const quaternion = new THREE.Quaternion();
  quaternion.setFromAxisAngle(axis.normalize(), angle);
  const matrix = new THREE.Matrix4();
  matrix.makeRotationFromQuaternion(quaternion);
  return matrix;
}

export function parseSpaceSeparatedValues(input: string): number[] {
  if (!input.trim()) {
    return [];
  }

  // Remove brackets, parentheses, and normalize whitespace/separators
  const cleaned = input
    .replace(/[\[\](){}]/g, '') // Remove brackets/parentheses
    .replace(/[,;]/g, ' ') // Replace commas/semicolons with spaces
    .replace(/\s+/g, ' ') // Normalize multiple spaces to single
    .trim();

  // Split by spaces and parse numbers
  return cleaned
    .split(' ')
    .map(s => parseFloat(s))
    .filter(n => !isNaN(n));
}

export function parseMatrixInput(input: string): number[] | null {
  try {
    // Remove brackets, commas, and other unwanted characters, keep numbers, spaces, dots, minus signs
    const cleaned = input
      .replace(/[\[\],]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Split by whitespace and parse numbers
    const values = cleaned
      .split(/\s+/)
      .map(str => {
        const num = parseFloat(str);
        return isNaN(num) ? null : num;
      })
      .filter(val => val !== null) as number[];

    // Should have exactly 16 numbers
    if (values.length !== 16) {
      console.warn(`Matrix parsing: Expected 16 numbers, got ${values.length}`);
      return null;
    }

    console.log(`✅ Matrix parsed successfully: ${values.length} numbers`);
    return values;
  } catch (error) {
    console.error('Matrix parsing error:', error);
    return null;
  }
}
