import { DepthMetadata } from './types';

export async function tryParseSidecar(fileName: string, readText: (candidate: string) => Promise<string | null>): Promise<Partial<DepthMetadata>> {
  const stem = fileName.replace(/\.[^/.]+$/, '');
  const candidates = [
    `${stem}.json`,
    `${fileName}.json`,
  ];
  for (const c of candidates) {
    try {
      const text = await readText(c);
      if (!text) continue;
      const parsed = JSON.parse(text);
      return parsed as Partial<DepthMetadata>;
    } catch {
      // ignore
    }
  }
  return {};
}


