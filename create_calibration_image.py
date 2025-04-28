import numpy as np
from PIL import Image

def create_calibration_image(width: int = 1400, height: int = 1400, dot_spacing: int = 100, dot_radius: int = 1, output_path: str = 'calibration_image.png') -> None:
    """
    Create a black calibration image with white dots every `dot_spacing` pixels.

    Args:
        width (int): Width of the image in pixels.
        height (int): Height of the image in pixels.
        dot_spacing (int): Spacing between dots in pixels.
        dot_radius (int): Radius of each dot in pixels.
        output_path (str): Path to save the output PNG image.
    """
    # Create a black image
    image = np.zeros((height, width), dtype=np.uint8)

    # Draw white dots
    for y in range(0, height, dot_spacing):
        for x in range(0, width, dot_spacing):
            # Draw a filled circle for each dot
            for dy in range(-dot_radius, dot_radius + 1):
                for dx in range(-dot_radius, dot_radius + 1):
                    if dx * dx + dy * dy <= dot_radius * dot_radius:
                        yy = y + dy
                        xx = x + dx
                        if 0 <= yy < height and 0 <= xx < width:
                            image[yy, xx] = 255

    # Convert to PIL Image and save
    img = Image.fromarray(image, mode='L')
    img.save(output_path)

if __name__ == '__main__':
   
    width = 800
    height = 800

    width = 30
    height = 30

    output_path = f'/mnt/c/Users/medgar/Downloads/calibration_image_{width}x{height}.png'
    output_path = f'./calibration_image_{width}x{height}.png'

    create_calibration_image(output_path=output_path, width=width, height=height)
