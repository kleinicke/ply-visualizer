export const viewerState = $state(
  /**
   * @type {{
   *   controlScheme: string;
   *   cameraConvention: string;
   *   edlEnabled: boolean;
   *   edlMode: 'auto' | 'all' | 'off';
   *   edlStrength: number;
   *   edlRadius: number;
   *   brightnessStops: number;
   *   backgroundBrightness: number;
   *   lightingMode: string;
   *   cameraFov: number;
   *   cameraNear: number;
   *   cameraFar: number;
   *   cameraPositionText: string;
   *   cameraRotationText: string;
   *   cameraTargetText: string;
   *   webgpuPickingAvailable: boolean;
   *   webgpuPickingUnavailableReason: string | null;
   *   pointPickingImplementation: 'cpu' | 'webgpu';
   *   webgpuPointRenderingAvailable: boolean;
   *   webgpuPointRenderingUnavailableReason: string | null;
   * }}
   */ ({
    controlScheme: 'legacy-trackball',
    cameraConvention: 'opengl',
    edlEnabled: true,
    edlMode: 'auto',
    edlStrength: 1.0,
    edlRadius: 1.4,
    brightnessStops: 0,
    backgroundBrightness: 13,
    lightingMode: 'normal',
    // CameraControlsPanel presentation, updated whenever the camera
    // moves by transformationMatrix.ts's updateCameraControlsPanel().
    cameraFov: 75,
    // Must match the PerspectiveCamera constructor arguments in initThreeJS.
    cameraNear: 0.001,
    cameraFar: 10000000,
    cameraPositionText: '(0.000, 0.000, 0.000)',
    cameraRotationText: '(0.0°, 0.0°, 0.0°)',
    cameraTargetText: '(0.000, 0.000, 0.000)',
    // The optional WebGPU helpers start after the viewer is ready (main.ts,
    // webgpuReady); the Controls tab follows these as they become known.
    webgpuPickingAvailable: false,
    webgpuPickingUnavailableReason: 'WebGPU availability is still being checked',
    pointPickingImplementation: 'cpu',
    webgpuPointRenderingAvailable: false,
    webgpuPointRenderingUnavailableReason: 'WebGPU availability is still being checked',
  })
);
