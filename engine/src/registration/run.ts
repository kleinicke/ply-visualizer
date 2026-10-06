import type { RegistrationWasm } from './wasmLoader';
import type { RegistrationKind } from './registrationWorker';

/** Copy the result before releasing the Rust allocation. */
export function runRegistration(
  wasm: RegistrationWasm,
  kind: RegistrationKind,
  source: Float32Array,
  target: Float32Array,
  settingsJson: string
): { matrix: Float64Array; stats: string } | null {
  const result =
    kind === 'register'
      ? wasm.register_pair(source, target, settingsJson)
      : kind === 'coarse'
        ? wasm.coarse_align(source, target, settingsJson)
        : kind === 'icp'
          ? wasm.icp_refine(source, target, settingsJson)
          : wasm.fit_correspondences(source, target);
  if (!result) {
    return null;
  }
  try {
    return { matrix: result.matrix, stats: result.stats };
  } finally {
    result.free?.();
  }
}
