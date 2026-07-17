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

/**
 * Manages distance measurements between points in 3D space
 */
export class MeasurementManager {
  private measurements: Measurement[] = [];
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private labelsContainer: HTMLDivElement | null = null;

  // Measurement path (A → B → C → ...): ordered picked world-space points
  // rendered as a polyline with per-segment labels. Independent of the
  // rotation-center single measurements above.
  private pathPoints: THREE.Vector3[] = [];
  private pathLine: THREE.Line | null = null;
  private pathMarkers: THREE.Points | null = null;
  private pathLabels: HTMLDivElement[] = [];

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
    this.pathPoints.push(point.clone());
    this.rebuildPathVisuals();
  }

  /**
   * Remove the most recently picked path point.
   */
  undoLastPathPoint(): void {
    if (this.pathPoints.length === 0) {
      return;
    }
    this.pathPoints.pop();
    this.rebuildPathVisuals();
  }

  /**
   * Remove the whole measurement path.
   */
  clearPath(): void {
    if (this.pathPoints.length === 0) {
      return;
    }
    this.pathPoints = [];
    this.rebuildPathVisuals();
  }

  getPathPoints(): THREE.Vector3[] {
    return this.pathPoints;
  }

  /**
   * Rebuild polyline, point markers, segment labels and the UI state store
   * from the current path points. The path is small (hand-picked points), so
   * a full rebuild per edit is simpler than incremental updates.
   */
  private rebuildPathVisuals(): void {
    if (this.pathLine) {
      this.scene.remove(this.pathLine);
      this.pathLine.geometry.dispose();
      (this.pathLine.material as THREE.Material).dispose();
      this.pathLine = null;
    }
    if (this.pathMarkers) {
      this.scene.remove(this.pathMarkers);
      this.pathMarkers.geometry.dispose();
      (this.pathMarkers.material as THREE.Material).dispose();
      this.pathMarkers = null;
    }
    for (const label of this.pathLabels) {
      label.parentNode?.removeChild(label);
    }
    this.pathLabels = [];

    if (this.pathPoints.length > 0) {
      // Constant screen-size markers so picks stay visible at any zoom.
      const markerGeometry = new THREE.BufferGeometry().setFromPoints(this.pathPoints);
      const markerMaterial = new THREE.PointsMaterial({
        color: 0xffb300,
        size: 9,
        sizeAttenuation: false,
        depthTest: false,
      });
      this.pathMarkers = new THREE.Points(markerGeometry, markerMaterial);
      this.pathMarkers.renderOrder = 999;
      this.scene.add(this.pathMarkers);
    }

    const segmentLengths: number[] = [];
    if (this.pathPoints.length > 1) {
      const lineGeometry = new THREE.BufferGeometry().setFromPoints(this.pathPoints);
      const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffb300, linewidth: 2 });
      this.pathLine = new THREE.Line(lineGeometry, lineMaterial);
      this.scene.add(this.pathLine);

      for (let i = 1; i < this.pathPoints.length; i++) {
        const distance = this.pathPoints[i - 1].distanceTo(this.pathPoints[i]);
        segmentLengths.push(distance);
        this.pathLabels.push(this.createPathLabel(distance));
      }
    }

    measurementState.pathPointCount = this.pathPoints.length;
    measurementState.segmentLengths = segmentLengths;
    measurementState.totalLength = segmentLengths.reduce((a, b) => a + b, 0);

    this.updateLabelPositions();
  }

  private createPathLabel(distance: number): HTMLDivElement {
    const label = document.createElement('div');
    label.className = 'measurement-label measurement-path-label';
    label.style.position = 'absolute';
    label.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    label.style.color = '#ffb300';
    label.style.padding = '4px 8px';
    label.style.borderRadius = '4px';
    label.style.fontSize = '12px';
    label.style.fontFamily = 'monospace';
    label.style.whiteSpace = 'nowrap';
    label.style.border = '1px solid #ffb300';
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

    for (let i = 0; i < this.pathLabels.length; i++) {
      const midpoint = new THREE.Vector3()
        .addVectors(this.pathPoints[i], this.pathPoints[i + 1])
        .multiplyScalar(0.5);
      const screenPosition = this.projectToScreen(midpoint);
      const label = this.pathLabels[i];
      if (screenPosition) {
        label.style.left = `${screenPosition.x}px`;
        label.style.top = `${screenPosition.y}px`;
        label.style.display = 'block';
      } else {
        label.style.display = 'none';
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
    this.clearPath();
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
