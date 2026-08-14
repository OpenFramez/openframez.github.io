#!/usr/bin/env python3
"""Generate PWA icons (192, 512) for OpenFramez using Pillow."""

from PIL import Image, ImageDraw, ImageFont
import os

OUT_DIR = "/home/z/my-project/openframez/assets/icons"
os.makedirs(OUT_DIR, exist_ok=True)


def make_icon(size, path):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # Gradient background (simulated with diagonal stripes)
    # Brand gradient: #6366f1 -> #8b5cf6 -> #ec4899
    c1 = (99, 102, 241, 255)    # indigo
    c2 = (139, 92, 246, 255)    # violet
    c3 = (236, 72, 153, 255)    # pink

    # Draw rounded rectangle background
    radius = int(size * 0.18)
    # Solid color first, then overlay gradient
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=c2)

    # Draw gradient using simple horizontal lines mixing colors
    for y in range(size):
        # Skip outside the rounded rect (approximate)
        if y < radius or y > size - radius:
            continue
        # Blend factor
        t = y / size
        if t < 0.5:
            r = int(c1[0] + (c2[0] - c1[0]) * (t * 2))
            g = int(c1[1] + (c2[1] - c1[1]) * (t * 2))
            b = int(c1[2] + (c2[2] - c1[2]) * (t * 2))
        else:
            tt = (t - 0.5) * 2
            r = int(c2[0] + (c3[0] - c2[0]) * tt)
            g = int(c2[1] + (c3[1] - c2[1]) * tt)
            b = int(c2[2] + (c3[2] - c2[2]) * tt)
        draw.line([(0, y), (size, y)], fill=(r, g, b, 255))

    # Re-mask to rounded rect (so corners are transparent)
    mask = Image.new("L", (size, size), 0)
    mdraw = ImageDraw.Draw(mask)
    mdraw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    img.putalpha(mask)

    # Draw "P" letter centered
    try:
        # Try to use a system bold font
        font_paths = [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        ]
        font_path = next((p for p in font_paths if os.path.exists(p)), None)
        if font_path:
            font = ImageFont.truetype(font_path, int(size * 0.55))
        else:
            font = ImageFont.load_default()
    except Exception:
        font = ImageFont.load_default()

    text = "P"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    tx = (size - tw) // 2 - bbox[0]
    ty = (size - th) // 2 - bbox[1]
    # Slight shadow
    draw.text((tx + 2, ty + 2), text, font=font, fill=(0, 0, 0, 60))
    draw.text((tx, ty), text, font=font, fill=(255, 255, 255, 255))

    img.save(path, "PNG")
    print(f"  ✓ {path} ({size}x{size}, {os.path.getsize(path)//1024} KB)")


if __name__ == "__main__":
    make_icon(192, os.path.join(OUT_DIR, "icon-192.png"))
    make_icon(512, os.path.join(OUT_DIR, "icon-512.png"))
    make_icon(32, os.path.join(OUT_DIR, "favicon-32.png"))
    make_icon(16, os.path.join(OUT_DIR, "favicon-16.png"))
    # Also apple-touch-icon (180)
    make_icon(180, os.path.join(OUT_DIR, "apple-touch-icon.png"))
    print("Done.")
