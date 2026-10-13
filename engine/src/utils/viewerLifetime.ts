/** Callbacks, listeners and timers owned by one viewer instance. */
type ViewerEvents = WindowEventMap & {
  webglcontextlost: Event;
  webglcontextrestored: Event;
  visibilitychange: Event;
};
export class ViewerLifetime {
  private readonly controller = new AbortController();
  private cleanups: (() => void)[] = [];
  get signal(): AbortSignal {
    return this.controller.signal;
  }
  get disposed(): boolean {
    return this.signal.aborted;
  }
  add(cleanup: () => void): void {
    if (this.disposed) {
      cleanup();
    } else {
      this.cleanups.push(cleanup);
    }
  }
  listen<K extends keyof ViewerEvents>(
    target: EventTarget,
    type: K,
    listener: (event: ViewerEvents[K]) => void,
    options?: boolean | AddEventListenerOptions
  ): void {
    target.addEventListener(type, listener as EventListener, {
      ...(typeof options === 'boolean' ? { capture: options } : options),
      signal: this.signal,
    });
  }
  defer(callback: () => void): void {
    const timer = setTimeout(() => {
      if (!this.disposed) {
        callback();
      }
    }, 0);
    this.add(() => clearTimeout(timer));
  }
  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.controller.abort();
    for (const cleanup of this.cleanups.splice(0).reverse()) {
      cleanup();
    }
  }
}
