import { detectFileTypeWithContent, parseFileData } from '../fileHandler';
import type { SpatialData } from '../interfaces';
import { messageBytes } from '../utils/messageBytes';

export interface FileDataMessage {
  type: 'fileData';
  fileName: string;
  data: Uint8Array | ArrayBuffer;
  shortPath?: string;
  isAddFile?: boolean;
}

/** Validate bytes and routing fields before invoking any decoder or opening UI. */
export function readFileDataMessage(value: unknown): FileDataMessage {
  if (!value || typeof value !== 'object') {throw new Error('Invalid file message');}
  const message = value as Record<string, unknown>;
  if (
    message.type !== 'fileData' ||
    typeof message.fileName !== 'string' ||
    !message.fileName ||
    !(message.data instanceof Uint8Array || message.data instanceof ArrayBuffer) ||
    (message.shortPath !== undefined && typeof message.shortPath !== 'string') ||
    (message.isAddFile !== undefined && typeof message.isAddFile !== 'boolean')
  ) {
    throw new Error('Invalid file message: expected a filename and binary data');
  }
  return message as unknown as FileDataMessage;
}

export async function decodeFileMessage(value: unknown): Promise<SpatialData> {
  const message = readFileDataMessage(value);
  const bytes = messageBytes(message.data);
  const category = await detectFileTypeWithContent(message.fileName, bytes);
  if (!category) {throw new Error(`Unsupported file: ${message.fileName}`);}
  const result = await parseFileData(bytes, category, message.fileName);
  if (result.type === 'jsonData') {throw new Error('JSON requires the pose/camera loader');}
  return {
    ...result.data,
    fileName: message.fileName,
    shortPath: message.shortPath,
    fileSizeInBytes: bytes.byteLength,
  };
}
