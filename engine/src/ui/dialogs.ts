export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function filenameTooltip(shortPath: string, displayedName: string): string {
  const pathName = shortPath.split(/[\\/]/).filter(Boolean).pop() || shortPath;
  return !displayedName ||
    pathName.localeCompare(displayedName, undefined, { sensitivity: 'accent' }) === 0
    ? shortPath
    : `${shortPath} / ${displayedName}`;
}

export function addTooltipsToTruncatedFilenames(): void {
  const fileNameLabels = document.querySelectorAll('.file-name');
  fileNameLabels.forEach(label => {
    const element = label as HTMLElement;
    const displayedName = (element.textContent || '').trim();
    // Usually `shortPath` already ends in the displayed filename. Container
    // formats are different: an X3A path belongs to every row while each row
    // displays its embedded X3R member. Preserve the source archive as context,
    // but always include the actual row name the tooltip is revealing.
    const shortPath = element.getAttribute('data-short-path');
    if (shortPath) {
      element.title = filenameTooltip(shortPath, displayedName);
    } else if (element.scrollWidth > element.clientWidth) {
      // Fallback: if no short path, show full text when truncated
      element.title = displayedName;
    } else {
      element.removeAttribute('title');
    }
  });
}
