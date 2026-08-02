import * as THREE from 'three/webgpu';
import {
  instancedBufferAttribute,
  reference,
  sRGBTransferEOTF,
  shapeCircle,
  uniform,
} from 'three/tsl';

interface PointSpriteState {
  sprite: THREE.Sprite;
  sourceMaterial: THREE.PointsMaterial;
  positionAttribute: THREE.BufferAttribute;
  colorAttribute: THREE.BufferAttribute | null;
  vertexColors: boolean;
  sizeNode: ReturnType<typeof uniform>;
  decodeNode: ReturnType<typeof uniform>;
  spriteMaterial: THREE.PointsNodeMaterial;
}

const STATE_KEY = '__webgpuPointSprite';
const DEFAULT_WORLD_POINT_SIZE = 0.001;
const WORLD_SIZE_TO_PIXELS = 1 / DEFAULT_WORLD_POINT_SIZE;

function createSpriteMaterial(
  source: THREE.PointsMaterial,
  positionAttribute: THREE.BufferAttribute,
  colorAttribute: THREE.BufferAttribute | null
): Omit<PointSpriteState, 'sprite'> {
  // A world size of 0.001 was historically clamped by WebGL to a visible
  // 1-pixel point. WebGPU sprite quads are not implicitly clamped and therefore
  // disappeared at the old default. Wide mode maps the existing slider to
  // logical pixels explicitly: 0.001 => 1 px, 0.01 => 10 px.
  const sizeNode = uniform(source.size * WORLD_SIZE_TO_PIXELS);
  const decodeNode = uniform(source.userData.srgbDecode ? 1 : 0);
  const baseColor = uniform(source.color);

  let colorNode: any = baseColor;
  if (source.vertexColors && colorAttribute) {
    const attributeColor = instancedBufferAttribute(colorAttribute);
    const decodedColor = sRGBTransferEOTF(attributeColor);
    const effectiveColor: any = (decodeNode as any)
      .greaterThan(0.5)
      .select(decodedColor, attributeColor);
    colorNode = baseColor.mul(effectiveColor);
  }

  const circleOpacity: any = shapeCircle();
  const spriteMaterial = new THREE.PointsNodeMaterial({
    positionNode: instancedBufferAttribute(positionAttribute),
    colorNode,
    opacityNode: circleOpacity.mul(reference('opacity', 'float', source)),
    sizeNode,
    sizeAttenuation: false,
    transparent: source.transparent,
    depthTest: source.depthTest,
    depthWrite: source.depthWrite,
    alphaToCoverage: true,
    opacity: source.opacity,
  });

  return {
    sourceMaterial: source,
    positionAttribute,
    colorAttribute,
    vertexColors: source.vertexColors,
    sizeNode,
    decodeNode,
    spriteMaterial,
  };
}

function disposeState(points: THREE.Points): void {
  const state = points.userData[STATE_KEY] as PointSpriteState | undefined;
  if (!state) {
    return;
  }
  points.remove(state.sprite);
  state.spriteMaterial.dispose();
  delete points.userData[STATE_KEY];
}

function attachState(points: THREE.Points): PointSpriteState | null {
  const source = points.material;
  if (!(source instanceof THREE.PointsMaterial)) {
    return null;
  }
  const positionAttribute = points.geometry.getAttribute('position') as
    | THREE.BufferAttribute
    | undefined;
  if (!positionAttribute) {
    return null;
  }
  const colorAttribute =
    (points.geometry.getAttribute('color') as THREE.BufferAttribute | undefined) ?? null;
  const materialState = createSpriteMaterial(source, positionAttribute, colorAttribute);
  const sprite = new THREE.Sprite(materialState.spriteMaterial);
  sprite.name = `${points.name || 'Point cloud'} (WebGPU sprites)`;
  sprite.count = positionAttribute.count;
  sprite.frustumCulled = false;
  sprite.renderOrder = points.renderOrder;
  points.add(sprite);

  const state: PointSpriteState = { ...materialState, sprite };
  points.userData[STATE_KEY] = state;
  source.visible = false;
  source.addEventListener('dispose', () => disposeState(points));
  return state;
}

function syncPointSprite(points: THREE.Points): void {
  const source = points.material;
  if (!(source instanceof THREE.PointsMaterial)) {
    disposeState(points);
    return;
  }

  const positionAttribute = points.geometry.getAttribute('position') as
    | THREE.BufferAttribute
    | undefined;
  if (!positionAttribute) {
    disposeState(points);
    return;
  }

  // Native WebGPU points are fixed at one pixel, which exactly matches the
  // viewer's default after WebGL's minimum-size clamp. Use that fast one-vertex
  // path until the user explicitly requests a wider point size.
  if (source.size <= DEFAULT_WORLD_POINT_SIZE * 1.001) {
    disposeState(points);
    source.visible = true;
    return;
  }
  const colorAttribute =
    (points.geometry.getAttribute('color') as THREE.BufferAttribute | undefined) ?? null;
  let state = points.userData[STATE_KEY] as PointSpriteState | undefined;

  if (
    !state ||
    state.sourceMaterial !== source ||
    state.positionAttribute !== positionAttribute ||
    state.colorAttribute !== colorAttribute ||
    state.vertexColors !== source.vertexColors
  ) {
    disposeState(points);
    state = attachState(points) ?? undefined;
  }
  if (!state) {
    return;
  }

  source.visible = false;
  state.sprite.count = positionAttribute.count;
  state.sprite.visible = true;
  state.sprite.renderOrder = points.renderOrder;
  state.sizeNode.value = source.size * WORLD_SIZE_TO_PIXELS;
  state.decodeNode.value = source.userData.srgbDecode ? 1 : 0;
  const pipelineChanged =
    state.spriteMaterial.transparent !== source.transparent ||
    state.spriteMaterial.depthTest !== source.depthTest ||
    state.spriteMaterial.depthWrite !== source.depthWrite;
  state.spriteMaterial.transparent = source.transparent;
  state.spriteMaterial.depthTest = source.depthTest;
  state.spriteMaterial.depthWrite = source.depthWrite;
  state.spriteMaterial.opacity = source.opacity;
  if (pipelineChanged) {
    state.spriteMaterial.needsUpdate = true;
  }
}

/**
 * Wide WebGPU points are instanced sprites because WebGPU point primitives are
 * fixed at one pixel. Keeping the original THREE.Points parent preserves the
 * viewer's picking, geometry, transforms and file-management contracts.
 */
export function syncWebGPUPointSprites(scene: THREE.Scene): void {
  scene.traverse(object => {
    if (object instanceof THREE.Points) {
      syncPointSprite(object);
    }
  });
}

export function restoreNativePoints(scene: THREE.Scene): void {
  scene.traverse(object => {
    if (object instanceof THREE.Points) {
      disposeState(object);
      const material = object.material;
      if (material instanceof THREE.PointsMaterial) {
        material.visible = true;
      }
    }
  });
}
