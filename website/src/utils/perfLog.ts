/**
 * Consistent, single-line phase timing for every load path.
 *
 * One clock for the whole pipeline: wall-clock `Date.now()`, which is shared by
 * the extension host and the webview (same machine). The extension stamps two
 * epochs on each load — `loadStartedAt` (when it starts reading the file) and
 * `postedAt` (just before it posts the data) — and the webview adds `receivedAt`
 * (construction) and `doneAt` (summary). Every phase is then the gap between two
 * adjacent epochs, so the phases ALWAYS sum to the total, by construction:
 *
 *   read+parse = postedAt   - loadStartedAt   (extension: disk read + parse)
 *   transfer   = receivedAt - postedAt         (data crossing into the webview)
 *   build      = doneAt     - receivedAt        (geometry + GPU upload + 1st frame)
 *   total      = doneAt     - loadStartedAt     (honest end-to-end the user waits)
 *
 * The webview sub-divides its own span with performance.now() marks (e.g. binary
 * PLY: fetch / parse / build) when a finer breakdown is useful.
 *
 * Output (one line per load):
 *   ⏱️ PERF[xyz] read+parse 4318ms · transfer 341ms · build 276ms | total 4935ms  (7,899,730 pts · 599 MB · wasm-stream)
 */
type PerfSink = (line: string) => void;

let sink: PerfSink | null = null;

/**
 * Register a destination for PERF lines (in addition to the devtools console).
 * The webview wires this to a postMessage that the extension writes into its
 * "3D Visualizer" Output channel. Left unset in the standalone website.
 */
export function setPerfSink(fn: PerfSink | null): void {
  sink = fn;
}

/** Emit a PERF line to the console and the registered sink (if any). */
export function perfLog(line: string): void {
  console.log(line);
  if (sink) {
    try {
      sink(line);
    } catch {
      /* never let logging break the load path */
    }
  }
}

const isEpoch = (v: unknown): v is number => typeof v === 'number' && isFinite(v) && v > 0;

export class PerfTimer {
  private readonly kind: string;
  private readonly t0: number; // performance.now() at construction (webview span start)
  private readonly receivedAt: number; // Date.now() at construction (message receipt)
  private readonly loadStartedAt?: number; // Date.now() epoch stamped by the extension
  private readonly postedAt?: number; // Date.now() epoch stamped by the extension
  private last: number;
  private readonly marks: Array<[string, number]> = [];
  private readonly extra: Record<string, string | number> = {};

  /**
   * @param loadStartedAt wall-clock epoch (Date.now) when the extension began the
   *   load — drives `read+parse` and the honest `total`. Omitted on the website.
   * @param postedAt wall-clock epoch (Date.now) stamped just before the extension
   *   posted the data — drives `transfer`.
   */
  constructor(kind: string, loadStartedAt?: number, postedAt?: number, receivedAt?: number) {
    this.kind = kind;
    this.t0 = performance.now();
    // `receivedAt` can be supplied for paths where the timer is built after some
    // webview work already happened (e.g. binary PLY constructs it after the
    // fetch, but passes the URI-receipt epoch so `transfer` excludes the fetch).
    this.receivedAt = isEpoch(receivedAt) ? receivedAt : Date.now();
    this.loadStartedAt = isEpoch(loadStartedAt) ? loadStartedAt : undefined;
    this.postedAt = isEpoch(postedAt) ? postedAt : undefined;
    this.last = this.t0;
  }

  /** Record the elapsed time since the previous mark as a named webview phase. */
  mark(phase: string): number {
    const now = performance.now();
    const dt = now - this.last;
    this.marks.push([phase, +dt.toFixed(1)]);
    this.last = now;
    return dt;
  }

  /** Record an externally-measured phase duration (ms), e.g. a fetch timed elsewhere. */
  add(phase: string, ms: number): void {
    this.marks.push([phase, +Math.max(0, ms).toFixed(1)]);
    this.last = performance.now();
  }

  /** Attach contextual key=value metadata shown in parentheses at the end. */
  note(key: string, value: string | number): void {
    this.extra[key] = value;
  }

  /** Emit (and return) the consolidated single-line summary. */
  summary(): string {
    const doneAt = Date.now();
    const phases: Array<[string, number]> = [];

    // Cross-process phases from the shared wall clock (sum exactly into total).
    if (this.loadStartedAt != null && this.postedAt != null) {
      phases.push(['read+parse', +Math.max(0, this.postedAt - this.loadStartedAt).toFixed(1)]);
    }
    if (this.postedAt != null) {
      phases.push(['transfer', +Math.max(0, this.receivedAt - this.postedAt).toFixed(1)]);
    }

    // Webview phases (build, or fetch/parse/build) measured with performance.now.
    phases.push(...this.marks);

    // Honest end-to-end: wall-clock when anchored, else the webview span.
    const totalMs =
      this.loadStartedAt != null
        ? Math.max(0, doneAt - this.loadStartedAt)
        : performance.now() - this.t0;

    const phaseStr = phases.map(([p, ms]) => `${p} ${ms}ms`).join(' · ');
    const extras = Object.entries(this.extra)
      .map(([, v]) => `${v}`)
      .join(' · ');
    const line = `⏱️ PERF[${this.kind}] ${phaseStr} | total ${totalMs.toFixed(1)}ms${
      extras ? `  (${extras})` : ''
    }`;
    perfLog(line);
    return line;
  }
}
