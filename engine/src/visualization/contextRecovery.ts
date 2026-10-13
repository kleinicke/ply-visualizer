import { mount, unmount } from 'svelte';
import { writable } from 'svelte/store';
import type { ViewerLifetime } from '../utils/viewerLifetime';
import ContextRecovery from '../components/ContextRecovery.svelte';

/**
 * `released` is a context lost while the viewer was hidden: either given up on
 * purpose (see RELEASE_HIDDEN_AFTER_MS) or evicted by the browser. It is
 * restored silently when the viewer is shown again.
 */
export type ContextRecoveryState = 'running' | 'lost' | 'paused' | 'released';

/**
 * How long a viewer stays hidden before it hands its WebGL context back.
 *
 * Every VS Code webview runs in ONE renderer process, and Chromium keeps at
 * most 16 WebGL contexts alive per process: opening a 17th file loses the
 * least recently used context, and an evicted context only comes back when
 * another one is destroyed. A hidden viewer that has already released its
 * context is the one evicted, and the release also frees its VRAM. Showing the
 * viewer again restores the context and re-uploads the scene from CPU memory,
 * in tens of milliseconds for a few million points. The delay keeps quick tab
 * switches from paying that.
 */
export const RELEASE_HIDDEN_AFTER_MS = 10000;

/** How long `ensureResident` waits for a restore before giving up. */
const RESTORE_TIMEOUT_MS = 5000;

export interface ContextResidency {
  /** Reported by the host (VS Code webview visibility, browser tab visibility). */
  setHidden(hidden: boolean): void;
  /**
   * Bring a released context back before work that needs the GPU while hidden
   * (an agent screenshot). Resolves once rendering is live again, or at once if
   * it never stopped. Does nothing about a loss the user still has to resume.
   */
  ensureResident(): Promise<void>;
}

/**
 * A context lost while the viewer is visible pauses and waits for the user,
 * because it is most likely a GPU reset or memory pressure, and replaying a
 * possibly oversized upload can lose it again. A context lost while hidden was
 * rendering that same scene a moment ago, so it is restored and resumed
 * without asking.
 */
export interface ContextReleasePolicy {
  /**
   * False while a deliberate release would interrupt something (a load, a
   * recording) or lose what three.js cannot rebuild (Spark's splat state);
   * the release is then retried after another delay.
   */
  canRelease(): boolean;
  /** Free GPU memory the WebGL context does not own (the WebGPU helpers). */
  beforeRelease(): void;
}

export function setupContextRecovery(
  canvas: HTMLCanvasElement,
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  lifetime: ViewerLifetime,
  pause: () => void,
  resume: () => void,
  policy?: ContextReleasePolicy
): ContextResidency {
  let current: ContextRecoveryState = 'running';
  const state = writable<ContextRecoveryState>(current);
  const set = (next: ContextRecoveryState) => {
    current = next;
    state.set(next);
  };
  // getExtension returns null once the context is lost, so this has to be
  // taken now, while it is still alive.
  const loseContext = gl.getExtension('WEBGL_lose_context');
  let hidden = document.visibilityState === 'hidden';
  let releaseTimer: ReturnType<typeof setTimeout> | undefined;
  let waiters: Array<() => void> = [];

  const settleWaiters = () => {
    const done = waiters;
    waiters = [];
    done.forEach(resolve => resolve());
  };
  const cancelRelease = () => {
    if (releaseTimer !== undefined) {
      clearTimeout(releaseTimer);
      releaseTimer = undefined;
    }
  };
  const scheduleRelease = () => {
    cancelRelease();
    if (!loseContext || !hidden || current !== 'running') {
      return;
    }
    releaseTimer = setTimeout(() => {
      releaseTimer = undefined;
      if (!hidden || current !== 'running' || lifetime.disposed || gl.isContextLost()) {
        return;
      }
      if (policy && !policy.canRelease()) {
        scheduleRelease();
        return;
      }
      policy?.beforeRelease();
      loseContext.loseContext();
    }, RELEASE_HIDDEN_AFTER_MS);
  };
  const restore = () => {
    if (current !== 'released' || !loseContext || lifetime.disposed) {
      return;
    }
    if (gl.isContextLost()) {
      loseContext.restoreContext();
    } else {
      // The browser already handed an evicted context back while hidden.
      set('running');
      resume();
      settleWaiters();
    }
  };

  const component = mount(ContextRecovery, {
    target: (() => {
      const target = document.createElement('div');
      document.body.appendChild(target);
      lifetime.add(() => target.remove());
      return target;
    })(),
    props: {
      state,
      resume: () => {
        if (current !== 'paused' || lifetime.disposed) {
          return;
        }
        set('running');
        resume();
      },
    },
  });
  lifetime.listen(canvas, 'webglcontextlost', event => {
    event.preventDefault();
    cancelRelease();
    pause();
    set(hidden ? 'released' : 'lost');
  });
  lifetime.listen(canvas, 'webglcontextrestored', () => {
    // Three.js has recreated its internal state; the scene re-uploads on the
    // next render.
    if (current === 'released' && (!hidden || waiters.length > 0)) {
      set('running');
      resume();
      settleWaiters();
      scheduleRelease();
    } else if (current !== 'released') {
      set('paused');
    }
    // Restored while still hidden and nobody waiting: stay released until shown.
  });
  lifetime.listen(document, 'visibilitychange', () => {
    residency.setHidden(document.visibilityState === 'hidden');
  });
  lifetime.add(() => {
    cancelRelease();
    settleWaiters();
    void unmount(component);
  });

  const residency: ContextResidency = {
    setHidden(next) {
      if (next === hidden) {
        return;
      }
      hidden = next;
      if (hidden) {
        scheduleRelease();
      } else {
        cancelRelease();
        restore();
      }
    },
    ensureResident() {
      if (current !== 'released' || !loseContext || lifetime.disposed) {
        return Promise.resolve();
      }
      return new Promise<void>(resolve => {
        const timer = setTimeout(resolve, RESTORE_TIMEOUT_MS);
        waiters.push(() => {
          clearTimeout(timer);
          resolve();
        });
        restore();
      });
    },
  };
  return residency;
}
