import { SpatialData, CameraParams } from '../interfaces';

/**
 * Parsers for camera/depth parameters embedded as comments in PLY-derived
 * SpatialData (e.g. "fx: 1000px", "Baseline: 50mm", "rgb24Scale=1000").
 */

export function getRgb24ScaleFactor(data: SpatialData): number {
  const comments = (data as any)?.comments;
  if (!Array.isArray(comments)) {
    return 1000;
  }

  for (const comment of comments) {
    if (typeof comment === 'string' && comment.includes('rgb24Scale=')) {
      const match = comment.match(/rgb24Scale=(\d+(?:\.\d+)?)/);
      if (match) {
        return parseFloat(match[1]);
      }
    }
  }
  return 1000; // Default to millimeters
}

export function getRgb24ConversionMode(
  data: SpatialData
): 'shift' | 'multiply' | 'red' | 'green' | 'blue' {
  const comments = (data as any)?.comments;
  if (!Array.isArray(comments)) {
    return 'shift';
  }

  for (const comment of comments) {
    if (typeof comment === 'string' && comment.includes('rgb24Mode=')) {
      const match = comment.match(/rgb24Mode=(shift|multiply|red|green|blue)/);
      if (match) {
        return match[1] as 'shift' | 'multiply' | 'red' | 'green' | 'blue';
      }
    }
  }
  return 'shift'; // Default to standard shift mode
}

export function getPngScaleFactor(data: SpatialData): number {
  const comments = (data as any)?.comments;
  if (!Array.isArray(comments)) {
    return 1000;
  } // Default

  for (const comment of comments) {
    if (typeof comment === 'string' && comment.includes('scale=')) {
      const match = comment.match(/scale=(\d+(?:\.\d+)?)/);
      if (match) {
        return parseFloat(match[1]);
      }
    }
  }
  return 1000; // Default to millimeters
}

export interface DepthSettingsHost {
  defaultDepthSettings: CameraParams;
  fileDepthData: Map<number, { depthDimensions?: { width: number; height: number } }>;
}

export function getDepthSetting(
  host: DepthSettingsHost,
  data: SpatialData,
  setting: 'camera' | 'depth'
): string {
  const comments = (data as any)?.comments;
  if (!Array.isArray(comments)) {
    if (setting === 'camera') {
      return host.defaultDepthSettings.cameraModel;
    }
    if (setting === 'depth') {
      return host.defaultDepthSettings.depthType;
    }
    return '';
  }
  for (const comment of comments) {
    if (setting === 'camera' && comment.startsWith('Camera: ')) {
      return comment.replace('Camera: ', '').toLowerCase();
    }
    if (setting === 'depth' && comment.startsWith('Depth: ')) {
      return comment.replace('Depth: ', '').toLowerCase();
    }
  }
  // Return default settings if no setting found in comments
  if (setting === 'camera') {
    return host.defaultDepthSettings.cameraModel;
  }
  if (setting === 'depth') {
    return host.defaultDepthSettings.depthType;
  }
  return '';
}

export function getDepthFx(host: DepthSettingsHost, data: SpatialData): number {
  const comments = (data as any)?.comments;
  if (!Array.isArray(comments)) {
    return host.defaultDepthSettings.fx;
  }
  for (const comment of comments) {
    if (comment.startsWith('fx: ')) {
      const match = comment.match(/(\d+(?:\.\d+)?)px/);
      return match ? parseFloat(match[1]) : host.defaultDepthSettings.fx;
    }
    // Legacy support for 'Focal length:' format
    if (comment.startsWith('Focal length: ')) {
      const match = comment.match(/(\d+(?:\.\d+)?)px/);
      return match ? parseFloat(match[1]) : host.defaultDepthSettings.fx;
    }
  }
  return host.defaultDepthSettings.fx;
}

export function getDepthFy(host: DepthSettingsHost, data: SpatialData): string {
  const comments = (data as any)?.comments;
  if (!Array.isArray(comments)) {
    return host.defaultDepthSettings.fy?.toString() || '';
  }
  for (const comment of comments) {
    if (comment.startsWith('fy: ')) {
      const match = comment.match(/(\d+(?:\.\d+)?)px/);
      return match ? match[1] : host.defaultDepthSettings.fy?.toString() || '';
    }
  }
  return host.defaultDepthSettings.fy?.toString() || '';
}

export function getDepthBaseline(host: DepthSettingsHost, data: SpatialData): number {
  const comments = (data as any)?.comments;
  if (!Array.isArray(comments)) {
    return host.defaultDepthSettings.baseline || 50;
  }
  for (const comment of comments) {
    if (comment.startsWith('Baseline: ')) {
      const match = comment.match(/(\d+(?:\.\d+)?)mm/);
      return match ? parseFloat(match[1]) : host.defaultDepthSettings.baseline || 50;
    }
  }
  return host.defaultDepthSettings.baseline || 50; // Use default baseline
}

export function getDepthCx(host: DepthSettingsHost, data: SpatialData, fileIndex?: number): string {
  // First try to get dimensions from stored depth data using file index
  if (fileIndex !== undefined) {
    const depthData = host.fileDepthData.get(fileIndex);
    if (depthData?.depthDimensions?.width) {
      const cx = (depthData.depthDimensions.width - 1) / 2;
      return cx.toString();
    }
  }

  // Fall back to checking dimensions on the data object (legacy)
  const dimensions = (data as any)?.depthDimensions;
  if (dimensions && dimensions.width) {
    const cx = (dimensions.width - 1) / 2;
    return cx.toString();
  }
  // Return empty string when dimensions aren't available yet (will be auto-calculated)
  return ''; // Empty = will be auto-calculated once image is processed
}

export function getDepthCy(host: DepthSettingsHost, data: SpatialData, fileIndex?: number): string {
  // First try to get dimensions from stored depth data using file index
  if (fileIndex !== undefined) {
    const depthData = host.fileDepthData.get(fileIndex);
    if (depthData?.depthDimensions?.height) {
      const cy = (depthData.depthDimensions.height - 1) / 2;
      return cy.toString();
    }
  }

  // Fall back to checking dimensions on the data object (legacy)
  const dimensions = (data as any)?.depthDimensions;
  if (dimensions && dimensions.height) {
    const cy = (dimensions.height - 1) / 2;
    return cy.toString();
  }
  // Return empty string when dimensions aren't available yet (will be auto-calculated)
  return ''; // Empty = will be auto-calculated once image is processed
}

export function getDepthConvention(
  host: DepthSettingsHost,
  data: SpatialData
): 'opengl' | 'opencv' {
  // Check if this file was processed with a specific convention
  const comments = (data as any)?.comments;
  if (Array.isArray(comments)) {
    for (const comment of comments) {
      if (comment.includes('Convention: ')) {
        const convention = comment.replace('Convention: ', '').toLowerCase();
        if (convention === 'opencv' || convention === 'opengl') {
          return convention as 'opengl' | 'opencv';
        }
      }
    }
  }
  // Use default convention from settings
  return host.defaultDepthSettings.convention || 'opengl';
}
