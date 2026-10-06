import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

type FrameRequest = { path: string; index: number; requestId: string };

/** One active read and one replaceable target per panel, including during scrubbing. */
export class SequenceFileReader {
  private latest: FrameRequest | undefined;
  private active: { request: FrameRequest; controller: AbortController } | undefined;
  private draining = false;
  private disposed = false;

  constructor(
    private readonly send: (message: { type: string; [key: string]: unknown }) => unknown,
    private readonly read: (path: string, signal: AbortSignal) => Promise<Uint8Array> = (
      path,
      signal
    ) => readFile(path, { signal })
  ) {}

  async request(request: FrameRequest): Promise<void> {
    if (this.disposed) {
      return;
    }
    this.latest = request;
    this.active?.controller.abort();
    if (this.draining) {
      return;
    }
    this.draining = true;
    try {
      while (this.latest && !this.disposed) {
        const next = this.latest;
        this.latest = undefined;
        const controller = new AbortController();
        this.active = { request: next, controller };
        try {
          const bytes = await this.read(next.path, controller.signal);
          if (!controller.signal.aborted) {
            await this.send({
              type: 'sequence:file',
              index: next.index,
              requestId: next.requestId,
              fileName: basename(next.path),
              data: new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength),
            });
          }
        } catch (error) {
          if (!controller.signal.aborted) {
            await this.send({
              type: 'sequence:file:error',
              index: next.index,
              requestId: next.requestId,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        } finally {
          this.active = undefined;
        }
      }
    } finally {
      this.draining = false;
    }
  }

  cancel(requestId: string): void {
    if (this.latest?.requestId === requestId) {
      this.latest = undefined;
    }
    if (this.active?.request.requestId === requestId) {
      this.active.controller.abort();
    }
  }

  dispose(): void {
    this.disposed = true;
    this.latest = undefined;
    this.active?.controller.abort();
  }
}
