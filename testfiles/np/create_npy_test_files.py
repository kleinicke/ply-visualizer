#!/usr/bin/env python3
"""
Create test NPY and NPZ files with depth data for the PLY visualizer
"""
import numpy as np
import os

def create_test_npy_files():
    """Create test NPY and NPZ files with synthetic depth data"""
    
    # Create a synthetic depth image (640x480)
    width, height = 640, 480
    
    # Create a gradient depth map simulating a simple scene
    x = np.linspace(0, 1, width)
    y = np.linspace(0, 1, height)
    X, Y = np.meshgrid(x, y)
    
    # Create depth data - closer in center, farther at edges
    depth_data = 1.0 + 2.0 * np.sqrt((X - 0.5)**2 + (Y - 0.5)**2)
    
    # Add some noise to make it more realistic
    noise = np.random.normal(0, 0.05, depth_data.shape)
    depth_data += noise
    
    # Ensure positive depth values
    depth_data = np.maximum(depth_data, 0.1)
    
    # Convert to float32 for consistency with other depth formats
    depth_data = depth_data.astype(np.float32)
    
    # Save as NPY file
    np.save('test_depth.npy', depth_data)
    print(f"Created test_depth.npy with shape {depth_data.shape}")
    
    # Create a disparity map (inverse depth relationship)
    # Disparity = baseline * focal_length / depth
    baseline = 0.1  # 10cm baseline
    focal_length = 525.0  # typical focal length in pixels
    disparity_data = (baseline * focal_length) / depth_data
    disparity_data = disparity_data.astype(np.float32)
    
    # Save as NPY file
    np.save('test_disparity.npy', disparity_data)
    print(f"Created test_disparity.npy with shape {disparity_data.shape}")
    
    # Create NPZ file with multiple arrays and metadata
    camera_params = {
        'fx': 525.0,
        'fy': 525.0,
        'cx': width / 2.0,
        'cy': height / 2.0,
        'baseline': baseline,
        'width': width,
        'height': height
    }
    
    # Save as NPZ file with metadata
    np.savez('test_depth_with_params.npz', 
             depth=depth_data,
             disparity=disparity_data,
             **camera_params)
    print(f"Created test_depth_with_params.npz with depth and camera parameters")
    
    # Create a smaller test file for faster loading during development
    small_depth = depth_data[::4, ::4]  # Downsample by 4x
    np.save('test_depth_small.npy', small_depth)
    print(f"Created test_depth_small.npy with shape {small_depth.shape}")
    
    print("\nTest files created successfully!")
    print("Files:")
    for filename in ['test_depth.npy', 'test_disparity.npy', 'test_depth_with_params.npz', 'test_depth_small.npy']:
        if os.path.exists(filename):
            size = os.path.getsize(filename)
            print(f"  {filename}: {size/1024:.1f} KB")

if __name__ == '__main__':
    create_test_npy_files()