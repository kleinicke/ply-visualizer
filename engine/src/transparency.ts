import type { FileEntryRegistry } from './state/fileEntries';
import * as THREE from 'three';

export interface TransparencyHost {
  fileEntries: FileEntryRegistry;
  allowTransparency: boolean;
  meshes: readonly (THREE.Mesh | THREE.Points | THREE.LineSegments | null)[];

  showStatus(message: string): void;
  requestRender(): void;
}

export function toggleTransparency(host: TransparencyHost): void {
  host.allowTransparency = !host.allowTransparency;
  console.log(`Transparency ${host.allowTransparency ? 'enabled' : 'disabled'}`);

  // Update UI button state
  const button = document.getElementById('toggle-transparency');
  if (button) {
    button.classList.toggle('active', host.allowTransparency);
  }

  // Update all existing materials with new transparency settings
  updateAllMaterialsForTransparency(host);

  // Show status message
  host.showStatus(
    `Transparency ${host.allowTransparency ? 'enabled' : 'disabled'}: ${host.allowTransparency ? 'Alpha blending available (may impact performance)' : 'Optimized opaque rendering'}`
  );

  host.requestRender();
}

export function updateAllMaterialsForTransparency(host: TransparencyHost): void {
  // Update all mesh materials with transparency settings
  host.meshes.forEach(mesh => {
    if (mesh instanceof THREE.Points && mesh.material instanceof THREE.PointsMaterial) {
      const material = mesh.material as THREE.PointsMaterial;
      // The adaptive renderer mirrors blending to its round pass before render.
      material.transparent = host.allowTransparency;
      material.needsUpdate = true;
    }
  });

  // Update vertex points objects
  host.fileEntries.all.forEach(entry => {
    const vertexPoints = entry.resources.vertexPoints;
    if (vertexPoints && vertexPoints.material instanceof THREE.PointsMaterial) {
      const material = vertexPoints.material as THREE.PointsMaterial;
      // Only toggle blending; preserve the material's existing point shape.
      material.transparent = host.allowTransparency;
      material.needsUpdate = true;
    }
  });

  // Update multi-material groups
  host.fileEntries.all.forEach(entry => {
    const group = entry.resources.materialGroup;
    if (group) {
      group.traverse(child => {
        if (child instanceof THREE.Points && child.material instanceof THREE.PointsMaterial) {
          const material = child.material as THREE.PointsMaterial;
          // Keep the material's existing point shape; only toggle blending.
          material.transparent = host.allowTransparency;
          material.needsUpdate = true;
        }
      });
    }
  });

  console.log(
    `Updated transparency for ${host.meshes.length} main meshes, ${host.fileEntries.length} vertex point objects, and ${host.fileEntries.length} multi-material groups`
  );
}
