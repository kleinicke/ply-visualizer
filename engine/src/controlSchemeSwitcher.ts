import { viewerState } from './state/viewer.svelte';

export type ControlType = 'trackball' | 'orbit' | 'legacy-trackball' | 'arcball';

export interface ControlSchemeHost {
  controlType: ControlType;
  initializeControls(): void;
  updateControlStatus(): void;
  showStatus(message: string): void;
}

export function switchToTrackballControls(host: ControlSchemeHost): void {
  if (host.controlType === 'trackball') {
    return;
  }

  console.log('🔄 Switching to TrackballControls');
  host.controlType = 'trackball';
  host.initializeControls();
  host.updateControlStatus();
  host.showStatus('Switched to Trackball controls');
}

export function switchToOrbitControls(host: ControlSchemeHost): void {
  if (host.controlType === 'orbit') {
    return;
  }

  console.log('🔄 Switching to OrbitControls');
  host.controlType = 'orbit';
  host.initializeControls();
  host.updateControlStatus();
  host.showStatus('Switched to Orbit controls');
}

export function switchToLegacyTrackballControls(host: ControlSchemeHost): void {
  if (host.controlType === 'legacy-trackball') {
    return;
  }

  console.log('🔄 Switching to Legacy TrackballControls');
  host.controlType = 'legacy-trackball';
  host.initializeControls();
  host.updateControlStatus();
  host.showStatus('Switched to Legacy Trackball controls (delta-based)');
}

export function switchToArcballControls(host: ControlSchemeHost): void {
  if (host.controlType === 'arcball') {
    return;
  }

  console.log('🔄 Switching to ArcballControls');
  host.controlType = 'arcball';
  host.initializeControls();
  host.updateControlStatus();
  host.showStatus('Switched to Arcball controls');
}

export function updateControlStatus(host: ControlSchemeHost): void {
  viewerState.controlScheme = host.controlType;
  const status = host.controlType.toUpperCase();
  console.log(`📊 Camera Controls: ${status}`);

  // Update UI if there's a status display
  const statusElement = document.getElementById('camera-control-status');
  if (statusElement) {
    statusElement.textContent = status;
  }

  // Update button active states
  const controlButtons = [
    { id: 'trackball-controls', type: 'trackball' },
    { id: 'orbit-controls', type: 'orbit' },
    { id: 'legacy-trackball-controls', type: 'legacy-trackball' },
    { id: 'arcball-controls', type: 'arcball' },
  ];

  controlButtons.forEach(button => {
    const btn = document.getElementById(button.id);
    if (btn) {
      if (button.type === host.controlType) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    }
  });
}
