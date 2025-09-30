import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('VS Code API Conflict Detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should detect the exact error we are seeing', () => {
    // Simulate the exact VS Code API behavior
    let apiInstance: any = null;

    const mockAcquireVsCodeApi = () => {
      if (apiInstance !== null) {
        throw new Error('An instance of the VS Code API has already been acquired');
      }
      apiInstance = {
        postMessage: vi.fn(),
        setState: vi.fn(),
        getState: vi.fn(),
      };
      return apiInstance;
    };

    // Mock the global acquireVsCodeApi function
    global.acquireVsCodeApi = mockAcquireVsCodeApi;

    // Test that first acquisition works
    const firstApi = mockAcquireVsCodeApi();
    expect(firstApi).toBeDefined();
    expect(firstApi.postMessage).toBeDefined();

    // Test that second acquisition fails with exact error
    expect(() => mockAcquireVsCodeApi()).toThrow(
      'An instance of the VS Code API has already been acquired'
    );
  });

  it('should identify where dual acquisition happens in our code', () => {
    const acquisitionPoints: string[] = [];

    const mockAcquireVsCodeApi = () => {
      const stack = new Error().stack || '';
      const caller = stack.split('\n')[2] || 'unknown';
      acquisitionPoints.push(caller);

      if (acquisitionPoints.length > 1) {
        throw new Error('An instance of the VS Code API has already been acquired');
      }

      return { postMessage: vi.fn(), setState: vi.fn(), getState: vi.fn() };
    };

    global.acquireVsCodeApi = mockAcquireVsCodeApi;

    // Simulate app.ts acquisition
    const appTsAcquisition = () => {
      // This simulates: const vscode = isVSCode ? acquireVsCodeApi() : null;
      return global.acquireVsCodeApi();
    };

    // Simulate SpatialVisualizer acquisition
    const spatialVisualizerAcquisition = () => {
      // This simulates SpatialVisualizer constructor calling acquireVsCodeApi
      return global.acquireVsCodeApi();
    };

    // First call succeeds
    appTsAcquisition();
    expect(acquisitionPoints).toHaveLength(1);

    // Second call fails
    expect(() => spatialVisualizerAcquisition()).toThrow(
      'An instance of the VS Code API has already been acquired'
    );
    expect(acquisitionPoints).toHaveLength(2);
  });

  it('should suggest solution for VS Code API conflict', () => {
    // Test the solution: pass the API instance instead of acquiring twice
    let sharedVsCodeApi: any = null;

    const acquireOnce = () => {
      if (!sharedVsCodeApi) {
        sharedVsCodeApi = {
          postMessage: vi.fn(),
          setState: vi.fn(),
          getState: vi.fn(),
        };
      }
      return sharedVsCodeApi;
    };

    // Both systems can safely use the shared instance
    const appApi = acquireOnce();
    const visualizerApi = acquireOnce();

    expect(appApi).toBe(visualizerApi); // Same instance
    expect(appApi.postMessage).toBeDefined();
  });
});
