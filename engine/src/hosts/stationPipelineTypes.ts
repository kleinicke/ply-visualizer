export interface StationPipelineUpdate {
  /** `metadata.embeddedScanName`, the archive member this update belongs to. */
  scanName: string;
  /**
   * Set on a partial update: colours cover the scan's own points only, so the
   * host can send each scan as it finishes rather than the archive at the end.
   */
  partial?: boolean;
  /** Column-major 4x4 placing the scan in the archive's common frame. */
  transform: number[] | null;
  /** Present only when this scan's colour changed. */
  rawColors?: Uint8Array;
  frameIndices?: Uint16Array;
  photographicallyColoredPoints?: number;
}

export interface StationPipelineMessage {
  updates?: StationPipelineUpdate[];
  summary?: string;
  error?: string;
  /** A scan finished; more are still coming, so the run stays busy. */
  partial?: boolean;
  /** The user stopped the run; scans coloured so far keep their colour. */
  cancelled?: boolean;
}

export interface LoadTimeColorUpdate {
  scanName: string;
  colors: Uint8Array;
  /** The payload is raw camera RGB; derive corrected display RGB on completion. */
  colorsAreRaw?: boolean;
  /** Set when the colour arrives in chunks; absent means the whole scan. */
  pointOffset?: number;
  totalPoints?: number;
  /** True on the closing chunk, which is what makes the colour visible. */
  final?: boolean;
  /** Present on the scan that carries the archive's camera profile. */
  cameraFrames?: unknown[];
  rawColors?: Uint8Array | null;
  frameIndices?: Uint16Array | null;
  colorCalibration?: unknown;
  photographicallyColoredPoints?: number;
  container?: unknown;
}
