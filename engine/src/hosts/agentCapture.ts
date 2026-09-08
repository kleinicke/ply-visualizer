import { Color, Vector2, WebGLRenderer } from 'three';
import { agentPresentation } from '../state/agentPresentation.svelte';
/* eslint-disable @typescript-eslint/naming-convention -- MCP wire keys */
import type { ControlHost } from './agentControls';
import { sceneGuidesState } from '../state/sceneGuides.svelte';
import { projectCoordinateGrid } from '../visualization/coordinateGrid';
import { getPointCloudColorOptions, type PointCloudColorOptionsHost } from '../colorOptions';
import { pose, restore } from './agentInspection';
import { fitAgentView } from './agentControls';
import { comparisonState } from './agentComparison';

export function captureAgentCanvas(host: ControlHost, maxSize = 1024): HTMLCanvasElement {
  const source = host.renderer.domElement;
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, maxSize / Math.max(source.width, source.height));
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = getComputedStyle(source).backgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  if (sceneGuidesState.grid && !comparisonState(host)) {
    const grid = projectCoordinateGrid(host, canvas.width, canvas.height);
    ctx.strokeStyle = '#a8b5c577';
    ctx.lineWidth = 1;
    for (const line of grid.lines) {
      ctx.beginPath();
      ctx.moveTo(line.x1, line.y1);
      ctx.lineTo(line.x2, line.y2);
      ctx.stroke();
    }
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#ddeeff';
    for (const label of grid.labels) {
      ctx.fillText(label.text, label.x + 4, label.y - 5);
    }
  }
  const split = comparisonState(host);
  if (split) {
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#eeeeee';
    for (const [side, i] of [split.left, split.right].entries()) {
      ctx.fillText(
        host.spatialFiles[i].fileName ?? `Object ${i}`,
        (side * canvas.width) / 2 + 12,
        canvas.height - 14,
        canvas.width / 2 - 24
      );
    }
  }
  if (sceneGuidesState.legend) {
    const lines = host.spatialFiles.flatMap((file, i) => {
      if (!host.fileVisibility[i] && !(split && [split.left, split.right].includes(i))) {
        return [];
      }
      const mode = host.individualColorModes[i];
      const palette =
        mode === 'assigned'
          ? host.fileColors[i % host.fileColors.length]
          : /^\d+$/.test(mode)
            ? host.fileColors[Number(mode)]
            : undefined;
      const label = palette
        ? '#' + new Color(palette[0], palette[1], palette[2]).getHexString()
        : (getPointCloudColorOptions(host as unknown as PointCloudColorOptionsHost, file, i).find(
            o => o.value === mode
          )?.label ?? mode);
      return [`${file.fileName ?? `Object ${i}`} · ${label}`];
    });
    for (const label of agentPresentation.labels) {
      lines.push(label.label);
    }
    if (agentPresentation.selection) {
      lines.push(agentPresentation.selection);
    }
    ctx.font = '12px sans-serif';
    const displayed = lines.slice(
      0,
      Math.max(1, Math.min(12, Math.floor((canvas.height - 32) / 18)))
    );
    const width = Math.min(
      canvas.width - 16,
      Math.max(180, ...displayed.map(s => ctx.measureText(s).width + 20))
    );
    ctx.fillStyle = '#20252ce8';
    ctx.fillRect(8, 8, width, displayed.length * 18 + 12);
    ctx.fillStyle = '#ffffff';
    displayed.forEach((line, i) => {
      const label = agentPresentation.labels.find(item => item.label === line);
      if (label) {
        ctx.fillStyle = label.color;
        ctx.fillRect(16, 18 + i * 18, 9, 9);
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillText(line, label ? 30 : 16, 27 + i * 18, width - (label ? 30 : 16));
    });
  }
  if (agentPresentation.warning) {
    ctx.fillStyle = '#20252cee';
    ctx.fillRect(0, canvas.height - 28, canvas.width, 28);
    ctx.fillStyle = '#ffbb44';
    ctx.font = '12px sans-serif';
    ctx.fillText(agentPresentation.warning, 8, canvas.height - 9, canvas.width - 16);
  }
  return canvas;
}
export async function agentMultiView(host: ControlHost, a: Record<string, any>) {
  if (comparisonState(host)) {
    throw new Error('Disable linked comparison before multi-view capture');
  }
  const before = pose(host),
    canvas = document.createElement('canvas');
  const columns = Math.min(2, a.presets.length),
    rows = Math.ceil(a.presets.length / columns);
  canvas.width = 512 * columns;
  canvas.height = 536 * rows;
  const renderer = host.renderer as unknown as WebGLRenderer;
  const size = renderer.getSize(new Vector2()),
    aspect = host.camera.aspect;
  const pixelRatio = renderer.getPixelRatio();
  const ctx = canvas.getContext('2d')!;
  try {
    renderer.setPixelRatio(1);
    renderer.setSize(512, 512, false);
    host.camera.aspect = 1;
    host.camera.updateProjectionMatrix();
    for (const [i, preset] of a.presets.entries()) {
      fitAgentView(host, preset);
      host.performRender();
      const image = captureAgentCanvas(host, 512);
      ctx.fillStyle = '#20252c';
      const x = (i % columns) * 512,
        y = Math.floor(i / columns) * 536;
      ctx.fillRect(x, y, 512, 536);
      ctx.drawImage(image, x, y, 512, 512);
      ctx.fillStyle = 'white';
      ctx.font = '14px sans-serif';
      ctx.fillText(preset, x + 12, y + 528);
    }
  } finally {
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(size.x, size.y, false);
    host.camera.aspect = aspect;
    restore(host, before);
    host.performRender();
  }
  return {
    png: canvas.toDataURL('image/png').split(',')[1],
    width: canvas.width,
    height: canvas.height,
    presets: a.presets,
    camera_preserved: true,
  };
}
