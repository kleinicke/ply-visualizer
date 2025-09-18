#!/usr/bin/env python3
"""
Generate test files in all formats supported by Open3D
Creates point clouds and meshes for testing the PLY Visualizer extension
"""

import open3d as o3d
import numpy as np
import os

def _choose_2d_factors(n):
    """Pick two factors (p1, p2) close to sqrt(n) so that p1 * p2 == n."""
    if n <= 0:
        return 1, 1
    p1 = int(round(np.sqrt(n)))
    p1 = max(1, p1)
    while p1 > 1 and n % p1 != 0:
        p1 -= 1
    p2 = n // p1
    return p1, p2

def _choose_3d_factors(n):
    """Pick three factors (p1, p2, p3) close to cbrt/sqrt so that p1 * p2 * p3 == n."""
    if n <= 0:
        return 1, 1, 1
    p1 = int(round(n ** (1.0 / 3.0)))
    p1 = max(1, p1)
    while p1 > 1 and n % p1 != 0:
        p1 -= 1
    remaining = n // p1
    p2 = int(round(np.sqrt(remaining)))
    p2 = max(1, p2)
    while p2 > 1 and remaining % p2 != 0:
        p2 -= 1
    p3 = remaining // p2
    return p1, p2, p3

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

def create_mtl_file(mtl_path, mesh):
    """Create a basic MTL file for OBJ with average vertex color"""
    if not mesh.has_vertex_colors():
        return
    
    # Calculate average color from vertex colors
    colors = np.asarray(mesh.vertex_colors)
    avg_color = np.mean(colors, axis=0)
    
    with open(mtl_path, 'w') as f:
        f.write("# Generated MTL file\n")
        f.write("newmtl material0\n")
        f.write(f"Kd {avg_color[0]:.6f} {avg_color[1]:.6f} {avg_color[2]:.6f}\n")
        f.write("illum 1\n")

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

    # Additionally, write NumPy .npy arrays with trailing axis of size 3
    try:
        points = np.asarray(pcd.points)  # shape (P, 3)
        if points.ndim == 2 and points.shape[1] == 3:
            P = points.shape[0]

            # [P, 3]
            npy_p3 = os.path.join(output_dir, f"sample_pointcloud_{P}x3.npy")
            np.save(npy_p3, points)
            print(f"✓ Created {os.path.basename(npy_p3)}")

            # [p1, p2, 3]
            p1, p2 = _choose_2d_factors(P)
            arr_2d = points.reshape(p1, p2, 3)
            npy_2d = os.path.join(output_dir, f"sample_pointcloud_{p1}x{p2}x3.npy")
            np.save(npy_2d, arr_2d)
            print(f"✓ Created {os.path.basename(npy_2d)}")

            # [p1, p2, p3, 3]
            d1, d2, d3 = _choose_3d_factors(P)
            arr_3d = points.reshape(d1, d2, d3, 3)
            npy_3d = os.path.join(output_dir, f"sample_pointcloud_{d1}x{d2}x{d3}x3.npy")
            np.save(npy_3d, arr_3d)
            print(f"✓ Created {os.path.basename(npy_3d)}")
        else:
            print("✗ Point data is not in expected shape [P,3]; skipping .npy exports")
    except Exception as e:
        print(f"✗ Error creating .npy files: {e}")

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
                # Create MTL file manually when creating OBJ
                if format_name == 'obj':
                    mtl_path = filepath.replace('.obj', '.mtl')
                    if os.path.exists(mtl_path):
                        print(f"✓ Created {os.path.basename(mtl_path)} (material file)")
                    else:
                        # Create basic MTL file with vertex colors
                        create_mtl_file(mtl_path, mesh)
                        print(f"✓ Created {os.path.basename(mtl_path)} (generated material file)")
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