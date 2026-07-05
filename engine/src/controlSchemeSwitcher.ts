export type ControlType = 'trackball' | 'orbit' | 'inverse-trackball' | 'arcball' | 'cloudcompare';

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

export function switchToInverseTrackballControls(host: ControlSchemeHost): void {
  if (host.controlType === 'inverse-trackball') {
    return;
  }

  console.log('🔄 Switching to Inverse TrackballControls');
  host.controlType = 'inverse-trackball';
  host.initializeControls();
  host.updateControlStatus();
  host.showStatus('Switched to Inverse Trackball controls');
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
    { id: 'inverse-trackball-controls', type: 'inverse-trackball' },
    { id: 'arcball-controls', type: 'arcball' },
    { id: 'cloudcompare-controls', type: 'cloudcompare' },
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
