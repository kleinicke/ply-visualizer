/**
 * Per-frame GPU time, behind a backend-neutral interface.
 *
 * The only implementation today is WebGL's `EXT_disjoint_timer_query`, which is
 * the single place in the viewer that reaches through the renderer to the raw
 * graphics context. WebGPU has no equivalent extension - it exposes timestamp
 * queries, enabled by constructing the renderer with `trackTimestamp: true` and
 * read back from `renderer.info`, which is a different shape entirely.
 *
 * Keeping that difference behind `GpuTimer` means adding a WebGPU backend is a
 * new file implementing three methods, rather than an edit to the render loop.
 * `renderStats.ts` owns FPS and CPU frame time and is already backend-neutral.
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

/**
 * Builds the timer for the renderer in use. Only a WebGL renderer exposes
 * `getContext`; anything else gets the null timer until a backend-specific
 * implementation exists.
 */
export function createGpuTimer(renderer: unknown): GpuTimer {
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
