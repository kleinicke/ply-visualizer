import * as THREE from 'three';

type AnchorStrategy = 'full' | 'left' | 'below';

export interface SafeViewRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VisibleViewportRect {
  offsetLeft: number;
  offsetTop: number;
  width: number;
  height: number;
}

interface ScreenAnchorOptions {
  camera: THREE.PerspectiveCamera;
  canvas: HTMLElement;
  panel: HTMLElement;
  onChange(safeRect: SafeViewRect): void;
}

const PANEL_GAP = 10;
const MIN_OBSTRUCTION_FRACTION = 0.01;
const STRATEGY_HYSTERESIS = 0.9;

function area(rect: SafeViewRect): number {
  return Math.max(0, rect.width) * Math.max(0, rect.height);
}

/**
 * Keeps the camera target in the useful part of the canvas rather than under
 * the top-right UI overlay. The selected safe rectangle is stable across
 * ordinary content updates; callers refresh it only for viewport changes,
 * panel collapse/expansion, and explicit camera fitting.
 */
export class ScreenAnchorController {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly canvas: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly onChange: (safeRect: SafeViewRect) => void;
  private strategy: AnchorStrategy = 'full';
  private safeRect: SafeViewRect = { x: 0, y: 0, width: 1, height: 1 };
  private viewportRefreshFrame: number | null = null;

  constructor(options: ScreenAnchorOptions) {
    this.camera = options.camera;
    this.canvas = options.canvas;
    this.panel = options.panel;
    this.onChange = options.onChange;
    this.refreshAutomatic(true);
    window.visualViewport?.addEventListener('resize', this.onVisualViewportChange);
    window.visualViewport?.addEventListener('scroll', this.onVisualViewportChange);
  }

  dispose(): void {
    window.visualViewport?.removeEventListener('resize', this.onVisualViewportChange);
    window.visualViewport?.removeEventListener('scroll', this.onVisualViewportChange);
    if (this.viewportRefreshFrame !== null) {
      cancelAnimationFrame(this.viewportRefreshFrame);
      this.viewportRefreshFrame = null;
    }
  }

  /** Recompute the automatic anchor from the current canvas and panel bounds. */
  refreshAutomatic(
    forceStrategy = false,
    viewport: VisibleViewportRect | null = window.visualViewport
  ): void {
    const canvasRect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, canvasRect.width);
    const height = Math.max(1, canvasRect.height);
    const visibleLeft = viewport
      ? THREE.MathUtils.clamp(viewport.offsetLeft - canvasRect.left, 0, width)
      : 0;
    const visibleTop = viewport
      ? THREE.MathUtils.clamp(viewport.offsetTop - canvasRect.top, 0, height)
      : 0;
    const visibleRight = viewport
      ? THREE.MathUtils.clamp(viewport.offsetLeft + viewport.width - canvasRect.left, 0, width)
      : width;
    const visibleBottom = viewport
      ? THREE.MathUtils.clamp(viewport.offsetTop + viewport.height - canvasRect.top, 0, height)
      : height;
    const visibleWidth = Math.max(1, visibleRight - visibleLeft);
    const visibleHeight = Math.max(1, visibleBottom - visibleTop);
    const full: SafeViewRect = {
      x: visibleLeft,
      y: visibleTop,
      width: visibleWidth,
      height: visibleHeight,
    };

    const panelRect = this.panel.getBoundingClientRect();
    const overlapLeft = THREE.MathUtils.clamp(
      panelRect.left - canvasRect.left,
      visibleLeft,
      visibleRight
    );
    const overlapTop = THREE.MathUtils.clamp(
      panelRect.top - canvasRect.top,
      visibleTop,
      visibleBottom
    );
    const overlapRight = THREE.MathUtils.clamp(
      panelRect.right - canvasRect.left,
      visibleLeft,
      visibleRight
    );
    const overlapBottom = THREE.MathUtils.clamp(
      panelRect.bottom - canvasRect.top,
      visibleTop,
      visibleBottom
    );
    const overlapArea =
      Math.max(0, overlapRight - overlapLeft) * Math.max(0, overlapBottom - overlapTop);

    const leftWidth = Math.max(1, overlapLeft - PANEL_GAP - visibleLeft);
    const belowY = Math.min(visibleBottom - 1, overlapBottom + PANEL_GAP);
    const candidates: Record<AnchorStrategy, SafeViewRect> = {
      full,
      left: { x: visibleLeft, y: visibleTop, width: leftWidth, height: visibleHeight },
      below: {
        x: visibleLeft,
        y: belowY,
        width: visibleWidth,
        height: Math.max(1, visibleBottom - belowY),
      },
    };

    let nextStrategy: AnchorStrategy = 'full';
    if (overlapArea / (visibleWidth * visibleHeight) >= MIN_OBSTRUCTION_FRACTION) {
      nextStrategy = area(candidates.left) >= area(candidates.below) ? 'left' : 'below';

      if (!forceStrategy && this.strategy !== 'full') {
        const currentArea = area(candidates[this.strategy]);
        const bestArea = area(candidates[nextStrategy]);
        if (currentArea >= bestArea * STRATEGY_HYSTERESIS) {
          nextStrategy = this.strategy;
        }
      }
    }

    this.strategy = nextStrategy;
    this.safeRect = candidates[nextStrategy];
    this.applyProjection(width, height);
  }

  private readonly onVisualViewportChange = (): void => {
    if (this.viewportRefreshFrame !== null) {
      return;
    }
    this.viewportRefreshFrame = requestAnimationFrame(() => {
      this.viewportRefreshFrame = null;
      this.refreshAutomatic();
    });
  };

  /** Fractions used by fit-to-view so content fits inside the same safe area. */
  getFitFractions(): { width: number; height: number } {
    const canvasRect = this.canvas.getBoundingClientRect();
    return {
      width: THREE.MathUtils.clamp(this.safeRect.width / Math.max(1, canvasRect.width), 0.1, 1),
      height: THREE.MathUtils.clamp(this.safeRect.height / Math.max(1, canvasRect.height), 0.1, 1),
    };
  }

  getSafeRect(): SafeViewRect {
    return { ...this.safeRect };
  }

  private applyProjection(width: number, height: number): void {
    const anchorX = this.safeRect.x + this.safeRect.width / 2;
    const anchorY = this.safeRect.y + this.safeRect.height / 2;
    const offsetX = width / 2 - anchorX;
    const offsetY = height / 2 - anchorY;

    if (Math.abs(offsetX) < 0.5 && Math.abs(offsetY) < 0.5) {
      this.camera.clearViewOffset();
    } else {
      this.camera.setViewOffset(width, height, offsetX, offsetY, width, height);
    }
    this.camera.updateProjectionMatrix();
    this.onChange(this.getSafeRect());
  }
}
