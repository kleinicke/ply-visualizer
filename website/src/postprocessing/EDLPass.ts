/**
 * Eye Dome Lighting (EDL) Post-Processing Pass for Three.js
 *
 * Adapted from the EDL shader code by Christian Boucheny used in
 * CloudCompare and Potree. EDL is a non-photorealistic shading technique
 * that enhances depth perception by darkening silhouettes and depth
 * discontinuities.
 *
 * Usage:
 *   const edlPass = new EDLPass(scene, camera, width, height);
 *   composer.addPass(edlPass);
 *   edlPass.enabled = true;  // toggle on/off
 *   edlPass.edlStrength = 1.0;
 *   edlPass.edlRadius = 1.0;
 */

import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass';

/** 8-direction neighbor kernel for depth sampling */
const NEIGHBOR_OFFSETS: [number, number][] = [
  [0, 1], // N
  [1, 1], // NE
  [1, 0], // E
  [1, -1], // SE
  [0, -1], // S
  [-1, -1], // SW
  [-1, 0], // W
  [-1, 1], // NW
];

const EDLVertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const EDLFragmentShader = /* glsl */ `
// Eye Dome Lighting fragment shader
// Adapted from Christian Boucheny's EDL implementation (CloudCompare/Potree)

uniform sampler2D tDiffuse;     // Color buffer from scene render
uniform sampler2D tDepth;       // Depth buffer from scene render
uniform float screenWidth;
uniform float screenHeight;
uniform float edlStrength;
uniform float radius;
uniform float cameraNear;
uniform float cameraFar;

// 8-direction neighbor offsets
uniform vec2 neighbours[8];

varying vec2 vUv;

/**
 * Linearize depth from the depth buffer.
 * The hardware depth buffer uses a hyperbolic distribution;
 * we convert to linear [0,1] range for meaningful comparisons.
 */
float getLinearDepth(vec2 coord) {
  float fragDepth = texture2D(tDepth, coord).r;
  // If depth is essentially at the far plane, treat as "no geometry"
  if (fragDepth >= 1.0) return 0.0;
  // Convert hyperbolic depth to linear
  float viewZ = (cameraNear * cameraFar) / (cameraFar - fragDepth * (cameraFar - cameraNear));
  return viewZ;
}

/**
 * Compute the EDL response for a pixel.
 * Compares the log2-depth of the current pixel against its neighbors.
 * Large depth differences indicate edges/silhouettes and produce a high response.
 */
float edlResponse(float depth) {
  vec2 texelSize = radius / vec2(screenWidth, screenHeight);

  float sum = 0.0;

  for (int i = 0; i < 8; i++) {
    vec2 neighbourCoord = vUv + texelSize * neighbours[i];
    float neighbourDepth = getLinearDepth(neighbourCoord);

    if (neighbourDepth > 0.0) {
      if (depth <= 0.0) {
        // Current pixel has no geometry but neighbor does — strong edge
        sum += 100.0;
      } else {
        // Compare log2 depths for scale-invariant edge detection
        sum += max(0.0, log2(depth) - log2(neighbourDepth));
      }
    }
  }

  return sum / 8.0;
}

void main() {
  vec4 color = texture2D(tDiffuse, vUv);
  float depth = getLinearDepth(vUv);

  // Skip EDL for background pixels (no geometry)
  if (depth <= 0.0) {
    gl_FragColor = color;
    return;
  }

  float response = edlResponse(depth);
  // Exponential falloff produces natural-looking shadows
  float shade = exp(-response * 300.0 * edlStrength);

  gl_FragColor = vec4(color.rgb * shade, color.a);
}
`;

export interface EDLPassOptions {
  strength?: number;
  radius?: number;
}

/**
 * Eye Dome Lighting post-processing pass.
 *
 * Renders the scene to an off-screen target with depth, then applies
 * the EDL shader as a full-screen effect that darkens edges where
 * depth changes sharply.
 */
export class EDLPass extends Pass {
  /** Controls the intensity of edge darkening (0 = off, 5 = very strong) */
  public edlStrength: number;
  /** Controls the sampling radius in pixels (1 = tight, 5 = broad halos) */
  public edlRadius: number;

  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private edlMaterial: THREE.ShaderMaterial;
  private fsQuad: FullScreenQuad;
  private renderTarget: THREE.WebGLRenderTarget;
  private _width: number;
  private _height: number;

  constructor(
    scene: THREE.Scene,
    camera: THREE.Camera,
    width: number,
    height: number,
    options: EDLPassOptions = {}
  ) {
    super();

    this.scene = scene;
    this.camera = camera;
    this.edlStrength = options.strength ?? 1.0;
    this.edlRadius = options.radius ?? 1.4;
    this._width = width;
    this._height = height;

    // Create render target with attached depth texture
    this.renderTarget = new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      type: THREE.HalfFloatType,
    });
    // Attach a depth texture so we can read depth in the EDL shader
    this.renderTarget.depthTexture = new THREE.DepthTexture(width, height);
    this.renderTarget.depthTexture.type = THREE.FloatType;

    // Build uniform neighbor array
    const neighbourUniforms = NEIGHBOR_OFFSETS.map(([x, y]) => new THREE.Vector2(x, y));

    // Create the EDL shader material
    this.edlMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        tDepth: { value: null },
        screenWidth: { value: width },
        screenHeight: { value: height },
        edlStrength: { value: this.edlStrength },
        radius: { value: this.edlRadius },
        cameraNear: { value: 0.001 },
        cameraFar: { value: 1000000 },
        neighbours: { value: neighbourUniforms },
      },
      vertexShader: EDLVertexShader,
      fragmentShader: EDLFragmentShader,
      depthWrite: false,
      depthTest: false,
    });

    this.fsQuad = new FullScreenQuad(this.edlMaterial);
  }

  /**
   * Render the EDL effect.
   * 1. Render the scene to our render target (capturing color + depth)
   * 2. Apply the EDL shader as a full-screen post-process
   */
  render(
    renderer: THREE.WebGLRenderer,
    writeBuffer: THREE.WebGLRenderTarget,
    _readBuffer: THREE.WebGLRenderTarget
    /*, deltaTime?: number, maskActive?: boolean */
  ): void {
    // Step 1: Render scene to our render target (captures color + depth)
    renderer.setRenderTarget(this.renderTarget);
    renderer.render(this.scene, this.camera);

    // Step 2: Update EDL uniforms
    const cam = this.camera as THREE.PerspectiveCamera;
    this.edlMaterial.uniforms.tDiffuse.value = this.renderTarget.texture;
    this.edlMaterial.uniforms.tDepth.value = this.renderTarget.depthTexture;
    this.edlMaterial.uniforms.edlStrength.value = this.edlStrength;
    this.edlMaterial.uniforms.radius.value = this.edlRadius;
    this.edlMaterial.uniforms.screenWidth.value = this._width;
    this.edlMaterial.uniforms.screenHeight.value = this._height;

    if (cam.near !== undefined) {
      this.edlMaterial.uniforms.cameraNear.value = cam.near;
    }
    if (cam.far !== undefined) {
      this.edlMaterial.uniforms.cameraFar.value = cam.far;
    }

    // Step 3: Render the full-screen quad with EDL shader
    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
    } else {
      renderer.setRenderTarget(writeBuffer);
    }
    this.fsQuad.render(renderer);
  }

  /**
   * Update the render target size (call on window resize).
   */
  setSize(width: number, height: number): void {
    this._width = width;
    this._height = height;
    this.renderTarget.setSize(width, height);
  }

  /**
   * Clean up GPU resources.
   */
  dispose(): void {
    this.renderTarget.dispose();
    this.edlMaterial.dispose();
    this.fsQuad.dispose();
  }
}
