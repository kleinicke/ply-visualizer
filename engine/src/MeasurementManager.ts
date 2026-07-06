import * as THREE from 'three';

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
    label.textContent = this.formatDistance(distance);

    if (this.labelsContainer) {
      this.labelsContainer.appendChild(label);
    }

    return label;
  }

  /**
   * Format distance with appropriate units
   */
  private formatDistance(distance: number): string {
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
   * Update all measurement label positions based on current camera view
   * Should be called every frame or when camera moves
   */
  updateLabelPositions(): void {
    for (const measurement of this.measurements) {
      this.updateLabelPosition(measurement);
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
