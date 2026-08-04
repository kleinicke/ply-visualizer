import * as path from 'path';

/**
 * 7-Zip extraction backed by `7z-wasm`.
 *
 * This used to shell out to a bundled native `7za`. That meant shipping every
 * platform's binary in the VSIX (~11 MB, the largest thing in the package)
 * because a VSIX is universal, and it made the feature depend on an executable
 * bit surviving packaging. One 1.6 MB WASM module replaces all of them and runs
 * the same everywhere, including remote and container hosts whose architecture
 * does not match the machine that packaged the extension.
 *
 * The archive is *not* read into memory. Both the archive's directory and the
 * output directory are mounted through Emscripten's NODEFS, so 7-Zip reads and
 * writes the real filesystem and peak memory stays bounded by its LZMA
 * dictionary rather than the archive size — measured at 63 MB peak RSS while
 * extracting a 483 MB archive containing 600 MB of files.
 */

type SevenZipModule = {
  FS: {
    mkdir(p: string): unknown;
    mount(type: unknown, opts: { root: string }, mountpoint: string): unknown;
    unmount(mountpoint: string): void;
  };
  NODEFS: unknown;
  /** Emscripten returns main()'s exit status; 7-Zip uses 0 for success. */
  callMain(args: string[]): number | undefined;
};

export interface ExtractOptions {
  /** Explicit `7zz.wasm` bytes. The extension passes the copy in `out/wasm/`. */
  wasmBinary?: ArrayBuffer;
}

/**
 * Extract `archivePath` into `extractDir`, which must already exist.
 *
 * Rejects if 7-Zip exits non-zero or aborts, with whatever it wrote to stderr.
 */
export async function extract7z(
  archivePath: string,
  extractDir: string,
  options: ExtractOptions = {}
): Promise<void> {
  const stderr: string[] = [];
  let aborted: string | undefined;

  // `7z-wasm` ships as an ES module. The extension host bundle is CommonJS, so
  // it is reached through a dynamic import, which webpack keeps as a real
  // import() rather than rewriting it to require().
  const factory = (await import('7z-wasm')).default as (
    opts?: Record<string, unknown>
  ) => Promise<SevenZipModule>;

  const sevenZip = await factory({
    // 7-Zip is chatty on stdout; the caller logs what matters. stderr is kept
    // so a failure carries 7-Zip's own diagnosis.
    print: () => {},
    printErr: (line: string) => {
      stderr.push(line);
    },
    // Without this an unreadable archive calls process.exit and takes the
    // extension host with it.
    noExitRuntime: true,
    quit: (_code: number, status: unknown) => {
      aborted = String(status);
    },
    ...(options.wasmBinary ? { wasmBinary: options.wasmBinary } : {}),
  });

  const archiveDir = path.dirname(path.resolve(archivePath));
  const archiveName = path.basename(archivePath);

  sevenZip.FS.mkdir('/archive');
  sevenZip.FS.mount(sevenZip.NODEFS, { root: archiveDir }, '/archive');
  sevenZip.FS.mkdir('/extract');
  sevenZip.FS.mount(sevenZip.NODEFS, { root: path.resolve(extractDir) }, '/extract');

  let status: number | undefined;
  try {
    // `x` keeps the stored directory structure; `-y` answers the overwrite
    // prompts that would otherwise block on stdin.
    status = sevenZip.callMain(['x', `/archive/${archiveName}`, '-o/extract', '-y']);
  } finally {
    // Unmount so NODEFS flushes, even when extraction threw.
    try {
      sevenZip.FS.unmount('/archive');
      sevenZip.FS.unmount('/extract');
    } catch {
      // A failed callMain can leave the FS where unmount throws; the module is
      // discarded either way, so this is not worth surfacing over the real error.
    }
  }

  if (aborted !== undefined || (status !== undefined && status !== 0)) {
    const detail = stderr.join('\n').trim();
    throw new Error(
      `7z extraction of ${archiveName} failed (exit ${status ?? aborted})${detail ? `: ${detail}` : ''}`
    );
  }
}
