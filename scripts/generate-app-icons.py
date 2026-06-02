"""Generate Ripple app icon assets (1024 square, full bleed, no pre-rounded corners)."""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "images"

SIZE = 1024
CX = CY = SIZE // 2

BG = (10, 20, 35)       # #0a1423
TEAL = (52, 211, 153)   # #34d399
WHITE = (255, 255, 255)

# Scale artwork inward so iOS/Android squircle masks do not clip outer rings.
ARTWORK_SCALE = 0.90


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def draw_icon(size: int = SIZE) -> Image.Image:
    img = Image.new("RGBA", (size, size), BG + (255,))
    draw = ImageDraw.Draw(img)
    s = (size / SIZE) * ARTWORK_SCALE
    cx = cy = size // 2

    ring_radii = [430, 345, 265, 190]
    for i, r in enumerate(ring_radii):
        radius = int(r * s)
        alpha = int(lerp(55, 210, i / max(len(ring_radii) - 1, 1)))
        w = max(2, int(3 * s))
        bbox = (cx - radius, cy - radius, cx + radius, cy + radius)
        draw.ellipse(bbox, outline=TEAL + (alpha,), width=w)

    disc_r = int(118 * s)
    draw.ellipse(
        (cx - disc_r, cy - disc_r, cx + disc_r, cy + disc_r),
        fill=TEAL,
    )

    # Circular arrow wrapping clockwise around the center disc
    arrow_r = int(168 * s)
    arrow_w = max(12, int(16 * s))
    bbox = (cx - arrow_r, cy - arrow_r, cx + arrow_r, cy + arrow_r)
    draw.arc(bbox, start=215, end=355, fill=TEAL, width=arrow_w)

    angle = math.radians(355)
    tip_x = cx + arrow_r * math.cos(angle)
    tip_y = cy + arrow_r * math.sin(angle)
    head = int(24 * s)
    left_angle = angle + math.radians(145)
    right_angle = angle - math.radians(145)
    draw.polygon(
        [
            (tip_x, tip_y),
            (tip_x + head * math.cos(left_angle), tip_y + head * math.sin(left_angle)),
            (tip_x + head * math.cos(right_angle), tip_y + head * math.sin(right_angle)),
        ],
        fill=TEAL,
    )

    clock_r = int(68 * s)
    draw.ellipse(
        (cx - clock_r, cy - clock_r, cx + clock_r, cy + clock_r),
        outline=WHITE + (230,),
        width=max(2, int(3 * s)),
    )

    hand_w = max(3, int(4 * s))
    draw.line((cx, cy, cx + int(36 * s), cy), fill=WHITE, width=hand_w)
    draw.line((cx, cy, cx, cy - int(46 * s)), fill=WHITE, width=hand_w)

    dot_r = int(5 * s)
    draw.ellipse(
        (cx - dot_r, cy - dot_r, cx + dot_r, cy + dot_r),
        fill=WHITE,
    )

    return img.convert("RGB")


def make_android_foreground(source: Image.Image) -> Image.Image:
    size = 1024
    fg = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    inner = int(size * 0.72)
    scaled = source.resize((inner, inner), Image.Resampling.LANCZOS)
    offset = (size - inner) // 2
    fg.paste(scaled, (offset, offset))
    return fg


def make_android_background() -> Image.Image:
    return Image.new("RGB", (SIZE, SIZE), BG)


def make_monochrome(source: Image.Image) -> Image.Image:
    gray = source.convert("L")
    mono = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    pixels = gray.load()
    out = mono.load()
    for y in range(SIZE):
        for x in range(SIZE):
            v = pixels[x, y]
            if v > 35:
                out[x, y] = (255, 255, 255, min(255, v + 50))
    return mono


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    icon = draw_icon(SIZE)

    icon.save(OUT / "icon.png", "PNG", optimize=True)
    icon.save(OUT / "splash-icon.png", "PNG", optimize=True)

    make_android_foreground(icon).save(OUT / "android-icon-foreground.png", "PNG", optimize=True)
    make_android_background().save(OUT / "android-icon-background.png", "PNG", optimize=True)
    make_monochrome(icon).save(OUT / "android-icon-monochrome.png", "PNG", optimize=True)
    icon.resize((48, 48), Image.Resampling.LANCZOS).save(OUT / "favicon.png", "PNG", optimize=True)

    print(f"Wrote icons to {OUT}")


if __name__ == "__main__":
    main()
