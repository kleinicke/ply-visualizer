/** Formats rendered as complete Three.js scenes rather than flattened meshes. */
export const SCENE_MODEL_EXTENSIONS = [
  'gltf',
  'glb',
  'fbx',
  'dae',
  '3ds',
  '3mf',
  'amf',
  'wrl',
  'step',
  'stp',
  'iges',
  'igs',
  'brep',
] as const;
export function isSceneModel(fileName: string): boolean {
  const extension = fileName.split('.').pop()?.toLowerCase();
  return SCENE_MODEL_EXTENSIONS.some(value => value === extension);
}

/** When selected with a scene model, these files supply its buffers or textures. */
export function isModelCompanion(fileName: string): boolean {
  return /\.(bin|png|jpe?g|tga|bmp|webp|gif|mtl)$/i.test(fileName);
}
