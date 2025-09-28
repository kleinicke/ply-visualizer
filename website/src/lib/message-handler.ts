// Message handler for VS Code communication
import * as THREE from 'three';

let vscodeApi: any = null;
let isInitialized = false;

export function setupMessageHandler(vscode?: any): void {
  if (isInitialized) {
    console.log('Message handler already initialized');
    return;
  }

  console.log('Setting up message handler...');

  // Use provided vscode API or try to acquire it
  if (vscode) {
    vscodeApi = vscode;
  } else if (typeof window !== 'undefined' && (window as any).acquireVsCodeApi) {
    try {
      vscodeApi = (window as any).acquireVsCodeApi();
    } catch (error) {
      console.warn('VS Code API already acquired, using existing instance');
      // API might already be acquired, continue without it for now
    }
  }

  // Set up message listener
  if (typeof window !== 'undefined') {
    window.addEventListener('message', handleMessage);
    isInitialized = true;
    console.log('✅ Message handler initialized');
  }
}

function handleMessage(event: MessageEvent): void {
  const message = event.data;
  console.log('📨 Received message:', message.type, message);

  switch (message.type) {
    case 'startLoading':
      handleStartLoading(message);
      break;
    case 'fileData':
      handleFileData(message);
      break;
    case 'largeFileStart':
      handleLargeFileStart(message);
      break;
    case 'largeFileChunk':
      handleLargeFileChunk(message);
      break;
    case 'timing':
      handleTiming(message);
      break;
    case 'defaultDepthSettings':
      handleDefaultDepthSettings(message);
      break;
    default:
      console.log('Unhandled message type:', message.type);
  }
}

function handleStartLoading(message: any): void {
  console.log('🚀 Starting to load file:', message.fileName);
  // TODO: Show loading indicator in UI
  // For now, just acknowledge the message
  if (vscodeApi) {
    vscodeApi.postMessage({
      type: 'loadingStarted',
      fileName: message.fileName,
    });
  }
}

function handleFileData(message: any): void {
  console.log('📄 Received file data for:', message.fileName);

  // Log the data structure
  console.log('File data structure:', {
    fileName: message.fileName,
    hasVertices: !!message.vertices,
    vertexCount: message.vertices?.length || 0,
    hasFaces: !!message.faces,
    faceCount: message.faces?.length || 0,
    hasColors: !!message.colors,
    hasNormals: !!message.normals,
  });

  // Create and add the 3D object to the scene
  try {
    const threeObject = createThreeObjectFromData(message);
    if (threeObject) {
      addObjectToScene(threeObject, message.fileName);
      console.log('✅ Successfully added object to scene:', message.fileName);
    }
  } catch (error) {
    console.error('❌ Failed to create 3D object:', error);
  }
}

function createThreeObjectFromData(data: any): any {
  if (!data.vertices || data.vertices.length === 0) {
    console.warn('No vertices found in file data');
    return null;
  }

  const geometry = new THREE.BufferGeometry();

  // Convert vertices to Float32Array
  const positions = new Float32Array(data.vertices.length * 3);
  const colors = data.hasColors ? new Float32Array(data.vertices.length * 3) : null;
  const normals = data.hasNormals ? new Float32Array(data.vertices.length * 3) : null;

  for (let i = 0; i < data.vertices.length; i++) {
    const vertex = data.vertices[i];
    const i3 = i * 3;

    // Positions
    positions[i3] = vertex.x;
    positions[i3 + 1] = vertex.y;
    positions[i3 + 2] = vertex.z;

    // Colors (if available)
    if (colors && vertex.red !== undefined) {
      colors[i3] = vertex.red / 255.0;
      colors[i3 + 1] = (vertex.green || 0) / 255.0;
      colors[i3 + 2] = (vertex.blue || 0) / 255.0;
    }

    // Normals (if available)
    if (normals && vertex.nx !== undefined) {
      normals[i3] = vertex.nx;
      normals[i3 + 1] = vertex.ny || 0;
      normals[i3 + 2] = vertex.nz || 0;
    }
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  if (colors) {
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }

  if (normals) {
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  } else {
    geometry.computeVertexNormals();
  }

  // Create material
  let material;
  if (data.faces && data.faces.length > 0) {
    // Mesh with faces
    const indices = [];
    for (const face of data.faces) {
      if (face.indices && face.indices.length >= 3) {
        // Triangulate face if needed
        for (let i = 1; i < face.indices.length - 1; i++) {
          indices.push(face.indices[0], face.indices[i], face.indices[i + 1]);
        }
      }
    }

    if (indices.length > 0) {
      geometry.setIndex(indices);
    }

    material = new THREE.MeshLambertMaterial({
      vertexColors: colors ? true : false,
      color: colors ? 0xffffff : 0x888888,
    });

    return new THREE.Mesh(geometry, material);
  } else {
    // Point cloud
    material = new THREE.PointsMaterial({
      size: 0.01,
      vertexColors: colors ? true : false,
      color: colors ? 0xffffff : 0x888888,
    });

    return new THREE.Points(geometry, material);
  }
}

function addObjectToScene(object: any, fileName: string): void {
  // Get the Three.js scene from our visualizer store
  // This is a simple implementation - in a full implementation,
  // we'd use the Svelte store system properly
  const event = new CustomEvent('addToScene', {
    detail: { object, fileName },
  });
  window.dispatchEvent(event);
}

function handleLargeFileStart(message: any): void {
  console.log('📦 Large file transfer starting:', message.fileName);
  // TODO: Initialize progress tracking
}

function handleLargeFileChunk(message: any): void {
  console.log('📦 Large file chunk received:', message.chunkIndex, '/', message.totalChunks);
  // TODO: Update progress indicator
  // TODO: Assemble chunks when complete
}

function handleTiming(message: any): void {
  console.log('⏱️ Timing info:', message);
  // TODO: Display performance metrics in UI
}

function handleDefaultDepthSettings(message: any): void {
  console.log('🔧 Default depth settings received:', message.settings);
  // TODO: Apply default depth settings to UI forms
  // This message contains default camera parameters and settings
}

export const MessageHandler = {
  initialize: setupMessageHandler,
  handleTiming,
  handleFileData,
  handleLargeFileStart,
  handleLargeFileChunk,
  getVscodeApi: () => vscodeApi,
  isInitialized: () => isInitialized,
};
