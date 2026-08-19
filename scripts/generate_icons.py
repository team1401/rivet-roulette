from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1] / "public"
COLORS = {
    "aluminum": "#e2e6e9",
    "ink": "#212830",
    "cream": "#f9f8f5",
    "gold": "#e5ac37",
    "rust": "#c63f22",
    "steel": "#8e9aa1",
}


def font_for(size: int):
    candidates = [
        "/System/Library/Fonts/SFNS.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ]
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            continue
    return ImageFont.load_default()


def render(size: int, filename: str):
    scale = size / 512
    image = Image.new("RGB", (size, size), COLORS["aluminum"])
    draw = ImageDraw.Draw(image)

    inset = round(28 * scale)
    radius = round(92 * scale)
    border = max(2, round(12 * scale))
    draw.rounded_rectangle(
        (inset, inset, size - inset, size - inset),
        radius=radius,
        fill=COLORS["cream"],
        outline=COLORS["ink"],
        width=border,
    )

    disk = (round(86 * scale), round(86 * scale), round(426 * scale), round(426 * scale))
    draw.pieslice(disk, start=90, end=270, fill=COLORS["gold"])
    draw.pieslice(disk, start=270, end=90, fill=COLORS["rust"])
    draw.ellipse(disk, outline=COLORS["ink"], width=max(2, round(10 * scale)))

    rivet_r = max(3, round(13 * scale))
    for x, y in ((66, 66), (446, 66), (66, 446), (446, 446)):
        cx, cy = round(x * scale), round(y * scale)
        draw.ellipse(
            (cx - rivet_r, cy - rivet_r, cx + rivet_r, cy + rivet_r),
            fill=COLORS["steel"],
            outline=COLORS["ink"],
            width=max(1, round(3 * scale)),
        )

    label = "RR"
    font = font_for(round(158 * scale))
    box = draw.textbbox((0, 0), label, font=font, stroke_width=max(1, round(3 * scale)))
    width = box[2] - box[0]
    height = box[3] - box[1]
    draw.text(
        ((size - width) / 2, (size - height) / 2 - box[1]),
        label,
        font=font,
        fill=COLORS["cream"],
        stroke_width=max(1, round(8 * scale)),
        stroke_fill=COLORS["ink"],
    )

    image.save(ROOT / filename, "PNG", optimize=True)


if __name__ == "__main__":
    render(180, "apple-touch-icon.png")
    render(192, "icon-192.png")
    render(512, "icon-512.png")
