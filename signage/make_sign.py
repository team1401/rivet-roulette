from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import random

OUT = Path(__file__).resolve().parent
W, H = 2400, 3000  # 8x10 at 300 DPI

COLORS = {
    "metal_light": (235, 239, 241),
    "metal_mid": (218, 225, 229),
    "metal_dark": (145, 158, 166),
    "ink": (31, 40, 48),
    "white": (250, 249, 246),
    "yellow": (229, 172, 55),
    "red": (198, 63, 34),
    "blue": (44, 119, 162),
}

FONT_BLACK = "/System/Library/Fonts/Supplemental/Arial Black.ttf"
FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
FONT_REG = "/System/Library/Fonts/Supplemental/Arial.ttf"


def font(path, size):
    return ImageFont.truetype(path, size=size)


def text_size(draw, text, f, stroke=0):
    box = draw.textbbox((0, 0), text, font=f, stroke_width=stroke)
    return box[2] - box[0], box[3] - box[1]


def centered(draw, xy, text, f, fill, stroke_width=0, stroke_fill=None, anchor="mm"):
    draw.text(xy, text, font=f, fill=fill, anchor=anchor,
              stroke_width=stroke_width, stroke_fill=stroke_fill)


def fit_font(draw, text, path, max_size, min_size, max_width):
    for size in range(max_size, min_size - 1, -2):
        f = font(path, size)
        if text_size(draw, text, f)[0] <= max_width:
            return f
    return font(path, min_size)


def rounded_shadow(base, box, radius, shadow_offset=(0, 22), shadow_blur=22, shadow=(31, 40, 48, 100)):
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    x0, y0, x1, y1 = box
    dx, dy = shadow_offset
    d.rounded_rectangle((x0 + dx, y0 + dy, x1 + dx, y1 + dy), radius=radius, fill=shadow)
    layer = layer.filter(ImageFilter.GaussianBlur(shadow_blur))
    base.alpha_composite(layer)


def rivet(draw, cx, cy, r=23):
    # Concentric brushed-steel rivet.
    draw.ellipse((cx-r, cy-r, cx+r, cy+r), fill=(73, 84, 92), outline=COLORS["ink"], width=4)
    draw.ellipse((cx-r+5, cy-r+5, cx+r-5, cy+r-5), fill=(162, 174, 181))
    draw.ellipse((cx-r+8, cy-r+8, cx+2, cy+2), fill=(246, 248, 249))
    draw.arc((cx-r+4, cy-r+4, cx+r-4, cy+r-4), 20, 155, fill=(255, 255, 255), width=4)


# Brushed aluminum background.
random.seed(1401)
img = Image.new("RGBA", (W, H), COLORS["metal_mid"] + (255,))
pix = img.load()
assert pix is not None
for y in range(H):
    band = int(8 * __import__("math").sin(y / 25.0) + 4 * __import__("math").sin(y / 6.0))
    noise = random.randint(-4, 4)
    for x in range(W):
        cross = int(3 * __import__("math").sin((x + y) / 120.0))
        v = max(-18, min(18, band + noise + cross))
        pix[x, y] = tuple(max(0, min(255, c + v)) for c in COLORS["metal_mid"]) + (255,)

# Soften the texture to print cleanly.
img = img.filter(ImageFilter.GaussianBlur(0.7))
draw = ImageDraw.Draw(img)

# Heavy border and rivets.
draw.rounded_rectangle((46, 46, W-46, H-46), radius=46, outline=COLORS["ink"], width=20)
draw.rounded_rectangle((78, 78, W-78, H-78), radius=34, outline=(255, 255, 255), width=5)
for cx, cy in [(116,116), (W-116,116), (116,H-116), (W-116,H-116)]:
    rivet(draw, cx, cy, 25)

# Top expo badge.
badge = (460, 124, 1940, 272)
draw.rounded_rectangle(badge, radius=74, fill=COLORS["ink"])
centered(draw, (1200, 198), "AIRSTREAM EXPO CHALLENGE", font(FONT_BOLD, 62), COLORS["white"])

# Main headline.
headline_f = font(FONT_BLACK, 258)
centered(draw, (1200, 500), "FEELING", headline_f, COLORS["ink"])
centered(draw, (1200, 748), "BRAVE?", headline_f, COLORS["ink"])

# Accent lines and subhead. Leave a clean gap around the words.
draw.line((245, 925, 700, 925), fill=COLORS["blue"], width=18)
draw.line((1700, 925, 2155, 925), fill=COLORS["blue"], width=18)
centered(draw, (1200, 923), "CHOOSE YOUR FATE", font(FONT_BLACK, 76), COLORS["blue"])

# Choice buttons.
left = (170, 1060, 1115, 1545)
right = (1285, 1060, 2230, 1545)
rounded_shadow(img, left, 54)
rounded_shadow(img, right, 54)
draw = ImageDraw.Draw(img)
draw.rounded_rectangle(left, radius=54, fill=COLORS["yellow"], outline=COLORS["ink"], width=14)
draw.rounded_rectangle(right, radius=54, fill=COLORS["red"], outline=COLORS["ink"], width=14)

# Choice title and cue.
lf = fit_font(draw, "COMPLIMENT", FONT_BLACK, 132, 95, 820)
rf = fit_font(draw, "INSULT", FONT_BLACK, 158, 110, 800)
centered(draw, (642, 1245), "COMPLIMENT", lf, COLORS["ink"])
centered(draw, (642, 1407), "WARM BOOST", font(FONT_BOLD, 54), COLORS["ink"])
centered(draw, (1758, 1245), "INSULT", rf, COLORS["white"])
centered(draw, (1758, 1407), "PLAYFUL ROAST", font(FONT_BOLD, 54), COLORS["white"])

# OR medallion.
draw.ellipse((1110, 1190, 1290, 1370), fill=COLORS["white"], outline=COLORS["ink"], width=12)
centered(draw, (1200, 1281), "OR", font(FONT_BLACK, 58), COLORS["ink"])

# Spoken-out-loud instruction card.
card = (215, 1698, 2185, 2152)
rounded_shadow(img, card, 46, shadow_offset=(0, 18), shadow_blur=18)
draw = ImageDraw.Draw(img)
draw.rounded_rectangle(card, radius=46, fill=COLORS["white"], outline=COLORS["ink"], width=12)
for cx, cy in [(270,1752), (2130,1752), (270,2098), (2130,2098)]:
    rivet(draw, cx, cy, 17)
centered(draw, (1200, 1835), "TAP THE iPAD", font(FONT_BLACK, 128), COLORS["ink"])
centered(draw, (1200, 1974), "HEAR YOUR FATE OUT LOUD", font(FONT_BOLD, 68), COLORS["blue"])
centered(draw, (1200, 2070), "Fast. Random. Slightly dangerous.", font(FONT_BOLD, 48), COLORS["ink"])

# Prize burst/banner.
burst_box = (350, 2255, 2050, 2485)
draw.rounded_rectangle(burst_box, radius=115, fill=COLORS["blue"], outline=COLORS["ink"], width=12)
centered(draw, (1200, 2372), "YOU MIGHT EVEN WIN A PRIZE", font(FONT_BLACK, 64), COLORS["white"])

# Bottom lockup.
centered(draw, (1200, 2676), "RIVET ROULETTE", font(FONT_BLACK, 112), COLORS["ink"])
centered(draw, (1200, 2788), "A COMPLIMENT & PLAYFUL INSULT MACHINE", font(FONT_BOLD, 47), COLORS["ink"])
centered(draw, (1200, 2863), "No feelings were harmed. Probably.", font(FONT_BOLD, 42), COLORS["red"])

# Save print-ready artifacts.
rgb = img.convert("RGB")
png_path = OUT / "rivet-roulette-8x10-sign.png"
pdf_path = OUT / "rivet-roulette-8x10-sign.pdf"
rgb.save(png_path, "PNG", dpi=(300, 300), optimize=True)
rgb.save(pdf_path, "PDF", resolution=300.0, quality=100)
print(png_path)
print(pdf_path)
print(f"pixels={W}x{H} dpi=300 page_inches=8x10")
