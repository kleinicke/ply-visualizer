/**
 * Surveyed ground truth for ScanArchive 2.x3a, supplied by the operator from
 * the instrument vendor's own registration.
 *
 * Written as displayed — row-major, the convention the viewer's matrix panel
 * uses — and transposed on load, so these can be checked against the UI by eye
 * without anyone having to hold a transpose in their head.
 */
// Keyed by full scan stem, matching the archive loader: dropping the prefix
// collides across archives that reuse numbering.
const ROW_MAJOR = {
  'NBL_NW_Innen_L1_0001': [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  'NBL_NW_Innen_L1_0000': [0.999994, -0.002892, 0.001839, 0.001635,
    0.002889, 0.999995, 0.001427, -0.004319,
    -0.001843, -0.001421, 0.999997, 0.001301, 0, 0, 0, 1],
  'NBL_NW_Innen_L1_0002': [0.999996, -0.002712, 0.000187, 0.001714,
    0.002711, 0.999996, 0.000971, -0.004556,
    -0.000189, -0.000971, 1.000000, 0.000262, 0, 0, 0, 1],
  'NBL_NW_Innen_L1_0003': [0.841440, 0.540349, -0.001037, 0.079946,
    -0.540349, 0.841441, 0.000307, -0.017895,
    0.001039, 0.000302, 0.999999, 0.002766, 0, 0, 0, 1],
  'NBL_NW_Innen_L1_0004': [0.841956, 0.539544, -0.001669, 0.079323,
    -0.539545, 0.841957, -0.000344, -0.017285,
    0.001219, 0.001190, 0.999999, 0.000276, 0, 0, 0, 1],
  'NBL_NW_Innen_L1_0005': [0.842833, 0.538174, -0.001037, -0.665420,
    -0.538175, 0.842829, -0.002750, 0.597996,
    -0.000607, 0.002876, 0.999996, -0.004324, 0, 0, 0, 1],
  'NBL_NW_Innen_L1_0006': [0.842792, 0.538238, -0.001178, -0.665745,
    -0.538239, 0.842786, -0.003261, 0.595614,
    -0.000763, 0.003382, 0.999994, -0.003620, 0, 0, 0, 1],
  'NBL_NW_Innen_L1_0007': [0.843051, 0.537832, -0.001373, -0.666002,
    -0.537834, 0.843044, -0.003486, 0.595566,
    -0.000717, 0.003677, 0.999993, -0.003905, 0, 0, 0, 1],
  'NBL_NW_Innen_L1_0008': [0.843183, 0.537626, -0.001187, -0.666276,
    -0.537625, 0.843171, -0.004624, 0.598174,
    -0.001485, 0.004537, 0.999989, -0.004209, 0, 0, 0, 1],
};

const transpose = m => {
  const out = new Array(16);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) out[c * 4 + r] = m[r * 4 + c];
  return out;
};

export const GROUND_TRUTH = Object.fromEntries(
  Object.entries(ROW_MAJOR).map(([id, m]) => [id, transpose(m)])
);
