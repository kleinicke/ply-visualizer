// Memory budget for opening files: what the system can spare, and what a set
// of files will take (costs from headers, rules in loadBudget.js).
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const budget = require('./loadBudget');

/** Memory the OS can give us without swapping, in bytes. */
function availableMemory() {
  try {
    if (process.platform === 'linux') {
      const match = /^MemAvailable:\s+(\d+) kB/m.exec(fs.readFileSync('/proc/meminfo', 'utf8'));
      if (match) return Number(match[1]) * 1024;
    } else if (process.platform === 'darwin') {
      // os.freemem() on macOS counts only completely unused pages, which is
      // usually a few hundred MB; inactive, speculative and purgeable pages
      // are handed out on demand, so they are available too.
      const text = execFileSync('vm_stat', { encoding: 'utf8', timeout: 2000 });
      const pageSize = Number(/page size of (\d+) bytes/.exec(text)?.[1] ?? 4096);
      const pages = name => Number(new RegExp(`^${name}:\\s+(\\d+)`, 'm').exec(text)?.[1] ?? 0);
      const free =
        pages('Pages free') +
        pages('Pages inactive') +
        pages('Pages speculative') +
        pages('Pages purgeable');
      if (free > 0) return free * pageSize;
    }
  } catch {
    // fall through
  }
  return os.freemem();
}

function readHead(file, length = 65536) {
  const fd = fs.openSync(file, 'r');
  try {
    const buffer = Buffer.alloc(length);
    const read = fs.readSync(fd, buffer, 0, length, 0);
    return buffer.subarray(0, read);
  } finally {
    fs.closeSync(fd);
  }
}

/** Reads the start of a PLY up to `end_header` (headers can be long). */
function readPlyHeader(file) {
  for (const length of [65536, 1 << 20]) {
    const text = readHead(file, length).toString('latin1');
    const header = budget.parsePlyHeader(text);
    if (header) return header;
    if (text.length < length) break;
  }
  return null;
}

/** LAS/LAZ point count and point format, or null. */
function lasInfo(file) {
  const head = readHead(file, 375);
  if (head.length < 111 || head.toString('latin1', 0, 4) !== 'LASF') return null;
  // Bits 6-7 of the format byte flag LAZ compression.
  const format = head[104] & 0x3f;
  let points = head.readUInt32LE(107);
  if (head[25] >= 4 && head.length >= 255) {
    const full = Number(head.readBigUInt64LE(247));
    if (full > 0) points = full;
  }
  return { format, points };
}

/** NPY point count (product of the shape / 3), or null if not N x 3. */
function npyPoints(file) {
  const head = readHead(file, 4096);
  if (head.toString('latin1', 1, 6) !== 'NUMPY') return null;
  const major = head[6];
  const len = major === 1 ? head.readUInt16LE(8) : head.readUInt32LE(8);
  const dict = head.toString('latin1', major === 1 ? 10 : 12, (major === 1 ? 10 : 12) + len);
  const shape = /'shape':\s*\(([^)]*)\)/.exec(dict);
  if (!shape) return null;
  const dims = shape[1]
    .split(',')
    .map(x => x.trim())
    .filter(Boolean)
    .map(Number);
  if (!dims.length || dims[dims.length - 1] !== 3) return null;
  return dims.reduce((a, b) => a * b, 1) / 3;
}

/**
 * Text point clouds: the first data row's column count, and points estimated
 * from the lines in the first megabyte.
 */
function textInfo(file, size) {
  const head = readHead(file, 1 << 20);
  const text = head.toString('latin1');
  let lines = 0;
  let columns = 0;
  for (const line of text.split('\n')) {
    lines++;
    if (!columns) {
      const numbers = line
        .trim()
        .split(/[\s,;]+/)
        .filter(t => t && !Number.isNaN(Number(t)));
      if (numbers.length >= 3) columns = numbers.length;
    }
  }
  const points = head.length ? Math.round((lines / head.length) * size) : 0;
  return { columns, points };
}

/**
 * The memory cost of one file, from its header (rules in loadBudget.js).
 * Formats whose layout is not read get the positions-only lower bound.
 */
function fileCost(file) {
  let size = 0;
  try {
    size = fs.statSync(file).size;
  } catch {
    return { ...budget.minimalCost(0, 0, false), size: 0 };
  }
  const ext = path.extname(file).toLowerCase();
  try {
    if (ext === '.ply') {
      const header = readPlyHeader(file);
      if (header) return { ...budget.plyCost(header, size), size };
    } else if (ext === '.pcd') {
      const header = budget.parsePcdHeader(readHead(file).toString('latin1'));
      if (header) return { ...budget.pcdCost(header, size), size };
    } else if (ext === '.las' || ext === '.laz') {
      const info = lasInfo(file);
      if (info) return { ...budget.lasCost(info, size), size };
    } else if (['.xyz', '.xyzn', '.xyzrgb', '.pts', '.txt', '.csv', '.asc', '.tsv'].includes(ext)) {
      const { columns, points } = textInfo(file, size);
      return { ...budget.textCost(ext, columns, points, size), size };
    } else if (ext === '.npy') {
      const points = npyPoints(file);
      if (points !== null) {
        // Positions only; the file and a Float32 copy pass through wasm.
        return {
          ...budget.pointCost(points, size, { wasm: size + points * 12, describe: 'xyz' }),
          size,
        };
      }
    } else if (ext === '.bin' && size % 16 === 0) {
      // KITTI: x y z intensity as float32.
      return {
        ...budget.pointCost(size / 16, size, {
          intensity: true,
          wasm: 0,
          describe: 'xyz + intensity',
        }),
        size,
      };
    }
  } catch {
    // unreadable header: fall through
  }
  // Unknown layout (E57, meshes, models): positions only, 12 bytes per point
  // on disk - a rough lower bound.
  return { ...budget.minimalCost(Math.round(size / 12), size, false), size };
}

/** Costs of `paths`, and what loading all of them normally takes. */
function estimateFiles(paths) {
  const files = paths.map(fileCost);
  const plan = budget.planLoad(files, null);
  return {
    files,
    bytes: files.reduce((sum, f) => sum + f.size, 0),
    points: files.reduce((sum, f) => sum + f.points, 0),
    exact: files.every(f => f.exact),
    steady: plan.steady,
    peak: plan.peak,
  };
}

function memoryInfo() {
  return { available: availableMemory(), total: os.totalmem() };
}

function formatBytes(bytes) {
  const gb = bytes / 1024 ** 3;
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`;
}

function formatPoints(points) {
  if (points >= 1e9) return `${(points / 1e9).toFixed(1)} billion`;
  if (points >= 1e6) return `${(points / 1e6).toFixed(1)} million`;
  return points.toLocaleString('en-US');
}

module.exports = {
  availableMemory,
  estimateFiles,
  memoryInfo,
  formatBytes,
  formatPoints,
};
