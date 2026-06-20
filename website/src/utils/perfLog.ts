/**
 * Lightweight, consistent phase timing for the load pipelines.
 *
 * Goal: produce directly-comparable single-line summaries for every load path
 * (binary PLY, depth TIFF, etc.) so we can see exactly where time goes and
 * compare formats apples-to-apples.
 *
 * Output format (one line per load):
 *   ⏱️ PERF[ply] transfer 12.0ms  parse 84.3ms  geometry 9.1ms  | total 110ms  (verts=1500000)
 *
 * Clock note: use performance.now() for intra-process phase deltas. For the
 * cross-process extension→webview "transfer" phase, pass a wall-clock
 * Date.now() epoch from the extension (postedAt) into `transferSince()` — the
 * two processes don't share a performance.now() origin, but do share Date.now().
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

export class PerfTimer {
  private readonly kind: string;
  private readonly t0: number;
  private last: number;
  private readonly marks: Array<[string, number]> = [];
  private readonly extra: Record<string, string | number> = {};

  constructor(kind: string, startedAt?: number) {
    this.kind = kind;
    this.t0 = startedAt ?? performance.now();
    this.last = this.t0;
  }

  /** Record the elapsed time since the previous mark as a named phase. */
  mark(phase: string): number {
    const now = performance.now();
    const dt = now - this.last;
    this.marks.push([phase, +dt.toFixed(1)]);
    this.last = now;
    return dt;
  }

  /** Record an externally-measured phase duration (ms). */
  add(phase: string, ms: number): void {
    this.marks.push([phase, +ms.toFixed(1)]);
    this.last = performance.now();
  }

  /**
   * Record the cross-process transfer phase from a wall-clock epoch stamped by
   * the extension just before postMessage. Resets the phase cursor so the next
   * mark() measures from "now" (message receipt), not from postedAt.
   */
  transferSince(postedAt: number | undefined): void {
    if (typeof postedAt === 'number' && isFinite(postedAt)) {
      this.marks.push(['transfer', +Math.max(0, Date.now() - postedAt).toFixed(1)]);
    }
    this.last = performance.now();
  }

  /** Attach contextual key=value metadata shown in parentheses at the end. */
  note(key: string, value: string | number): void {
    this.extra[key] = value;
  }

  /** Emit (and return) the consolidated summary line. */
  summary(): string {
    const total = (performance.now() - this.t0).toFixed(1);
    const phases = this.marks.map(([p, ms]) => `${p} ${ms}ms`).join('  ');
    const extras = Object.entries(this.extra)
      .map(([k, v]) => `${k}=${v}`)
      .join(' ');
    const line = `⏱️ PERF[${this.kind}] ${phases}  | total ${total}ms${
      extras ? `  (${extras})` : ''
    }`;
    perfLog(line);
    return line;
  }
}
