export interface CadNode {
  name: string;
  meshes: number[];
  children: CadNode[];
}

export interface CadMesh {
  name: string;
  color?: number[];
  brep_faces?: { first: number; last: number; color: number[] | null }[];
  attributes: {
    position: { array: Float32Array };
    normal?: { array: Float32Array };
  };
  index: { array: Uint32Array };
}

export interface CadResult {
  root: CadNode;
  meshes: CadMesh[];
}
export type CadFormat = 'step' | 'iges' | 'brep';

export function isCadFormat(value: unknown): value is CadFormat {
  return value === 'step' || value === 'iges' || value === 'brep';
}

export function cadFormatForExtension(extension: string): CadFormat | null {
  switch (extension.toLowerCase()) {
    case 'step':
    case 'stp':
      return 'step';
    case 'iges':
    case 'igs':
      return 'iges';
    case 'brep':
      return 'brep';
    default:
      return null;
  }
}

export type CadDecoder = (bytes: Uint8Array<ArrayBuffer>, format: CadFormat) => Promise<CadResult>;
