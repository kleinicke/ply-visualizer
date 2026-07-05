// Phase 1 write-through store: mirrors viewer-wide settings that today live
// as plain fields on PointCloudVisualizer (control scheme, camera
// convention, EDL params, brightness, lighting mode). Nothing reads from
// this store yet - it's populated alongside the existing fields so a future
// Controls/Camera tab component can switch over without a behavior change.
//
// Plain JS on purpose - see files.svelte.js for why (svelte-loader compiles
// .svelte.js/.svelte.ts via Svelte's compileModule, which parses without
// TypeScript support as of svelte@5.56).
export const viewerState = $state(
  /**
   * @type {{
   *   controlScheme: string;
   *   cameraConvention: string;
   *   edlEnabled: boolean;
   *   edlStrength: number;
   *   edlRadius: number;
   *   brightnessStops: number;
   *   backgroundBrightness: number;
   *   lightingMode: string;
   *   cameraFov: number;
   *   cameraPositionText: string;
   *   cameraRotationText: string;
   *   cameraTargetText: string;
   * }}
   */ ({
    controlScheme: 'trackball',
    cameraConvention: 'opengl',
    edlEnabled: false,
    edlStrength: 1.0,
    edlRadius: 1.4,
    brightnessStops: 0,
    backgroundBrightness: 13,
    lightingMode: 'normal',
    // Phase 4 (CameraControlsPanel.svelte): updated every frame the camera
    // moves by transformationMatrix.ts's updateCameraControlsPanel().
    cameraFov: 75,
    cameraPositionText: '(0.000, 0.000, 0.000)',
    cameraRotationText: '(0.0°, 0.0°, 0.0°)',
    cameraTargetText: '(0.000, 0.000, 0.000)',
  })
);
