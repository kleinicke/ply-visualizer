export const DEFAULT_URL_HISTORY_LIMIT = 50;

/** Keep only usable strings, collapse duplicates, and retain the newest entries. */
export function normalizeUrlHistory(value: unknown, limit = DEFAULT_URL_HISTORY_LIMIT): string[] {
  if (!Array.isArray(value) || limit <= 0) {
    return [];
  }
  const unique: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') {
      continue;
    }
    const url = item.trim();
    if (!url) {
      continue;
    }
    const previous = unique.indexOf(url);
    if (previous >= 0) {
      unique.splice(previous, 1);
    }
    unique.push(url);
  }
  return unique.slice(-limit);
}

/** Add a URL as the newest entry without allowing repeated history rows. */
export function rememberUrl(
  history: readonly string[],
  url: string,
  limit = DEFAULT_URL_HISTORY_LIMIT
): string[] {
  return normalizeUrlHistory([...history, url], limit);
}

/**
 * Shell-style history traversal for a text field.
 *
 * The value present on the first Up press is retained as a draft. Moving Down
 * past the newest saved URL restores that exact draft instead of clearing it.
 */
export class UrlHistoryCursor {
  private index: number | null = null;
  private draft = '';

  constructor(private history: readonly string[]) {}

  setHistory(history: readonly string[]): void {
    this.history = history;
    this.reset();
  }

  reset(): void {
    this.index = null;
    this.draft = '';
  }

  previous(currentValue: string): string | null {
    if (this.history.length === 0) {
      return null;
    }
    if (this.index === null) {
      this.draft = currentValue;
      this.index = this.history.length - 1;
    } else {
      this.index = Math.max(0, this.index - 1);
    }
    return this.history[this.index];
  }

  next(): string | null {
    if (this.index === null) {
      return null;
    }
    if (this.index < this.history.length - 1) {
      this.index++;
      return this.history[this.index];
    }
    this.index = null;
    return this.draft;
  }
}
