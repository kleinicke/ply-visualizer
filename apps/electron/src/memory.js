// Memory budget for opening files: what the system can spare, and roughly
// what a set of files will take once loaded.
const fs = require('node:fs');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

/**
 * Bytes the viewer holds per loaded point (positions + colors in the page,
 * the GPU copy, bookkeeping). Measured: 20M xyz+rgb points take ~1.2 GB.
 * On Apple silicon the GPU copy is in the same RAM, so it counts too.
 */
const BYTES_PER_POINT = 60;
/** On-disk bytes per point when a file's header gives no count (binary xyz+rgb). */
const FALLBACK_BYTES_PER_POINT_ON_DISK = 15;

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

/** Point count from the file header (PLY, PCD, LAS/LAZ), or null. */
function headerPointCount(file) {
  const lower = file.toLowerCase();
  try {
    if (lower.endsWith('.ply') || lower.endsWith('.pcd')) {
      const head = readHead(file).toString('latin1');
      const match = lower.endsWith('.ply')
        ? /^element\s+vertex\s+(\d+)/m.exec(head)
        : /^POINTS\s+(\d+)/m.exec(head);
      // A PLY with faces is a mesh; its vertex count still describes memory.
      return match ? Number(match[1]) : null;
    }
    if (lower.endsWith('.las') || lower.endsWith('.laz')) {
      const head = readHead(file, 375);
      if (head.toString('latin1', 0, 4) !== 'LASF') return null;
      const minor = head[25];
      const legacy = head.readUInt32LE(107);
      if (minor >= 4 && head.length >= 255) {
        const full = Number(head.readBigUInt64LE(247));
        if (full > 0) return full;
      }
      return legacy;
    }
  } catch {
    // unreadable header: estimate from size
  }
  return null;
}

/**
 * Per-file sizes and point counts (exact from headers when possible), and the
 * memory a full load is expected to take.
 */
function estimateFiles(paths) {
  const files = paths.map(file => {
    let size = 0;
    try {
      size = fs.statSync(file).size;
    } catch {
      // vanished: counts as empty
    }
    const counted = headerPointCount(file);
    return {
      size,
      points: counted ?? Math.round(size / FALLBACK_BYTES_PER_POINT_ON_DISK),
      exact: counted !== null,
    };
  });
  const bytes = files.reduce((sum, f) => sum + f.size, 0);
  const points = files.reduce((sum, f) => sum + f.points, 0);
  return {
    files,
    bytes,
    points,
    // A normal open reads every file before parsing any, so the raw bytes
    // are held on top of the parsed points.
    fullLoadMemory: points * BYTES_PER_POINT + bytes,
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
  BYTES_PER_POINT,
  availableMemory,
  estimateFiles,
  memoryInfo,
  formatBytes,
  formatPoints,
};
