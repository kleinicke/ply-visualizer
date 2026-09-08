import { agentBuild } from './agentBuild';
import { updateAgentLegend } from './agentLegend';
import { captureAgentCanvas } from './agentCapture';
import { compactAgentReply } from './agentReplies';
import { setAgentCamera } from './agentTransforms';
/* eslint-disable @typescript-eslint/naming-convention -- Python MCP wire-format keys */
import * as THREE from 'three';
import { alignmentStatus, agentAlignmentBusy } from './agentAlignment';
import { applyAgentControl, fitAgentView, type ControlHost } from './agentControls';
import { agentAttributes, rememberAgentCamera } from './agentInspection';
import { agentViewState, objectPresentation } from './agentViewState';
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

const rendererId = Array.from(crypto.getRandomValues(new Uint8Array(16)), n =>
  n.toString(16).padStart(2, '0')
).join('');

export async function handleAgentCommand(host: AgentViewerHost): Promise<boolean> {
  const response = await fetch(`agent/command?renderer_id=${rendererId}`);
  if (!response.ok) {
    return false;
  }
  const command = await response.json();
  if (!command) {
    return false;
  }
  let reply: { id: string; result?: unknown; error?: string } = { id: command.id };
  try {
    if (document.documentElement.dataset.localSession !== 'loaded') {
      throw new Error('The scene has not loaded successfully yet.');
    }
    if (command.operation === 'camera' && agentAlignmentBusy(host as unknown as ControlHost)) {
      throw new Error('Alignment is running; wait before changing the camera');
    }
    if (command.operation === 'camera') {
      rememberAgentCamera(host as unknown as ControlHost);
      const args = command.arguments;
      setAgentCamera(host as unknown as ControlHost, args);
      if (args.fit) {
        fitAgentView(host);
      }
    }
    const controlResult = !['camera', 'inspect', 'capture'].includes(command.operation)
      ? await applyAgentControl(
          host as unknown as ControlHost,
          command.operation,
          command.arguments
        )
      : undefined;
    await updateAgentLegend(host as unknown as ControlHost);
    host.performRender();
    const bounds = new THREE.Box3();
    for (const mesh of host.meshes) {
      if (mesh) {
        bounds.expandByObject(mesh);
      }
    }
    const attributes = await agentAttributes(host.spatialFiles);
    reply.result = {
      alignment: alignmentStatus(host as unknown as ControlHost),
      renderer_build: agentBuild,
      renderer_id: rendererId,
      rendered_revision: Number(document.documentElement.dataset.sessionRevision),
      objects: host.spatialFiles.map(file => ({
        ...objectPresentation(host as unknown as ControlHost, host.spatialFiles.indexOf(file)),
        object_index: host.spatialFiles.indexOf(file),
        name: file.fileName,
        source_points: file.sourcePointCount ?? null,
        filtered_points:
          file.sourcePointCount === undefined ? null : file.sourcePointCount - file.vertexCount,
        scalar_fields: Object.keys(file.scalarFields ?? {}),
        attributes: attributes[host.spatialFiles.indexOf(file)],
        vertices: file.vertexCount,
        faces: file.faceCount,
        has_colors: file.hasColors,
        has_normals: file.hasNormals,
        visible: (host as unknown as ControlHost).fileVisibility[host.spatialFiles.indexOf(file)],
        point_size: (host as unknown as ControlHost).pointSizes[host.spatialFiles.indexOf(file)],
        color_mode: (host as unknown as ControlHost).individualColorModes[
          host.spatialFiles.indexOf(file)
        ],
        points: (host as unknown as ControlHost).pointsVisible[host.spatialFiles.indexOf(file)],
        mesh: (host as unknown as ControlHost).solidVisible[host.spatialFiles.indexOf(file)],
      })),
      bounds: bounds.isEmpty() ? null : { min: bounds.min.toArray(), max: bounds.max.toArray() },
      ...agentViewState(host as unknown as ControlHost),
    };
    if (controlResult !== undefined) {
      reply.result = {
        ...(reply.result as object),
        ...(controlResult as object),
        camera: {
          ...agentViewState(host as unknown as ControlHost).camera,
          ...(controlResult as { camera?: object }).camera,
        },
      };
    }
    if (command.arguments.detail !== 'full' && command.operation !== 'capture') {
      reply.result = compactAgentReply(
        command.operation,
        reply.result as Record<string, any>,
        command.arguments
      );
    }
    if (
      command.operation === 'capture' ||
      (command.operation === 'selection' && command.arguments.preview)
    ) {
      const canvas = captureAgentCanvas(host as unknown as ControlHost);
      reply.result = {
        ...(command.operation === 'selection' ? (reply.result as object) : {}),
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
    body: JSON.stringify({ ...reply, renderer_id: rendererId }),
  });
  return true;
}
