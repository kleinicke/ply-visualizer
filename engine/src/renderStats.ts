/**
 * GPU timing (via EXT_disjoint_timer_query) and FPS/frame-time tracking for
 * the render loop. Extracted out of PointCloudVisualizer; main.ts's animate()
 * still owns frame scheduling and calls into these functions each frame.
 */
export interface RenderStatsHost {
  renderer: { getContext(): WebGLRenderingContext | WebGL2RenderingContext };
  gpuTimerExtension: any;
  gpuQueries: any[];
  gpuTimes: number[];
  currentGpuTime: number;

  fpsFrameTimes: number[];
  previousFps: number;
  currentFps: number;
  lastFpsUpdate: number;
  frameRenderTimes: number[];
  currentFrameTime: number;
}

export function initGPUTiming(host: RenderStatsHost): void {
  const gl = host.renderer.getContext();

  // Try to get timer query extension
  host.gpuTimerExtension =
    gl.getExtension('EXT_disjoint_timer_query_webgl2') ||
    gl.getExtension('EXT_disjoint_timer_query');

  if (host.gpuTimerExtension) {
    console.log('GPU timing available - measuring actual render time');
  } else {
    console.log('GPU timing not available - using CPU frame time');
  }
}

export function startGPUTiming(host: RenderStatsHost): any {
  if (!host.gpuTimerExtension) {
    return null;
  }

  const gl = host.renderer.getContext() as any; // Cast to handle extension methods

  if (gl.createQuery) {
    // WebGL2 approach
    const query = gl.createQuery();
    gl.beginQuery(host.gpuTimerExtension.TIME_ELAPSED_EXT, query);
    return query;
  } else if (host.gpuTimerExtension.createQueryEXT) {
    // WebGL1 extension approach
    const query = host.gpuTimerExtension.createQueryEXT();
    host.gpuTimerExtension.beginQueryEXT(host.gpuTimerExtension.TIME_ELAPSED_EXT, query);
    return query;
  }

  return null;
}

export function endGPUTiming(host: RenderStatsHost, query: any): void {
  if (!query || !host.gpuTimerExtension) {
    return;
  }

  const gl = host.renderer.getContext() as any;

  if (gl.endQuery) {
    // WebGL2 approach
    gl.endQuery(host.gpuTimerExtension.TIME_ELAPSED_EXT);
  } else if (host.gpuTimerExtension.endQueryEXT) {
    // WebGL1 extension approach
    host.gpuTimerExtension.endQueryEXT(host.gpuTimerExtension.TIME_ELAPSED_EXT);
  }

  host.gpuQueries.push(query);
}

export function updateGPUTiming(host: RenderStatsHost): void {
  if (!host.gpuTimerExtension) {
    return;
  }

  const gl = host.renderer.getContext() as any;

  // Check completed queries
  for (let i = host.gpuQueries.length - 1; i >= 0; i--) {
    const query = host.gpuQueries[i];
    let available = false;
    let timeElapsed = 0;

    if (gl.getQueryParameter) {
      // WebGL2 approach
      available = gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE);
      if (available) {
        timeElapsed = gl.getQueryParameter(query, gl.QUERY_RESULT);
      }
    } else if (host.gpuTimerExtension.getQueryObjectEXT) {
      // WebGL1 extension approach
      available = host.gpuTimerExtension.getQueryObjectEXT(
        query,
        host.gpuTimerExtension.QUERY_RESULT_AVAILABLE_EXT
      );
      if (available) {
        timeElapsed = host.gpuTimerExtension.getQueryObjectEXT(
          query,
          host.gpuTimerExtension.QUERY_RESULT_EXT
        );
      }
    }

    const disjoint = gl.getParameter(host.gpuTimerExtension.GPU_DISJOINT_EXT);

    if (available && !disjoint) {
      const timeMs = timeElapsed / 1000000; // Convert nanoseconds to milliseconds

      host.gpuTimes.push(timeMs);

      // Keep only last 30 GPU times for averaging
      if (host.gpuTimes.length > 30) {
        host.gpuTimes.shift();
      }

      // Calculate average GPU time
      host.currentGpuTime = host.gpuTimes.reduce((a, b) => a + b, 0) / host.gpuTimes.length;

      // Clean up query
      if (gl.deleteQuery) {
        gl.deleteQuery(query);
      } else if (host.gpuTimerExtension.deleteQueryEXT) {
        host.gpuTimerExtension.deleteQueryEXT(query);
      }

      host.gpuQueries.splice(i, 1);
    }
  }
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
  const statsElement = document.getElementById('performance-stats');
  if (statsElement) {
    let timeStr;
    if (host.gpuTimerExtension && host.currentGpuTime > 0) {
      // Show actual GPU render time when available
      timeStr = `${host.currentGpuTime.toFixed(1)} ms`;
    } else {
      // Fallback to frame time
      timeStr = `${host.currentFrameTime.toFixed(1)} ms`;
    }
    const statsStr = `${host.currentFps} fps / ${timeStr}`;
    if (statsElement.textContent !== statsStr) {
      statsElement.textContent = statsStr;
    }
  }
}
