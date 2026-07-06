import * as THREE from 'three';

export interface TransparencyHost {
  allowTransparency: boolean;
  meshes: (THREE.Mesh | THREE.Points | THREE.LineSegments | null)[];
  vertexPointsObjects: (THREE.Points | null)[];
  multiMaterialGroups: (THREE.Group | null)[];
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
      // Only toggle blending; keep alphaTest (the round-disc cutout, set in
      // optimizeForPointCount) so points stay round across transparency toggles.
      material.transparent = host.allowTransparency;
      material.needsUpdate = true;
    }
  });

  // Update vertex points objects
  host.vertexPointsObjects.forEach(vertexPoints => {
    if (vertexPoints && vertexPoints.material instanceof THREE.PointsMaterial) {
      const material = vertexPoints.material as THREE.PointsMaterial;
      // Only toggle blending; keep alphaTest (the round-disc cutout, set in
      // optimizeForPointCount) so points stay round across transparency toggles.
      material.transparent = host.allowTransparency;
      material.needsUpdate = true;
    }
  });

  // Update multi-material groups
  host.multiMaterialGroups.forEach(group => {
    if (group) {
      group.traverse(child => {
        if (child instanceof THREE.Points && child.material instanceof THREE.PointsMaterial) {
          const material = child.material as THREE.PointsMaterial;
          // Keep alphaTest (round-disc cutout); only toggle blending.
          material.transparent = host.allowTransparency;
          material.needsUpdate = true;
        }
      });
    }
  });

  console.log(
    `Updated transparency for ${host.meshes.length} main meshes, ${host.vertexPointsObjects.length} vertex point objects, and ${host.multiMaterialGroups.length} multi-material groups`
  );
}
