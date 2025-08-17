import numpy as np
import tifffile

# Create a 1000x1000 black image
image = np.zeros((1000, 1000), dtype=np.uint8)

# Define the 10 white pixel positions
positions = [
    (0, 0),        # Top-left corner
    (999, 999),    # Bottom-right corner
    (125, 125),    # Evenly distributed positions
    (250, 250),
    (375, 375),
    (500, 500),
    (625, 625),
    (750, 750),
    (875, 875),
    (100, 900)     # Additional position for variety
]

# Set white pixels (value 255) at specified positions
for y, x in positions:
    image[y, x] = 255

# Save as TIFF file
tifffile.imwrite('test_white_pixels.tiff', image)

print(f"Created test_white_pixels.tiff with white pixels at positions: {positions}")