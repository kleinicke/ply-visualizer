export type ExportFile = (name: string, blob: Blob) => Promise<boolean>;
let hostExport: ExportFile | undefined;

/** Hosts may supply native saving; browser and IDE downloads remain the default. */
export function setExportFileHost(save: ExportFile): void {
  hostExport = save;
}

export async function exportFile(name: string, blob: Blob): Promise<boolean> {
  if (hostExport) {return hostExport(name, blob);}
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return true;
}

export function exportWithStatus(
  name: string,
  blob: Blob,
  status: (message: string) => void
): void {
  void exportFile(name, blob)
    .then(saved => status(saved ? `Export requested: ${name}` : 'Export cancelled'))
    .catch(error =>
      status(`Export failed: ${error instanceof Error ? error.message : String(error)}`)
    );
}
