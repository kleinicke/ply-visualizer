export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function addTooltipsToTruncatedFilenames(): void {
  const fileNameLabels = document.querySelectorAll('.file-name');
  fileNameLabels.forEach(label => {
    const element = label as HTMLElement;
    // Always show short path (grandparent/parent/filename) in tooltip
    const shortPath = element.getAttribute('data-short-path');
    if (shortPath) {
      element.title = shortPath;
    } else if (element.scrollWidth > element.clientWidth) {
      // Fallback: if no short path, show full text when truncated
      element.title = element.textContent || '';
    } else {
      element.removeAttribute('title');
    }
  });
}

export interface ModalDialogHandle {
  modal: HTMLDivElement;
  dialog: HTMLDivElement;
  close: () => void;
}

/**
 * Builds the modal overlay + centered box shared by all transform/camera
 * dialogs, and wires up the close-on-background-click / close-on-Escape
 * behavior common to all of them.
 */
export function createModalDialog(bodyHtml: string): ModalDialogHandle {
  const modal = document.createElement('div');
  modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        `;

  const dialog = document.createElement('div');
  dialog.style.cssText = `
            background: white;
            padding: 20px;
            border-radius: 8px;
            min-width: 300px;
            max-width: 400px;
        `;
  dialog.innerHTML = bodyHtml;

  modal.appendChild(dialog);
  document.body.appendChild(modal);

  const close = () => {
    modal.remove();
  };

  modal.addEventListener('click', e => {
    if (e.target === modal) {
      close();
    }
  });

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', handleKeydown);
    }
  };
  document.addEventListener('keydown', handleKeydown);

  return { modal, dialog, close };
}

export function translationDialogTemplate(): string {
  return `
            <h3 style="margin-top:0;">Add Translation</h3>
            <div style="margin-bottom: 15px;">
                <label style="display:block;margin-bottom:5px;font-weight:bold;">Enter translation vector (X Y Z):</label>
                <div style="font-size:11px;color:#666;margin-bottom:8px;">
                    Format: X Y Z (space-separated)<br>
                    Commas, brackets, and line breaks are automatically handled<br>
                    Example: 1 0 0 (move 1 unit along X-axis)
                </div>
                <textarea id="translation-input"
                    placeholder="1 0 0"
                    style="width:100%;height:80px;padding:8px;font-family:monospace;font-size:12px;border:1px solid #ccc;border-radius:4px;resize:vertical;"
                >1 0 0</textarea>
            </div>
            <div style="text-align:right;">
                <button id="cancel-translation" style="margin-right:10px;padding:8px 15px;">Cancel</button>
                <button id="apply-translation" style="padding:8px 15px;background:#007acc;color:white;border:none;border-radius:4px;">Apply</button>
            </div>
        `;
}

export function quaternionDialogTemplate(): string {
  return `
            <h3 style="margin-top:0;">Add Quaternion Rotation</h3>
            <div style="margin-bottom: 15px;">
                <label style="display:block;margin-bottom:5px;font-weight:bold;">Enter quaternion values (X Y Z W):</label>
                <div style="font-size:11px;color:#666;margin-bottom:8px;">
                    Format: X Y Z W (space-separated)<br>
                    Commas, brackets, and line breaks are automatically handled<br>
                    Example: 0 0 0 1 (identity quaternion)
                </div>
                <textarea id="quaternion-input"
                    placeholder="0 0 0 1"
                    style="width:100%;height:80px;padding:8px;font-family:monospace;font-size:12px;border:1px solid #ccc;border-radius:4px;resize:vertical;"
                >0 0 0 1</textarea>
            </div>
            <div style="text-align:right;">
                <button id="cancel-quaternion" style="margin-right:10px;padding:8px 15px;">Cancel</button>
                <button id="apply-quaternion" style="padding:8px 15px;background:#007acc;color:white;border:none;border-radius:4px;">Apply</button>
            </div>
        `;
}

export function angleAxisDialogTemplate(): string {
  return `
            <h3 style="margin-top:0;">Add Angle-Axis Rotation</h3>
            <div style="margin-bottom: 15px;">
                <label style="display:block;margin-bottom:5px;font-weight:bold;">Enter axis and angle (X Y Z angle):</label>
                <div style="font-size:11px;color:#666;margin-bottom:8px;">
                    Format: X Y Z angle (space-separated, angle in degrees)<br>
                    Commas, brackets, and line breaks are automatically handled<br>
                    Example: 0 1 0 90 (90° rotation around Y-axis)
                </div>
                <textarea id="angle-axis-input"
                    placeholder="0 1 0 90"
                    style="width:100%;height:80px;padding:8px;font-family:monospace;font-size:12px;border:1px solid #ccc;border-radius:4px;resize:vertical;"
                >0 1 0 90</textarea>
            </div>
            <div style="text-align:right;">
                <button id="cancel-angle-axis" style="margin-right:10px;padding:8px 15px;">Cancel</button>
                <button id="apply-angle-axis" style="padding:8px 15px;background:#007acc;color:white;border:none;border-radius:4px;">Apply</button>
            </div>
        `;
}

export function cameraPositionDialogTemplate(x: string, y: string, z: string): string {
  return `
            <h3 style="margin-top:0;">Modify Camera Position</h3>
            <div style="margin-bottom: 15px;">
                <label style="display:block;margin-bottom:5px;">Camera Position X Y Z in Meter:</label>
                <textarea id="camera-position-input"
                    placeholder="${x} ${y} ${z}"
                    style="width:100%;height:60px;padding:8px;font-family:monospace;font-size:12px;border:1px solid #ccc;border-radius:4px;resize:vertical;"
                >${x} ${y} ${z}</textarea>
            </div>
            <div style="margin-bottom: 15px;">
                <label style="display:block;margin-bottom:8px;">Keep constant when changing:</label>
                <div style="display:flex;gap:15px;align-items:center;">
                    <label style="display:flex;align-items:center;gap:5px;cursor:pointer;">
                        <input type="radio" name="position-constraint" value="rotation" style="margin:0;">
                        <span>Rotation (angle)</span>
                    </label>
                    <label style="display:flex;align-items:center;gap:5px;cursor:pointer;">
                        <input type="radio" name="position-constraint" value="center" checked style="margin:0;">
                        <span>Rotation center</span>
                    </label>
                </div>
            </div>
            <div style="text-align:right;">
                <button id="set-all-pos-zero" style="margin-right:10px;padding:6px 12px;background:#f0f0f0;border:1px solid #ccc;border-radius:4px;font-size:11px;">Set All to 0</button>
                <button id="cancel-camera-pos" style="margin-right:10px;padding:8px 15px;">Cancel</button>
                <button id="apply-camera-pos" style="padding:8px 15px;background:#007acc;color:white;border:none;border-radius:4px;">Apply</button>
            </div>
        `;
}

export function cameraRotationDialogTemplate(rotX: string, rotY: string, rotZ: string): string {
  return `
            <h3 style="margin-top:0;">Modify Camera Rotation</h3>
            <div style="margin-bottom: 15px;">
                <label style="display:block;margin-bottom:5px;">Rotation around X Y Z Axis in degrees:</label>
                <textarea id="camera-rotation-input"
                    placeholder="${rotX} ${rotY} ${rotZ}"
                    style="width:100%;height:60px;padding:8px;font-family:monospace;font-size:12px;border:1px solid #ccc;border-radius:4px;resize:vertical;"
                >${rotX} ${rotY} ${rotZ}</textarea>
            </div>
            <div style="margin-bottom: 15px;">
                <label style="display:block;margin-bottom:8px;">Keep constant when changing:</label>
                <div style="display:flex;gap:15px;align-items:center;">
                    <label style="display:flex;align-items:center;gap:5px;cursor:pointer;">
                        <input type="radio" name="rotation-constraint" value="position" style="margin:0;">
                        <span>Position</span>
                    </label>
                    <label style="display:flex;align-items:center;gap:5px;cursor:pointer;">
                        <input type="radio" name="rotation-constraint" value="center" checked style="margin:0;">
                        <span>Rotation center</span>
                    </label>
                </div>
            </div>
            <div style="text-align:right;">
                <button id="set-all-rot-zero" style="margin-right:10px;padding:6px 12px;background:#f0f0f0;border:1px solid #ccc;border-radius:4px;font-size:11px;">Set All to 0</button>
                <button id="cancel-camera-rot" style="margin-right:10px;padding:8px 15px;">Cancel</button>
                <button id="apply-camera-rot" style="padding:8px 15px;background:#007acc;color:white;border:none;border-radius:4px;">Apply</button>
            </div>
        `;
}

export function rotationCenterDialogTemplate(x: string, y: string, z: string): string {
  return `
            <h3 style="margin-top:0;">Modify Rotation Center</h3>
            <div style="margin-bottom: 15px;">
                <label style="display:block;margin-bottom:5px;">Rotation Center X Y Z in Meter:</label>
                <textarea id="rotation-center-input"
                    placeholder="${x} ${y} ${z}"
                    style="width:100%;height:60px;padding:8px;font-family:monospace;font-size:12px;border:1px solid #ccc;border-radius:4px;resize:vertical;"
                >${x} ${y} ${z}</textarea>
            </div>
            <div style="margin-bottom: 15px;">
                <label style="display:block;margin-bottom:8px;">Keep constant when changing:</label>
                <div style="display:flex;gap:15px;align-items:center;">
                    <label style="display:flex;align-items:center;gap:5px;cursor:pointer;">
                        <input type="radio" name="center-constraint" value="position" checked style="margin:0;">
                        <span>Position</span>
                    </label>
                    <label style="display:flex;align-items:center;gap:5px;cursor:pointer;">
                        <input type="radio" name="center-constraint" value="rotation" style="margin:0;">
                        <span>Rotation (angle)</span>
                    </label>
                </div>
            </div>
            <div style="text-align:right;">
                <button id="set-center-origin" style="margin-right:10px;padding:6px 12px;background:#f0f0f0;border:1px solid #ccc;border-radius:4px;font-size:11px;">Set to Origin (0,0,0)</button>
                <button id="cancel-rotation-center" style="margin-right:10px;padding:8px 15px;">Cancel</button>
                <button id="apply-rotation-center" style="padding:8px 15px;background:#007acc;color:white;border:none;border-radius:4px;">Apply</button>
            </div>
        `;
}
