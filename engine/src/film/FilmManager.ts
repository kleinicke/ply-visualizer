import * as THREE from 'three';
import {
  CameraKeyframe,
  parseKeyframeProject,
  sampleTimeline,
  timelineDuration,
} from './keyframes';
import { filmState } from '../state/film.svelte';
import { viewerState } from '../state/viewer.svelte';
import { getBackgroundCssColor } from '../sceneBrightness';

declare const acquireVsCodeApi: () => any;
const isVSCode = typeof acquireVsCodeApi !== 'undefined';

export interface FilmHost {
  camera: THREE.PerspectiveCamera;
  controls: { target: THREE.Vector3; enabled: boolean; update(): void };
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  backgroundBrightness: number;
  vscode: { postMessage(message: any): void };
  requestRender(): void;
  showStatus(message: string): void;
}

interface SavedCameraPose {
  position: THREE.Vector3;
  target: THREE.Vector3;
  up: THREE.Vector3;
  fov: number;
}

/**
 * Video mode: an ordered list of camera keyframes played back as a smooth
 * camera path (film/keyframes.ts), optionally recorded from the canvas with
 * MediaRecorder, and serializable to JSON so a camera path can be reproduced
 * later. The host keeps rendering through its normal on-demand loop; playback
 * just moves the camera and requests renders, so it works identically in the
 * VS Code webview and the standalone page.
 */
export class FilmManager {
  private host: FilmHost;
  private keyframes: CameraKeyframe[] = [];
  private keyframeCounter = 0;

  private playing = false;
  private rafId: number | null = null;
  private playStart = 0;
  private savedPose: SavedCameraPose | null = null;

  private recorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private recordedMime = '';
  // The canvas clears with alpha 0 and the visible background is CSS on the
  // canvas element, so captureStream would record transparency (black in the
  // video). During recording the background is rendered into the scene
  // instead; this holds what to restore afterwards.
  private savedBackground: THREE.Scene['background'] = null;
  private backgroundSwapped = false;

  private frustumGroup: THREE.Group | null = null;

  constructor(host: FilmHost) {
    this.host = host;
  }

  getKeyframes(): CameraKeyframe[] {
    return this.keyframes;
  }

  isPlaying(): boolean {
    return this.playing;
  }

  addKeyframeFromCamera(): void {
    const c = this.host.camera;
    this.keyframeCounter++;
    this.keyframes.push({
      name: `Keyframe ${this.keyframeCounter}`,
      position: c.position.toArray() as [number, number, number],
      target: this.host.controls.target.toArray() as [number, number, number],
      quaternion: c.quaternion.toArray() as [number, number, number, number],
      fov: c.fov,
      duration: 2,
      dwell: 0,
    });
    this.syncState();
    this.host.showStatus(`Added keyframe ${this.keyframes.length}`);
  }

  removeKeyframe(index: number): void {
    if (index < 0 || index >= this.keyframes.length) {
      return;
    }
    this.keyframes.splice(index, 1);
    this.syncState();
  }

  moveKeyframe(index: number, delta: number): void {
    const to = index + delta;
    if (index < 0 || index >= this.keyframes.length || to < 0 || to >= this.keyframes.length) {
      return;
    }
    const [key] = this.keyframes.splice(index, 1);
    this.keyframes.splice(to, 0, key);
    this.syncState();
  }

  updateKeyframe(index: number, patch: Partial<Pick<CameraKeyframe, 'duration' | 'dwell'>>): void {
    const key = this.keyframes[index];
    if (!key) {
      return;
    }
    if (patch.duration !== undefined && Number.isFinite(patch.duration) && patch.duration > 0) {
      key.duration = patch.duration;
    }
    if (patch.dwell !== undefined && Number.isFinite(patch.dwell) && patch.dwell >= 0) {
      key.dwell = patch.dwell;
    }
    this.syncState();
  }

  /** Re-capture the current camera into an existing keyframe. */
  overwriteKeyframe(index: number): void {
    const key = this.keyframes[index];
    if (!key) {
      return;
    }
    const c = this.host.camera;
    key.position = c.position.toArray() as [number, number, number];
    key.target = this.host.controls.target.toArray() as [number, number, number];
    key.quaternion = c.quaternion.toArray() as [number, number, number, number];
    key.fov = c.fov;
    this.syncState();
    this.host.showStatus(`Updated ${key.name} to current view`);
  }

  /** Jump the interactive camera to a keyframe (for editing/inspection). */
  goToKeyframe(index: number): void {
    const key = this.keyframes[index];
    if (!key || this.playing) {
      return;
    }
    this.applySample({
      position: new THREE.Vector3().fromArray(key.position),
      target: new THREE.Vector3().fromArray(key.target),
      up: new THREE.Vector3(0, 1, 0).applyQuaternion(
        new THREE.Quaternion().fromArray(key.quaternion)
      ),
      fov: key.fov,
    });
  }

  play(): void {
    if (this.playing) {
      return;
    }
    if (this.keyframes.length < 2) {
      this.host.showStatus('Video mode needs at least 2 keyframes to play');
      return;
    }

    const c = this.host.camera;
    this.savedPose = {
      position: c.position.clone(),
      target: this.host.controls.target.clone(),
      up: c.up.clone(),
      fov: c.fov,
    };

    this.host.controls.enabled = false;
    // Kill any leftover trackball fling momentum so it can't fight playback.
    (this.host.controls as any)._lastAngle = 0;

    this.playing = true;
    this.playStart = performance.now();
    filmState.playing = true;
    this.tick();
  }

  /** Stop playback, restore the pre-playback camera, finalize any recording. */
  stop(): void {
    if (!this.playing) {
      return;
    }
    this.playing = false;
    filmState.playing = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.host.controls.enabled = true;

    if (this.savedPose) {
      this.applySample(this.savedPose);
      this.savedPose = null;
    }

    if (this.recorder) {
      this.finishRecording();
    }
  }

  private tick = (): void => {
    if (!this.playing) {
      return;
    }
    const loop = filmState.loop;
    const total = timelineDuration(this.keyframes, loop);
    let t = (performance.now() - this.playStart) / 1000;

    if (t >= total) {
      if (loop && !this.recorder) {
        // The looping timeline ends exactly where it starts (closing segment
        // flies back to the first keyframe), so wrapping t is seamless.
        const cycles = Math.floor(t / total);
        this.playStart += cycles * total * 1000;
        t -= cycles * total;
      } else {
        // Show the final pose for one frame, then restore. A recording with
        // loop enabled runs the loop exactly once and ends back at the start.
        this.applySample(sampleTimeline(this.keyframes, total, loop));
        this.stop();
        return;
      }
    }

    this.applySample(sampleTimeline(this.keyframes, t, loop));
    this.rafId = requestAnimationFrame(this.tick);
  };

  private applySample(sample: SavedCameraPose | ReturnType<typeof sampleTimeline>): void {
    const c = this.host.camera;
    c.position.copy(sample.position);
    this.host.controls.target.copy(sample.target);
    c.up.copy(sample.up);
    c.lookAt(sample.target);
    if (c.fov !== sample.fov) {
      c.fov = sample.fov;
      viewerState.cameraFov = sample.fov;
      c.updateProjectionMatrix();
    }
    this.host.requestRender();
  }

  // ---------------------------------------------------------------- recording

  startRecording(): void {
    if (this.recorder) {
      return;
    }
    if (this.keyframes.length < 2) {
      this.host.showStatus('Video mode needs at least 2 keyframes to record');
      return;
    }
    if (typeof MediaRecorder === 'undefined') {
      this.host.showStatus('Recording is not supported in this environment');
      return;
    }

    // Prefer MP4/H.264 when the browser can mux it, fall back through WebM
    // codecs; never assume a specific one is available.
    const candidates = [
      'video/mp4;codecs=avc1',
      'video/mp4',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
    ];
    const mime = candidates.find(m => MediaRecorder.isTypeSupported(m));
    if (!mime) {
      this.host.showStatus('No supported video codec found — cannot record');
      return;
    }

    // Recording during a preview restarts from the beginning: end the preview
    // (restoring the pre-preview camera, which play() below re-saves so it
    // still comes back after the recording) and record one full pass.
    if (this.playing) {
      this.stop();
    }

    // Bake the CSS canvas background into the scene for the recording (the
    // canvas itself is transparent — see savedBackground).
    this.savedBackground = this.host.scene.background;
    this.host.scene.background = new THREE.Color(getBackgroundCssColor(this.host as any));
    this.backgroundSwapped = true;
    this.host.requestRender();

    const stream = (this.host.renderer.domElement as HTMLCanvasElement).captureStream(60);
    this.recordedChunks = [];
    this.recordedMime = mime;
    this.recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12_000_000 });
    this.recorder.ondataavailable = e => {
      if (e.data.size > 0) {
        this.recordedChunks.push(e.data);
      }
    };
    this.recorder.start(250);
    filmState.recording = true;
    this.host.showStatus(`Recording camera path (${mime.split(';')[0]})…`);
    this.play();
  }

  private finishRecording(): void {
    const recorder = this.recorder;
    if (!recorder) {
      return;
    }
    this.recorder = null;
    filmState.recording = false;

    if (this.backgroundSwapped) {
      this.host.scene.background = this.savedBackground;
      this.savedBackground = null;
      this.backgroundSwapped = false;
      this.host.requestRender();
    }

    recorder.onstop = () => {
      const blob = new Blob(this.recordedChunks, { type: this.recordedMime });
      this.recordedChunks = [];
      recorder.stream.getTracks().forEach(track => track.stop());
      this.saveVideoBlob(blob);
    };
    recorder.stop();
  }

  private saveVideoBlob(blob: Blob): void {
    const ext = this.recordedMime.includes('mp4') ? 'mp4' : 'webm';
    const stamp = new Date().toISOString().replace(/[:T]/g, '-').replace(/\..+/, '');
    const fileName = `camera-path-${stamp}.${ext}`;

    if (isVSCode) {
      // Webviews can't trigger downloads; ship the bytes to the extension host.
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        this.host.vscode.postMessage({
          type: 'saveVideo',
          dataBase64: dataUrl.slice(dataUrl.indexOf(',') + 1),
          defaultFileName: fileName,
          extension: ext,
        });
      };
      reader.readAsDataURL(blob);
      return;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    this.host.showStatus(`Video saved: ${fileName}`);
  }

  // ------------------------------------------------------------- persistence

  buildProjectJson(): string {
    return JSON.stringify({ version: 1, type: 'camera-path', keyframes: this.keyframes }, null, 2);
  }

  saveProject(): void {
    if (this.keyframes.length === 0) {
      this.host.showStatus('No keyframes to save');
      return;
    }
    const stamp = new Date().toISOString().replace(/[:T]/g, '-').replace(/\..+/, '');
    const fileName = `camera-path-${stamp}.json`;
    const json = this.buildProjectJson();

    if (isVSCode) {
      this.host.vscode.postMessage({
        type: 'saveCameraPath',
        content: json,
        defaultFileName: fileName,
      });
      return;
    }

    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    this.host.showStatus(`Camera path saved: ${fileName}`);
  }

  loadProject(jsonText: string): boolean {
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      this.host.showStatus('Camera path file is not valid JSON');
      return false;
    }
    const keyframes = parseKeyframeProject(parsed);
    if (!keyframes) {
      this.host.showStatus('Camera path file has no valid keyframes');
      return false;
    }
    this.stop();
    this.keyframes = keyframes;
    this.keyframeCounter = keyframes.length;
    this.syncState();
    this.host.showStatus(`Loaded camera path with ${keyframes.length} keyframes`);
    return true;
  }

  // ----------------------------------------------------------------- preview

  setFrustumsVisible(visible: boolean): void {
    filmState.frustumsVisible = visible;
    this.rebuildFrustums();
    this.host.requestRender();
  }

  /**
   * Small CameraHelper per keyframe while editing. The helper cameras use a
   * short far plane (a fraction of the keyframe's distance to its target) so
   * the frustums read as markers instead of filling the scene.
   */
  private rebuildFrustums(): void {
    if (this.frustumGroup) {
      this.host.scene.remove(this.frustumGroup);
      this.frustumGroup.traverse(obj => {
        const helper = obj as THREE.CameraHelper;
        if (helper.geometry) {
          helper.geometry.dispose();
        }
        if ((helper as any).material?.dispose) {
          (helper as any).material.dispose();
        }
      });
      this.frustumGroup = null;
    }
    if (!filmState.frustumsVisible || this.keyframes.length === 0) {
      return;
    }

    this.frustumGroup = new THREE.Group();
    for (const key of this.keyframes) {
      const position = new THREE.Vector3().fromArray(key.position);
      const target = new THREE.Vector3().fromArray(key.target);
      const dist = Math.max(1e-3, position.distanceTo(target));
      const aspect = this.host.camera.aspect || 1;
      const cam = new THREE.PerspectiveCamera(key.fov, aspect, dist * 0.02, dist * 0.25);
      cam.position.copy(position);
      cam.quaternion.fromArray(key.quaternion);
      cam.updateMatrixWorld(true);
      this.frustumGroup.add(new THREE.CameraHelper(cam));
    }
    this.host.scene.add(this.frustumGroup);
  }

  toggleLoop(): void {
    filmState.loop = !filmState.loop;
    // The loop's closing segment changes the total duration.
    this.syncState();
  }

  /** Mirror manager state into the Svelte store the panel renders from. */
  private syncState(): void {
    filmState.keyframes = this.keyframes.map(k => ({
      name: k.name,
      duration: k.duration,
      dwell: k.dwell,
      fov: k.fov,
    }));
    filmState.totalDuration =
      this.keyframes.length > 1 ? timelineDuration(this.keyframes, filmState.loop) : 0;
    if (filmState.frustumsVisible) {
      this.rebuildFrustums();
    }
    this.host.requestRender();
  }

  dispose(): void {
    this.stop();
    filmState.frustumsVisible = false;
    this.rebuildFrustums();
  }
}
