/// <reference types="node" />

import { Worker } from 'node:worker_threads';
import { cadWorkerSource } from '../models/cadWorkerSource';
import { isCadFormat, type CadResult, type CadFormat } from '../models/cadTypes';

/** Node-only transport for the same CAD conversion used by the website. */
export async function decodeCadInNode(
  bytes: Uint8Array,
  decoderPath: string,
  format: CadFormat
): Promise<CadResult> {
  if (!isCadFormat(format)) {throw new Error('Unsupported CAD format.');}
  const worker = new Worker(
    `
    const { parentPort, workerData } = require('node:worker_threads');
    const occtimportjs = require(workerData.decoderPath);
    const self = { postMessage: (data, transfers) => parentPort.postMessage(data, transfers) };
    ${cadWorkerSource}
    parentPort.on('message', data => self.onmessage({ data }));
  `,
    { eval: true, workerData: { decoderPath } }
  );
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await new Promise<CadResult>((resolve, reject) => {
      timeout = setTimeout(
        () => reject(new Error('CAD conversion exceeded two minutes.')),
        120_000
      );
      worker.once('message', message =>
        message.error ? reject(new Error(message.error)) : resolve(message.result)
      );
      worker.once('error', reject);
      worker.once('exit', code =>
        reject(new Error(`CAD decoder exited before returning geometry (${code}).`))
      );
      const copy = new Uint8Array(bytes);
      worker.postMessage({ bytes: copy, format }, [copy.buffer]);
    });
  } finally {
    clearTimeout(timeout);
    await worker.terminate();
  }
}
