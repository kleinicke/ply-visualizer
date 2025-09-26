#!/usr/bin/env python3
"""
Create test PNG depth images for testing the 3D Visualizer PNG depth support.
"""

import numpy as np
from PIL import Image
import os

def create_test_depth_png():
    """Create test depth PNG files with different formats and interpretations."""
    
    # Create output directory
    output_dir = "testfiles"
    os.makedirs(output_dir, exist_ok=True)
    
    # Test image dimensions
    width, height = 100, 100
    
    # 1. Create 16-bit depth map in millimeters (0-5000mm = 0-5m)
    depth_mm = np.zeros((height, width), dtype=np.uint16)
    for y in range(height):
        for x in range(width):
            # Create a gradient from 500mm to 5000mm
            distance = 500 + (4500 * (x + y)) // (width + height)
            depth_mm[y, x] = distance
    
    # Save as 16-bit PNG
    img_16bit = Image.fromarray(depth_mm, mode='I;16')
    img_16bit.save(os.path.join(output_dir, "test_depth_16bit_mm.png"))
    print(f"Created 16-bit depth PNG (millimeters): {np.min(depth_mm)}-{np.max(depth_mm)}mm")
    
    # 2. Create disparity map (scaled by 256)
    disparity_raw = np.zeros((height, width), dtype=np.uint16)
    for y in range(height):
        for x in range(width):
            # Create disparity values that need to be divided by 256
            disp_val = 256 + (1000 * (x + y)) // (width + height)  # Values 256-1256
            disparity_raw[y, x] = disp_val
    
    img_disp = Image.fromarray(disparity_raw, mode='I;16')
    img_disp.save(os.path.join(output_dir, "test_disparity_256.png"))
    print(f"Created disparity PNG (div by 256): {np.min(disparity_raw)}-{np.max(disparity_raw)}")
    
    # 3. Create depth map in meters (scaled by 1000)
    depth_m_scaled = np.zeros((height, width), dtype=np.uint16)
    for y in range(height):
        for x in range(width):
            # Depth values 0.5m to 5m, scaled by 1000
            depth_val = 500 + (4500 * (x + y)) // (width + height)
            depth_m_scaled[y, x] = depth_val
    
    img_m = Image.fromarray(depth_m_scaled, mode='I;16')
    img_m.save(os.path.join(output_dir, "test_depth_meters_1000.png"))
    print(f"Created depth PNG (meters x1000): {np.min(depth_m_scaled)}-{np.max(depth_m_scaled)}")
    
    # 4. Create 8-bit test image for comparison
    depth_8bit = (depth_mm / 256).astype(np.uint8)
    img_8bit = Image.fromarray(depth_8bit, mode='L')
    img_8bit.save(os.path.join(output_dir, "test_depth_8bit.png"))
    print(f"Created 8-bit depth PNG: {np.min(depth_8bit)}-{np.max(depth_8bit)}")
    
    # 5. Create depth map with invalid pixels (0 values)
    depth_with_invalid = depth_mm.copy()
    # Set some pixels to 0 (invalid)
    for i in range(0, height, 10):
        for j in range(0, width, 10):
            depth_with_invalid[i:i+2, j:j+2] = 0
    
    img_invalid = Image.fromarray(depth_with_invalid, mode='I;16')
    img_invalid.save(os.path.join(output_dir, "test_depth_with_invalid.png"))
    print(f"Created depth PNG with invalid pixels (0 values)")
    
    print(f"\nTest PNG files created in {output_dir}/")
    print("Use these files to test PNG depth support in 3D Visualizer:")
    print("- test_depth_16bit_mm.png: 16-bit depth in millimeters")
    print("- test_disparity_256.png: Disparity values (divide by 256)")
    print("- test_depth_meters_1000.png: Depth in meters (divide by 1000)")
    print("- test_depth_8bit.png: 8-bit depth for comparison")
    print("- test_depth_with_invalid.png: Depth with invalid pixels (0)")

if __name__ == "__main__":
    create_test_depth_png()