// Shared conversion body for the browser worker and Node worker_threads.
// Each import gets a worker so its WASM heap is freed afterwards.
export const cadWorkerSource = `
self.onmessage = async ({ data }) => {
  try {
    const reader = { step: 'ReadStepFile', iges: 'ReadIgesFile', brep: 'ReadBrepFile' }[data.format];
    if (!reader) throw new Error('Unsupported CAD format.');
    const occt = await occtimportjs({ wasmBinary: data.wasmBinary });
    const result = occt[reader](data.bytes, {
      ...(data.format === 'brep' ? {} : { linearUnit: 'millimeter' }),
      linearDeflectionType: 'bounding_box_ratio',
      linearDeflection: 0.001,
      angularDeflection: 0.5
    });
    if (!result.success || !result.meshes?.length) {
      throw new Error(data.format.toUpperCase() + ' contains no supported solid or surface geometry, or could not be decoded.');
    }
    const buffers = [];
    for (const mesh of result.meshes) {
      mesh.attributes.position.array = new Float32Array(mesh.attributes.position.array);
      mesh.index.array = new Uint32Array(mesh.index.array);
      buffers.push(mesh.attributes.position.array.buffer, mesh.index.array.buffer);
      if (mesh.attributes.normal) {
        mesh.attributes.normal.array = new Float32Array(mesh.attributes.normal.array);
        buffers.push(mesh.attributes.normal.array.buffer);
      }
    }
    self.postMessage({ result }, buffers);
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};
`;
