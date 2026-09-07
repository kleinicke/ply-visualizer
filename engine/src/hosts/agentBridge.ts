/* eslint-disable @typescript-eslint/naming-convention -- Python MCP wire-format keys */
import * as THREE from 'three';
import type { SpatialData } from '../interfaces';

export interface AgentViewerHost {
  camera: THREE.PerspectiveCamera;
  controls: { target: THREE.Vector3; update(): void };
  renderer: { domElement: HTMLCanvasElement };
  spatialFiles: SpatialData[];
  meshes: (THREE.Object3D | null)[];
  fitCameraToAllObjects(): void;
  performRender(): void;
}

export async function handleAgentCommand(host: AgentViewerHost): Promise<void> {
  const response = await fetch('agent/command');
  if (!response.ok) {
    return;
  }
  const command = await response.json();
  if (!command) {
    return;
  }
  let reply: { id: string; result?: unknown; error?: string } = { id: command.id };
  try {
    if (document.documentElement.dataset.localSession !== 'loaded') {
      throw new Error('The scene has not loaded successfully yet.');
    }
    if (command.operation === 'camera') {
      const args = command.arguments;
      if (args.fit) {
        host.fitCameraToAllObjects();
      } else {
        host.camera.position.fromArray(args.position);
        host.controls.target.fromArray(args.target);
        if (args.up) {
          host.camera.up.fromArray(args.up);
        }
        host.controls.update();
      }
    }
    host.performRender();
    const bounds = new THREE.Box3();
    for (const mesh of host.meshes) {
      if (mesh) {
        bounds.expandByObject(mesh);
      }
    }
    reply.result = {
      rendered_revision: Number(document.documentElement.dataset.sessionRevision),
      objects: host.spatialFiles.map(file => ({
        name: file.fileName,
        vertices: file.vertexCount,
        faces: file.faceCount,
        has_colors: file.hasColors,
        has_normals: file.hasNormals,
      })),
      bounds: bounds.isEmpty() ? null : { min: bounds.min.toArray(), max: bounds.max.toArray() },
      camera: {
        position: host.camera.position.toArray(),
        target: host.controls.target.toArray(),
        up: host.camera.up.toArray(),
      },
    };
    if (command.operation === 'capture') {
      const source = host.renderer.domElement;
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 1024 / Math.max(source.width, source.height));
      canvas.width = Math.max(1, Math.round(source.width * scale));
      canvas.height = Math.max(1, Math.round(source.height * scale));
      canvas.getContext('2d')!.drawImage(source, 0, 0, canvas.width, canvas.height);
      reply.result = {
        png: canvas.toDataURL('image/png').split(',')[1],
        width: canvas.width,
        height: canvas.height,
      };
    }
  } catch (error) {
    reply = { id: command.id, error: error instanceof Error ? error.message : String(error) };
  }
  await fetch('agent/result', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reply),
  });
}
