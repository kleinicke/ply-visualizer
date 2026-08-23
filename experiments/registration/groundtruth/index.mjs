/**
 * Surveyed ground truth, as supplied by the operator from the vendor's own
 * registration. Row-major as displayed in the viewer, transposed on load.
 *
 * Coverage is partial on purpose: the operator sent the scans whose placement
 * they had reason to trust. Every metric here compares *relative* poses over
 * whatever subset is present, so a partial set still scores a full run — it
 * just scores fewer pairs.
 */
import { GROUND_TRUTH as SCANARCHIVE_2 } from './scanarchive2.mjs';

const transpose = m => {
  const out = new Array(16);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) out[c * 4 + r] = m[r * 4 + c];
  return out;
};
const rows = table => Object.fromEntries(Object.entries(table).map(([k, v]) => [k, transpose(v)]));

/** ScanArchive_2.x3a — the six scans that were misplacing. Three stations. */
const SCANARCHIVE_UNDERSCORE_2 = rows({
  'NK_Pf_J_0029': [0.966439, 0.241424, 0.087807, -0.088132,
    -0.235271, 0.969041, -0.074878, 2.266946,
    -0.103166, 0.051706, 0.993319, 0.326065, 0, 0, 0, 1],
  'NK_Pf_J_0030': [0.966570, 0.240735, 0.088257, -0.087935,
    -0.234516, 0.969194, -0.075267, 2.268421,
    -0.103657, 0.052053, 0.993250, 0.326319, 0, 0, 0, 1],
  'NK_Pf_J_0031': [0.921716, -0.379628, 0.079517, -13.101303,
    0.385210, 0.919912, -0.073317, -8.367518,
    -0.045315, 0.098208, 0.994134, 0.757247, 0, 0, 0, 1],
  'NK_Pf_J_0032': [0.921287, -0.380565, 0.080006, -13.102239,
    0.386200, 0.919486, -0.073453, -8.367921,
    -0.045611, 0.098570, 0.994084, 0.756082, 0, 0, 0, 1],
  'NK_Pf_J_0033': [0.854722, -0.513681, 0.074709, -2.463429,
    0.518350, 0.852283, -0.070186, -24.965131,
    -0.027620, 0.098715, 0.994732, -1.054287, 0, 0, 0, 1],
  'NK_Pf_J_0034': [0.854278, -0.514323, 0.075371, -2.466060,
    0.519046, 0.851890, -0.069817, -24.964492,
    -0.028300, 0.098764, 0.994708, -1.053588, 0, 0, 0, 1],
});

/**
 * ScanArchive2.x3a — two stations, 9.8 m apart.
 *
 * The operator listed three poses per station without saying which scan is
 * which within a station. That ambiguity is worth at most 4 mm: the three
 * "links" poses agree with each other to 3.2 mm and the three "linke_ecke"
 * poses to 0.9 mm, so any assignment within a station is correct to well
 * under the tolerances used here.
 */
const SCANARCHIVE_2_NOUNDERSCORE = rows({
  '200907_NBL_NW_links': [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  '200907_NBL_NW_links_0000': [1.000000, 0.000277, -0.000003, 0.001682,
    -0.000277, 1.000000, -0.000392, 0.001640,
    0.000003, 0.000392, 1.000000, -0.000045, 0, 0, 0, 1],
  '200907_NBL_NW_links_0001': [0.999996, -0.000867, 0.002658, 0.003164,
    0.000873, 0.999997, -0.002256, -0.000106,
    -0.002656, 0.002258, 0.999994, -0.000852, 0, 0, 0, 1],
  '200907_NBL_NW_linke_ecke_0000': [0.821607, -0.570001, -0.007735, 1.917957,
    0.570052, 0.821563, 0.008660, -9.606461,
    0.001419, -0.011524, 0.999933, -0.100984, 0, 0, 0, 1],
  '200907_NBL_NW_linke_ecke_0001': [0.821741, -0.569811, -0.007535, 1.917274,
    0.569860, 0.821694, 0.008821, -9.605771,
    0.001165, -0.011542, 0.999933, -0.100688, 0, 0, 0, 1],
  '200907_NBL_NW_linke_ecke_0002': [0.821058, -0.570805, -0.006717, 1.917255,
    0.570844, 0.821010, 0.008905, -9.606606,
    0.000432, -0.011146, 0.999938, -0.101243, 0, 0, 0, 1],
});

export const TRUTH = {
  'ScanArchive 2.x3a': SCANARCHIVE_2,
  'ScanArchive_2.x3a': SCANARCHIVE_UNDERSCORE_2,
  'ScanArchive2.x3a': SCANARCHIVE_2_NOUNDERSCORE,
};

export const truthFor = path => TRUTH[path.split('/').pop()] ?? null;
