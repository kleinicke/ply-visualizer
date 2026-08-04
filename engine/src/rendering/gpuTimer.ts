/**
 * Per-frame GPU time, behind a backend-neutral interface.
 *
 * Two implementations, because the backends measure nothing alike. WebGL uses
 * `EXT_disjoint_timer_query` and brackets the draw with explicit begin/end
 * calls on the raw graphics context. WebGPU has no such extension: timestamps
 * are enabled once by constructing the renderer with `trackTimestamp: true`,
 * three brackets the render pass itself, and the result is read back
 * asynchronously from `renderer.info`.
 *
 * Keeping that difference here means the render loop calls the same three
 * methods either way. `renderStats.ts` owns FPS and CPU frame time and is
 * already backend-neutral.
 *
 * **The two numbers are not strictly comparable.** WebGL's query brackets
 * whatever the viewer draws between `begin()` and `end()`; WebGPU's brackets
 * three's render pass. They measure nearly the same work, but a difference of a
 * few percent between backends should not be read as a real difference.
 */
export interface GpuTimer {
  /** False when the backend cannot measure GPU time; callers fall back to CPU time. */
  readonly available: boolean;
  /** Opens a measurement around the coming draw. */
  begin(): void;
  /** Closes the measurement opened by `begin`. */
  end(): void;
  /**
   * Collects whatever finished since the last call. GPU timings are
   * asynchronous, so this returns completed measurements, not this frame's.
   */
  poll(): void;
  /** Rolling average in milliseconds, or 0 when nothing has been measured. */
  readonly averageMs: number;
}

/** Used when the backend offers no timing, so callers need no null checks. */
export const NULL_GPU_TIMER: GpuTimer = {
  available: false,
  begin() {},
  end() {},
  poll() {},
  averageMs: 0,
};

/** Frames averaged for the displayed figure. */
const SAMPLE_WINDOW = 30;

const NANOSECONDS_PER_MS = 1_000_000;

interface TimerExtension {
  TIME_ELAPSED_EXT: number;
  GPU_DISJOINT_EXT: number;
  QUERY_RESULT_AVAILABLE_EXT?: number;
  QUERY_RESULT_EXT?: number;
  createQueryEXT?(): unknown;
  beginQueryEXT?(target: number, query: unknown): void;
  endQueryEXT?(target: number): void;
  getQueryObjectEXT?(query: unknown, pname: number): number | boolean;
  deleteQueryEXT?(query: unknown): void;
}

/**
 * WebGL implementation. WebGL2 exposes the query calls on the context itself
 * while WebGL1 puts them on the extension object, so each operation picks
 * whichever pair exists.
 */
export class WebGLGpuTimer implements GpuTimer {
  private readonly gl: any;
  private readonly extension: TimerExtension | null;
  private readonly pending: unknown[] = [];
  private readonly samples: number[] = [];
  private average = 0;
  private open: unknown = null;

  constructor(gl: WebGLRenderingContext | WebGL2RenderingContext) {
    this.gl = gl;
    this.extension =
      (gl.getExtension('EXT_disjoint_timer_query_webgl2') as TimerExtension | null) ??
      (gl.getExtension('EXT_disjoint_timer_query') as TimerExtension | null);
  }

  get available(): boolean {
    return this.extension !== null;
  }

  get averageMs(): number {
    return this.average;
  }

  begin(): void {
    if (!this.extension || this.open) {
      return;
    }
    if (this.gl.createQuery) {
      const query = this.gl.createQuery();
      this.gl.beginQuery(this.extension.TIME_ELAPSED_EXT, query);
      this.open = query;
    } else if (this.extension.createQueryEXT && this.extension.beginQueryEXT) {
      const query = this.extension.createQueryEXT();
      this.extension.beginQueryEXT(this.extension.TIME_ELAPSED_EXT, query);
      this.open = query;
    }
  }

  end(): void {
    if (!this.extension || !this.open) {
      return;
    }
    if (this.gl.endQuery) {
      this.gl.endQuery(this.extension.TIME_ELAPSED_EXT);
    } else if (this.extension.endQueryEXT) {
      this.extension.endQueryEXT(this.extension.TIME_ELAPSED_EXT);
    }
    this.pending.push(this.open);
    this.open = null;
  }

  poll(): void {
    if (!this.extension) {
      return;
    }
    // A disjoint event means the GPU was interrupted and every in-flight
    // timing is meaningless, so the whole batch is discarded rather than
    // averaged in.
    const disjoint = this.gl.getParameter(this.extension.GPU_DISJOINT_EXT);

    for (let i = this.pending.length - 1; i >= 0; i--) {
      const query = this.pending[i];
      const result = this.readQuery(query);
      if (result === null) {
        continue;
      }
      if (!disjoint) {
        this.record(result / NANOSECONDS_PER_MS);
      }
      this.deleteQuery(query);
      this.pending.splice(i, 1);
    }
  }

  private readQuery(query: unknown): number | null {
    if (this.gl.getQueryParameter) {
      if (!this.gl.getQueryParameter(query, this.gl.QUERY_RESULT_AVAILABLE)) {
        return null;
      }
      return this.gl.getQueryParameter(query, this.gl.QUERY_RESULT) as number;
    }
    const ext = this.extension;
    if (!ext?.getQueryObjectEXT) {
      return null;
    }
    if (!ext.getQueryObjectEXT(query, ext.QUERY_RESULT_AVAILABLE_EXT!)) {
      return null;
    }
    return ext.getQueryObjectEXT(query, ext.QUERY_RESULT_EXT!) as number;
  }

  private deleteQuery(query: unknown): void {
    if (this.gl.deleteQuery) {
      this.gl.deleteQuery(query);
    } else {
      this.extension?.deleteQueryEXT?.(query);
    }
  }

  private record(timeMs: number): void {
    this.samples.push(timeMs);
    if (this.samples.length > SAMPLE_WINDOW) {
      this.samples.shift();
    }
    this.average = this.samples.reduce((total, value) => total + value, 0) / this.samples.length;
  }
}

/** The subset of three's WebGPU renderer this file needs, kept import-free. */
interface TimestampCapableRenderer {
  isWebGPURenderer?: boolean;
  hasFeature?(name: string): boolean;
  resolveTimestampsAsync?(): Promise<number | undefined>;
  info?: { render?: { timestamp?: number } };
}

/**
 * WebGPU implementation.
 *
 * three brackets the render pass itself when the renderer is built with
 * `trackTimestamp: true`, so `begin`/`end` have nothing to do. The work is all
 * in `poll`: resolving timestamps is asynchronous, and asking for a second
 * resolve while the first is in flight both wastes work and can interleave
 * results, so only one request is ever outstanding.
 */
export class WebGPUGpuTimer implements GpuTimer {
  private readonly renderer: TimestampCapableRenderer;
  private readonly samples: number[] = [];
  private average = 0;
  private resolving = false;
  private supported: boolean;

  constructor(renderer: TimestampCapableRenderer) {
    this.renderer = renderer;
    // 'timestamp-query' is an optional WebGPU feature; adapters may omit it,
    // and browsers gate it behind precision settings. Without it three still
    // renders, it just never reports a timestamp.
    this.supported = renderer.hasFeature?.('timestamp-query') === true;
  }

  get available(): boolean {
    return this.supported;
  }

  get averageMs(): number {
    return this.average;
  }

  begin(): void {}

  end(): void {}

  poll(): void {
    if (!this.supported || this.resolving || !this.renderer.resolveTimestampsAsync) {
      return;
    }
    this.resolving = true;
    this.renderer
      .resolveTimestampsAsync()
      .then(elapsed => {
        // The promise resolves with the duration in milliseconds; older three
        // revisions only update renderer.info, so fall back to that.
        const timeMs = elapsed ?? this.renderer.info?.render?.timestamp;
        if (typeof timeMs === 'number' && timeMs > 0) {
          this.record(timeMs);
        }
      })
      .catch(() => {
        // A rejected resolve means the backend withdrew timing support (device
        // lost, feature disabled mid-run). Stop asking rather than spinning.
        this.supported = false;
      })
      .finally(() => {
        this.resolving = false;
      });
  }

  private record(timeMs: number): void {
    this.samples.push(timeMs);
    if (this.samples.length > SAMPLE_WINDOW) {
      this.samples.shift();
    }
    this.average = this.samples.reduce((total, value) => total + value, 0) / this.samples.length;
  }
}

/**
 * Builds the timer for the renderer in use: timestamp queries for WebGPU, the
 * disjoint-timer extension for WebGL, and the null timer when neither backend
 * can measure anything.
 */
export function createGpuTimer(renderer: unknown): GpuTimer {
  const candidate = renderer as TimestampCapableRenderer;
  if (candidate.isWebGPURenderer === true) {
    const timer = new WebGPUGpuTimer(candidate);
    return timer.available ? timer : NULL_GPU_TIMER;
  }

  const getContext = (renderer as { getContext?: () => unknown }).getContext;
  if (typeof getContext !== 'function') {
    return NULL_GPU_TIMER;
  }
  const context = getContext.call(renderer);
  if (
    typeof WebGLRenderingContext !== 'undefined' &&
    context instanceof WebGLRenderingContext === false &&
    (typeof WebGL2RenderingContext === 'undefined' ||
      context instanceof WebGL2RenderingContext === false)
  ) {
    return NULL_GPU_TIMER;
  }
  const timer = new WebGLGpuTimer(context as WebGLRenderingContext);
  return timer.available ? timer : NULL_GPU_TIMER;
}
