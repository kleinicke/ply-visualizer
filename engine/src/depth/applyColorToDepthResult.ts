import { CameraParams, DepthConversionResult } from '../interfaces';

export function applyColorToDepthResult(
  result: DepthConversionResult,
  imageData: ImageData,
  cameraParams: CameraParams
): void {
  const colorData = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  const colors = new Uint8Array(result.pointCount * 3);
  let colorIndex = 0;
  const defaultGray = 128;

  if (result.pixelCoords && result.pixelCoords.length === result.pointCount * 2) {
    for (let i = 0; i < result.pointCount; i++) {
      const pixelIndex = i * 2;
      const u = Math.round(result.pixelCoords[pixelIndex]);
      const v = Math.round(result.pixelCoords[pixelIndex + 1]);

      if (u >= 0 && u < width && v >= 0 && v < height) {
        const colorPixelIndex = (v * width + u) * 4;
        colors[colorIndex++] = colorData[colorPixelIndex];
        colors[colorIndex++] = colorData[colorPixelIndex + 1];
        colors[colorIndex++] = colorData[colorPixelIndex + 2];
      } else {
        colors[colorIndex++] = defaultGray;
        colors[colorIndex++] = defaultGray;
        colors[colorIndex++] = defaultGray;
      }
    }
  } else {
    const convention = cameraParams.convention || 'opengl';
    const isOpenGL = convention === 'opengl';
    const fx = cameraParams.fx;
    const fy = cameraParams.fy || cameraParams.fx;
    const cx = cameraParams.cx!;
    const cy = cameraParams.cy!;

    for (let i = 0; i < result.pointCount; i++) {
      const vertexIndex = i * 3;
      const x = result.vertices[vertexIndex];
      const y = result.vertices[vertexIndex + 1];
      const z = result.vertices[vertexIndex + 2];

      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        colors[colorIndex++] = defaultGray;
        colors[colorIndex++] = defaultGray;
        colors[colorIndex++] = defaultGray;
        continue;
      }

      const validDepth = isOpenGL ? z < 0 : z > 0;
      if (!validDepth) {
        colors[colorIndex++] = defaultGray;
        colors[colorIndex++] = defaultGray;
        colors[colorIndex++] = defaultGray;
        continue;
      }

      const xCV = x;
      const yCV = isOpenGL ? -y : y;
      const zCV = isOpenGL ? -z : z;
      let u: number;
      let v: number;

      if (cameraParams.cameraModel === 'fisheye-equidistant') {
        const r = Math.sqrt(xCV * xCV + yCV * yCV);
        const theta = Math.atan2(r, zCV);
        const phi = Math.atan2(yCV, xCV);
        const rFish = fx * theta;
        u = Math.round(cx + rFish * Math.cos(phi));
        v = Math.round(cy + rFish * Math.sin(phi));
      } else {
        u = Math.round(fx * (xCV / zCV) + cx);
        v = Math.round(fy * (yCV / zCV) + cy);
      }

      if (u >= 0 && u < width && v >= 0 && v < height) {
        const pixelIndex = (v * width + u) * 4;
        colors[colorIndex++] = colorData[pixelIndex];
        colors[colorIndex++] = colorData[pixelIndex + 1];
        colors[colorIndex++] = colorData[pixelIndex + 2];
      } else {
        colors[colorIndex++] = defaultGray;
        colors[colorIndex++] = defaultGray;
        colors[colorIndex++] = defaultGray;
      }
    }
  }

  result.colors = colors;
}
