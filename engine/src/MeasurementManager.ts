import * as THREE from 'three';
import { measurementState } from './state/measurement.svelte';

/**
 * Format a distance with appropriate units. Shared by the 3D labels and the
 * Measurements panel.
 */
export function formatDistance(distance: number): string {
  if (distance < 0.01) {
    return `${(distance * 1000).toFixed(2)} mm`;
  } else if (distance < 1.0) {
    return `${(distance * 100).toFixed(2)} cm`;
  } else if (distance < 1000) {
    return `${distance.toFixed(3)} m`;
  } else {
    return `${(distance / 1000).toFixed(3)} km`;
  }
}

/**
 * Represents a distance measurement between two points
 */
export interface Measurement {
  startPoint: THREE.Vector3;
  endPoint: THREE.Vector3;
  line: THREE.Line;
  label: HTMLDivElement;
  distance: number;
}

interface MeasurementPath {
  points: THREE.Vector3[];
  line: THREE.Line | null;
  closingLine: THREE.Line | null;
  markers: THREE.Points | null;
  labels: HTMLDivElement[];
  closed: boolean;
}

export type PathStartMode = 'center' | 'free';

/**
 * Manages distance measurements between points in 3D space
 */
export class MeasurementManager {
  private measurements: Measurement[] = [];
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private labelsContainer: HTMLDivElement | null = null;

  // Completed paths keep their visuals while the newest path remains editable.
  private paths: MeasurementPath[] = [];
  private activePathIndex = -1;
  // This is an editing preference, not a one-shot operation. A newly added
  // point keeps the active path closed by moving its last-to-first segment.
  private closeLoopEnabled = false;
  // One-shot choice for the next Shift + double-click. It does not create or
  // modify a path until the gesture actually hits geometry.
  private pendingStartMode: PathStartMode | null = 'center';
  private lastUsedStartMode: PathStartMode = 'center';

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.initializeLabelsContainer();
  }

  /**
   * Initialize the HTML container for measurement labels
   */
  private initializeLabelsContainer(): void {
    this.labelsContainer = document.createElement('div');
    this.labelsContainer.id = 'measurement-labels';
    this.labelsContainer.style.position = 'absolute';
    this.labelsContainer.style.top = '0';
    this.labelsContainer.style.left = '0';
    this.labelsContainer.style.pointerEvents = 'none';
    this.labelsContainer.style.width = '100%';
    this.labelsContainer.style.height = '100%';
    this.labelsContainer.style.zIndex = '1000';
    document.body.appendChild(this.labelsContainer);
  }

  /**
   * Add a new measurement between two points
   *
   * @param startPoint - The first point (typically the rotation center)
   * @param endPoint - The second point (typically the clicked point)
   * @returns The created measurement
   */
  addMeasurement(startPoint: THREE.Vector3, endPoint: THREE.Vector3): Measurement {
    // Calculate distance
    const distance = startPoint.distanceTo(endPoint);

    // Create line geometry
    const geometry = new THREE.BufferGeometry().setFromPoints([startPoint, endPoint]);
    const material = new THREE.LineBasicMaterial({
      color: 0xff0000, // Red color
      linewidth: 2,
      depthTest: true,
      depthWrite: true,
    });
    const line = new THREE.Line(geometry, material);
    this.scene.add(line);

    // Create label
    const label = this.createLabel(distance);

    // Store measurement
    const measurement: Measurement = {
      startPoint: startPoint.clone(),
      endPoint: endPoint.clone(),
      line,
      label,
      distance,
    };

    this.measurements.push(measurement);

    return measurement;
  }

  /**
   * Create an HTML label for displaying the measurement distance
   */
  private createLabel(distance: number): HTMLDivElement {
    const label = document.createElement('div');
    label.className = 'measurement-label';
    label.style.position = 'absolute';
    label.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    label.style.color = '#ff0000';
    label.style.padding = '4px 8px';
    label.style.borderRadius = '4px';
    label.style.fontSize = '12px';
    label.style.fontFamily = 'monospace';
    label.style.whiteSpace = 'nowrap';
    label.style.border = '1px solid #ff0000';
    label.style.pointerEvents = 'none';
    label.textContent = formatDistance(distance);

    if (this.labelsContainer) {
      this.labelsContainer.appendChild(label);
    }

    return label;
  }

  /**
   * Append a picked point to the measurement path and rebuild its visuals.
   */
  addPathPoint(point: THREE.Vector3): void {
    const path = this.ensureActivePath();
    path.closed = this.closeLoopEnabled;
    path.points.push(point.clone());
    this.rebuildPathVisuals(path);
  }

  /**
   * Remove the most recently picked path point.
   */
  undoLastPathPoint(): void {
    const path = this.getActivePath();
    if (!path || path.points.length === 0) {
      return;
    }
    path.points.pop();
    this.rebuildPathVisuals(path);
  }

  /**
   * Remove the whole measurement path.
   */
  clearPath(): void {
    const path = this.getActivePath();
    if (!path || path.points.length === 0) {
      return;
    }
    path.points = [];
    path.closed = this.closeLoopEnabled;
    this.rebuildPathVisuals(path);
  }

  togglePathClosed(): void {
    this.closeLoopEnabled = !this.closeLoopEnabled;
    const path = this.ensureActivePath();
    path.closed = this.closeLoopEnabled;
    this.rebuildPathVisuals(path);
  }

  togglePathStartMode(mode: PathStartMode): void {
    this.pendingStartMode = this.pendingStartMode === mode ? null : mode;
    this.syncPathState();
  }

  /** Consume the armed one-shot mode immediately before adding a picked point. */
  prepareForPathPoint(rotationCenter: THREE.Vector3): void {
    const mode = this.pendingStartMode;
    if (!mode) {
      return;
    }

    let path = this.getActivePath();
    if (!path || path.points.length > 0) {
      path = this.createPath();
      this.paths.push(path);
      this.activePathIndex = this.paths.length - 1;
    }
    this.pendingStartMode = null;
    this.lastUsedStartMode = mode;
    if (mode === 'center') {
      path.points.push(rotationCenter.clone());
      this.rebuildPathVisuals(path);
    } else {
      this.syncPathState();
    }
  }

  getPathPoints(): THREE.Vector3[] {
    return this.getActivePath()?.points ?? [];
  }

  getPathCount(): number {
    return this.paths.filter(path => path.points.length > 0).length;
  }

  clearAllPaths(): void {
    for (const path of this.paths) {
      this.disposePathVisuals(path);
    }
    this.paths = [];
    this.activePathIndex = -1;
    this.pendingStartMode = this.lastUsedStartMode === 'center' ? 'center' : null;
    this.syncPathState();
  }

  /**
   * Rebuild polyline, point markers, segment labels and the UI state store
   * from the current path points. The path is small (hand-picked points), so
   * a full rebuild per edit is simpler than incremental updates.
   */
  private createPath(): MeasurementPath {
    return {
      points: [],
      line: null,
      closingLine: null,
      markers: null,
      labels: [],
      closed: this.closeLoopEnabled,
    };
  }

  private getActivePath(): MeasurementPath | null {
    return this.paths[this.activePathIndex] ?? null;
  }

  private ensureActivePath(): MeasurementPath {
    let path = this.getActivePath();
    if (!path) {
      path = this.createPath();
      this.paths.push(path);
      this.activePathIndex = 0;
    }
    return path;
  }

  private disposePathVisuals(path: MeasurementPath): void {
    if (path.line) {
      this.scene.remove(path.line);
      path.line.geometry.dispose();
      (path.line.material as THREE.Material).dispose();
      path.line = null;
    }
    if (path.closingLine) {
      this.scene.remove(path.closingLine);
      path.closingLine.geometry.dispose();
      (path.closingLine.material as THREE.Material).dispose();
      path.closingLine = null;
    }
    if (path.markers) {
      this.scene.remove(path.markers);
      path.markers.geometry.dispose();
      (path.markers.material as THREE.Material).dispose();
      path.markers = null;
    }
    for (const label of path.labels) {
      label.parentNode?.removeChild(label);
    }
    path.labels = [];
  }

  private rebuildPathVisuals(path: MeasurementPath): void {
    this.disposePathVisuals(path);

    if (path.points.length > 0) {
      // Constant screen-size markers so picks stay visible at any zoom.
      const markerGeometry = new THREE.BufferGeometry().setFromPoints(path.points);
      const markerMaterial = new THREE.PointsMaterial({
        color: 0xffb300,
        size: 9,
        sizeAttenuation: false,
        depthTest: false,
      });
      path.markers = new THREE.Points(markerGeometry, markerMaterial);
      path.markers.renderOrder = 999;
      this.scene.add(path.markers);
    }

    const segmentLengths: number[] = [];
    if (path.points.length > 1) {
      const lineGeometry = new THREE.BufferGeometry().setFromPoints(path.points);
      const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffb300, linewidth: 2 });
      path.line = new THREE.Line(lineGeometry, lineMaterial);
      this.scene.add(path.line);

      for (let i = 1; i < path.points.length; i++) {
        const distance = path.points[i - 1].distanceTo(path.points[i]);
        segmentLengths.push(distance);
        path.labels.push(this.createPathLabel(distance));
      }
      if (path.closed && path.points.length > 2) {
        const distance = path.points[path.points.length - 1].distanceTo(path.points[0]);
        segmentLengths.push(distance);
        path.labels.push(this.createPathLabel(distance, true));
        const closingGeometry = new THREE.BufferGeometry().setFromPoints([
          path.points[path.points.length - 1],
          path.points[0],
        ]);
        const closingMaterial = new THREE.LineBasicMaterial({ color: 0xffd166, linewidth: 2 });
        path.closingLine = new THREE.Line(closingGeometry, closingMaterial);
        this.scene.add(path.closingLine);
      }
    }

    this.syncPathState(segmentLengths);

    this.updateLabelPositions();
  }

  private syncPathState(segmentLengths?: number[]): void {
    const path = this.getActivePath();
    const lengths = segmentLengths ?? this.getSegmentLengths(path);
    measurementState.pathPointCount = path?.points.length ?? 0;
    measurementState.pathClosed = this.closeLoopEnabled;
    measurementState.pathStartMode = this.pendingStartMode;
    measurementState.pathCount = this.getPathCount();
    measurementState.segmentLengths = lengths;
    measurementState.totalLength = lengths.reduce((a, b) => a + b, 0);
  }

  private getSegmentLengths(path: MeasurementPath | null): number[] {
    if (!path) {
      return [];
    }
    const lengths: number[] = [];
    for (let i = 1; i < path.points.length; i++) {
      lengths.push(path.points[i - 1].distanceTo(path.points[i]));
    }
    if (path.closed && path.points.length > 2) {
      lengths.push(path.points[path.points.length - 1].distanceTo(path.points[0]));
    }
    return lengths;
  }

  private createPathLabel(distance: number, closing = false): HTMLDivElement {
    const label = document.createElement('div');
    label.className = `measurement-label measurement-path-label${closing ? ' measurement-loop-label' : ''}`;
    label.style.position = 'absolute';
    label.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    label.style.color = closing ? '#ffd166' : '#ffb300';
    label.style.padding = '4px 8px';
    label.style.borderRadius = '4px';
    label.style.fontSize = '12px';
    label.style.fontFamily = 'monospace';
    label.style.whiteSpace = 'nowrap';
    label.style.border = `1px solid ${closing ? '#ffd166' : '#ffb300'}`;
    label.style.pointerEvents = 'none';
    label.textContent = formatDistance(distance);
    this.labelsContainer?.appendChild(label);
    return label;
  }

  /**
   * Update all measurement label positions based on current camera view
   * Should be called every frame or when camera moves
   */
  updateLabelPositions(): void {
    for (const measurement of this.measurements) {
      this.updateLabelPosition(measurement);
    }

    for (const path of this.paths) {
      for (let i = 0; i < path.labels.length; i++) {
        const nextIndex = (i + 1) % path.points.length;
        const midpoint = new THREE.Vector3()
          .addVectors(path.points[i], path.points[nextIndex])
          .multiplyScalar(0.5);
        const screenPosition = this.projectToScreen(midpoint);
        const label = path.labels[i];
        if (screenPosition) {
          label.style.left = `${screenPosition.x}px`;
          label.style.top = `${screenPosition.y}px`;
          label.style.display = 'block';
        } else {
          label.style.display = 'none';
        }
      }
    }
  }

  /**
   * Update a single measurement label position
   */
  private updateLabelPosition(measurement: Measurement): void {
    // Calculate midpoint between start and end
    const midpoint = new THREE.Vector3()
      .addVectors(measurement.startPoint, measurement.endPoint)
      .multiplyScalar(0.5);

    // Project to screen coordinates
    const screenPosition = this.projectToScreen(midpoint);

    // Update label position
    if (screenPosition) {
      measurement.label.style.left = `${screenPosition.x}px`;
      measurement.label.style.top = `${screenPosition.y}px`;
      measurement.label.style.display = 'block';
    } else {
      measurement.label.style.display = 'none';
    }
  }

  /**
   * Project a 3D point to screen coordinates
   */
  private projectToScreen(point: THREE.Vector3): { x: number; y: number } | null {
    const vector = point.clone().project(this.camera);

    // Check if point is in front of camera
    if (vector.z > 1) {
      return null;
    }

    const canvas = this.renderer.domElement;
    const rect = canvas.getBoundingClientRect();

    const x = (vector.x * 0.5 + 0.5) * rect.width + rect.left;
    const y = (-(vector.y * 0.5) + 0.5) * rect.height + rect.top;

    return { x, y };
  }

  /**
   * Clear all measurements
   */
  clearAll(): void {
    for (const measurement of this.measurements) {
      // Remove line from scene
      this.scene.remove(measurement.line);
      measurement.line.geometry.dispose();
      if (measurement.line.material instanceof THREE.Material) {
        measurement.line.material.dispose();
      }

      // Remove label from DOM
      if (measurement.label.parentNode) {
        measurement.label.parentNode.removeChild(measurement.label);
      }
    }

    this.measurements = [];
    this.clearAllPaths();
  }

  /**
   * Remove the most recent measurement
   */
  removeLastMeasurement(): void {
    const measurement = this.measurements.pop();
    if (measurement) {
      // Remove line from scene
      this.scene.remove(measurement.line);
      measurement.line.geometry.dispose();
      if (measurement.line.material instanceof THREE.Material) {
        measurement.line.material.dispose();
      }

      // Remove label from DOM
      if (measurement.label.parentNode) {
        measurement.label.parentNode.removeChild(measurement.label);
      }
    }
  }

  /**
   * Get all current measurements
   */
  getMeasurements(): Measurement[] {
    return this.measurements;
  }

  /**
   * Clean up all resources
   */
  dispose(): void {
    this.clearAll();

    if (this.labelsContainer && this.labelsContainer.parentNode) {
      this.labelsContainer.parentNode.removeChild(this.labelsContainer);
    }
    this.labelsContainer = null;
  }
}
