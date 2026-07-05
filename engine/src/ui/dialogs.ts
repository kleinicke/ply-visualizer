export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function addTooltipsToTruncatedFilenames(): void {
  const fileNameLabels = document.querySelectorAll('.file-name');
  fileNameLabels.forEach(label => {
    const element = label as HTMLElement;
    // Always show short path (grandparent/parent/filename) in tooltip
    const shortPath = element.getAttribute('data-short-path');
    if (shortPath) {
      element.title = shortPath;
    } else if (element.scrollWidth > element.clientWidth) {
      // Fallback: if no short path, show full text when truncated
      element.title = element.textContent || '';
    } else {
      element.removeAttribute('title');
    }
  });
}
