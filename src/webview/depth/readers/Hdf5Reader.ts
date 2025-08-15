import { DepthReader, DepthReaderResult, DepthImage, DepthMetadata } from '../types';

// HDF5 reader using h5wasm library
export class Hdf5Reader implements DepthReader {
  canRead(filename: string): boolean {
    return filename.toLowerCase().endsWith('.h5') || filename.toLowerCase().endsWith('.hdf5');
  }

  async read(arrayBuffer: ArrayBuffer): Promise<DepthReaderResult> {
    // Check if we have h5wasm available
    if (typeof (window as any).h5wasm !== 'undefined') {
      return this.readWithH5Wasm(arrayBuffer);
    }
    
    // Fallback: try to detect common patterns and provide helpful error
    throw new Error(
      'HDF5 support requires h5wasm library. ' +
      'This file appears to contain multi-camera calibration data and image frames, not depth maps. ' +
      'To view depth data, please save as NPY/NPZ, MAT v5, or TIFF format.'
    );
  }

  private async readWithH5Wasm(arrayBuffer: ArrayBuffer): Promise<DepthReaderResult> {
    const h5wasm = (window as any).h5wasm;
    
    try {
      // Wait for h5wasm to be ready
      await h5wasm.ready;
      
      // Create a temporary file from the array buffer
      const tempFilename = `temp_${Date.now()}.h5`;
      const fs = h5wasm.Module.FS;
      
      // Write the array buffer to the virtual filesystem
      const uint8Array = new Uint8Array(arrayBuffer);
      fs.writeFile(tempFilename, uint8Array);
      
      // Open the HDF5 file
      const file = new h5wasm.File(tempFilename, 'r');
      
      try {
        // Look for common depth dataset names
        const depthDatasetNames = [
          'depth', 'depth_map', 'depthmap', 'z', 'disparity', 'inv_depth',
          'depth_data', 'depth_values', 'range', 'distance'
        ];
        
        let depthDataset: any = null;
        let datasetName = '';
        
        // First, try to find a direct depth dataset
        for (const name of depthDatasetNames) {
          try {
            const dataset = file.get(name);
            if (dataset && dataset.shape && dataset.shape.length === 2) {
              depthDataset = dataset;
              datasetName = name;
              break;
            }
          } catch (e) {
            // Dataset doesn't exist, continue
          }
        }
        
        // If no direct depth dataset found, look for any 2D float dataset
        if (!depthDataset) {
          const datasets = this.findAllDatasets(file);
          for (const [name, dataset] of datasets) {
            if (dataset.shape && dataset.shape.length === 2 && 
                (dataset.dtype === 'float32' || dataset.dtype === 'float64')) {
              depthDataset = dataset;
              datasetName = name;
              break;
            }
          }
        }
        
        if (!depthDataset) {
          throw new Error(
            'No depth dataset found in HDF5 file. ' +
            'This file contains: ' + this.describeFileStructure(file)
          );
        }
        
        // Extract the depth data
        const data = depthDataset.value;
        const shape = depthDataset.shape;
        if (!shape || shape.length !== 2) {
          throw new Error(`Dataset ${datasetName} is not 2D: ${shape}`);
        }
        
        const [height, width] = shape;
        
        // Convert to Float32Array
        let depthData: Float32Array;
        if (data instanceof Float32Array) {
          depthData = data;
        } else if (data instanceof Float64Array) {
          depthData = new Float32Array(data);
        } else if (data instanceof Uint16Array || data instanceof Uint32Array || data instanceof Int32Array) {
          // Convert integer data to float
          depthData = new Float32Array(data.length);
          for (let i = 0; i < data.length; i++) {
            depthData[i] = data[i];
          }
        } else {
          throw new Error(`Unsupported data type: ${depthDataset.dtype}`);
        }
        
        // Create depth image
        const image: DepthImage = { width, height, data: depthData };
        
        // Determine metadata based on dataset name and data characteristics
        const meta: DepthMetadata = this.inferMetadata(datasetName, depthData);
        
        return { image, meta };
        
      } finally {
        // Clean up
        file.close();
        // Remove temporary file
        try {
          fs.unlink(tempFilename);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      
    } catch (error) {
      throw new Error(`Failed to read HDF5 file: ${error}`);
    }
  }
  
  private findAllDatasets(group: any): [string, any][] {
    const datasets: [string, any][] = [];
    
    const traverse = (currentGroup: any, path: string = '') => {
      for (const key of currentGroup.keys()) {
        const fullPath = path ? `${path}/${key}` : key;
        try {
          const item = currentGroup.get(key);
          if (item && item.shape) {
            datasets.push([fullPath, item]);
          } else if (item && item.keys) {
            // It's a group, traverse recursively
            traverse(item, fullPath);
          }
        } catch (e) {
          // Skip items we can't access
        }
      }
    };
    
    traverse(group);
    return datasets;
  }
  
  private describeFileStructure(group: any): string {
    try {
      const datasets = this.findAllDatasets(group);
      const descriptions = datasets.map(([name, dataset]) => 
        `${name} (${dataset.shape?.join('x') || 'unknown'}, ${dataset.dtype || 'unknown'})`
      );
      return descriptions.join(', ') || 'no datasets';
    } catch (e) {
      return 'unknown structure';
    }
  }
  
  private inferMetadata(datasetName: string, data: Float32Array): DepthMetadata {
    // Infer metadata based on dataset name and data characteristics
    let kind: 'depth' | 'disparity' | 'inv_depth' | 'z' = 'depth';
    let unit: 'meter' | 'millimeter' = 'meter';
    let scale = 1;
    
    // Determine kind from dataset name
    if (datasetName.includes('disparity')) {
      kind = 'disparity';
    } else if (datasetName.includes('inv_depth') || datasetName.includes('inverse')) {
      kind = 'inv_depth';
    } else if (datasetName.includes('z')) {
      kind = 'z';
    }
    
    // Determine unit and scale from data range
    const validData = data.filter(x => !isNaN(x) && isFinite(x));
    if (validData.length > 0) {
      const min = Math.min(...validData);
      const max = Math.max(...validData);
      
      // If values are very large (>1000), likely millimeters
      if (max > 1000 && kind === 'depth') {
        unit = 'millimeter';
        scale = 0.001; // Convert mm to meters
      }
      // If values are very small (<0.1), might need scaling
      else if (max < 0.1 && kind === 'depth') {
        scale = 1000; // Convert to meters
      }
    }
    
    return { kind, unit, scale };
  }
}



