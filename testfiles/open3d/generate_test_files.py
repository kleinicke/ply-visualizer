#!/usr/bin/env python3
"""
Generate test files in all formats supported by Open3D
Creates point clouds and meshes for testing the PLY Visualizer extension
"""

import open3d as o3d
import numpy as np
import os

def create_sample_point_cloud():
    """Create a sample point cloud with colors and normals"""
    # Create a sphere point cloud
    points = []
    colors = []
    normals = []
    
    # Generate points on a sphere
    for theta in np.linspace(0, 2*np.pi, 50):
        for phi in np.linspace(0, np.pi, 25):
            x = np.sin(phi) * np.cos(theta)
            y = np.sin(phi) * np.sin(theta) 
            z = np.cos(phi)
            
            points.append([x, y, z])
            
            # Color based on position
            r = (x + 1) / 2
            g = (y + 1) / 2
            b = (z + 1) / 2
            colors.append([r, g, b])
            
            # Normal is the same as position for a sphere
            normals.append([x, y, z])
    
    pcd = o3d.geometry.PointCloud()
    pcd.points = o3d.utility.Vector3dVector(np.array(points))
    pcd.colors = o3d.utility.Vector3dVector(np.array(colors))
    pcd.normals = o3d.utility.Vector3dVector(np.array(normals))
    
    return pcd

def create_sample_mesh():
    """Create a sample mesh (torus)"""
    mesh = o3d.geometry.TriangleMesh.create_torus(torus_radius=1.0, tube_radius=0.3)
    mesh.compute_vertex_normals()
    
    # Add colors to vertices
    vertices = np.asarray(mesh.vertices)
    colors = np.zeros_like(vertices)
    colors[:, 0] = (vertices[:, 0] + 1.5) / 3.0  # Red channel
    colors[:, 1] = (vertices[:, 1] + 1.5) / 3.0  # Green channel  
    colors[:, 2] = (vertices[:, 2] + 0.5) / 1.0  # Blue channel
    
    mesh.vertex_colors = o3d.utility.Vector3dVector(colors)
    
    return mesh

def generate_point_cloud_files(pcd, output_dir):
    """Generate point cloud files in all supported formats"""
    formats = {
        'ply': 'sample_pointcloud.ply',
        'pcd': 'sample_pointcloud.pcd',
        'xyz': 'sample_pointcloud.xyz',
        'xyzn': 'sample_pointcloud.xyzn', 
        'xyzrgb': 'sample_pointcloud.xyzrgb',
        'pts': 'sample_pointcloud.pts'
    }
    
    print("Generating point cloud files...")
    for format_name, filename in formats.items():
        filepath = os.path.join(output_dir, filename)
        try:
            success = o3d.io.write_point_cloud(filepath, pcd)
            if success:
                print(f"✓ Created {filename}")
            else:
                print(f"✗ Failed to create {filename}")
        except Exception as e:
            print(f"✗ Error creating {filename}: {e}")

def generate_mesh_files(mesh, output_dir):
    """Generate mesh files in all supported formats"""
    formats = {
        'ply': 'sample_mesh.ply',
        'stl': 'sample_mesh.stl', 
        'obj': 'sample_mesh.obj',
        'off': 'sample_mesh.off',
        'gltf': 'sample_mesh.gltf',
        'glb': 'sample_mesh.glb'
    }
    
    print("Generating mesh files...")
    for format_name, filename in formats.items():
        filepath = os.path.join(output_dir, filename)
        try:
            success = o3d.io.write_triangle_mesh(filepath, mesh)
            if success:
                print(f"✓ Created {filename}")
            else:
                print(f"✗ Failed to create {filename}")
        except Exception as e:
            print(f"✗ Error creating {filename}: {e}")

def main():
    # Create output directory
    output_dir = os.path.dirname(os.path.abspath(__file__))
    
    print("Open3D File Format Generator")
    print("============================")
    print(f"Output directory: {output_dir}")
    print()
    
    # Create sample geometries
    print("Creating sample point cloud...")
    pcd = create_sample_point_cloud()
    
    print("Creating sample mesh...")  
    mesh = create_sample_mesh()
    
    print()
    
    # Generate all file formats
    generate_point_cloud_files(pcd, output_dir)
    print()
    generate_mesh_files(mesh, output_dir)
    
    print()
    print("File generation complete!")
    
    # List generated files
    generated_files = [f for f in os.listdir(output_dir) if f.startswith('sample_')]
    print(f"Generated {len(generated_files)} files:")
    for filename in sorted(generated_files):
        filepath = os.path.join(output_dir, filename)
        size = os.path.getsize(filepath)
        print(f"  {filename} ({size} bytes)")

if __name__ == "__main__":
    main()