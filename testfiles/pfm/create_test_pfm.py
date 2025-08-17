#!/usr/bin/env python3
"""
Create a simple test PFM file for testing PFM to point cloud conversion
"""
import numpy as np
import struct

def create_test_pfm(filename, width=10, height=10):
    """Create a simple test PFM depth image"""
    
    # Create a simple depth pattern - a pyramid
    depths = np.zeros((height, width), dtype=np.float32)
    
    center_x, center_y = width // 2, height // 2
    max_dist = max(center_x, center_y)
    
    for y in range(height):
        for x in range(width):
            # Distance from center
            dist = max(abs(x - center_x), abs(y - center_y))
            # Create pyramid - closer to center = higher depth
            depths[y, x] = 1.0 + (max_dist - dist) * 0.5
    
    # PFM format:
    # - Header: "Pf\n" for grayscale
    # - Dimensions: "width height\n" 
    # - Scale: "-1.0\n" (negative = little endian)
    # - Binary data: height rows of width floats (bottom to top)
    
    with open(filename, 'wb') as f:
        # Write header
        f.write(b'Pf\n')
        f.write(f'{width} {height}\n'.encode('ascii'))
        f.write(b'-1.0\n')  # Negative scale = little endian
        
        # Write binary data (bottom to top)
        for y in range(height - 1, -1, -1):
            for x in range(width):
                f.write(struct.pack('<f', depths[y, x]))
    
    print(f"Created test PFM file: {filename}")
    print(f"Size: {width}x{height}")
    print(f"Depth range: {depths.min():.2f} - {depths.max():.2f}")

if __name__ == "__main__":
    create_test_pfm('test_depth.pfm', 20, 20)