import type { ParseResult, UnifiedFileData } from '../fileHandler';

/**
 * One place that knows every input format.
 *
 * Adding a format used to mean editing three things that had to agree: the
 * `SUPPORTED_EXTENSIONS` category arrays, the `detectFileType` chain that reads
 * them, and a `switch (extension)` in `parseFileData`. Nothing enforced that
 * they stayed in sync, and the error messages listing supported formats were
 * built from yet another traversal of the same arrays.
 *
 * A format now registers once, here. Detection, the supported-extension lists
 * and parse dispatch are all derived from the same table.
 *
 * ## Known limit: single files, keyed by extension
 *
 * Dispatch is a map from extension to definition, and `parse` takes one
 * `Uint8Array`. That covers every format the viewer accepts today.
 *
 * It does *not* cover a directory. A COLMAP reconstruction is a folder
 * (`sparse/0/cameras.bin` plus an `images/` tree) with no extension to
 * dispatch on and no single buffer to parse, so adding it means giving
 * `FormatDefinition` a way to claim an input by inspecting a layout rather than
 * a filename, and giving `parse` a source it can read several files from.
 * That is deliberately not built ahead of its first user - but it is the reason
 * dispatch lives behind this interface instead of staying a `switch`.
 */

export type FileCategory = 'pointCloud' | 'mesh' | 'depthImage' | 'poseData';

export interface FormatParseContext {
  data: Uint8Array;
  fileName: string;
  /** The category detection settled on, after any `refineCategory` pass. */
  category: FileCategory;
  timingCallback?: (message: string) => void;
}

export interface FormatDefinition {
  /** Lowercase extensions, without the dot. */
  readonly extensions: readonly string[];
  readonly category: FileCategory;
  /**
   * Content sniffing that can move a file to a different category than its
   * extension implies. NPY is the only user: it holds either a depth image or
   * an XYZ point cloud, distinguishable only by array shape.
   */
  refineCategory?(data: Uint8Array): FileCategory | null;
  /**
   * Absent when something other than `parseFileData` decodes the format:
   * splat containers go through Spark (visualization/splatMode.ts) and depth
   * images through DepthRegistry, but both still need to be *recognised* here
   * so the file is accepted and routed.
   */
  parse?(context: FormatParseContext): Promise<ParseResult>;
}

export class FormatRegistry {
  private readonly definitions: FormatDefinition[] = [];
  private readonly byExtension = new Map<string, FormatDefinition>();

  register(definition: FormatDefinition): void {
    for (const extension of definition.extensions) {
      const existing = this.byExtension.get(extension);
      if (existing) {
        throw new Error(`Format extension "${extension}" is already registered`);
      }
      this.byExtension.set(extension, definition);
    }
    this.definitions.push(definition);
  }

  find(extension: string): FormatDefinition | null {
    return this.byExtension.get(extension.toLowerCase()) ?? null;
  }

  /** Every registered extension in a category, for messages and UI lists. */
  extensionsFor(category: FileCategory): string[] {
    return this.definitions
      .filter(definition => definition.category === category)
      .flatMap(definition => [...definition.extensions]);
  }

  allExtensions(): string[] {
    return [...this.byExtension.keys()];
  }

  has(extension: string): boolean {
    return this.byExtension.has(extension.toLowerCase());
  }
}

export const formats = new FormatRegistry();

/** Shared by the parsers that return a parser-specific shape. */
export type UnifiedConverter = (data: unknown, fileName: string) => UnifiedFileData;
