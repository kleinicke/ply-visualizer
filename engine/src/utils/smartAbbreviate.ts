/**
 * Shortens a set of names by collapsing the parts they all share, wherever
 * those parts are — not just a common prefix or suffix.
 *
 *   test_param=1.ply, test_param=2.ply  ->  …param=1, …param=2
 *   run3_lr=0.1_final.ply, run4_lr=0.1_final.ply -> …3…, …4…
 *   (a key=value key is kept whenever its value differs)
 *   scan_A_v1.ply, scan_B_v2.ply -> …A…1, …B…2
 *
 * Names are split into tokens (letter runs, digit runs, single separators),
 * the token sequence common to every name is found with an iterated LCS, and
 * each maximal run of common tokens becomes "…". A trailing common run that
 * is only a file extension is dropped instead, since "….ply" says nothing.
 * Common runs shorter than `minRun` characters are kept: collapsing "_" into
 * "…" would make names longer, not shorter.
 */
const ELLIPSIS = '…';

export function tokenize(name: string): string[] {
  // Decimals stay whole: 0.01 vs 0.05 must not become "01" vs "05".
  return name.match(/[A-Za-z]+|[0-9]+(?:\.[0-9]+)*(?![A-Za-z])|[0-9]+|[^A-Za-z0-9]/g) ?? [];
}

function lcs(a: string[], b: string[]): string[] {
  const n = a.length;
  const m = b.length;
  const dp: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: string[] = [];
  for (let i = 0, j = 0; i < n && j < m;) {
    if (a[i] === b[j]) {
      out.push(a[i]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }
  return out;
}

/** Marks which tokens of `tokens` align with the common sequence. */
function alignCommon(tokens: string[], common: string[]): boolean[] {
  const n = tokens.length;
  const m = common.length;
  const dp: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        tokens[i] === common[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const marks = new Array<boolean>(n).fill(false);
  for (let i = 0, j = 0; i < n && j < m;) {
    if (tokens[i] === common[j] && dp[i][j] === dp[i + 1][j + 1] + 1) {
      marks[i] = true;
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }
  return marks;
}

export function smartAbbreviate(names: readonly string[], minRun = 3): string[] {
  if (names.length < 2) {
    return [...names];
  }
  const tokenized = names.map(tokenize);
  let common = tokenized[0];
  for (let i = 1; i < tokenized.length && common.length; i++) {
    common = lcs(common, tokenized[i]);
  }
  if (!common.length) {
    return [...names];
  }
  return tokenized.map((tokens, index) => {
    const marks = alignCommon(tokens, common);
    // key=value: when the value differs, the key is what makes it readable,
    // so keep "noise=" in front of "0.01" even though every name has it.
    for (let i = 1; i + 1 < tokens.length; i++) {
      if (tokens[i] === '=' && marks[i] && !marks[i + 1]) {
        marks[i] = false;
        if (marks[i - 1] && /^[A-Za-z0-9]/.test(tokens[i - 1])) {
          marks[i - 1] = false;
        }
      }
    }
    let out = '';
    for (let i = 0; i < tokens.length;) {
      if (!marks[i]) {
        out += tokens[i++];
        continue;
      }
      let j = i;
      let run = '';
      while (j < tokens.length && marks[j]) {
        run += tokens[j++];
      }
      const trailing = j === tokens.length;
      if (trailing && /^\.[A-Za-z0-9]+$/.test(run)) {
        // just the extension
      } else if (run.length < minRun) {
        out += run;
      } else if (!out.endsWith(ELLIPSIS)) {
        out += ELLIPSIS;
      }
      i = j;
    }
    // Identical names (or nothing distinctive) keep their full form.
    return out.replace(new RegExp(ELLIPSIS, 'g'), '').trim() ? out : names[index];
  });
}
