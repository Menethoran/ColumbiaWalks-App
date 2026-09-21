#!/usr/bin/env python3
"""Render the existing ColumbiaWalks badge geometry as an opaque iOS icon."""

from pathlib import Path
from PIL import Image, ImageDraw

SCALE = 16
SIZE = 1024
BLUE = "#1e5a7a"
GREEN = "#2f855a"
WHITE = "#ffffff"


def point(x: float, y: float) -> tuple[int, int]:
    factor = SIZE * SCALE / 108
    return round(x * factor), round(y * factor)


output = Path(__file__).resolve().parents[1] / "ColumbiaWalks/Resources/Assets.xcassets/AppIcon.appiconset/AppIcon.png"
output.parent.mkdir(parents=True, exist_ok=True)

image = Image.new("RGB", (SIZE * SCALE, SIZE * SCALE), BLUE)
draw = ImageDraw.Draw(image)

# The white location pin, green center, and walking figure mirror the existing SVG.
draw.ellipse([point(23, 14), point(85, 76)], fill=WHITE)
draw.polygon([point(29, 61), point(54, 94), point(79, 61)], fill=WHITE)
draw.ellipse([point(36, 27), point(72, 63)], fill=GREEN)

draw.ellipse([point(44, 34), point(54, 44)], fill=WHITE)
width = point(3.8, 0)[0]
draw.line([point(57, 44), point(50, 48), point(45, 58)], fill=WHITE, width=width, joint="curve")
draw.line([point(52, 49), point(58, 55), point(55, 63)], fill=WHITE, width=width, joint="curve")
draw.line([point(57, 44), point(63, 40), point(68, 46)], fill=WHITE, width=width, joint="curve")
draw.line([point(57, 53), point(63, 63)], fill=WHITE, width=width, joint="curve")

image.resize((SIZE, SIZE), Image.Resampling.LANCZOS).save(output, "PNG", optimize=True)
print(output)

