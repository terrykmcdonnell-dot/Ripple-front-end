"""Generate Ripple app icon assets from icon-source.png (1024 square, full bleed)."""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "images"
ANDROID_RES = ROOT / "android" / "app" / "src" / "main" / "res"
SOURCE = OUT / "icon-source.png"

SIZE = 1024
BG = (10, 20, 35)  # #0a1423 — matches app.json adaptiveIcon.backgroundColor

MIPMAP_SIZES = {
    "mipmap-mdpi": (48, 108),
    "mipmap-hdpi": (72, 162),
    "mipmap-xhdpi": (96, 216),
    "mipmap-xxhdpi": (144, 324),
    "mipmap-xxxhdpi": (192, 432),
}

SPLASH_SIZES = {
    "drawable-mdpi": 288,
    "drawable-hdpi": 432,
    "drawable-xhdpi": 576,
    "drawable-xxhdpi": 864,
    "drawable-xxxhdpi": 1152,
}


def load_source() -> Image.Image:
    if not SOURCE.is_file():
        raise SystemExit(
            f"Missing {SOURCE}. Add a 1024×1024 PNG master icon, then re-run this script.",
        )
    img = Image.open(SOURCE)
    if img.mode != "RGB":
        img = img.convert("RGB")
    if img.size != (SIZE, SIZE):
        img = img.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    return img


def make_android_foreground(source: Image.Image, layer_size: int | None = None) -> Image.Image:
    """Scale artwork into Android adaptive-icon safe zone (~72%)."""
    size = layer_size or SIZE
    fg = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    inner = int(size * 0.72)
    scaled = source.resize((inner, inner), Image.Resampling.LANCZOS)
    offset = (size - inner) // 2
    fg.paste(scaled, (offset, offset))
    return fg


def make_android_background(layer_size: int | None = None) -> Image.Image:
    size = layer_size or SIZE
    return Image.new("RGB", (size, size), BG)


def make_monochrome(source: Image.Image, layer_size: int | None = None) -> Image.Image:
    if layer_size and layer_size != SIZE:
        source = source.resize((layer_size, layer_size), Image.Resampling.LANCZOS)
    size = source.size[0]
    gray = source.convert("L")
    mono = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    pixels = gray.load()
    out = mono.load()
    for y in range(size):
        for x in range(size):
            v = pixels[x, y]
            if v > 35:
                out[x, y] = (255, 255, 255, min(255, v + 50))
    return mono


def save_webp(path: Path, image: Image.Image) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if image.mode not in ("RGB", "RGBA"):
        image = image.convert("RGBA")
    image.save(path, "WEBP", quality=90, method=6)


def write_android_native(source: Image.Image, foreground_master: Image.Image, mono_master: Image.Image) -> None:
    if not ANDROID_RES.is_dir():
        return

    for folder, (launcher_px, layer_px) in MIPMAP_SIZES.items():
        target = ANDROID_RES / folder
        launcher = source.resize((launcher_px, launcher_px), Image.Resampling.LANCZOS)
        save_webp(target / "ic_launcher.webp", launcher)
        save_webp(target / "ic_launcher_round.webp", launcher)
        save_webp(
            target / "ic_launcher_foreground.webp",
            make_android_foreground(source, layer_px),
        )
        save_webp(target / "ic_launcher_background.webp", make_android_background(layer_px))
        save_webp(target / "ic_launcher_monochrome.webp", make_monochrome(source, layer_px))

    for folder, splash_px in SPLASH_SIZES.items():
        target = ANDROID_RES / folder
        splash = make_android_foreground(source, splash_px).convert("RGBA")
        target.mkdir(parents=True, exist_ok=True)
        splash.save(target / "splashscreen_logo.png", "PNG", optimize=True)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    icon = load_source()
    foreground = make_android_foreground(icon)
    mono = make_monochrome(icon)

    icon.save(OUT / "icon.png", "PNG", optimize=True)
    icon.save(OUT / "splash-icon.png", "PNG", optimize=True)
    foreground.save(OUT / "android-icon-foreground.png", "PNG", optimize=True)
    make_android_background().save(OUT / "android-icon-background.png", "PNG", optimize=True)
    mono.save(OUT / "android-icon-monochrome.png", "PNG", optimize=True)
    icon.resize((48, 48), Image.Resampling.LANCZOS).save(OUT / "favicon.png", "PNG", optimize=True)

    write_android_native(icon, foreground, mono)

    print(f"Wrote Expo assets to {OUT}")
    if ANDROID_RES.is_dir():
        print(f"Updated Android native icons in {ANDROID_RES}")


if __name__ == "__main__":
    main()
