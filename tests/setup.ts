import { vi } from 'vitest';

// Mock Three.js for testing
vi.mock('three', () => ({
  BufferGeometry: vi.fn(() => ({
    setAttribute: vi.fn(),
    dispose: vi.fn(),
  })),
  BufferAttribute: vi.fn((array, itemSize) => ({
    array,
    itemSize,
  })),
  PointsMaterial: vi.fn(options => ({
    ...options,
    dispose: vi.fn(),
  })),
  Points: vi.fn((geometry, material) => ({
    geometry,
    material,
    name: '',
  })),
}));

// Mock global window objects
Object.defineProperty(window, 'acquireVsCodeApi', {
  value: vi.fn(() => ({
    postMessage: vi.fn(),
  })),
});
