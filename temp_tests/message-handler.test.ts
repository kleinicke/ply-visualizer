import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupMessageHandler, MessageHandler } from '../website/src/lib/message-handler';

describe('MessageHandler', () => {
  beforeEach(() => {
    // Reset any previous initialization
    (MessageHandler as any).isInitialized = false;

    // Clear event listeners
    const mockRemoveEventListener = vi.fn();
    global.window = {
      addEventListener: vi.fn(),
      removeEventListener: mockRemoveEventListener,
      dispatchEvent: vi.fn(),
    } as any;
  });

  describe('setupMessageHandler', () => {
    it('should initialize message handler only once', () => {
      const mockVscode = { postMessage: vi.fn() };

      setupMessageHandler(mockVscode);
      expect(MessageHandler.isInitialized()).toBe(true);

      // Second call should not re-initialize
      const consoleSpy = vi.spyOn(console, 'log');
      setupMessageHandler(mockVscode);
      expect(consoleSpy).toHaveBeenCalledWith('Message handler already initialized');
    });

    it('should store vscode API reference', () => {
      const mockVscode = { postMessage: vi.fn() };
      setupMessageHandler(mockVscode);

      expect(MessageHandler.getVscodeApi()).toBe(mockVscode);
    });
  });

  describe('file loading messages', () => {
    it('should handle startLoading message', () => {
      const mockVscode = { postMessage: vi.fn() };
      setupMessageHandler(mockVscode);

      const startLoadingMessage = {
        type: 'startLoading',
        fileName: 'test.ply',
        data: { type: 'startLoading', fileName: 'test.ply' },
      };

      // Simulate message event
      const messageEvent = new MessageEvent('message', { data: startLoadingMessage.data });
      window.dispatchEvent(messageEvent);

      expect(mockVscode.postMessage).toHaveBeenCalledWith({
        type: 'loadingStarted',
        fileName: 'test.ply',
      });
    });

    it('should handle fileData message and create 3D object', () => {
      setupMessageHandler();

      const fileDataMessage = {
        type: 'fileData',
        fileName: 'sample_pointcloud.ply',
        vertices: [
          { x: 1, y: 2, z: 3, red: 255, green: 0, blue: 0 },
          { x: 4, y: 5, z: 6, red: 0, green: 255, blue: 0 },
          { x: 7, y: 8, z: 9, red: 0, green: 0, blue: 255 },
        ],
        faces: [] as any[],
        hasColors: true,
        hasNormals: false,
        vertexCount: 3,
        faceCount: 0,
      };

      // Mock the addToScene event dispatch
      const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

      // Simulate message event
      const messageEvent = new MessageEvent('message', { data: fileDataMessage });
      window.dispatchEvent(messageEvent);

      // Should dispatch an addToScene event
      expect(dispatchEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'addToScene',
          detail: expect.objectContaining({
            fileName: 'sample_pointcloud.ply',
          }),
        })
      );
    });
  });
});
