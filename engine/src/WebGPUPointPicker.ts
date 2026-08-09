import * as THREE from 'three';
import type { PointPickHit, SelectionContext } from './SelectionManager';

const MAX_CLIPPING_PLANES = 8;
const NO_RESULT = 0xffffffff;
// Keep individual allocations comfortably below the WebGPU minimum
// maxStorageBufferBindingSize (128 MiB). Smaller chunks also avoid one large
// allocation failing even when the device has enough aggregate memory.
const TARGET_CHUNK_BYTES = 16 * 1024 * 1024;

type GPUDeviceLike = any;
type GPUBufferLike = any;

interface CachedPositionChunk {
  buffer: GPUBufferLike;
  pointOffset: number;
  count: number;
}

interface CachedPositionBuffers {
  chunks: CachedPositionChunk[];
  version: number;
  count: number;
}

interface PickDispatch {
  mesh: THREE.Points;
  bindGroup: any;
  uniformBuffer: GPUBufferLike;
  count: number;
  idOffset: number;
  pointOffset: number;
}

export interface WebGPUPointPickerCreation {
  picker: WebGPUPointPicker | null;
  unavailableReason: string | null;
}

/**
 * Point-cloud picking implemented as two WebGPU compute passes.
 *
 * The first pass atomically selects the smallest positive view depth. The
 * second pass resolves equal-depth ties to one stable global point ID. Only
 * eight bytes are copied back to JavaScript, regardless of cloud size.
 */
export class WebGPUPointPicker {
  private readonly positionBuffers = new Map<object, CachedPositionBuffers>();
  private readonly ownedPositionBuffers = new Set<GPUBufferLike>();
  private readonly maxChunkPoints: number;
  private disposed = false;

  private constructor(
    private readonly device: GPUDeviceLike,
    private readonly firstPassPipeline: any,
    private readonly secondPassPipeline: any,
    private readonly bindGroupLayout: any
  ) {
    const limits = device.limits ?? {};
    const maxBindingBytes = Number(limits.maxStorageBufferBindingSize ?? TARGET_CHUNK_BYTES);
    const maxBufferBytes = Number(limits.maxBufferSize ?? maxBindingBytes);
    const maxDispatchPoints = Number(limits.maxComputeWorkgroupsPerDimension ?? 65535) * 256;
    this.maxChunkPoints = Math.max(
      1,
      Math.min(
        Math.floor(TARGET_CHUNK_BYTES / 12),
        Math.floor(maxBindingBytes / 12),
        Math.floor(maxBufferBytes / 12),
        maxDispatchPoints
      )
    );
  }

  static async create(): Promise<WebGPUPointPickerCreation> {
    const gpu = (navigator as Navigator & { gpu?: any }).gpu;
    if (!gpu) {
      return {
        picker: null,
        unavailableReason: 'navigator.gpu is unavailable in this environment',
      };
    }

    try {
      const adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) {
        return { picker: null, unavailableReason: 'no WebGPU adapter was returned' };
      }
      const device = await adapter.requestDevice();
      const module = device.createShaderModule({ code: PICK_SHADER });
      const bindGroupLayout = device.createBindGroupLayout({
        entries: [
          {
            binding: 0,
            visibility: gpuShaderStage().COMPUTE,
            buffer: { type: 'read-only-storage' },
          },
          {
            binding: 1,
            visibility: gpuShaderStage().COMPUTE,
            buffer: { type: 'uniform' },
          },
          {
            binding: 2,
            visibility: gpuShaderStage().COMPUTE,
            buffer: { type: 'storage' },
          },
        ],
      });
      const layout = device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });
      const firstPassDescriptor = {
        layout,
        compute: { module, entryPoint: 'find_depth' },
      };
      const secondPassDescriptor = {
        layout,
        compute: { module, entryPoint: 'find_id' },
      };
      // The async form waits for WGSL validation. A browser that exposes
      // navigator.gpu but cannot compile this picker is treated as unavailable
      // before the Controls UI is mounted.
      const firstPassPipeline = device.createComputePipelineAsync
        ? await device.createComputePipelineAsync(firstPassDescriptor)
        : device.createComputePipeline(firstPassDescriptor);
      const secondPassPipeline = device.createComputePipelineAsync
        ? await device.createComputePipelineAsync(secondPassDescriptor)
        : device.createComputePipeline(secondPassDescriptor);

      return {
        picker: new WebGPUPointPicker(
          device,
          firstPassPipeline,
          secondPassPipeline,
          bindGroupLayout
        ),
        unavailableReason: null,
      };
    } catch (error) {
      return {
        picker: null,
        unavailableReason: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async pick(
    mouseScreenX: number,
    mouseScreenY: number,
    canvas: HTMLCanvasElement,
    pointCloudMeshes: THREE.Points[],
    context: SelectionContext
  ): Promise<PointPickHit | null> {
    if (this.disposed) {
      throw new Error('WebGPU point picker has been disposed');
    }
    if ((context.clippingPlanes?.length ?? 0) > MAX_CLIPPING_PLANES) {
      throw new Error(`WebGPU picking supports at most ${MAX_CLIPPING_PLANES} clipping planes`);
    }

    return this.withErrorScopes(() =>
      this.pickWithValidatedResources(mouseScreenX, mouseScreenY, canvas, pointCloudMeshes, context)
    );
  }

  private async pickWithValidatedResources(
    mouseScreenX: number,
    mouseScreenY: number,
    canvas: HTMLCanvasElement,
    pointCloudMeshes: THREE.Points[],
    context: SelectionContext
  ): Promise<PointPickHit | null> {
    const usage = gpuBufferUsage();
    const resultBuffer = this.device.createBuffer({
      size: 8,
      usage: usage.STORAGE | usage.COPY_SRC | usage.COPY_DST,
    });
    const readbackBuffer = this.device.createBuffer({
      size: 8,
      usage: usage.COPY_DST | usage.MAP_READ,
    });
    this.device.queue.writeBuffer(resultBuffer, 0, new Uint32Array([NO_RESULT, NO_RESULT]));

    const dispatches: PickDispatch[] = [];
    let idOffset = 0;
    try {
      this.prunePositionBuffers(
        new Set(pointCloudMeshes.map(mesh => mesh.geometry.getAttribute('position')))
      );
      context.camera.updateMatrixWorld();
      const viewProjection = new THREE.Matrix4().multiplyMatrices(
        context.camera.projectionMatrix,
        context.camera.matrixWorldInverse
      );

      for (const mesh of pointCloudMeshes) {
        const position = mesh.geometry.getAttribute('position');
        if (!position || position.count === 0) {continue;}
        if (idOffset + position.count >= NO_RESULT) {
          throw new Error('WebGPU picker point ID space exceeded');
        }

        mesh.updateMatrixWorld();
        const cached = this.getPositionBuffers(position);
        for (const chunk of cached.chunks) {
          const uniformData = this.makeUniformData(
            mesh,
            viewProjection,
            mouseScreenX,
            mouseScreenY,
            canvas,
            context,
            chunk.count,
            idOffset + chunk.pointOffset
          );
          const uniformBuffer = this.device.createBuffer({
            size: uniformData.byteLength,
            usage: usage.UNIFORM | usage.COPY_DST,
          });
          this.device.queue.writeBuffer(uniformBuffer, 0, uniformData);
          const bindGroup = this.device.createBindGroup({
            layout: this.bindGroupLayout,
            entries: [
              { binding: 0, resource: { buffer: chunk.buffer } },
              { binding: 1, resource: { buffer: uniformBuffer } },
              { binding: 2, resource: { buffer: resultBuffer } },
            ],
          });
          dispatches.push({
            mesh,
            bindGroup,
            uniformBuffer,
            count: chunk.count,
            idOffset: idOffset + chunk.pointOffset,
            pointOffset: chunk.pointOffset,
          });
        }
        idOffset += position.count;
      }

      if (dispatches.length === 0) {return null;}

      const encoder = this.device.createCommandEncoder();
      const firstPass = encoder.beginComputePass();
      firstPass.setPipeline(this.firstPassPipeline);
      for (const dispatch of dispatches) {
        firstPass.setBindGroup(0, dispatch.bindGroup);
        firstPass.dispatchWorkgroups(Math.ceil(dispatch.count / 256));
      }
      firstPass.end();

      const secondPass = encoder.beginComputePass();
      secondPass.setPipeline(this.secondPassPipeline);
      for (const dispatch of dispatches) {
        secondPass.setBindGroup(0, dispatch.bindGroup);
        secondPass.dispatchWorkgroups(Math.ceil(dispatch.count / 256));
      }
      secondPass.end();
      encoder.copyBufferToBuffer(resultBuffer, 0, readbackBuffer, 0, 8);
      this.device.queue.submit([encoder.finish()]);

      await readbackBuffer.mapAsync(gpuMapMode().READ);
      const result = new Uint32Array(readbackBuffer.getMappedRange()).slice();
      readbackBuffer.unmap();
      if (result[1] === NO_RESULT) {return null;}

      const dispatch = dispatches.find(
        item => result[1] >= item.idOffset && result[1] < item.idOffset + item.count
      );
      if (!dispatch) {throw new Error('WebGPU picker returned an unknown point ID');}
      const pointIndex = dispatch.pointOffset + result[1] - dispatch.idOffset;
      return this.describeHit(
        dispatch.mesh,
        pointIndex,
        mouseScreenX,
        mouseScreenY,
        canvas,
        context
      );
    } finally {
      for (const dispatch of dispatches) {dispatch.uniformBuffer.destroy();}
      resultBuffer.destroy();
      readbackBuffer.destroy();
    }
  }

  dispose(): void {
    this.disposed = true;
    for (const buffer of this.ownedPositionBuffers) {buffer.destroy();}
    this.ownedPositionBuffers.clear();
    this.device.destroy();
  }

  private prunePositionBuffers(
    activeAttributes: Set<THREE.BufferAttribute | THREE.InterleavedBufferAttribute>
  ): void {
    for (const [attribute, cached] of this.positionBuffers) {
      if (activeAttributes.has(attribute as THREE.BufferAttribute)) {continue;}
      for (const chunk of cached.chunks) {
        chunk.buffer.destroy();
        this.ownedPositionBuffers.delete(chunk.buffer);
      }
      this.positionBuffers.delete(attribute);
    }
  }

  private getPositionBuffers(
    attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute
  ): CachedPositionBuffers {
    const version = this.attributeVersion(attribute);
    const existing = this.positionBuffers.get(attribute);
    if (existing && existing.version === version && existing.count === attribute.count) {
      return existing;
    }
    if (existing) {
      for (const chunk of existing.chunks) {
        chunk.buffer.destroy();
        this.ownedPositionBuffers.delete(chunk.buffer);
      }
    }

    const sourceArray =
      (attribute as any).isInterleavedBufferAttribute === true
        ? undefined
        : (attribute as THREE.BufferAttribute).array;
    const usage = gpuBufferUsage();
    const chunks: CachedPositionChunk[] = [];
    for (let pointOffset = 0; pointOffset < attribute.count; pointOffset += this.maxChunkPoints) {
      const count = Math.min(this.maxChunkPoints, attribute.count - pointOffset);
      const packed =
        attribute.itemSize === 3 && !attribute.normalized && sourceArray instanceof Float32Array
          ? sourceArray.subarray(pointOffset * 3, (pointOffset + count) * 3)
          : this.packPositions(attribute, pointOffset, count);
      const buffer = this.device.createBuffer({
        size: Math.max(4, packed.byteLength),
        usage: usage.STORAGE | usage.COPY_DST,
      });
      this.device.queue.writeBuffer(buffer, 0, packed);
      chunks.push({ buffer, pointOffset, count });
      this.ownedPositionBuffers.add(buffer);
    }
    const cached = { chunks, version, count: attribute.count };
    this.positionBuffers.set(attribute, cached);
    return cached;
  }

  private packPositions(
    attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
    pointOffset: number,
    count: number
  ): Float32Array {
    const packed = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const base = i * 3;
      const sourceIndex = pointOffset + i;
      packed[base] = attribute.getX(sourceIndex);
      packed[base + 1] = attribute.getY(sourceIndex);
      packed[base + 2] = attribute.getZ(sourceIndex);
    }
    return packed;
  }

  private attributeVersion(
    attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute
  ): number {
    return (attribute as any).isInterleavedBufferAttribute === true
      ? (attribute as THREE.InterleavedBufferAttribute).data.version
      : (attribute as THREE.BufferAttribute).version;
  }

  private async withErrorScopes<T>(operation: () => Promise<T>): Promise<T> {
    // WebGPU validation and allocation failures are asynchronous. Without
    // scopes an invalid bind group can merely discard the dispatch and look
    // exactly like a legitimate "no point hit" result.
    this.device.pushErrorScope('validation');
    this.device.pushErrorScope('out-of-memory');
    let result: T | undefined;
    let operationError: unknown = null;
    try {
      result = await operation();
    } catch (error) {
      operationError = error;
    }

    const outOfMemory = await this.device.popErrorScope();
    const validation = await this.device.popErrorScope();
    const gpuError = outOfMemory ?? validation;
    if (gpuError) {
      throw new Error(`WebGPU picker error: ${gpuError.message ?? String(gpuError)}`);
    }
    if (operationError) {throw operationError;}
    return result as T;
  }

  private makeUniformData(
    mesh: THREE.Points,
    viewProjection: THREE.Matrix4,
    mouseX: number,
    mouseY: number,
    canvas: HTMLCanvasElement,
    context: SelectionContext,
    count: number,
    idOffset: number
  ): ArrayBuffer {
    // 2 matrices + 4 vec4 blocks + 8 clipping-plane vec4s.
    const data = new ArrayBuffer(64 * 2 + 16 * 4 + 16 * MAX_CLIPPING_PLANES);
    const floats = new Float32Array(data);
    const uints = new Uint32Array(data);
    const mvp = new THREE.Matrix4().multiplyMatrices(viewProjection, mesh.matrixWorld);
    floats.set(mvp.elements, 0);
    floats.set(mesh.matrixWorld.elements, 16);
    floats.set([canvas.clientWidth, canvas.clientHeight, mouseX, mouseY], 32);

    const material = mesh.material as THREE.PointsMaterial;
    floats.set(
      [material.size, material.sizeAttenuation ? 1 : 0, context.screenSpaceScaling ? 1 : 0, 150],
      36
    );
    uints.set([count, idOffset, context.clippingPlanes?.length ?? 0, 0], 40);
    // Slot 44 is padding so the clipping-plane array starts after four vec4 blocks.
    let planeOffset = 48;
    for (const plane of context.clippingPlanes ?? []) {
      floats.set([plane.normal.x, plane.normal.y, plane.normal.z, plane.constant], planeOffset);
      planeOffset += 4;
    }
    return data;
  }

  private describeHit(
    mesh: THREE.Points,
    pointIndex: number,
    mouseX: number,
    mouseY: number,
    canvas: HTMLCanvasElement,
    context: SelectionContext
  ): PointPickHit {
    const attribute = mesh.geometry.getAttribute('position');
    const local = new THREE.Vector3().fromBufferAttribute(attribute, pointIndex);
    const projected = local.clone().applyMatrix4(mesh.matrixWorld).project(context.camera);
    const sx = (projected.x * 0.5 + 0.5) * canvas.clientWidth;
    const sy = (projected.y * -0.5 + 0.5) * canvas.clientHeight;
    const cameraPoint = local
      .clone()
      .applyMatrix4(mesh.matrixWorld)
      .applyMatrix4(context.camera.matrixWorldInverse);
    const viewDepth = -cameraPoint.z;
    const material = mesh.material as THREE.PointsMaterial;
    let renderedSize = material.size;
    if (material.sizeAttenuation && !context.screenSpaceScaling) {
      renderedSize = (material.size * canvas.clientHeight * 0.5) / Math.max(viewDepth, 0.001);
    }
    const extraPadding = Math.min(20, renderedSize * 0.2);
    let pixelRadius = renderedSize * 0.5 + 3 + extraPadding;
    if (viewDepth < 0.01) {pixelRadius = Math.max(pixelRadius, renderedSize * 0.75);}
    pixelRadius = Math.min(150, pixelRadius);
    return {
      mesh,
      pointIndex,
      viewDepth,
      pixelDistance: Math.hypot(sx - mouseX, sy - mouseY),
      renderedSize,
      pixelRadius,
    };
  }
}

function gpuBufferUsage(): any {
  return (globalThis as any).GPUBufferUsage;
}

function gpuShaderStage(): any {
  return (globalThis as any).GPUShaderStage;
}

function gpuMapMode(): any {
  return (globalThis as any).GPUMapMode;
}

const PICK_SHADER = /* wgsl */ `
struct Params {
  mvp: mat4x4<f32>,
  world: mat4x4<f32>,
  viewport_mouse: vec4<f32>,
  point_params: vec4<f32>,
  counts: vec4<u32>,
  padding: vec4<u32>,
  clipping_planes: array<vec4<f32>, ${MAX_CLIPPING_PLANES}>,
}

struct Result {
  best_depth: atomic<u32>,
  best_id: atomic<u32>,
}

@group(0) @binding(0) var<storage, read> positions: array<f32>;
@group(0) @binding(1) var<uniform> params: Params;
@group(0) @binding(2) var<storage, read_write> result: Result;

fn candidate(index: u32) -> vec2<u32> {
  let base = index * 3u;
  let local = vec4<f32>(positions[base], positions[base + 1u], positions[base + 2u], 1.0);
  let clip = params.mvp * local;
  let depth = clip.w;
  if (!(depth >= 0.000001)) { return vec2<u32>(0xffffffffu); }

  let screen = vec2<f32>(
    (clip.x / depth * 0.5 + 0.5) * params.viewport_mouse.x,
    (clip.y / depth * -0.5 + 0.5) * params.viewport_mouse.y
  );
  let delta = screen - params.viewport_mouse.zw;
  let pixel_distance_sq = dot(delta, delta);
  let max_radius = params.point_params.w;
  if (pixel_distance_sq > max_radius * max_radius) { return vec2<u32>(0xffffffffu); }

  if (params.counts.z > 0u) {
    let world_point = params.world * local;
    for (var i = 0u; i < params.counts.z; i++) {
      let plane = params.clipping_planes[i];
      if (dot(plane.xyz, world_point.xyz) + plane.w < 0.0) {
        return vec2<u32>(0xffffffffu);
      }
    }
  }

  var rendered_size = params.point_params.x;
  if (params.point_params.y > 0.5 && params.point_params.z < 0.5) {
    rendered_size = params.point_params.x * params.viewport_mouse.y * 0.5 / max(depth, 0.001);
  }
  let extra_padding = min(20.0, rendered_size * 0.2);
  var radius = rendered_size * 0.5 + 3.0 + extra_padding;
  if (depth < 0.01) { radius = max(radius, rendered_size * 0.75); }
  radius = min(max_radius, radius);
  if (pixel_distance_sq > radius * radius) { return vec2<u32>(0xffffffffu); }
  return vec2<u32>(bitcast<u32>(depth), params.counts.y + index);
}

@compute @workgroup_size(256)
fn find_depth(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= params.counts.x) { return; }
  let value = candidate(gid.x);
  if (value.x != 0xffffffffu) { atomicMin(&result.best_depth, value.x); }
}

@compute @workgroup_size(256)
fn find_id(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= params.counts.x) { return; }
  let value = candidate(gid.x);
  if (value.x == atomicLoad(&result.best_depth)) { atomicMin(&result.best_id, value.y); }
}
`;
