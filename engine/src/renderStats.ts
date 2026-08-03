import { uiState } from './state/ui.svelte';
import type { GpuTimer } from './rendering/gpuTimer';

/**
 * FPS and frame-time tracking for the render loop. Extracted out of
 * PointCloudVisualizer; main.ts's animate() still owns frame scheduling and
 * calls into these functions each frame.
 *
 * GPU timing itself lives in rendering/gpuTimer.ts behind a backend-neutral
 * interface - the query juggling here was WebGL-only. This module just reads
 * the measurement for display.
 */
export interface RenderStatsHost {
  gpuTimer: GpuTimer;

  fpsFrameTimes: number[];
  previousFps: number;
  currentFps: number;
  lastFpsUpdate: number;
  frameRenderTimes: number[];
  currentFrameTime: number;
}

export function trackRender(host: RenderStatsHost): void {
  // Record a render event
  const now = performance.now();
  host.fpsFrameTimes.push(now);
}

export function trackFrameTime(host: RenderStatsHost, frameTimeMs: number): void {
  // Check if we're transitioning from 0 FPS (idle) to active rendering
  const wasIdle = host.previousFps === 0 && host.currentFps > 0;

  if (wasIdle) {
    // Reset frame history when restarting from idle
    host.frameRenderTimes = [frameTimeMs];
    host.currentFrameTime = frameTimeMs;
  } else {
    // Add current frame time to history
    host.frameRenderTimes.push(frameTimeMs);

    // Keep only last 30 frame times for averaging
    if (host.frameRenderTimes.length > 30) {
      host.frameRenderTimes.shift();
    }

    // When at 0 FPS, use the exact time of the last rendering
    // When active (FPS > 1), use averaging for smoother display
    if (host.currentFps === 0) {
      host.currentFrameTime = frameTimeMs;
    } else if (host.currentFps <= 1) {
      host.currentFrameTime = frameTimeMs;
    } else {
      // Normal averaging when we have multiple recent frames
      host.currentFrameTime =
        host.frameRenderTimes.reduce((a, b) => a + b, 0) / host.frameRenderTimes.length;
    }
  }
}

export function updateFPSCalculation(host: RenderStatsHost): void {
  const now = performance.now();

  // Keep only renders from the last second
  const oneSecondAgo = now - 1000;
  while (host.fpsFrameTimes.length > 0 && host.fpsFrameTimes[0] < oneSecondAgo) {
    host.fpsFrameTimes.shift();
  }

  // Update FPS display every 250ms to avoid too frequent updates
  if (now - host.lastFpsUpdate > 250) {
    host.previousFps = host.currentFps; // Store previous FPS value
    host.currentFps = host.fpsFrameTimes.length;
    host.lastFpsUpdate = now;
    updateFPSDisplay(host);
  }
}

export function updateFPSDisplay(host: RenderStatsHost): void {
  let timeStr;
  if (host.gpuTimer.available && host.gpuTimer.averageMs > 0) {
    // Show actual GPU render time when available
    timeStr = `${host.gpuTimer.averageMs.toFixed(1)} ms`;
  } else {
    // Fallback to frame time
    timeStr = `${host.currentFrameTime.toFixed(1)} ms`;
  }
  uiState.perfStatsText = `${host.currentFps} fps / ${timeStr}`;
}
