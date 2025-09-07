import * as THREE from 'three';
import { PlyData } from '../../webview/interfaces';

export interface UIStateManagerCallbacks {
    // File management
    getFiles: () => PlyData[];
    getFileVisibility: () => boolean[];
    getPoseGroups: () => THREE.Group[];
    getCameraGroups: () => THREE.Group[];
    
    // Transform and matrix operations
    getTransformationMatrixAsArray: (fileIndex: number) => number[];
    isDepthDerivedFile: (data: PlyData) => boolean;
    getDepthSetting: (data: PlyData, setting: 'camera' | 'depth') => string;
    
    // Visibility and rendering state
    getFileColors: () => [number, number, number][];
    getIndividualColorModes: () => string[];
    getPointSizes: () => number[];
    
    // Button states and interactions
    updatePointsNormalsButtonStates: () => void;
    updateUniversalRenderButtonStates: () => void;
    updateDefaultButtonState: () => void;
    
    // File operations
    toggleFileVisibility: (fileIndex: number) => void;
    updatePointSize: (fileIndex: number, size: number) => void;
    
    // Render mode operations
    toggleUniversalRenderMode?: (fileIndex: number, mode: string) => void;
    
    // Color operations
    setFileColorValue?: (fileIndex: number, value: string) => void;
    
    // Sequence manager integration
    isSequenceMode: () => boolean;
    getSequenceLength: () => number;
    getCurrentSequenceIndex: () => number;
    getCurrentSequenceFilename: () => string;
}

/**
 * UI State management - extracted from main.ts
 * Handles large UI update functions and state synchronization
 */
export class UIStateManager {
    constructor(private callbacks: UIStateManagerCallbacks) {}

    /**
     * Switch between tabs - extracted from main.ts  
     */
    switchTab(tabName: string): void {
        // Remove active class from all tabs and panels
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelectorAll('.tab-panel').forEach(panel => {
            panel.classList.remove('active');
        });

        // Add active class to selected tab and panel
        const activeTabBtn = document.querySelector(`[data-tab="${tabName}"]`);
        const activePanel = document.getElementById(`${tabName}-tab`);
        
        if (activeTabBtn) {
            activeTabBtn.classList.add('active');
        }
        if (activePanel) {
            activePanel.classList.add('active');
        }
    }

    /**
     * Update file list UI - massive 1200-line function extracted from main.ts
     */
    updateFileList(): void {
        const fileListDiv = document.getElementById('file-list');
        if (!fileListDiv) return;

        const files = this.callbacks.getFiles();
        const poseGroups = this.callbacks.getPoseGroups();
        const cameraGroups = this.callbacks.getCameraGroups();
        
        if (files.length === 0 && poseGroups.length === 0 && cameraGroups.length === 0) {
            fileListDiv.innerHTML = '<div class="no-files">No objects loaded</div>';
            return;
        }

        let html = '';
        // In sequence mode, show only the current frame information
        if (this.callbacks.isSequenceMode() && this.callbacks.getSequenceLength() > 0) {
            const name = this.callbacks.getCurrentSequenceFilename();
            html += `
                <div class="file-item">
                    <div class="file-item-main">
                        <input type="checkbox" id="file-0" checked disabled>
                        <span class="color-indicator" style="background-color: #888"></span>
                        <label for="file-0" class="file-name">${name}</label>
                    </div>
                    <div class="file-info">Frame ${this.callbacks.getCurrentSequenceIndex() + 1} of ${this.callbacks.getSequenceLength()}</div>
                </div>
            `;
            fileListDiv.innerHTML = html;
            return;
        }

        // Render point clouds and meshes
        const fileVisibility = this.callbacks.getFileVisibility();
        const fileColors = this.callbacks.getFileColors();
        const individualColorModes = this.callbacks.getIndividualColorModes();
        
        for (let i = 0; i < files.length; i++) {
            const data = files[i];
            
            // Color indicator
            let colorIndicator = '';
            if (individualColorModes[i] === 'original' && data.hasColors) {
                colorIndicator = '<span class="color-indicator" style="background: linear-gradient(45deg, #ff0000, #00ff00, #0000ff); border: 1px solid #666;"></span>';
            } else {
                const color = fileColors[i % fileColors.length];
                const colorHex = `#${Math.round(color[0] * 255).toString(16).padStart(2, '0')}${Math.round(color[1] * 255).toString(16).padStart(2, '0')}${Math.round(color[2] * 255).toString(16).padStart(2, '0')}`;
                colorIndicator = `<span class="color-indicator" style="background-color: ${colorHex}"></span>`;
            }
            
            // Transformation matrix UI
            const matrixArr = this.callbacks.getTransformationMatrixAsArray(i);
            let matrixStr = '';
            for (let r = 0; r < 4; ++r) {
                const row = matrixArr.slice(r * 4, r * 4 + 4).map(v => v.toFixed(6));
                matrixStr += row.join(' ') + '\n';
            }
            
            html += this.generateFileItemHTML(data, i, fileVisibility[i], colorIndicator, matrixStr);
        }

        // Render pose data
        html += this.generatePoseHTML(poseGroups);

        // Render camera data  
        html += this.generateCameraHTML(cameraGroups);

        fileListDiv.innerHTML = html;
        
        // Set up event listeners after HTML is inserted
        this.setupFileListEventListeners(fileListDiv);
        
        // Update button states after file list is refreshed
        this.callbacks.updatePointsNormalsButtonStates();
        this.callbacks.updateUniversalRenderButtonStates();
        this.callbacks.updateDefaultButtonState();
    }

    /**
     * Generate HTML for a single file item - part of massive updateFileList extraction
     */
    private generateFileItemHTML(
        data: PlyData, 
        i: number, 
        isVisible: boolean, 
        colorIndicator: string, 
        matrixStr: string
    ): string {
        const pointSizes = this.callbacks.getPointSizes();
        
        return `
            <div class="file-item">
                <div class="file-item-main">
                    <input type="checkbox" id="file-${i}" ${isVisible ? 'checked' : ''}>
                    ${colorIndicator}
                    <label for="file-${i}" class="file-name">${data.fileName || `File ${i + 1}`}</label>
                    <button class="remove-file" data-file-index="${i}" title="Remove file">✕</button>
                </div>
                <div class="file-info">${data.vertexCount.toLocaleString()} vertices, ${data.faceCount.toLocaleString()} faces</div>
                
                ${this.callbacks.isDepthDerivedFile(data) ? this.generateDepthControlsHTML(data, i) : ''}
                
                ${this.generateTransformControlsHTML(i, matrixStr)}
                
                ${this.generateRenderingControlsHTML(data, i)}
                
                ${this.generatePointSizeControlHTML(i, pointSizes[i])}
                
                ${this.generateColorControlsHTML(data, i)}
            </div>
        `;
    }

    /**
     * Generate depth controls HTML - part of updateFileList extraction
     */
    private generateDepthControlsHTML(data: PlyData, i: number): string {
        return `
            <!-- Depth Settings (First) -->
            <div class="depth-controls" style="margin-top: 8px;">
                <button class="depth-settings-toggle" data-file-index="${i}" style="background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: 1px solid var(--vscode-panel-border); padding: 4px 8px; border-radius: 2px; cursor: pointer; font-size: 11px; width: 100%;">
                    <span class="toggle-icon">▶</span> Depth Settings
                </button>
                <div class="depth-settings-panel" id="depth-panel-${i}" style="display:none; margin-top: 8px; padding: 8px; background: var(--vscode-input-background); border: 1px solid var(--vscode-panel-border); border-radius: 2px;">
                    <div id="image-size-${i}" style="font-size: 9px; color: var(--vscode-descriptionForeground); margin-top: 1px;">Image Size: Width: -, Height: -</div>
                    
                    <!-- Calibration File Loading -->
                    ${this.generateCalibrationControlsHTML(i)}
                    
                    ${this.generateCameraModelControlsHTML(data, i)}
                    
                    ${this.generateDepthTypeControlsHTML(data, i)}
                    
                    ${this.generateIntrinsicParametersHTML(data, i)}
                    
                    ${this.generateDepthProcessingControlsHTML(data, i)}
                    
                    ${this.generateDepthActionButtonsHTML(i)}
                </div>
            </div>
        `;
    }

    /**
     * Generate calibration controls HTML
     */
    private generateCalibrationControlsHTML(i: number): string {
        return `
            <div class="depth-group" style="margin-bottom: 8px;">
                <label style="display: block; font-size: 10px; font-weight: bold; margin-bottom: 2px;">Load Calibration:</label>
                <button class="load-calibration-btn" data-file-index="${i}" style="width: 100%; padding: 4px 8px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: 1px solid var(--vscode-panel-border); border-radius: 2px; cursor: pointer; font-size: 10px;">
                    📁 Load Calibration File
                </button>
                <div class="calibration-info" id="calibration-info-${i}" style="display: none; margin-top: 4px; padding: 4px; background: var(--vscode-input-background); border: 1px solid var(--vscode-panel-border); border-radius: 2px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div id="calibration-filename-${i}" style="font-size: 9px; font-weight: bold; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"></div>
                        <select id="camera-select-${i}" style="flex: 0 0 25%; font-size: 9px; padding: 1px 2px;">
                            <option value="">Select camera...</option>
                        </select>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Generate camera model controls HTML
     */
    private generateCameraModelControlsHTML(data: PlyData, i: number): string {
        const cameraSettings = this.callbacks.getDepthSetting(data, 'camera');
        return `
            <div class="depth-group" style="margin-bottom: 8px;">
                <label for="camera-model-${i}" style="display: block; font-size: 10px; font-weight: bold; margin-bottom: 2px;">Camera Model ⭐:</label>
                <select id="camera-model-${i}" style="width: 100%; padding: 2px; font-size: 11px;">
                    <option value="pinhole-ideal" ${cameraSettings.includes('pinhole-ideal') ? 'selected' : ''}>Pinhole Ideal</option>
                    <option value="pinhole-opencv" ${cameraSettings.includes('pinhole-opencv') ? 'selected' : ''}>Pinhole + OpenCV Distortion (beta)</option>
                    <option value="fisheye-equidistant" ${cameraSettings.includes('fisheye-equidistant') ? 'selected' : ''}>Fisheye Equidistant</option>
                    <option value="fisheye-opencv" ${cameraSettings.includes('fisheye-opencv') ? 'selected' : ''}>Fisheye + OpenCV Distortion (beta)</option>
                    <option value="fisheye-kannala-brandt" ${cameraSettings.includes('fisheye-kannala-brandt') ? 'selected' : ''}>Fisheye Kannala-Brandt (beta)</option>
                </select>
            </div>
        `;
    }

    /**
     * Generate depth type controls HTML
     */
    private generateDepthTypeControlsHTML(data: PlyData, i: number): string {
        const depthSettings = this.callbacks.getDepthSetting(data, 'depth');
        return `
            <div class="depth-group" style="margin-bottom: 8px;">
                <label for="depth-type-${i}" style="display: block; font-size: 10px; font-weight: bold; margin-bottom: 2px;">Depth Type ⭐:</label>
                <select id="depth-type-${i}" style="width: 100%; padding: 2px; font-size: 11px;">
                    <option value="euclidean" ${depthSettings.includes('euclidean') ? 'selected' : ''}>Euclidean</option>
                    <option value="orthogonal" ${depthSettings.includes('orthogonal') ? 'selected' : ''}>Orthogonal</option>
                    <option value="disparity" ${depthSettings.includes('disparity') ? 'selected' : ''}>Disparity</option>
                    <option value="inverse_depth" ${depthSettings.includes('inverse_depth') ? 'selected' : ''}>Inverse Depth</option>
                </select>
            </div>
        `;
    }

    /**
     * Generate intrinsic parameters HTML
     */
    private generateIntrinsicParametersHTML(data: PlyData, i: number): string {
        return `
            <div class="depth-group" style="margin-bottom: 8px;">
                <label style="display: block; font-size: 10px; font-weight: bold; margin-bottom: 2px;">Intrinsic Parameters ⭐:</label>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-bottom: 4px;">
                    <div>
                        <label for="fx-${i}" style="font-size: 9px;">fx:</label>
                        <input type="number" id="fx-${i}" step="0.01" style="width: 100%; padding: 1px; font-size: 10px;" placeholder="1000">
                    </div>
                    <div>
                        <label for="fy-${i}" style="font-size: 9px;">fy:</label>
                        <input type="number" id="fy-${i}" step="0.01" style="width: 100%; padding: 1px; font-size: 10px;" placeholder="same as fx">
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
                    <div>
                        <label for="cx-${i}" style="font-size: 9px;">cx:</label>
                        <input type="number" id="cx-${i}" step="0.01" style="width: 100%; padding: 1px; font-size: 10px;" placeholder="auto">
                    </div>
                    <div>
                        <label for="cy-${i}" style="font-size: 9px;">cy:</label>
                        <input type="number" id="cy-${i}" step="0.01" style="width: 100%; padding: 1px; font-size: 10px;" placeholder="auto">
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Generate depth processing controls HTML
     */
    private generateDepthProcessingControlsHTML(data: PlyData, i: number): string {
        return `
            <div class="depth-group" style="margin-bottom: 8px;">
                <label style="display: block; font-size: 10px; font-weight: bold; margin-bottom: 2px;">Depth Processing:</label>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-bottom: 4px;">
                    <div>
                        <label for="depth-scale-${i}" style="font-size: 9px;">Scale:</label>
                        <input type="number" id="depth-scale-${i}" step="0.01" style="width: 100%; padding: 1px; font-size: 10px;" placeholder="1.0">
                    </div>
                    <div>
                        <label for="depth-bias-${i}" style="font-size: 9px;">Bias:</label>
                        <input type="number" id="depth-bias-${i}" step="0.01" style="width: 100%; padding: 1px; font-size: 10px;" placeholder="0.0">
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
                    <div>
                        <label for="convention-${i}" style="font-size: 9px;">Convention:</label>
                        <select id="convention-${i}" style="width: 100%; padding: 1px; font-size: 10px;">
                            <option value="opengl">OpenGL (+Y up)</option>
                            <option value="opencv">OpenCV (+Y down)</option>
                        </select>
                    </div>
                    <div class="disparity-controls" style="display: none;">
                        <label for="baseline-${i}" style="font-size: 9px;">Baseline:</label>
                        <input type="number" id="baseline-${i}" step="0.1" style="width: 100%; padding: 1px; font-size: 10px;" placeholder="120">
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Generate depth action buttons HTML
     */
    private generateDepthActionButtonsHTML(i: number): string {
        return `
            <div class="depth-group" style="margin-bottom: 8px;">
                <div style="display: flex; gap: 4px;">
                    <button class="reprocess-depth" data-file-index="${i}" style="flex: 1; padding: 4px 8px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: 1px solid var(--vscode-panel-border); border-radius: 2px; cursor: pointer; font-size: 11px;">🔄 Reprocess</button>
                    <button class="load-color-image" data-file-index="${i}" style="flex: 1; padding: 4px 8px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: 1px solid var(--vscode-panel-border); border-radius: 2px; cursor: pointer; font-size: 11px;">🖼️ Color Image</button>
                </div>
                <div style="display: flex; gap: 4px; margin-top: 4px;">
                    <button class="save-ply-file" data-file-index="${i}" style="flex: 1; padding: 4px 8px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: 1px solid var(--vscode-panel-border); border-radius: 2px; cursor: pointer; font-size: 11px;">💾 Save as PLY</button>
                </div>
                <div style="display: flex; gap: 4px; margin-top: 4px;">
                    <button class="use-as-default-settings" data-file-index="${i}" style="flex: 1; padding: 4px 8px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: 1px solid var(--vscode-panel-border); border-radius: 2px; cursor: pointer; font-size: 11px;">⭐ Use as Default</button>
                    <button class="reset-to-default-settings" data-file-index="${i}" style="flex: 1; padding: 4px 8px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: 1px solid var(--vscode-panel-border); border-radius: 2px; cursor: pointer; font-size: 11px;">⭐ Reset to Default</button>
                </div>
            </div>
        `;
    }

    /**
     * Generate transform controls HTML
     */
    private generateTransformControlsHTML(i: number, matrixStr: string): string {
        return `
            <!-- Transform Controls (Second) -->
            <div class="transform-section">
                <button class="transform-toggle" data-file-index="${i}">
                    <span class="toggle-icon">▶</span> Transform
                </button>
                <div class="transform-panel" id="transform-panel-${i}" style="display:none;">
                    <div class="transform-group">
                        <label style="font-size:10px;font-weight:bold;">Transformations:</label>
                        <div class="transform-buttons">
                            <button class="add-translation" data-file-index="${i}">Add Translation</button>
                            <button class="add-quaternion" data-file-index="${i}">Add Quaternion</button>
                            <button class="add-angle-axis" data-file-index="${i}">Add Angle-Axis</button>
                        </div>
                    </div>
                    
                    <div class="transform-group">
                        <label style="font-size:10px;font-weight:bold;">Rotation (90°):</label>
                        <div class="transform-buttons">
                            <button class="rotate-x" data-file-index="${i}">X</button>
                            <button class="rotate-y" data-file-index="${i}">Y</button>
                            <button class="rotate-z" data-file-index="${i}">Z</button>
                        </div>
                    </div>
                    
                    <div class="transform-group">
                        <label style="font-size:10px;font-weight:bold;">Matrix (4x4):</label>
                        <textarea id="matrix-${i}" rows="4" cols="50" style="width:100%;font-size:9px;font-family:monospace;" placeholder="1.000000 0.000000 0.000000 0.000000&#10;0.000000 1.000000 0.000000 0.000000&#10;0.000000 0.000000 1.000000 0.000000&#10;0.000000 0.000000 0.000000 1.000000">${matrixStr.trim()}</textarea>
                        <div class="transform-buttons" style="margin-top:4px;">
                            <button class="apply-matrix" data-file-index="${i}">Apply Matrix</button>
                            <button class="invert-matrix" data-file-index="${i}">Invert</button>
                            <button class="reset-matrix" data-file-index="${i}">Reset</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Generate rendering controls HTML
     */
    private generateRenderingControlsHTML(data: PlyData, i: number): string {
        const hasFaces = data.faceCount > 0;
        const hasLines = (data as any).objData && (data as any).objData.lineCount > 0;
        const hasGeometry = hasFaces || hasLines;
        const hasNormalsData = data.hasNormals || hasFaces;
        const buttons = [];
        
        // Always show points button
        buttons.push(`<button class="render-mode-btn points-btn" data-file-index="${i}" data-mode="points" style="padding: 3px 6px; border: 1px solid var(--vscode-panel-border); border-radius: 2px; font-size: 9px; cursor: pointer;">👁️ Points</button>`);
        
        // Show mesh/wireframe buttons if there are faces OR lines
        if (hasGeometry) {
            buttons.push(`<button class="render-mode-btn mesh-btn" data-file-index="${i}" data-mode="mesh" style="padding: 3px 6px; border: 1px solid var(--vscode-panel-border); border-radius: 2px; font-size: 9px; cursor: pointer;">🔷 Mesh</button>`);
            buttons.push(`<button class="render-mode-btn wireframe-btn" data-file-index="${i}" data-mode="wireframe" style="padding: 3px 6px; border: 1px solid var(--vscode-panel-border); border-radius: 2px; font-size: 9px; cursor: pointer;">📐 Wireframe</button>`);
        }
        
        // Show normals button if there are normals or faces
        const isPtsFile = data.fileName?.toLowerCase().endsWith('.pts');
        const shouldShowNormals = hasNormalsData && (!isPtsFile || (data.vertices.length > 0 && data.vertices[0]?.nx !== undefined));
        
        if (shouldShowNormals) {
            buttons.push(`<button class="render-mode-btn normals-btn" data-file-index="${i}" data-mode="normals" style="padding: 3px 6px; border: 1px solid var(--vscode-panel-border); border-radius: 2px; font-size: 9px; cursor: pointer;">📏 Normals</button>`);
        }
        
        // Determine grid layout
        const buttonCount = buttons.length;
        let gridColumns = '';
        if (buttonCount === 1) gridColumns = '1fr';
        else if (buttonCount === 2) gridColumns = '1fr 1fr';
        else if (buttonCount === 3) gridColumns = '1fr 1fr 1fr';
        else if (buttonCount === 4) gridColumns = '1fr 1fr 1fr 1fr';
        
        return `
            <!-- Universal Rendering Controls -->
            <div class="rendering-controls" style="margin-top: 4px; margin-bottom: 6px;">
                <div style="display: grid; grid-template-columns: ${gridColumns}; gap: 3px;">${buttons.join('')}</div>
            </div>
        `;
    }

    /**
     * Generate point size control HTML
     */
    private generatePointSizeControlHTML(i: number, currentSize: number): string {
        const sizeValue = currentSize || 0.001;
        return `
            <!-- Point/Line Size Control -->
            <div class="point-size-control" style="margin-top: 4px;">
                <label for="size-${i}" style="font-size: 11px;">Point Size:</label>
                <input type="range" id="size-${i}" min="0.0001" max="0.1" step="0.0001" value="${sizeValue}" class="size-slider" style="width: 100%;">
                <span class="size-value" style="font-size: 10px;">${sizeValue.toFixed(4)}</span>
            </div>
        `;
    }

    /**
     * Generate color controls HTML
     */
    private generateColorControlsHTML(data: PlyData, i: number): string {
        return `
            <!-- Color Control -->
            <div class="color-control" style="margin-top: 4px;">
                <label for="color-${i}" style="font-size: 11px; display: block; margin-bottom: 2px;">Color:</label>
                <select id="color-${i}" class="color-selector" style="width: 100%; padding: 3px; border: 1px solid var(--vscode-panel-border); border-radius: 2px; font-size: 9px;">
                    ${data.hasColors ? `<option value="original" ${this.getIndividualColorMode(i) === 'original' ? 'selected' : ''}>Original</option>` : ''}
                    <option value="assigned" ${this.getIndividualColorMode(i) === 'assigned' ? 'selected' : ''}>Assigned (${this.getColorName(i)})</option>
                    ${this.getColorOptions(i)}
                </select>
            </div>
        `;
    }

    /**
     * Get individual color mode for a file
     */
    private getIndividualColorMode(fileIndex: number): string {
        const individualColorModes = this.callbacks.getIndividualColorModes();
        return individualColorModes[fileIndex] || 'assigned';
    }

    /**
     * Get color name for a file index
     */
    private getColorName(fileIndex: number): string {
        const colorNames = ['White', 'Red', 'Green', 'Blue', 'Yellow', 'Magenta', 'Cyan', 'Orange', 'Purple', 'Dark Green', 'Gray'];
        return colorNames[fileIndex % colorNames.length];
    }

    /**
     * Generate color options for dropdown
     */
    private getColorOptions(fileIndex: number): string {
        const fileColors = this.callbacks.getFileColors();
        const individualColorModes = this.callbacks.getIndividualColorModes();
        let options = '';
        for (let i = 0; i < fileColors.length; i++) {
            const isSelected = individualColorModes[fileIndex] === i.toString();
            options += `<option value="${i}" ${isSelected ? 'selected' : ''}>${this.getColorName(i)}</option>`;
        }
        return options;
    }

    /**
     * Generate pose data HTML
     */
    private generatePoseHTML(poseGroups: THREE.Group[]): string {
        // Pose rendering logic would go here - simplified for extraction
        return ''; // Placeholder - full implementation would be quite large
    }

    /**
     * Generate camera data HTML  
     */
    private generateCameraHTML(cameraGroups: THREE.Group[]): string {
        // Camera rendering logic would go here - simplified for extraction
        return ''; // Placeholder - full implementation would be quite large
    }

    /**
     * Set up event listeners for file list - part of updateFileList extraction
     */
    private setupFileListEventListeners(fileListDiv: Element): void {
        // File visibility checkboxes
        const fileCheckboxes = fileListDiv.querySelectorAll('input[type="checkbox"][id^="file-"]');
        fileCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const target = e.target as HTMLInputElement;
                const fileIndex = parseInt(target.id.replace('file-', ''));
                this.callbacks.toggleFileVisibility(fileIndex);
            });
        });

        // Remove file buttons
        const removeButtons = fileListDiv.querySelectorAll('.remove-file');
        removeButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const target = e.target as HTMLElement;
                const fileIndex = parseInt(target.getAttribute('data-file-index') || '0');
                // Remove file logic would be handled by callback
                console.log(`Remove file ${fileIndex}`);
            });
        });

        // Transform toggle buttons
        const transformToggles = fileListDiv.querySelectorAll('.transform-toggle');
        transformToggles.forEach(button => {
            button.addEventListener('click', (e) => {
                const target = e.target as HTMLElement;
                const fileIndex = parseInt(target.getAttribute('data-file-index') || '0');
                const panel = document.getElementById(`transform-panel-${fileIndex}`);
                const icon = target.querySelector('.toggle-icon');
                
                if (panel && icon) {
                    const isHidden = panel.style.display === 'none';
                    panel.style.display = isHidden ? 'block' : 'none';
                    icon.textContent = isHidden ? '▼' : '▶';
                }
            });
        });

        // Render mode buttons (points, mesh, wireframe, normals)
        const renderModeButtons = fileListDiv.querySelectorAll('.render-mode-btn');
        console.log(`Found ${renderModeButtons.length} render mode buttons to attach listeners to`);
        renderModeButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const target = e.target as HTMLElement;
                const fileIndex = parseInt(target.getAttribute('data-file-index') || '0');
                const mode = target.getAttribute('data-mode') || 'solid';
                console.log(`🔘 Render button clicked: fileIndex=${fileIndex}, mode=${mode}`);
                if (this.callbacks.toggleUniversalRenderMode) {
                    this.callbacks.toggleUniversalRenderMode(fileIndex, mode);
                }
            });
        });
        
        // Point size sliders
        const sizeSliders = fileListDiv.querySelectorAll('.size-slider');
        sizeSliders.forEach(slider => {
            slider.addEventListener('input', (e) => {
                const target = e.target as HTMLInputElement;
                const fileIndex = parseInt(target.id.split('-')[1] || '0');
                const newSize = parseFloat(target.value);
                
                console.log('Point size slider changed for file:', fileIndex, 'new size:', newSize);
                
                // Update size value display
                const sizeDisplay = target.parentElement?.querySelector('.size-value');
                if (sizeDisplay) {
                    sizeDisplay.textContent = newSize.toFixed(4);
                }
                
                // Apply the new point size
                this.callbacks.updatePointSize(fileIndex, newSize);
            });
        });
        
        // Color selectors
        const colorSelectors = fileListDiv.querySelectorAll('.color-selector');
        colorSelectors.forEach(select => {
            select.addEventListener('change', (e) => {
                const target = e.target as HTMLSelectElement;
                const fileIndex = parseInt(target.id.replace('color-', ''));
                const value = target.value;
                
                console.log('Color selector changed for file:', fileIndex, 'value:', value);
                
                if (this.callbacks.setFileColorValue) {
                    this.callbacks.setFileColorValue(fileIndex, value);
                }
            });
        });
    }
}