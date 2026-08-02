import * as THREE from 'three/webgpu';
import { exp, float, log2, max, pass, screenUV, uniform, vec2, vec4 } from 'three/tsl';

const NEIGHBOUR_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 1],
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, -1],
  [-1, 0],
  [-1, 1],
];

/**
 * Backend-independent Eye Dome Lighting built with TSL. Three compiles this
 * graph to WGSL for WebGPU and GLSL for WebGPURenderer's WebGL2 fallback.
 */
export class ModernEDLPipeline {
  private readonly scenePass;
  private readonly pipeline: THREE.RenderPipeline;
  private readonly strengthNode = uniform(1);
  private readonly radiusNode = uniform(1.4);
  private readonly secondRingWeightNode = uniform(0);
  private readonly textureSizeNode;

  constructor(renderer: THREE.WebGPURenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.scenePass = pass(scene, camera);

    const colorNode = this.scenePass.getTextureNode();
    const depthTextureNode = this.scenePass.getTextureNode('depth');
    const linearizeDepth = (sampledDepth: any) =>
      uniform(camera.near)
        .mul(uniform(camera.far))
        .div(
          uniform(camera.far).sub(sampledDepth.mul(uniform(camera.far).sub(uniform(camera.near))))
        );
    const centerRawDepth = depthTextureNode.sample(screenUV).r;
    const centerDepth = linearizeDepth(centerRawDepth);
    this.textureSizeNode = uniform(
      new THREE.Vector2(renderer.domElement.width || 1, renderer.domElement.height || 1)
    );
    const texelRadius = vec2(this.radiusNode).div(this.textureSizeNode);

    let firstRing: any = float(0);
    let secondRing: any = float(0);

    for (const [x, y] of NEIGHBOUR_OFFSETS) {
      const offset = texelRadius.mul(vec2(x, y));
      const neighbourRawDepth = depthTextureNode.sample(screenUV.add(offset)).r;
      const neighbourDepth = linearizeDepth(neighbourRawDepth);
      const neighbourResponse = max(
        float(0),
        log2(max(centerDepth, 1e-6)).sub(log2(max(neighbourDepth, 1e-6)))
      );
      firstRing = firstRing.add(neighbourRawDepth.lessThan(1).select(neighbourResponse, float(0)));

      const secondRawDepth = depthTextureNode.sample(screenUV.add(offset.mul(2))).r;
      const secondDepth = linearizeDepth(secondRawDepth);
      const secondResponse = max(
        float(0),
        log2(max(centerDepth, 1e-6)).sub(log2(max(secondDepth, 1e-6)))
      );
      secondRing = secondRing.add(secondRawDepth.lessThan(1).select(secondResponse, float(0)));
    }

    firstRing = firstRing.div(NEIGHBOUR_OFFSETS.length);
    secondRing = secondRing.div(NEIGHBOUR_OFFSETS.length);
    const response = firstRing
      .add(secondRing.mul(this.secondRingWeightNode))
      .div(float(1).add(this.secondRingWeightNode));
    const shade = exp(response.mul(this.strengthNode).mul(-300));
    const sceneColor = colorNode.sample(screenUV);
    const shaded = vec4(sceneColor.rgb.mul(shade), sceneColor.a);

    // Background depth is 1. Keep it untouched, just like the former GLSL pass.
    const outputNode = centerRawDepth.lessThan(1).select(shaded, sceneColor);
    this.pipeline = new THREE.RenderPipeline(renderer, outputNode);

    // PassNode tracks renderer size internally. This uniform is only the
    // physical texel size used by the EDL neighbourhood samples.
  }

  set strength(value: number) {
    this.strengthNode.value = value;
  }

  set radius(value: number) {
    this.radiusNode.value = value;
  }

  set secondRingWeight(value: number) {
    this.secondRingWeightNode.value = value;
  }

  setSize(width: number, height: number, pixelRatio = 1): void {
    this.textureSizeNode.value.set(
      Math.max(1, width * pixelRatio),
      Math.max(1, height * pixelRatio)
    );
  }

  render(): void {
    this.pipeline.render();
  }

  dispose(): void {
    this.scenePass.dispose();
    this.pipeline.dispose();
  }
}
