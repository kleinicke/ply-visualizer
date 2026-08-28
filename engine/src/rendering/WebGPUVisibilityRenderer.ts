import * as THREE from 'three';

const EMPTY = 0xffffffff;
const WORKGROUP_SIZE = 256;
const HASH_SIZE = 256;
const MAX_CLIPPING_PLANES = 8;
const TARGET_CHUNK_BYTES = 16 * 1024 * 1024;

type GPUAny = any;

export type PointRenderingImplementation = 'current' | 'webgpu-visibility';

export interface VisibilityRendererCreation {
  renderer: WebGPUVisibilityRenderer | null;
  unavailableReason: string | null;
}

export interface VisibilityRenderContext {
  camera: THREE.PerspectiveCamera;
  pointClouds: THREE.Points[];
  clippingPlanes?: readonly THREE.Plane[];
  brightnessStops: number;
  hasDepthConflicts?: boolean;
}

interface GeometryChunk {
  positionBuffer: GPUAny;
  colorBuffer: GPUAny;
  pointOffset: number;
  count: number;
}

interface GeometryCache {
  positionVersion: number;
  colorVersion: number;
  count: number;
  chunks: GeometryChunk[];
}

interface Dispatch {
  bindGroup: GPUAny;
  uniformBuffer: GPUAny;
  count: number;
}

/**
 * Exact opaque one-pixel point visibility using WebGPU compute.
 *
 * Workgroups first collapse points into a 256-entry local pixel hash table,
 * then emit one global atomic update per occupied pixel. Dense columns thus
 * contend roughly once per workgroup rather than once per point. A stable
 * global point ID resolves exact-depth ties deterministically.
 */
export class WebGPUVisibilityRenderer {
  readonly canvas: HTMLCanvasElement;

  private readonly geometryCache = new Map<THREE.BufferGeometry, GeometryCache>();
  private readonly ownedBuffers = new Set<GPUAny>();
  private readonly maxChunkPoints: number;
  private readonly context: GPUAny;
  private readonly canvasFormat: string;
  private readonly computeLayout: GPUAny;
  private readonly clearPipeline: GPUAny;
  private readonly depthPipeline: GPUAny;
  private readonly idPipeline: GPUAny;
  private readonly shadePipeline: GPUAny;
  private readonly presentPipeline: GPUAny;
  private readonly presentLayout: GPUAny;

  private width = 0;
  private height = 0;
  private depthBuffer: GPUAny = null;
  private idBuffer: GPUAny = null;
  private outputTexture: GPUAny = null;
  private outputView: GPUAny = null;
  private presentBindGroup: GPUAny = null;
  private disposed = false;

  private constructor(
    private readonly device: GPUAny,
    canvas: HTMLCanvasElement,
    context: GPUAny,
    canvasFormat: string,
    computeLayout: GPUAny,
    clearPipeline: GPUAny,
    depthPipeline: GPUAny,
    idPipeline: GPUAny,
    shadePipeline: GPUAny,
    presentPipeline: GPUAny,
    presentLayout: GPUAny
  ) {
    this.canvas = canvas;
    this.context = context;
    this.canvasFormat = canvasFormat;
    this.computeLayout = computeLayout;
    this.clearPipeline = clearPipeline;
    this.depthPipeline = depthPipeline;
    this.idPipeline = idPipeline;
    this.shadePipeline = shadePipeline;
    this.presentPipeline = presentPipeline;
    this.presentLayout = presentLayout;

    const limits = device.limits ?? {};
    const bindingBytes = Number(limits.maxStorageBufferBindingSize ?? TARGET_CHUNK_BYTES);
    const bufferBytes = Number(limits.maxBufferSize ?? bindingBytes);
    const dispatchPoints = Number(limits.maxComputeWorkgroupsPerDimension ?? 65535) * 256;
    this.maxChunkPoints = Math.max(
      1,
      Math.min(
        Math.floor(TARGET_CHUNK_BYTES / 12),
        Math.floor(bindingBytes / 12),
        Math.floor(bufferBytes / 12),
        dispatchPoints
      )
    );
  }

  static async create(container: HTMLElement): Promise<VisibilityRendererCreation> {
    const gpu = (navigator as Navigator & { gpu?: GPUAny }).gpu;
    if (!gpu) {
      return { renderer: null, unavailableReason: 'navigator.gpu is unavailable' };
    }

    let device: GPUAny = null;
    let canvas: HTMLCanvasElement | null = null;
    try {
      const adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) {return { renderer: null, unavailableReason: 'no WebGPU adapter was returned' };}
      device = await adapter.requestDevice();

      canvas = document.createElement('canvas');
      canvas.id = 'webgpu-visibility-canvas';
      canvas.style.position = 'absolute';
      canvas.style.inset = '0';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.pointerEvents = 'none';
      canvas.style.display = 'none';
      canvas.style.zIndex = '1';
      container.appendChild(canvas);

      const context = canvas.getContext('webgpu') as GPUAny;
      if (!context) {throw new Error('could not create a WebGPU canvas context');}
      const canvasFormat = gpu.getPreferredCanvasFormat();
      context.configure({
        device,
        format: canvasFormat,
        alphaMode: 'premultiplied',
      });

      const module = device.createShaderModule({ code: VISIBILITY_SHADER });
      const stage = (globalThis as any).GPUShaderStage;
      const computeLayout = device.createBindGroupLayout({
        entries: [
          { binding: 0, visibility: stage.COMPUTE, buffer: { type: 'read-only-storage' } },
          { binding: 1, visibility: stage.COMPUTE, buffer: { type: 'read-only-storage' } },
          { binding: 2, visibility: stage.COMPUTE, buffer: { type: 'uniform' } },
          { binding: 3, visibility: stage.COMPUTE, buffer: { type: 'storage' } },
          { binding: 4, visibility: stage.COMPUTE, buffer: { type: 'storage' } },
          {
            binding: 5,
            visibility: stage.COMPUTE,
            storageTexture: { access: 'write-only', format: 'rgba8unorm' },
          },
        ],
      });
      const computePipelineLayout = device.createPipelineLayout({
        bindGroupLayouts: [computeLayout],
      });
      const makeCompute = async (entryPoint: string) =>
        device.createComputePipelineAsync({
          layout: computePipelineLayout,
          compute: { module, entryPoint },
        });
      const [clearPipeline, depthPipeline, idPipeline, shadePipeline] = await Promise.all([
        makeCompute('clear_visibility'),
        makeCompute('resolve_depth'),
        makeCompute('resolve_id'),
        makeCompute('shade_winners'),
      ]);

      const presentModule = device.createShaderModule({ code: PRESENT_SHADER });
      const presentLayout = device.createBindGroupLayout({
        entries: [{ binding: 0, visibility: stage.FRAGMENT, texture: {} }],
      });
      const presentPipeline = await device.createRenderPipelineAsync({
        layout: device.createPipelineLayout({ bindGroupLayouts: [presentLayout] }),
        vertex: { module: presentModule, entryPoint: 'vertex_main' },
        fragment: {
          module: presentModule,
          entryPoint: 'fragment_main',
          targets: [{ format: canvasFormat }],
        },
        primitive: { topology: 'triangle-list' },
      });

      return {
        renderer: new WebGPUVisibilityRenderer(
          device,
          canvas,
          context,
          canvasFormat,
          computeLayout,
          clearPipeline,
          depthPipeline,
          idPipeline,
          shadePipeline,
          presentPipeline,
          presentLayout
        ),
        unavailableReason: null,
      };
    } catch (error) {
      canvas?.remove();
      device?.destroy();
      return {
        renderer: null,
        unavailableReason: error instanceof Error ? error.message : String(error),
      };
    }
  }

  setEnabled(enabled: boolean): void {
    this.canvas.style.display = enabled ? 'block' : 'none';
  }

  canRender(context: VisibilityRenderContext): boolean {
    if (this.disposed || context.pointClouds.length === 0) {return false;}
    if (context.hasDepthConflicts) {return false;}
    if ((context.clippingPlanes?.length ?? 0) > MAX_CLIPPING_PLANES) {return false;}

    this.resizeToDisplaySize();
    context.camera.updateMatrixWorld();
    const height = Math.max(1, this.canvas.height);
    for (const cloud of context.pointClouds) {
      if (!(cloud.material instanceof THREE.PointsMaterial)) {return false;}
      const material = cloud.material;
      if (material.transparent || material.opacity < 1) {return false;}
      const sphere = cloud.geometry.boundingSphere;
      if (!sphere) {cloud.geometry.computeBoundingSphere();}
      const bounds = cloud.geometry.boundingSphere;
      if (!bounds) {return false;}
      cloud.updateMatrixWorld();
      const center = bounds.center.clone().applyMatrix4(cloud.matrixWorld);
      const radius = bounds.radius * cloud.matrixWorld.getMaxScaleOnAxis();
      center.applyMatrix4(context.camera.matrixWorldInverse);
      const nearestDepth = -center.z - radius;
      if (nearestDepth <= 0) {return false;}
      if (material.sizeAttenuation) {
        const maximumPixels = (material.size * height * 0.5) / Math.max(nearestDepth, 0.001);
        if (maximumPixels > 1.25) {return false;}
      } else if (material.size > 1.25) {
        return false;
      }
    }
    return true;
  }

  render(context: VisibilityRenderContext): boolean {
    if (!this.canRender(context)) {return false;}
    if (this.width === 0 || this.height === 0) {return false;}

    const active = new Set(context.pointClouds.map(cloud => cloud.geometry));
    this.pruneCache(active);
    const usage = (globalThis as any).GPUBufferUsage;
    const dispatches: Dispatch[] = [];
    let globalOffset = 0;

    context.camera.updateMatrixWorld();
    const viewProjection = new THREE.Matrix4().multiplyMatrices(
      context.camera.projectionMatrix,
      context.camera.matrixWorldInverse
    );

    for (const cloud of context.pointClouds) {
      const position = cloud.geometry.getAttribute('position');
      if (!position) {continue;}
      const cached = this.getGeometryCache(cloud.geometry);
      cloud.updateMatrixWorld();
      for (const chunk of cached.chunks) {
        const uniformData = this.makeUniformData(
          cloud,
          viewProjection,
          chunk.count,
          globalOffset + chunk.pointOffset,
          context
        );
        const uniformBuffer = this.device.createBuffer({
          size: uniformData.byteLength,
          usage: usage.UNIFORM | usage.COPY_DST,
        });
        this.device.queue.writeBuffer(uniformBuffer, 0, uniformData);
        const bindGroup = this.device.createBindGroup({
          layout: this.computeLayout,
          entries: [
            { binding: 0, resource: { buffer: chunk.positionBuffer } },
            { binding: 1, resource: { buffer: chunk.colorBuffer } },
            { binding: 2, resource: { buffer: uniformBuffer } },
            { binding: 3, resource: { buffer: this.depthBuffer } },
            { binding: 4, resource: { buffer: this.idBuffer } },
            { binding: 5, resource: this.outputView },
          ],
        });
        dispatches.push({ bindGroup, uniformBuffer, count: chunk.count });
      }
      globalOffset += position.count;
    }
    if (dispatches.length === 0) {return false;}

    const encoder = this.device.createCommandEncoder();
    const pixelCount = this.width * this.height;
    const clearPass = encoder.beginComputePass();
    clearPass.setPipeline(this.clearPipeline);
    clearPass.setBindGroup(0, dispatches[0].bindGroup);
    clearPass.dispatchWorkgroups(Math.ceil(pixelCount / WORKGROUP_SIZE));
    clearPass.end();

    const depthPass = encoder.beginComputePass();
    depthPass.setPipeline(this.depthPipeline);
    for (const dispatch of dispatches) {
      depthPass.setBindGroup(0, dispatch.bindGroup);
      depthPass.dispatchWorkgroups(Math.ceil(dispatch.count / WORKGROUP_SIZE));
    }
    depthPass.end();

    const idPass = encoder.beginComputePass();
    idPass.setPipeline(this.idPipeline);
    for (const dispatch of dispatches) {
      idPass.setBindGroup(0, dispatch.bindGroup);
      idPass.dispatchWorkgroups(Math.ceil(dispatch.count / WORKGROUP_SIZE));
    }
    idPass.end();

    const clearTexturePass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.outputView,
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });
    clearTexturePass.end();

    const shadePass = encoder.beginComputePass();
    shadePass.setPipeline(this.shadePipeline);
    for (const dispatch of dispatches) {
      shadePass.setBindGroup(0, dispatch.bindGroup);
      shadePass.dispatchWorkgroups(Math.ceil(dispatch.count / WORKGROUP_SIZE));
    }
    shadePass.end();

    const canvasView = this.context.getCurrentTexture().createView();
    const presentPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: canvasView,
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });
    presentPass.setPipeline(this.presentPipeline);
    presentPass.setBindGroup(0, this.presentBindGroup);
    presentPass.draw(3);
    presentPass.end();
    this.device.queue.submit([encoder.finish()]);

    this.device.queue.onSubmittedWorkDone().finally(() => {
      for (const dispatch of dispatches) {dispatch.uniformBuffer.destroy();}
    });
    return true;
  }

  dispose(): void {
    this.disposed = true;
    this.destroyFrameResources();
    for (const cached of this.geometryCache.values()) {this.destroyCache(cached);}
    this.geometryCache.clear();
    this.canvas.remove();
    this.device.destroy();
  }

  private resizeToDisplaySize(): void {
    const pixelRatio = Math.min(window.devicePixelRatio, 2);
    // The overlay is display:none while the current renderer is selected, so
    // its own client size is zero. Its parent is the stable sizing source.
    const parent = this.canvas.parentElement;
    const cssWidth = parent?.clientWidth ?? this.canvas.clientWidth;
    const cssHeight = parent?.clientHeight ?? this.canvas.clientHeight;
    const width = Math.max(1, Math.round(cssWidth * pixelRatio));
    const height = Math.max(1, Math.round(cssHeight * pixelRatio));
    if (width === this.width && height === this.height) {return;}
    this.width = width;
    this.height = height;
    this.canvas.width = width;
    this.canvas.height = height;
    this.destroyFrameResources();

    const usage = (globalThis as any).GPUBufferUsage;
    const textureUsage = (globalThis as any).GPUTextureUsage;
    const pixelBytes = width * height * 4;
    this.depthBuffer = this.device.createBuffer({ size: pixelBytes, usage: usage.STORAGE });
    this.idBuffer = this.device.createBuffer({ size: pixelBytes, usage: usage.STORAGE });
    this.outputTexture = this.device.createTexture({
      size: { width, height },
      format: 'rgba8unorm',
      usage:
        textureUsage.STORAGE_BINDING |
        textureUsage.TEXTURE_BINDING |
        textureUsage.RENDER_ATTACHMENT,
    });
    this.outputView = this.outputTexture.createView();
    this.presentBindGroup = this.device.createBindGroup({
      layout: this.presentLayout,
      entries: [{ binding: 0, resource: this.outputView }],
    });
  }

  private destroyFrameResources(): void {
    this.depthBuffer?.destroy();
    this.idBuffer?.destroy();
    this.outputTexture?.destroy();
    this.depthBuffer = this.idBuffer = this.outputTexture = this.outputView = null;
    this.presentBindGroup = null;
  }

  private getGeometryCache(geometry: THREE.BufferGeometry): GeometryCache {
    const position = geometry.getAttribute('position');
    const color = geometry.getAttribute('color');
    const positionVersion = attributeVersion(position);
    const colorVersion = color ? attributeVersion(color) : -1;
    const existing = this.geometryCache.get(geometry);
    if (
      existing &&
      existing.positionVersion === positionVersion &&
      existing.colorVersion === colorVersion &&
      existing.count === position.count
    ) {
      return existing;
    }
    if (existing) {this.destroyCache(existing);}

    const usage = (globalThis as any).GPUBufferUsage;
    const chunks: GeometryChunk[] = [];
    for (let pointOffset = 0; pointOffset < position.count; pointOffset += this.maxChunkPoints) {
      const count = Math.min(this.maxChunkPoints, position.count - pointOffset);
      const positions = packPositions(position, pointOffset, count);
      const colors = packColors(color, pointOffset, count);
      const positionBuffer = this.device.createBuffer({
        size: positions.byteLength,
        usage: usage.STORAGE | usage.COPY_DST,
      });
      const colorBuffer = this.device.createBuffer({
        size: colors.byteLength,
        usage: usage.STORAGE | usage.COPY_DST,
      });
      this.device.queue.writeBuffer(positionBuffer, 0, positions);
      this.device.queue.writeBuffer(colorBuffer, 0, colors);
      this.ownedBuffers.add(positionBuffer);
      this.ownedBuffers.add(colorBuffer);
      chunks.push({ positionBuffer, colorBuffer, pointOffset, count });
    }
    const cached = { positionVersion, colorVersion, count: position.count, chunks };
    this.geometryCache.set(geometry, cached);
    return cached;
  }

  private makeUniformData(
    cloud: THREE.Points,
    viewProjection: THREE.Matrix4,
    count: number,
    idOffset: number,
    context: VisibilityRenderContext
  ): ArrayBuffer {
    const data = new ArrayBuffer(64 * 2 + 16 * 4 + 16 * MAX_CLIPPING_PLANES);
    const floats = new Float32Array(data);
    const uints = new Uint32Array(data);
    const mvp = new THREE.Matrix4().multiplyMatrices(viewProjection, cloud.matrixWorld);
    floats.set(mvp.elements, 0);
    floats.set(cloud.matrixWorld.elements, 16);
    floats.set([this.width, this.height, 0, 0], 32);
    const material = cloud.material as THREE.PointsMaterial;
    floats.set(
      [material.color.r, material.color.g, material.color.b, Math.pow(2, context.brightnessStops)],
      36
    );
    uints.set([count, idOffset, context.clippingPlanes?.length ?? 0, this.width * this.height], 40);
    uints.set([material.vertexColors ? 1 : 0, material.userData.srgbDecode ? 1 : 0, 0, 0], 44);
    let offset = 48;
    for (const plane of context.clippingPlanes ?? []) {
      floats.set([plane.normal.x, plane.normal.y, plane.normal.z, plane.constant], offset);
      offset += 4;
    }
    return data;
  }

  private pruneCache(active: Set<THREE.BufferGeometry>): void {
    for (const [geometry, cached] of this.geometryCache) {
      if (active.has(geometry)) {continue;}
      this.destroyCache(cached);
      this.geometryCache.delete(geometry);
    }
  }

  private destroyCache(cached: GeometryCache): void {
    for (const chunk of cached.chunks) {
      chunk.positionBuffer.destroy();
      chunk.colorBuffer.destroy();
      this.ownedBuffers.delete(chunk.positionBuffer);
      this.ownedBuffers.delete(chunk.colorBuffer);
    }
  }
}

function attributeVersion(
  attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute
): number {
  return (attribute as any).isInterleavedBufferAttribute
    ? (attribute as THREE.InterleavedBufferAttribute).data.version
    : (attribute as THREE.BufferAttribute).version;
}

function packPositions(
  attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  offset: number,
  count: number
): Float32Array {
  const direct =
    !(attribute as any).isInterleavedBufferAttribute &&
    attribute.itemSize === 3 &&
    !attribute.normalized &&
    (attribute as THREE.BufferAttribute).array instanceof Float32Array;
  if (direct) {
    return ((attribute as THREE.BufferAttribute).array as Float32Array).subarray(
      offset * 3,
      (offset + count) * 3
    );
  }
  const packed = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const source = offset + i;
    packed[i * 3] = attribute.getX(source);
    packed[i * 3 + 1] = attribute.getY(source);
    packed[i * 3 + 2] = attribute.getZ(source);
  }
  return packed;
}

function packColors(
  attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute | undefined,
  offset: number,
  count: number
): Uint32Array {
  const packed = new Uint32Array(count);
  if (!attribute) {
    packed.fill(0xffffffff);
    return packed;
  }
  for (let i = 0; i < count; i++) {
    const source = offset + i;
    const r = colorByte(attribute.getX(source), attribute);
    const g = colorByte(attribute.getY(source), attribute);
    const b = colorByte(attribute.getZ(source), attribute);
    packed[i] = r | (g << 8) | (b << 16) | 0xff000000;
  }
  return packed;
}

function colorByte(
  value: number,
  attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute
): number {
  const normalized = attribute.normalized || value <= 1;
  return Math.max(0, Math.min(255, Math.round(normalized ? value * 255 : value)));
}

const VISIBILITY_SHADER = /* wgsl */ `
const EMPTY: u32 = 0xffffffffu;
const HASH_SIZE: u32 = ${HASH_SIZE}u;

struct Params {
  mvp: mat4x4<f32>,
  world: mat4x4<f32>,
  viewport: vec4<f32>,
  material: vec4<f32>,
  counts: vec4<u32>,
  flags: vec4<u32>,
  clipping_planes: array<vec4<f32>, ${MAX_CLIPPING_PLANES}>,
}

struct Candidate { pixel: u32, depth: u32, id: u32 }

@group(0) @binding(0) var<storage, read> positions: array<f32>;
@group(0) @binding(1) var<storage, read> colors: array<u32>;
@group(0) @binding(2) var<uniform> params: Params;
@group(0) @binding(3) var<storage, read_write> depths: array<atomic<u32>>;
@group(0) @binding(4) var<storage, read_write> ids: array<atomic<u32>>;
@group(0) @binding(5) var output_image: texture_storage_2d<rgba8unorm, write>;

var<workgroup> local_keys: array<atomic<u32>, ${HASH_SIZE}>;
var<workgroup> local_values: array<atomic<u32>, ${HASH_SIZE}>;

fn candidate(index: u32) -> Candidate {
  let base = index * 3u;
  let local = vec4<f32>(positions[base], positions[base + 1u], positions[base + 2u], 1.0);
  let clip = params.mvp * local;
  let depth = clip.w;
  if (!(depth > 0.000001) || clip.x < -depth || clip.x > depth || clip.y < -depth || clip.y > depth || clip.z < -depth || clip.z > depth) {
    return Candidate(EMPTY, EMPTY, EMPTY);
  }
  if (params.counts.z > 0u) {
    let world = params.world * local;
    for (var i = 0u; i < params.counts.z; i++) {
      let plane = params.clipping_planes[i];
      if (dot(plane.xyz, world.xyz) + plane.w < 0.0) { return Candidate(EMPTY, EMPTY, EMPTY); }
    }
  }
  let sx = (clip.x / depth * 0.5 + 0.5) * params.viewport.x;
  let sy = (clip.y / depth * -0.5 + 0.5) * params.viewport.y;
  let px = min(u32(floor(sx)), u32(params.viewport.x) - 1u);
  let py = min(u32(floor(sy)), u32(params.viewport.y) - 1u);
  return Candidate(py * u32(params.viewport.x) + px, bitcast<u32>(depth), params.counts.y + index);
}

fn local_min(pixel: u32, value: u32) -> bool {
  let start = pixel & (HASH_SIZE - 1u);
  for (var probe = 0u; probe < HASH_SIZE; probe++) {
    let slot = (start + probe) & (HASH_SIZE - 1u);
    var old = atomicLoad(&local_keys[slot]);
    if (old == EMPTY) {
      atomicCompareExchangeWeak(&local_keys[slot], EMPTY, pixel);
      old = atomicLoad(&local_keys[slot]);
    }
    if (old == pixel) {
      atomicMin(&local_values[slot], value);
      return true;
    }
  }
  return false;
}

@compute @workgroup_size(${WORKGROUP_SIZE})
fn clear_visibility(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= params.counts.w) { return; }
  atomicStore(&depths[gid.x], EMPTY);
  atomicStore(&ids[gid.x], EMPTY);
}

@compute @workgroup_size(${WORKGROUP_SIZE})
fn resolve_depth(
  @builtin(global_invocation_id) gid: vec3<u32>,
  @builtin(local_invocation_index) lane: u32
) {
  atomicStore(&local_keys[lane], EMPTY);
  atomicStore(&local_values[lane], EMPTY);
  workgroupBarrier();
  if (gid.x < params.counts.x) {
    let c = candidate(gid.x);
    if (c.pixel != EMPTY && !local_min(c.pixel, c.depth)) { atomicMin(&depths[c.pixel], c.depth); }
  }
  workgroupBarrier();
  let pixel = atomicLoad(&local_keys[lane]);
  if (pixel != EMPTY) { atomicMin(&depths[pixel], atomicLoad(&local_values[lane])); }
}

@compute @workgroup_size(${WORKGROUP_SIZE})
fn resolve_id(
  @builtin(global_invocation_id) gid: vec3<u32>,
  @builtin(local_invocation_index) lane: u32
) {
  atomicStore(&local_keys[lane], EMPTY);
  atomicStore(&local_values[lane], EMPTY);
  workgroupBarrier();
  if (gid.x < params.counts.x) {
    let c = candidate(gid.x);
    if (c.pixel != EMPTY && c.depth == atomicLoad(&depths[c.pixel])) {
      if (!local_min(c.pixel, c.id)) { atomicMin(&ids[c.pixel], c.id); }
    }
  }
  workgroupBarrier();
  let pixel = atomicLoad(&local_keys[lane]);
  if (pixel != EMPTY) { atomicMin(&ids[pixel], atomicLoad(&local_values[lane])); }
}

fn srgb_to_linear(c: vec3<f32>) -> vec3<f32> {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3<f32>(2.4)), step(vec3<f32>(0.04045), c));
}
fn linear_to_srgb(c: vec3<f32>) -> vec3<f32> {
  return mix(c * 12.92, 1.055 * pow(max(c, vec3<f32>(0.0)), vec3<f32>(1.0 / 2.4)) - 0.055, step(vec3<f32>(0.0031308), c));
}

@compute @workgroup_size(${WORKGROUP_SIZE})
fn shade_winners(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= params.counts.x) { return; }
  let c = candidate(gid.x);
  if (c.pixel == EMPTY || c.id != atomicLoad(&ids[c.pixel])) { return; }
  let packed = colors[gid.x];
  var color = vec3<f32>(f32(packed & 255u), f32((packed >> 8u) & 255u), f32((packed >> 16u) & 255u)) / 255.0;
  if (params.flags.x == 0u) { color = params.material.rgb; }
  else if (params.flags.y != 0u) { color = srgb_to_linear(color); }
  color = linear_to_srgb(color * params.material.a);
  let width = u32(params.viewport.x);
  textureStore(output_image, vec2<i32>(i32(c.pixel % width), i32(c.pixel / width)), vec4<f32>(color, 1.0));
}
`;

const PRESENT_SHADER = /* wgsl */ `
@group(0) @binding(0) var image: texture_2d<f32>;

@vertex
fn vertex_main(@builtin(vertex_index) index: u32) -> @builtin(position) vec4<f32> {
  let positions = array<vec2<f32>, 3>(vec2<f32>(-1.0, -1.0), vec2<f32>(3.0, -1.0), vec2<f32>(-1.0, 3.0));
  return vec4<f32>(positions[index], 0.0, 1.0);
}

@fragment
fn fragment_main(@builtin(position) position: vec4<f32>) -> @location(0) vec4<f32> {
  return textureLoad(image, vec2<i32>(position.xy), 0);
}
`;
