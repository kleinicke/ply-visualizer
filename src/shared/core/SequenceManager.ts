import * as THREE from 'three';

export interface SequenceManagerCallbacks {
    postMessage: (message: any) => void;
    updateFileList: () => void;
    updateSequenceUI: () => void;
    fitCameraToObject: (obj: THREE.Object3D) => void;
    handleUltimateRawBinaryData?: (message: any) => Promise<void>;
    displayFiles?: (files: any[]) => Promise<void>;
    handleXyzData?: (message: any) => Promise<void>;
    handleObjData?: (message: any) => Promise<void>;
    handleStlData?: (message: any) => Promise<void>;
    handleDepthData?: (message: any) => Promise<void>;
    getMeshes: () => THREE.Object3D[];
    getScene: () => THREE.Scene;
    clearMeshes: () => void;
    clearPlyFiles: () => void;
    trimNormalModeArraysFrom: (startIndex: number) => void;
}

/**
 * Sequence/Animation management - extracted from main.ts
 * Handles sequence playback, caching, and frame management
 */
export class SequenceManager {
    private sequenceMode = false;
    private sequenceFiles: string[] = [];
    private sequenceIndex = 0;
    private sequenceTargetIndex = 0;
    private sequenceDidInitialFit = false;
    private isSequencePlaying = false;
    private sequenceTimer: number | null = null;
    private sequenceFps = 10;
    private sequenceCache = new Map<number, THREE.Object3D>();
    private sequenceCacheOrder: number[] = [];
    private maxSequenceCache = 10;

    constructor(private callbacks: SequenceManagerCallbacks) {}

    /**
     * Initialize sequence mode with file list - extracted from main.ts
     */
    initializeSequence(files: string[], wildcard: string): void {
        this.sequenceMode = true;
        this.sequenceFiles = files;
        this.sequenceIndex = 0;
        this.sequenceTargetIndex = 0;
        this.sequenceDidInitialFit = false;
        this.isSequencePlaying = false;
        this.sequenceCache.clear();
        this.sequenceCacheOrder = [];
        
        // Show overlay
        document.getElementById('sequence-overlay')?.classList.remove('hidden');
        const wildcardInput = document.getElementById('seq-wildcard') as HTMLInputElement | null;
        if (wildcardInput) wildcardInput.value = wildcard;
        this.callbacks.updateSequenceUI();
        
        // Clear any existing meshes from normal mode
        this.callbacks.clearMeshes();
        this.callbacks.clearPlyFiles();
        
        // Load first frame
        if (files.length > 0) this.loadSequenceFrame(0);
        this.callbacks.updateFileList();
    }

    /**
     * Update sequence UI elements - extracted from main.ts
     */
    updateSequenceUI(): void {
        const slider = document.getElementById('seq-slider') as HTMLInputElement | null;
        const label = document.getElementById('seq-label') as HTMLElement | null;
        if (slider) {
            slider.max = Math.max(0, this.sequenceFiles.length - 1).toString();
            slider.value = Math.min(this.sequenceIndex, this.sequenceFiles.length ? this.sequenceFiles.length - 1 : 0).toString();
        }
        if (label) {
            label.textContent = `${this.sequenceFiles.length ? this.sequenceIndex + 1 : 0} / ${this.sequenceFiles.length}`;
        }
    }

    /**
     * Play sequence animation - extracted from main.ts
     */
    playSequence(): void {
        if (!this.sequenceFiles.length) return;
        if (this.isSequencePlaying) return;
        this.isSequencePlaying = true;
        const intervalMs = Math.max(50, Math.floor(1000 / this.sequenceFps));
        this.sequenceTimer = window.setInterval(() => {
            const nextIndex = (this.sequenceIndex + 1) % this.sequenceFiles.length;
            this.seekSequence(nextIndex);
        }, intervalMs) as unknown as number;
    }

    /**
     * Pause sequence animation - extracted from main.ts
     */
    pauseSequence(): void {
        this.isSequencePlaying = false;
        if (this.sequenceTimer !== null) {
            window.clearInterval(this.sequenceTimer as unknown as number);
            this.sequenceTimer = null;
        }
    }

    /**
     * Stop sequence animation - extracted from main.ts
     */
    stopSequence(): void {
        this.pauseSequence();
    }

    /**
     * Step sequence by delta frames - extracted from main.ts
     */
    stepSequence(delta: number): void {
        if (!this.sequenceFiles.length) return;
        this.pauseSequence(); // do not auto-play when stepping
        const count = this.sequenceFiles.length;
        const next = (this.sequenceIndex + delta + count) % count;
        this.seekSequence(next);
    }

    /**
     * Seek to specific frame index - extracted from main.ts
     */
    seekSequence(index: number): void {
        if (!this.sequenceFiles.length) return;
        const clamped = Math.max(0, Math.min(index, this.sequenceFiles.length - 1));
        this.sequenceTargetIndex = clamped;
        this.loadSequenceFrame(clamped);
    }

    /**
     * Handle ultimate data for sequence - extracted from main.ts
     */
    async sequenceHandleUltimate(message: any): Promise<void> {
        if (!this.callbacks.handleUltimateRawBinaryData) return;
        
        const plyMsg = { ...message, type: 'ultimateRawBinaryData', messageType: 'addFiles' };
        const meshes = this.callbacks.getMeshes();
        const startFilesLen = meshes.length;
        
        await this.callbacks.handleUltimateRawBinaryData(plyMsg);
        const created = meshes[meshes.length - 1];
        
        if (created) {
            if (message.index === this.sequenceTargetIndex) this.useSequenceObject(created, message.index);
            else this.cacheSequenceOnly(created, message.index);
        }
        this.callbacks.trimNormalModeArraysFrom(startFilesLen);
    }

    /**
     * Handle PLY data for sequence - extracted from main.ts
     */
    async sequenceHandlePly(message: any): Promise<void> {
        if (!this.callbacks.displayFiles) return;
        
        const meshes = this.callbacks.getMeshes();
        const startFilesLen = meshes.length;
        
        await this.callbacks.displayFiles([message.data]);
        const created = meshes[meshes.length - 1];
        
        if (created) {
            if (message.index === this.sequenceTargetIndex) this.useSequenceObject(created, message.index);
            else this.cacheSequenceOnly(created, message.index);
        }
        this.callbacks.trimNormalModeArraysFrom(startFilesLen);
    }

    /**
     * Handle XYZ data for sequence - extracted from main.ts
     */
    async sequenceHandleXyz(message: any): Promise<void> {
        if (!this.callbacks.handleXyzData) return;
        
        const meshes = this.callbacks.getMeshes();
        const startFilesLen = meshes.length;
        
        await this.callbacks.handleXyzData({ 
            type: 'xyzData', 
            fileName: message.fileName, 
            data: message.data, 
            isAddFile: true 
        });
        const created = meshes[meshes.length - 1];
        
        if (created) {
            if (message.index === this.sequenceTargetIndex) this.useSequenceObject(created, message.index);
            else this.cacheSequenceOnly(created, message.index);
        }
        this.callbacks.trimNormalModeArraysFrom(startFilesLen);
    }

    /**
     * Handle OBJ data for sequence - extracted from main.ts
     */
    async sequenceHandleObj(message: any): Promise<void> {
        if (!this.callbacks.handleObjData) return;
        
        const meshes = this.callbacks.getMeshes();
        const startFilesLen = meshes.length;
        
        await this.callbacks.handleObjData({ 
            type: 'objData', 
            fileName: message.fileName, 
            data: message.data, 
            isAddFile: true 
        });
        const created = meshes[meshes.length - 1];
        
        if (created) {
            if (message.index === this.sequenceTargetIndex) this.useSequenceObject(created, message.index);
            else this.cacheSequenceOnly(created, message.index);
        }
        this.callbacks.trimNormalModeArraysFrom(startFilesLen);
    }

    /**
     * Handle STL data for sequence - extracted from main.ts
     */
    async sequenceHandleStl(message: any): Promise<void> {
        if (!this.callbacks.handleStlData) return;
        
        const meshes = this.callbacks.getMeshes();
        const startFilesLen = meshes.length;
        
        await this.callbacks.handleStlData({ 
            type: 'stlData', 
            fileName: message.fileName, 
            data: message.data, 
            isAddFile: true 
        });
        const created = meshes[meshes.length - 1];
        
        if (created) {
            if (message.index === this.sequenceTargetIndex) this.useSequenceObject(created, message.index);
            else this.cacheSequenceOnly(created, message.index);
        }
        this.callbacks.trimNormalModeArraysFrom(startFilesLen);
    }

    /**
     * Handle depth data for sequence - extracted from main.ts
     */
    async sequenceHandleDepth(message: any): Promise<void> {
        if (!this.callbacks.handleDepthData) return;
        
        const meshes = this.callbacks.getMeshes();
        const startFilesLen = meshes.length;
        
        await this.callbacks.handleDepthData({ 
            type: 'depthData', 
            fileName: message.fileName, 
            data: message.data, 
            isAddFile: true 
        });
        const created = meshes[meshes.length - 1];
        if (created) this.useSequenceObject(created, message.index);
        this.callbacks.trimNormalModeArraysFrom(startFilesLen);
    }

    /**
     * Load specific frame from sequence - extracted from main.ts
     */
    private async loadSequenceFrame(index: number): Promise<void> {
        const filePath = this.sequenceFiles[index];
        if (!filePath) return;
        
        // If cached, display immediately
        const cached = this.sequenceCache.get(index);
        if (cached) {
            this.swapSequenceObject(cached, index);
            return;
        }
        
        // If a request is in-flight and for a different index, let it finish but ignore on arrival
        const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        // Request from extension with requestId for matching
        this.callbacks.postMessage({ type: 'sequence:requestFile', path: filePath, index, requestId });
        
        // Show a lightweight loading hint
        try { 
            (document.getElementById('loading') as HTMLElement)?.classList.remove('hidden'); 
        } catch {}
    }

    /**
     * Use object for sequence display - extracted from main.ts
     */
    private useSequenceObject(obj: THREE.Object3D, index: number): void {
        const scene = this.callbacks.getScene();
        
        // Cache management
        if (!this.sequenceCache.has(index)) {
            this.sequenceCache.set(index, obj);
            this.sequenceCacheOrder.push(index);
            
            // Evict if over capacity
            while (this.sequenceCacheOrder.length > this.maxSequenceCache) {
                const evictIndex = this.sequenceCacheOrder.shift()!;
                if (evictIndex !== this.sequenceIndex) {
                    const evictObj = this.sequenceCache.get(evictIndex);
                    if (evictObj) {
                        scene.remove(evictObj);
                        if ((evictObj as any).geometry) (evictObj as any).geometry.dispose?.();
                        if ((evictObj as any).material) {
                            const mat = (evictObj as any).material;
                            if (Array.isArray(mat)) mat.forEach(m => m.dispose?.()); else mat.dispose?.();
                        }
                    }
                    this.sequenceCache.delete(evictIndex);
                }
            }
        }
        this.swapSequenceObject(obj, index);
    }

    /**
     * Cache object without displaying - extracted from main.ts
     */
    private cacheSequenceOnly(obj: THREE.Object3D, index: number): void {
        const scene = this.callbacks.getScene();
        
        if (obj.parent) scene.remove(obj);
        if (!this.sequenceCache.has(index)) {
            this.sequenceCache.set(index, obj);
            this.sequenceCacheOrder.push(index);
            
            while (this.sequenceCacheOrder.length > this.maxSequenceCache) {
                const evictIndex = this.sequenceCacheOrder.shift()!;
                const evictObj = this.sequenceCache.get(evictIndex);
                if (evictObj) {
                    scene.remove(evictObj);
                    if ((evictObj as any).geometry) (evictObj as any).geometry.dispose?.();
                    if ((evictObj as any).material) {
                        const mat = (evictObj as any).material;
                        if (Array.isArray(mat)) mat.forEach(m => m.dispose?.()); else mat.dispose?.();
                    }
                }
                this.sequenceCache.delete(evictIndex);
            }
        }
    }

    /**
     * Swap displayed sequence object - extracted from main.ts
     */
    private swapSequenceObject(obj: THREE.Object3D, index: number): void {
        const scene = this.callbacks.getScene();
        
        // Remove current
        const current = this.sequenceCache.get(this.sequenceIndex);
        if (current && current !== obj) {
            current.visible = false;
            scene.remove(current);
        }
        
        // Add new
        if (!obj.parent) scene.add(obj);
        obj.visible = true;
        
        // Hide axes when new object is added to rule out looking-only-at-axes confusion
        try { 
            (scene as any).axesGroup.visible = true; 
        } catch {}
        
        this.sequenceIndex = index;
        
        // Make points clearly visible in sequence mode
        this.ensureSequenceVisibility(obj);
        
        // Fit camera only once on the first visible frame
        if (!this.sequenceDidInitialFit) {
            this.callbacks.fitCameraToObject(obj);
            this.sequenceDidInitialFit = true;
        }
        
        this.callbacks.updateSequenceUI();
        this.callbacks.updateFileList();
        
        // Hide loading if it was shown
        try { 
            (document.getElementById('loading') as HTMLElement)?.classList.add('hidden'); 
        } catch {}
        
        // Preload next
        const next = (index + 1) % this.sequenceFiles.length;
        const nextPath = this.sequenceFiles[next] || '';
        const isDepth = /\.(tif|tiff|pfm|npy|npz|png|exr)$/i.test(nextPath);
        if (!isDepth && !this.sequenceCache.get(next)) {
            this.callbacks.postMessage({ type: 'sequence:requestFile', path: nextPath, index: next });
        }
    }

    /**
     * Ensure sequence object is visible - extracted from main.ts
     */
    private ensureSequenceVisibility(obj: THREE.Object3D): void {
        if ((obj as any).isPoints && (obj as any).material && (obj as any).material instanceof THREE.PointsMaterial) {
            const mat = (obj as any).material as THREE.PointsMaterial;
            // Use a sensible on-screen size for sequence mode; avoid tiny defaults
            if (!mat.size || mat.size < 0.5) {
                mat.size = 2.5;
            }
            // Use screen-space size for clarity regardless of distance
            mat.sizeAttenuation = false;
            mat.needsUpdate = true;
        }
    }

    // Public API
    isSequenceMode(): boolean {
        return this.sequenceMode;
    }

    getSequenceFiles(): string[] {
        return [...this.sequenceFiles];
    }

    getCurrentSequenceIndex(): number {
        return this.sequenceIndex;
    }

    getSequenceLength(): number {
        return this.sequenceFiles.length;
    }

    isPlaying(): boolean {
        return this.isSequencePlaying;
    }

    setSequenceFps(fps: number): void {
        this.sequenceFps = Math.max(1, Math.min(60, fps));
        
        // Restart timer if playing
        if (this.isSequencePlaying) {
            this.pauseSequence();
            this.playSequence();
        }
    }

    getSequenceFps(): number {
        return this.sequenceFps;
    }

    getCurrentSequenceFilename(): string {
        if (!this.sequenceMode || this.sequenceFiles.length === 0) return '';
        return this.sequenceFiles[this.sequenceIndex]?.split(/[\\/]/).pop() || `Frame ${this.sequenceIndex + 1}`;
    }

    dispose(): void {
        this.pauseSequence();
        
        // Clear cache and dispose objects
        for (const obj of this.sequenceCache.values()) {
            if (obj.parent) obj.parent.remove(obj);
            if ((obj as any).geometry) (obj as any).geometry.dispose?.();
            if ((obj as any).material) {
                const mat = (obj as any).material;
                if (Array.isArray(mat)) mat.forEach(m => m.dispose?.()); 
                else mat.dispose?.();
            }
        }
        
        this.sequenceCache.clear();
        this.sequenceCacheOrder = [];
        this.sequenceFiles = [];
        this.sequenceMode = false;
    }
}