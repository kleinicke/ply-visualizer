/** Formats rendered as complete Three.js scenes rather than flattened meshes. */
export const SCENE_MODEL_EXTENSIONS = ['gltf', 'glb', 'fbx', 'dae', '3ds'] as const;
export function isSceneModel(fileName: string): boolean {
  return /\.(gltf|glb|fbx|dae|3ds)$/i.test(fileName);
}
