#!/usr/bin/env python3
"""
Script to create comprehensive STL test files demonstrating various STL features:
1. Binary STL with basic geometry (tetrahedron)
2. Binary STL with color information (colored cube)
3. Complex mesh (subdivided sphere)
"""

import struct
import math
import numpy as np

def write_binary_stl(filename, triangles, header="Generated STL"):
    """Write triangles to binary STL format"""
    with open(filename, 'wb') as f:
        # Write 80-byte header
        header_bytes = header.encode('utf-8')[:80]
        header_bytes = header_bytes.ljust(80, b'\0')
        f.write(header_bytes)
        
        # Write triangle count (4 bytes, little endian)
        f.write(struct.pack('<I', len(triangles)))
        
        # Write triangles
        for triangle in triangles:
            normal = triangle['normal']
            vertices = triangle['vertices']
            color = triangle.get('color', None)
            
            # Write normal (3 floats, 12 bytes)
            f.write(struct.pack('<fff', normal[0], normal[1], normal[2]))
            
            # Write vertices (9 floats, 36 bytes)
            for vertex in vertices:
                f.write(struct.pack('<fff', vertex[0], vertex[1], vertex[2]))
            
            # Write attribute bytes (2 bytes)
            if color:
                # Encode RGB color in RGB565 format
                r = min(31, int(color[0] * 31 / 255))
                g = min(63, int(color[1] * 63 / 255))
                b = min(31, int(color[2] * 31 / 255))
                color_packed = (r << 11) | (g << 5) | b
                f.write(struct.pack('<H', color_packed))
            else:
                f.write(struct.pack('<H', 0))

def calculate_normal(v1, v2, v3):
    """Calculate normal vector for triangle"""
    u = np.array(v2) - np.array(v1)
    v = np.array(v3) - np.array(v1)
    normal = np.cross(u, v)
    length = np.linalg.norm(normal)
    if length > 0:
        normal = normal / length
    return normal.tolist()

def create_tetrahedron():
    """Create a simple tetrahedron"""
    # Tetrahedron vertices
    v1 = [0.0, 0.0, 0.0]
    v2 = [1.0, 0.0, 0.0]
    v3 = [0.5, 0.866, 0.0]
    v4 = [0.5, 0.289, 0.816]
    
    triangles = []
    
    # Face 1: v1, v2, v3
    normal = calculate_normal(v1, v2, v3)
    triangles.append({
        'normal': normal,
        'vertices': [v1, v2, v3]
    })
    
    # Face 2: v1, v3, v4
    normal = calculate_normal(v1, v3, v4)
    triangles.append({
        'normal': normal,
        'vertices': [v1, v3, v4]
    })
    
    # Face 3: v1, v4, v2
    normal = calculate_normal(v1, v4, v2)
    triangles.append({
        'normal': normal,
        'vertices': [v1, v4, v2]
    })
    
    # Face 4: v2, v4, v3
    normal = calculate_normal(v2, v4, v3)
    triangles.append({
        'normal': normal,
        'vertices': [v2, v4, v3]
    })
    
    return triangles

def create_colored_cube():
    """Create a cube with different colors on each face"""
    # Cube vertices
    vertices = [
        [0.0, 0.0, 0.0],  # 0
        [1.0, 0.0, 0.0],  # 1
        [1.0, 1.0, 0.0],  # 2
        [0.0, 1.0, 0.0],  # 3
        [0.0, 0.0, 1.0],  # 4
        [1.0, 0.0, 1.0],  # 5
        [1.0, 1.0, 1.0],  # 6
        [0.0, 1.0, 1.0]   # 7
    ]
    
    # Define faces with colors (RGB)
    faces = [
        # Bottom face (z=0) - Red
        ([vertices[0], vertices[1], vertices[2]], [255, 0, 0]),
        ([vertices[0], vertices[2], vertices[3]], [255, 0, 0]),
        
        # Top face (z=1) - Green
        ([vertices[4], vertices[7], vertices[6]], [0, 255, 0]),
        ([vertices[4], vertices[6], vertices[5]], [0, 255, 0]),
        
        # Front face (y=0) - Blue
        ([vertices[0], vertices[4], vertices[5]], [0, 0, 255]),
        ([vertices[0], vertices[5], vertices[1]], [0, 0, 255]),
        
        # Back face (y=1) - Yellow
        ([vertices[2], vertices[6], vertices[7]], [255, 255, 0]),
        ([vertices[2], vertices[7], vertices[3]], [255, 255, 0]),
        
        # Left face (x=0) - Magenta
        ([vertices[0], vertices[3], vertices[7]], [255, 0, 255]),
        ([vertices[0], vertices[7], vertices[4]], [255, 0, 255]),
        
        # Right face (x=1) - Cyan
        ([vertices[1], vertices[5], vertices[6]], [0, 255, 255]),
        ([vertices[1], vertices[6], vertices[2]], [0, 255, 255]),
    ]
    
    triangles = []
    for face_vertices, color in faces:
        normal = calculate_normal(face_vertices[0], face_vertices[1], face_vertices[2])
        triangles.append({
            'normal': normal,
            'vertices': face_vertices,
            'color': color
        })
    
    return triangles

def create_subdivided_sphere(radius=1.0, subdivisions=2):
    """Create a subdivided icosphere"""
    # Start with icosahedron vertices
    phi = (1.0 + math.sqrt(5.0)) / 2.0  # Golden ratio
    
    vertices = [
        [-1,  phi,  0], [1,  phi,  0], [-1, -phi,  0], [1, -phi,  0],
        [ 0, -1,  phi], [0,  1,  phi], [ 0, -1, -phi], [0,  1, -phi],
        [ phi,  0, -1], [phi,  0,  1], [-phi,  0, -1], [-phi,  0,  1]
    ]
    
    # Normalize vertices to sphere surface
    for i, v in enumerate(vertices):
        length = math.sqrt(v[0]**2 + v[1]**2 + v[2]**2)
        vertices[i] = [v[0]/length * radius, v[1]/length * radius, v[2]/length * radius]
    
    # Icosahedron faces
    faces = [
        [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
        [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
        [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
        [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]
    ]
    
    # Subdivide faces
    for _ in range(subdivisions):
        new_faces = []
        edge_vertices = {}
        
        def get_middle_vertex(v1_idx, v2_idx):
            key = tuple(sorted([v1_idx, v2_idx]))
            if key not in edge_vertices:
                v1 = vertices[v1_idx]
                v2 = vertices[v2_idx]
                middle = [(v1[0] + v2[0]) / 2, (v1[1] + v2[1]) / 2, (v1[2] + v2[2]) / 2]
                # Normalize to sphere surface
                length = math.sqrt(middle[0]**2 + middle[1]**2 + middle[2]**2)
                middle = [middle[0]/length * radius, middle[1]/length * radius, middle[2]/length * radius]
                edge_vertices[key] = len(vertices)
                vertices.append(middle)
            return edge_vertices[key]
        
        for face in faces:
            v1, v2, v3 = face
            a = get_middle_vertex(v1, v2)
            b = get_middle_vertex(v2, v3)
            c = get_middle_vertex(v3, v1)
            
            new_faces.extend([
                [v1, a, c], [v2, b, a], [v3, c, b], [a, b, c]
            ])
        
        faces = new_faces
    
    # Convert to triangles with normals
    triangles = []
    for face in faces:
        v1, v2, v3 = [vertices[i] for i in face]
        normal = calculate_normal(v1, v2, v3)
        triangles.append({
            'normal': normal,
            'vertices': [v1, v2, v3]
        })
    
    return triangles

def create_complex_mesh():
    """Create a more complex mesh (torus)"""
    major_radius = 2.0
    minor_radius = 0.5
    major_segments = 16
    minor_segments = 8
    
    vertices = []
    for i in range(major_segments):
        major_angle = 2 * math.pi * i / major_segments
        for j in range(minor_segments):
            minor_angle = 2 * math.pi * j / minor_segments
            
            x = (major_radius + minor_radius * math.cos(minor_angle)) * math.cos(major_angle)
            y = (major_radius + minor_radius * math.cos(minor_angle)) * math.sin(major_angle)
            z = minor_radius * math.sin(minor_angle)
            
            vertices.append([x, y, z])
    
    triangles = []
    for i in range(major_segments):
        for j in range(minor_segments):
            # Current quad indices
            v1 = i * minor_segments + j
            v2 = i * minor_segments + (j + 1) % minor_segments
            v3 = ((i + 1) % major_segments) * minor_segments + (j + 1) % minor_segments
            v4 = ((i + 1) % major_segments) * minor_segments + j
            
            # Create two triangles from quad
            triangle1_vertices = [vertices[v1], vertices[v2], vertices[v3]]
            normal1 = calculate_normal(triangle1_vertices[0], triangle1_vertices[1], triangle1_vertices[2])
            triangles.append({
                'normal': normal1,
                'vertices': triangle1_vertices
            })
            
            triangle2_vertices = [vertices[v1], vertices[v3], vertices[v4]]
            normal2 = calculate_normal(triangle2_vertices[0], triangle2_vertices[1], triangle2_vertices[2])
            triangles.append({
                'normal': normal2,
                'vertices': triangle2_vertices
            })
    
    return triangles

def main():
    print("Creating STL test files...")
    
    # 1. Simple tetrahedron (binary)
    print("Creating test_tetrahedron_binary.stl...")
    tetrahedron = create_tetrahedron()
    write_binary_stl("test_tetrahedron_binary.stl", tetrahedron, "Binary Tetrahedron Test")
    
    # 2. Colored cube (binary with colors)
    print("Creating test_colored_cube_binary.stl...")
    colored_cube = create_colored_cube()
    write_binary_stl("test_colored_cube_binary.stl", colored_cube, "Colored Cube with RGB565")
    
    # 3. Subdivided sphere (many triangles)
    print("Creating test_sphere_subdivided.stl...")
    sphere = create_subdivided_sphere(radius=1.5, subdivisions=3)
    write_binary_stl("test_sphere_subdivided.stl", sphere, f"Subdivided Sphere - {len(sphere)} triangles")
    
    # 4. Complex torus mesh
    print("Creating test_torus_complex.stl...")
    torus = create_complex_mesh()
    write_binary_stl("test_torus_complex.stl", torus, f"Torus Mesh - {len(torus)} triangles")
    
    print(f"Created 4 binary STL test files:")
    print(f"  - test_tetrahedron_binary.stl ({len(tetrahedron)} triangles)")
    print(f"  - test_colored_cube_binary.stl ({len(colored_cube)} triangles)")
    print(f"  - test_sphere_subdivided.stl ({len(sphere)} triangles)")
    print(f"  - test_torus_complex.stl ({len(torus)} triangles)")
    print(f"Plus the existing ASCII file:")
    print(f"  - test_cube_ascii.stl (12 triangles)")

if __name__ == "__main__":
    main()