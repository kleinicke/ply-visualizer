import type { ViewerLifetime } from '../utils/viewerLifetime';

/**
 * How long the loop keeps ticking after the last frame that did anything. Long
 * enough for control damping to settle and for the FPS readout (a one-second
 * window) to fall back to zero before the loop stops.
 */
export const IDLE_SLEEP_MS = 1200;

/** How often a sleeping loop looks for a camera moved without a render request. */
const WATCHDOG_MS = 250;

/**
 * Lets the render loop stop while nothing changes.
 *
 * Rendering was already on demand, but the requestAnimationFrame loop itself
 * ran forever to watch the camera: ~3% of a core per open viewer, at the
 * display's 120 Hz, plus a compositor wake-up every frame, for a scene that
 * was standing still. The loop now sleeps after `IDLE_SLEEP_MS` of
 * inactivity. Anything that can need a frame wakes it: a render request, user
 * input (which drives the camera controls) and host messages. A low-rate
 * watchdog catches code that moves the camera without asking for a render,
 * which the running loop used to notice on its own.
 */
export class RenderLoopSleep {
  private sleeping = false;
  private lastActiveAt = performance.now();
  private watchdog: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly lifetime: ViewerLifetime,
    private readonly resume: () => void,
    private readonly cameraChanged: () => boolean
  ) {
    const wake = () => this.wake();
    for (const type of ['pointerdown', 'pointermove', 'wheel', 'keydown', 'keyup'] as const) {
      lifetime.listen(document, type, wake, { capture: true, passive: true });
    }
    lifetime.listen(document, 'touchstart', wake, { capture: true, passive: true });
    lifetime.listen(window, 'message', wake);
    lifetime.add(() => this.cancel());
  }

  /**
   * Called at the end of every loop tick. True when the loop should stop: the
   * caller cancels its next frame.
   */
  tick(active: boolean, canSleep: boolean): boolean {
    const now = performance.now();
    if (active || !canSleep) {
      this.lastActiveAt = now;
      return false;
    }
    if (now - this.lastActiveAt < IDLE_SLEEP_MS) {
      return false;
    }
    this.sleeping = true;
    this.watchdog = setInterval(() => {
      if (this.cameraChanged()) {
        this.wake();
      }
    }, WATCHDOG_MS);
    return true;
  }

  /** Restart a loop that went to sleep. A loop stopped on purpose stays stopped. */
  wake(): void {
    if (!this.sleeping || this.lifetime.disposed) {
      return;
    }
    this.cancel();
    this.lastActiveAt = performance.now();
    this.resume();
  }

  /** Forget the sleep, e.g. because the loop was stopped explicitly. */
  cancel(): void {
    this.sleeping = false;
    if (this.watchdog !== null) {
      clearInterval(this.watchdog);
      this.watchdog = null;
    }
  }
}
