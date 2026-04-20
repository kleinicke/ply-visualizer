declare module 'three/addons/controls/OrbitControls.js' {
  import * as THREE from 'three';

  export class OrbitControls {
    constructor(object: THREE.Camera, domElement?: HTMLElement);
    enabled: boolean;
    target: THREE.Vector3;
    addEventListener(type: string, listener: (...args: any[]) => void): void;
    removeEventListener(type: string, listener: (...args: any[]) => void): void;
    update(): void;
    dispose(): void;
    [key: string]: any;
  }
}

declare module 'three/addons/controls/TrackballControls.js' {
  import * as THREE from 'three';

  export class TrackballControls {
    constructor(object: THREE.Camera, domElement?: HTMLElement);
    enabled: boolean;
    target: THREE.Vector3;
    rotateSpeed: number;
    zoomSpeed: number;
    panSpeed: number;
    screen: { left: number; top: number; width: number; height: number };
    handleResize(): void;
    addEventListener(type: string, listener: (...args: any[]) => void): void;
    removeEventListener(type: string, listener: (...args: any[]) => void): void;
    update(): void;
    dispose(): void;
    [key: string]: any;
  }
}

declare module 'three/addons/postprocessing/EffectComposer.js' {
  import * as THREE from 'three';

  export class EffectComposer {
    constructor(renderer: THREE.WebGLRenderer);
    renderTarget1: THREE.WebGLRenderTarget;
    renderTarget2: THREE.WebGLRenderTarget;
    addPass(pass: unknown): void;
    removePass(pass: unknown): void;
    render(deltaTime?: number): void;
    setSize(width: number, height: number): void;
    dispose(): void;
    [key: string]: any;
  }
}

declare module 'three/addons/postprocessing/Pass.js' {
  import * as THREE from 'three';

  export class Pass {
    enabled: boolean;
    needsSwap: boolean;
    clear: boolean;
    renderToScreen: boolean;
    setSize(width: number, height: number): void;
    render(
      renderer: THREE.WebGLRenderer,
      writeBuffer: THREE.WebGLRenderTarget,
      readBuffer: THREE.WebGLRenderTarget,
      deltaTime?: number,
      maskActive?: boolean
    ): void;
  }

  export class FullScreenQuad {
    constructor(material?: THREE.Material);
    material: THREE.Material;
    render(renderer: THREE.WebGLRenderer): void;
    dispose(): void;
  }
}
