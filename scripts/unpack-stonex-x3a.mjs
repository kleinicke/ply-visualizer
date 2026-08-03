#!/usr/bin/env node

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const require = createRequire(import.meta.url);
const { StonexX3aParser } = require(
  path.join(REPO_ROOT, 'out/engine/src/parsers/stonexX3aParser.js')
);

const inputPath = process.argv[2] ? path.resolve(process.argv[2]) : null;
const outputPath = process.argv[3]
  ? path.resolve(process.argv[3])
  : inputPath
    ? path.join(
        path.dirname(inputPath),
        `${path.basename(inputPath, path.extname(inputPath))}_unpacked`
      )
    : null;

if (!inputPath || !outputPath) {
  console.error('Usage: node scripts/unpack-stonex-x3a.mjs <archive.x3a> [output-folder]');
  process.exit(2);
}

function text(bytes, offset, length) {
  return bytes.subarray(offset, offset + length).toString('latin1');
}

function archiveMembers(bytes) {
  if (bytes.length < 88 || text(bytes, 0, 4) !== 'CRAX') {
    throw new Error('Not a CRAX/X3A archive');
  }
  const count = bytes.readUInt32LE(80);
  const directoryEnd = 88 + count * 512;
  if (!count || directoryEnd > bytes.length) {
    throw new Error('Invalid or truncated X3A directory');
  }
  const members = [];
  for (let index = 0; index < count; index++) {
    const entry = 88 + index * 512;
    const offset = Number(bytes.readBigUInt64LE(entry));
    const size = Number(bytes.readBigUInt64LE(entry + 8));
    const nameBytes = bytes.subarray(entry + 16, entry + 512);
    const nul = nameBytes.indexOf(0);
    const name = nameBytes.subarray(0, nul < 0 ? nameBytes.length : nul).toString('utf8');
    if (
      !name ||
      path.basename(name) !== name ||
      offset < directoryEnd ||
      offset + size > bytes.length
    ) {
      throw new Error(`Invalid archive member at directory index ${index}`);
    }
    members.push({ name, offset, size });
  }
  return members;
}

function scanLayout(bytes, member) {
  const columns = bytes.readUInt32LE(member.offset + 32);
  const rows = bytes.readUInt32LE(member.offset + 44);
  const stride = 48 + rows * 8;
  let columnsOffset = member.offset + 16_408;
  if (text(bytes, columnsOffset, 4) !== 'XCOL') {
    const searchEnd = Math.min(member.offset + member.size, member.offset + 1024 * 1024);
    columnsOffset = -1;
    for (let offset = member.offset + 16; offset + 4 <= searchEnd; offset += 4) {
      if (text(bytes, offset, 4) === 'XCOL') {
        columnsOffset = offset;
        break;
      }
    }
  }
  if (columnsOffset < 0 || columnsOffset + columns * stride > member.offset + member.size) {
    throw new Error(`Invalid X3R layout in ${member.name}`);
  }
  let validPoints = 0;
  for (let column = 0; column < columns; column++) {
    let sample = columnsOffset + column * stride + 48;
    for (let row = 0; row < rows; row++, sample += 8) {
      const range = bytes.readInt32LE(sample);
      if (range > 0 && range < 0x7fffffff) {
        validPoints++;
      }
    }
  }
  return { columns, rows, validPoints };
}

function grayWorldBalance(bytes, frames) {
  let redGain = 0;
  let blueGain = 0;
  let usable = 0;
  for (const frame of frames) {
    const width = bytes.readUInt32LE(frame.offset + 8);
    const height = bytes.readUInt32LE(frame.offset + 12);
    const pixels = frame.offset + 64;
    let red = 0;
    let green = 0;
    let blue = 0;
    let samples = 0;
    for (let y = 0; y + 1 < height; y += 16) {
      const evenY = y & ~1;
      for (let x = 0; x + 1 < width; x += 16) {
        const evenX = x & ~1;
        const row0 = pixels + evenY * width + evenX;
        const row1 = row0 + width;
        green += (bytes[row0] + bytes[row1 + 1]) * 0.5;
        red += bytes[row0 + 1];
        blue += bytes[row1];
        samples++;
      }
    }
    if (samples && red && blue) {
      redGain += green / red;
      blueGain += green / blue;
      usable++;
    }
  }
  return usable ? { red: redGain / usable, blue: blueGain / usable } : { red: 1, blue: 1 };
}

function portraitTopLeftBalance(bytes, frame) {
  const width = bytes.readUInt32LE(frame.offset + 8);
  const height = bytes.readUInt32LE(frame.offset + 12);
  const pixels = frame.offset + 64;
  const patchSize = Math.min(200, width, height);
  let red = 0;
  let green = 0;
  let greenSquares = 0;
  let blue = 0;
  let samples = 0;

  // After the clockwise rotation, portrait top-left corresponds to the raw
  // sensor's bottom-left. On X300 upward-camera panoramas this is normally a
  // broad, low-texture sky region and is a much better illuminant reference
  // than the scene-wide average (which is dominated by ground and plants).
  for (let y = height - patchSize; y + 1 < height; y += 2) {
    for (let x = 0; x + 1 < patchSize; x += 2) {
      const row0 = pixels + y * width + x;
      const row1 = row0 + width;
      const sampleGreen = (bytes[row0] + bytes[row1 + 1]) * 0.5;
      green += sampleGreen;
      greenSquares += sampleGreen * sampleGreen;
      red += bytes[row0 + 1];
      blue += bytes[row1];
      samples++;
    }
  }
  if (!samples || !red || !blue) {
    return null;
  }
  const meanRed = red / samples;
  const meanGreen = green / samples;
  const meanBlue = blue / samples;
  const greenDeviation = Math.sqrt(Math.max(0, greenSquares / samples - meanGreen * meanGreen));
  // Reject clipped patches: equal 255 values contain no color-response data.
  if (Math.max(meanRed, meanGreen, meanBlue) >= 250) {
    return null;
  }
  return {
    red: meanGreen / meanRed,
    blue: meanGreen / meanBlue,
    // Prefer a bright, smooth patch. This selects sky without tying the
    // conversion to a particular panorama angle or filename.
    score: meanGreen / (1 + greenDeviation),
  };
}

function whiteBalances(bytes, frames) {
  const result = new Map();
  for (const type of ['U', 'D']) {
    const typedFrames = frames.filter(frame =>
      new RegExp(`-${type}\\d{9}\\.x3i$`, 'i').test(frame.name)
    );
    const fallback = grayWorldBalance(bytes, typedFrames);
    const references = typedFrames
      .map(frame => portraitTopLeftBalance(bytes, frame))
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);
    const reference = references[0];
    result.set(type, reference ? { red: reference.red, blue: reference.blue } : fallback);
  }
  return result;
}

function writePly(filePath, cloud, startPoint, pointCount, sourceName) {
  const header = Buffer.from(
    [
      'ply',
      'format binary_little_endian 1.0',
      `comment Converted from Stonex X300 ${sourceName}`,
      `element vertex ${pointCount}`,
      'property float x',
      'property float y',
      'property float z',
      'property uchar red',
      'property uchar green',
      'property uchar blue',
      'property float intensity',
      'end_header',
      '',
    ].join('\n')
  );
  const fd = fs.openSync(filePath, 'w');
  try {
    fs.writeSync(fd, header);
    const batchPoints = 65_536;
    for (let first = 0; first < pointCount; first += batchPoints) {
      const count = Math.min(batchPoints, pointCount - first);
      const records = Buffer.allocUnsafe(count * 19);
      for (let local = 0; local < count; local++) {
        const sourcePoint = startPoint + first + local;
        const source3 = sourcePoint * 3;
        const target = local * 19;
        records.writeFloatLE(cloud.positionsArray[source3], target);
        records.writeFloatLE(cloud.positionsArray[source3 + 1], target + 4);
        records.writeFloatLE(cloud.positionsArray[source3 + 2], target + 8);
        const fallback = Math.round(cloud.intensityArray[sourcePoint] * 255);
        records[target + 12] = cloud.colorsArray?.[source3] ?? fallback;
        records[target + 13] = cloud.colorsArray?.[source3 + 1] ?? fallback;
        records[target + 14] = cloud.colorsArray?.[source3 + 2] ?? fallback;
        records.writeFloatLE(cloud.intensityArray[sourcePoint], target + 15);
      }
      fs.writeSync(fd, records);
    }
  } finally {
    fs.closeSync(fd);
  }
}

async function main() {
  const bytes = await fsp.readFile(inputPath);
  const members = archiveMembers(bytes);
  await fsp.mkdir(outputPath, { recursive: true });
  const embeddedDir = path.join(outputPath, 'embedded');
  const imagesDir = path.join(outputPath, 'images');
  const cloudsDir = path.join(outputPath, 'point_clouds');
  await Promise.all([
    fsp.mkdir(embeddedDir, { recursive: true }),
    fsp.mkdir(imagesDir, { recursive: true }),
    fsp.mkdir(cloudsDir, { recursive: true }),
  ]);

  for (const member of members) {
    await fsp.writeFile(
      path.join(embeddedDir, member.name),
      bytes.subarray(member.offset, member.offset + member.size)
    );
  }

  const imageMembers = members.filter(member => member.name.toLowerCase().endsWith('.x3i'));
  const gainsByCamera = whiteBalances(bytes, imageMembers);
  const convertedImages = [];
  for (const member of imageMembers) {
    const width = bytes.readUInt32LE(member.offset + 8);
    const height = bytes.readUInt32LE(member.offset + 12);
    const cameraType = member.name.match(/-([UD])\d{9}\.x3i$/i)?.[1].toUpperCase();
    const gains = gainsByCamera.get(cameraType) ?? { red: 1, blue: 1 };
    const input = path.join(embeddedDir, member.name);
    const output = path.join(imagesDir, `${path.basename(member.name, '.x3i')}.png`);
    const conversion = spawnSync(
      'ffmpeg',
      [
        '-v',
        'error',
        '-y',
        '-skip_initial_bytes',
        '64',
        '-f',
        'rawvideo',
        '-pixel_format',
        'bayer_grbg8',
        '-video_size',
        `${width}x${height}`,
        '-i',
        input,
        '-frames:v',
        '1',
        '-vf',
        // Force Bayer conversion before rotating. If transpose receives the
        // one-channel mosaic, it rotates the CFA sites but retains the GRBG
        // pixel-format label, producing a strong cast and a visible 2x2 grid.
        `format=rgb24,colorchannelmixer=rr=${gains.red}:bb=${gains.blue},transpose=clock`,
        output,
      ],
      { encoding: 'utf8' }
    );
    if (conversion.status !== 0) {
      throw new Error(`ffmpeg failed for ${member.name}: ${conversion.stderr.trim()}`);
    }
    convertedImages.push(path.relative(outputPath, output));
  }

  const cloud = await new StonexX3aParser().parse(bytes, path.basename(inputPath));
  const scanMembers = members.filter(member => member.name.toLowerCase().endsWith('.x3r'));
  const convertedClouds = [];
  let pointOffset = 0;
  for (const member of scanMembers) {
    const layout = scanLayout(bytes, member);
    const output = path.join(cloudsDir, `${path.basename(member.name, '.x3r')}.ply`);
    writePly(output, cloud, pointOffset, layout.validPoints, member.name);
    convertedClouds.push({
      source: member.name,
      output: path.relative(outputPath, output),
      columns: layout.columns,
      rows: layout.rows,
      validPoints: layout.validPoints,
    });
    pointOffset += layout.validPoints;
  }
  if (pointOffset !== cloud.vertexCount) {
    throw new Error(
      `PLY split produced ${pointOffset} points, parser produced ${cloud.vertexCount}`
    );
  }

  const manifest = {
    source: inputPath,
    createdAt: new Date().toISOString(),
    archiveMembers: members.map(member => ({ name: member.name, size: member.size })),
    images: convertedImages,
    pointClouds: convertedClouds,
    cameraCalibrations: members
      .filter(member => member.name.toLowerCase().endsWith('.cal'))
      .map(member => path.join('embedded', member.name)),
    totalValidPoints: cloud.vertexCount,
    photographicallyColoredPoints: cloud.metadata.photographicallyColoredPoints,
  };
  await fsp.writeFile(
    path.join(outputPath, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`
  );
  console.log(JSON.stringify({ outputPath, ...manifest }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
