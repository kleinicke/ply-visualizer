import * as THREE from 'three';
import { MathUtils } from './MathUtils';

export interface DialogUtilsCallbacks {
    // Camera access
    getCamera: () => THREE.PerspectiveCamera;
    getControls: () => any;
    
    // UI updates
    updateCameraControlsPanel: () => void;
    
    // Status and feedback
    showError?: (message: string) => void;
    showStatus?: (message: string) => void;
    
    // Event handling
    updateRotationOriginButtonState?: () => void;
}

/**
 * Dialog utilities - extracted from main.ts
 * Handles camera parameter dialogs and user input modals
 */
export class DialogUtils {
    constructor(private callbacks: DialogUtilsCallbacks) {}

    /**
     * Show camera position dialog - extracted from main.ts
     */
    showCameraPositionDialog(): void {
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
        
        const camera = this.callbacks.getCamera();
        const currentPos = camera.position;
        
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: #2d2d2d;
            color: white;
            padding: 20px;
            border-radius: 8px;
            width: 400px;
            border: 1px solid #444;
            font-family: Arial, sans-serif;
        `;
        
        dialog.innerHTML = `
            <h3 style="margin-top:0;color:#fff;font-size:16px;">Set Camera Position</h3>
            <p style="font-size:12px;color:#ccc;margin:10px 0;">Enter camera position coordinates (X Y Z):</p>
            
            <textarea id="camera-position-input" style="
                width:100%;
                height:60px;
                background:#1e1e1e;
                color:white;
                border:1px solid #555;
                border-radius:4px;
                padding:10px;
                font-family:monospace;
                resize:none;
                box-sizing:border-box;
            " placeholder="X Y Z">${currentPos.x.toFixed(3)} ${currentPos.y.toFixed(3)} ${currentPos.z.toFixed(3)}</textarea>
            
            <div style="margin:15px 0;">
                <p style="font-size:12px;color:#ccc;margin:5px 0;">Position constraint:</p>
                <div style="margin:5px 0;">
                    <label style="font-size:12px;color:#ccc;cursor:pointer;">
                        <input type="radio" name="position-constraint" value="target" checked style="margin-right:5px;">
                        Keep rotation center (adjust view angle)
                    </label>
                </div>
                <div style="margin:5px 0;">
                    <label style="font-size:12px;color:#ccc;cursor:pointer;">
                        <input type="radio" name="position-constraint" value="rotation" style="margin-right:5px;">
                        Keep view angle (adjust rotation center)
                    </label>
                </div>
            </div>
            
            <div style="text-align:center;margin-top:20px;">
                <button id="set-all-pos-zero" style="padding:8px 15px;background:#444;color:white;border:none;border-radius:4px;margin-right:10px;">Set to Origin</button>
                <button id="cancel-camera-pos" style="padding:8px 15px;background:#666;color:white;border:none;border-radius:4px;margin-right:10px;">Cancel</button>
                <button id="apply-camera-pos" style="padding:8px 15px;background:#007acc;color:white;border:none;border-radius:4px;">Apply</button>
            </div>
        `;
        
        modal.appendChild(dialog);
        document.body.appendChild(modal);
        
        const closeModal = () => {
            modal.remove();
        };
        
        const cancelBtn = dialog.querySelector('#cancel-camera-pos');
        const applyBtn = dialog.querySelector('#apply-camera-pos');
        const setAllZeroBtn = dialog.querySelector('#set-all-pos-zero');
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', closeModal);
        }
        
        if (setAllZeroBtn) {
            setAllZeroBtn.addEventListener('click', () => {
                (dialog.querySelector('#camera-position-input') as HTMLTextAreaElement).value = '0 0 0';
            });
        }
        
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                const input = (dialog.querySelector('#camera-position-input') as HTMLTextAreaElement).value;
                const constraint = (dialog.querySelector('input[name="position-constraint"]:checked') as HTMLInputElement).value;
                const values = MathUtils.parseSpaceSeparatedValues(input);
                
                if (values.length === 3) {
                    const [x, y, z] = values;
                    
                    // Store current camera state
                    const currentQuaternion = camera.quaternion.clone();
                    const controls = this.callbacks.getControls();
                    const currentTarget = controls.target.clone();
                    
                    // Update position
                    camera.position.set(x, y, z);
                    
                    // Apply constraint logic
                    if (constraint === 'rotation') {
                        // Keep rotation (angle) - restore quaternion
                        camera.quaternion.copy(currentQuaternion);
                        
                        // Update target based on new position and preserved rotation
                        const direction = new THREE.Vector3(0, 0, -1);
                        direction.applyQuaternion(currentQuaternion);
                        controls.target.copy(camera.position.clone().add(direction));
                    } else {
                        // Keep rotation center (target) - restore target (default behavior)
                        controls.target.copy(currentTarget);
                        
                        // Adjust camera rotation to look at the preserved target
                        camera.lookAt(currentTarget);
                    }
                    
                    controls.update();
                    this.callbacks.updateCameraControlsPanel();
                    closeModal();
                } else {
                    alert('Please enter exactly 3 numbers for position (X Y Z)');
                }
            });
        }
        
        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
        
        // Close on Escape key
        const handleKeydown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleKeydown);
            }
        };
        document.addEventListener('keydown', handleKeydown);
    }

    /**
     * Show camera rotation dialog - extracted from main.ts
     */
    showCameraRotationDialog(): void {
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
        
        const camera = this.callbacks.getCamera();
        const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'XYZ');
        
        // Convert to degrees for user-friendly input
        const degX = THREE.MathUtils.radToDeg(euler.x);
        const degY = THREE.MathUtils.radToDeg(euler.y);
        const degZ = THREE.MathUtils.radToDeg(euler.z);
        
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: #2d2d2d;
            color: white;
            padding: 20px;
            border-radius: 8px;
            width: 400px;
            border: 1px solid #444;
            font-family: Arial, sans-serif;
        `;
        
        dialog.innerHTML = `
            <h3 style="margin-top:0;color:#fff;font-size:16px;">Set Camera Rotation</h3>
            <p style="font-size:12px;color:#ccc;margin:10px 0;">Enter rotation angles in degrees (X Y Z):</p>
            
            <textarea id="camera-rotation-input" style="
                width:100%;
                height:60px;
                background:#1e1e1e;
                color:white;
                border:1px solid #555;
                border-radius:4px;
                padding:10px;
                font-family:monospace;
                resize:none;
                box-sizing:border-box;
            " placeholder="X-angle Y-angle Z-angle">${degX.toFixed(1)} ${degY.toFixed(1)} ${degZ.toFixed(1)}</textarea>
            
            <div style="text-align:center;margin-top:20px;">
                <button id="set-all-rot-zero" style="padding:8px 15px;background:#444;color:white;border:none;border-radius:4px;margin-right:10px;">Reset Rotation</button>
                <button id="cancel-camera-rot" style="padding:8px 15px;background:#666;color:white;border:none;border-radius:4px;margin-right:10px;">Cancel</button>
                <button id="apply-camera-rot" style="padding:8px 15px;background:#007acc;color:white;border:none;border-radius:4px;">Apply</button>
            </div>
        `;
        
        modal.appendChild(dialog);
        document.body.appendChild(modal);
        
        const closeModal = () => {
            modal.remove();
        };
        
        const cancelBtn = dialog.querySelector('#cancel-camera-rot');
        const applyBtn = dialog.querySelector('#apply-camera-rot');
        const setAllZeroBtn = dialog.querySelector('#set-all-rot-zero');
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', closeModal);
        }
        
        if (setAllZeroBtn) {
            setAllZeroBtn.addEventListener('click', () => {
                (dialog.querySelector('#camera-rotation-input') as HTMLTextAreaElement).value = '0 0 0';
            });
        }
        
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                const input = (dialog.querySelector('#camera-rotation-input') as HTMLTextAreaElement).value;
                const values = MathUtils.parseSpaceSeparatedValues(input);
                
                if (values.length === 3) {
                    const [degX, degY, degZ] = values;
                    const radX = THREE.MathUtils.degToRad(degX);
                    const radY = THREE.MathUtils.degToRad(degY);
                    const radZ = THREE.MathUtils.degToRad(degZ);
                    
                    camera.rotation.set(radX, radY, radZ);
                    const controls = this.callbacks.getControls();
                    controls.update();
                    this.callbacks.updateCameraControlsPanel();
                    closeModal();
                } else {
                    alert('Please enter exactly 3 numbers for rotation (X Y Z degrees)');
                }
            });
        }
        
        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
        
        // Close on Escape key
        const handleKeydown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleKeydown);
            }
        };
        document.addEventListener('keydown', handleKeydown);
    }

    /**
     * Show rotation center dialog - extracted from main.ts
     */
    showRotationCenterDialog(): void {
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
        
        const controls = this.callbacks.getControls();
        const currentTarget = controls.target;
        
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: #2d2d2d;
            color: white;
            padding: 20px;
            border-radius: 8px;
            width: 400px;
            border: 1px solid #444;
            font-family: Arial, sans-serif;
        `;
        
        dialog.innerHTML = `
            <h3 style="margin-top:0;color:#fff;font-size:16px;">Set Rotation Center</h3>
            <p style="font-size:12px;color:#ccc;margin:10px 0;">Enter rotation center coordinates (X Y Z):</p>
            
            <textarea id="rotation-center-input" style="
                width:100%;
                height:60px;
                background:#1e1e1e;
                color:white;
                border:1px solid #555;
                border-radius:4px;
                padding:10px;
                font-family:monospace;
                resize:none;
                box-sizing:border-box;
            " placeholder="X Y Z">${currentTarget.x.toFixed(3)} ${currentTarget.y.toFixed(3)} ${currentTarget.z.toFixed(3)}</textarea>
            
            <div style="text-align:center;margin-top:20px;">
                <button id="set-center-origin" style="padding:8px 15px;background:#444;color:white;border:none;border-radius:4px;margin-right:10px;">Set to Origin</button>
                <button id="cancel-rotation-center" style="padding:8px 15px;background:#666;color:white;border:none;border-radius:4px;margin-right:10px;">Cancel</button>
                <button id="apply-rotation-center" style="padding:8px 15px;background:#007acc;color:white;border:none;border-radius:4px;">Apply</button>
            </div>
        `;
        
        modal.appendChild(dialog);
        document.body.appendChild(modal);
        
        const closeModal = () => {
            modal.remove();
        };
        
        const cancelBtn = dialog.querySelector('#cancel-rotation-center');
        const applyBtn = dialog.querySelector('#apply-rotation-center');
        const setOriginBtn = dialog.querySelector('#set-center-origin');
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', closeModal);
        }
        
        if (setOriginBtn) {
            setOriginBtn.addEventListener('click', () => {
                (dialog.querySelector('#rotation-center-input') as HTMLTextAreaElement).value = '0 0 0';
            });
        }
        
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                const input = (dialog.querySelector('#rotation-center-input') as HTMLTextAreaElement).value;
                const values = MathUtils.parseSpaceSeparatedValues(input);
                
                if (values.length === 3) {
                    const [x, y, z] = values;
                    const newCenter = new THREE.Vector3(x, y, z);
                    
                    // Set the new rotation center
                    controls.target.copy(newCenter);
                    controls.update();
                    
                    // Update UI state if callback is available
                    this.callbacks.updateRotationOriginButtonState?.();
                    
                    closeModal();
                } else {
                    alert('Please enter exactly 3 numbers for rotation center (X Y Z)');
                }
            });
        }
        
        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
        
        // Close on Escape key
        const handleKeydown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleKeydown);
            }
        };
        document.addEventListener('keydown', handleKeydown);
    }

    /**
     * Create styled modal base - helper method
     */
    private createModalBase(): HTMLElement {
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
        return modal;
    }

    /**
     * Create styled dialog base - helper method
     */
    private createDialogBase(): HTMLElement {
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: #2d2d2d;
            color: white;
            padding: 20px;
            border-radius: 8px;
            width: 400px;
            border: 1px solid #444;
            font-family: Arial, sans-serif;
        `;
        return dialog;
    }

    /**
     * Set up modal event handlers - helper method
     */
    private setupModalHandlers(modal: HTMLElement, closeCallback: () => void): void {
        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeCallback();
            }
        });
        
        // Close on Escape key
        const handleKeydown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                closeCallback();
                document.removeEventListener('keydown', handleKeydown);
            }
        };
        document.addEventListener('keydown', handleKeydown);
    }
}