#!/usr/bin/env python3
"""
Create edge case STL files to test parser robustness
"""

def create_malformed_ascii_stl():
    """Create an ASCII STL with various formatting issues"""
    content = """solid malformed_test
  facet normal 0.0 0.0 1.0
    outer loop
      vertex 0.0 0.0 0.0
      vertex 1.0 0.0 0.0
      vertex 0.5 0.866 0.0
    endloop
  endfacet
  
  facet normal 0.577 0.577 0.577
    outer loop
      vertex 1.0 0.0 0.0
      vertex 1.0 1.0 0.0
      vertex 1.0 0.5 0.866
    endloop
  endfacet
  
  // This facet has extra whitespace and comments
  facet normal -1.0 0.0 0.0  
    outer loop  
      vertex 0.0 0.0 0.0     
      vertex 0.0 0.866 0.5   
      vertex 0.0 1.0 0.0     
    endloop    
  endfacet  
endsolid malformed_test"""
    
    with open("test_malformed_ascii.stl", "w") as f:
        f.write(content)

def create_large_coordinates_stl():
    """Create STL with very large coordinate values"""
    content = """solid large_coordinates
  facet normal 0.0 0.0 1.0
    outer loop
      vertex 1000000.0 2000000.0 3000000.0
      vertex 1000001.0 2000000.0 3000000.0
      vertex 1000000.5 2000000.866 3000000.0
    endloop
  endfacet
  facet normal 0.0 0.0 -1.0
    outer loop
      vertex -999999.0 -1999999.0 -2999999.0
      vertex -999998.5 -1999999.866 -2999999.0
      vertex -999998.0 -1999999.0 -2999999.0
    endloop
  endfacet
endsolid large_coordinates"""
    
    with open("test_large_coordinates.stl", "w") as f:
        f.write(content)

def create_precision_test_stl():
    """Create STL with high precision floating point values"""
    content = """solid precision_test
  facet normal 0.123456789 0.987654321 0.555555555
    outer loop
      vertex 0.123456789012345 0.987654321098765 0.111111111111111
      vertex 0.234567890123456 0.876543210987654 0.222222222222222
      vertex 0.345678901234567 0.765432109876543 0.333333333333333
    endloop
  endfacet
  facet normal -0.707106781186547 0.707106781186547 0.0
    outer loop
      vertex 0.0 0.0 0.0
      vertex 0.707106781186547 0.707106781186547 0.0
      vertex 0.0 1.41421356237309 0.0
    endloop
  endfacet
endsolid precision_test"""
    
    with open("test_precision_float.stl", "w") as f:
        f.write(content)

if __name__ == "__main__":
    print("Creating edge case STL test files...")
    create_malformed_ascii_stl()
    create_large_coordinates_stl()
    create_precision_test_stl()
    print("Created:")
    print("  - test_malformed_ascii.stl (formatting edge cases)")
    print("  - test_large_coordinates.stl (very large coordinate values)")
    print("  - test_precision_float.stl (high precision floating point)")