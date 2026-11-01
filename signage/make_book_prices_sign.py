from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import math
import random

OUT = Path(__file__).resolve().parent
W, H = 2400, 3000  # 8x10 inches at 300 DPI

INK = (31, 40, 48)
NAVY = (31, 55, 82)
BLUE = (44, 119, 162)
GOLD = (229, 172, 55)
RED = (198, 63, 34)
WHITE = (251, 250, 247)
METAL = (220, 226, 230)

FONT_BLACK = "/System/Library/Fonts/Supplemental/Arial Black.ttf"
FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
FONT_REG = "/System/Library/Fonts/Supplemental/Arial.ttf"

BOOKS = [
    ("aluminum-and-dust.png", "$15"),
    ("good-idea.png", "$15"),
    ("accidental-hero.png", "$15"),
    ("koa-golf-cart.png", "$10"),
]


def font(path, size):
    return ImageFont.truetype(path, size=size)


def centered(draw, xy, text, f, fill, anchor="mm", stroke_width=0, stroke_fill=None):
    draw.text(xy, text, font=f, fill=fill, anchor=anchor,
              stroke_width=stroke_width, stroke_fill=stroke_fill)


def shadow(base, box, radius=30, offset=(0, 20), blur=18, alpha=100):
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    x0, y0, x1, y1 = box
    dx, dy = offset
    d.rounded_rectangle((x0+dx, y0+dy, x1+dx, y1+dy), radius=radius, fill=(31, 40, 48, alpha))
    base.alpha_composite(layer.filter(ImageFilter.GaussianBlur(blur)))


def rivet(draw, cx, cy, r=24):
    draw.ellipse((cx-r, cy-r, cx+r, cy+r), fill=(67, 78, 87), outline=INK, width=4)
    draw.ellipse((cx-r+5, cy-r+5, cx+r-5, cy+r-5), fill=(164, 176, 183))
    draw.ellipse((cx-r+8, cy-r+8, cx+2, cy+2), fill=(248, 249, 250))
    draw.arc((cx-r+4, cy-r+4, cx+r-4, cy+r-4), 20, 155, fill=WHITE, width=4)


# Brushed aluminum background, matching the other booth signs.
random.seed(411)
img = Image.new("RGBA", (W, H), METAL + (255,))
pix = img.load()
assert pix is not None
for y in range(H):
    band = int(7 * math.sin(y / 25.0) + 3 * math.sin(y / 6.4))
    noise = random.randint(-4, 4)
    for x in range(W):
        cross = int(3 * math.sin((x + y) / 124.0))
        v = max(-17, min(17, band + noise + cross))
        pix[x, y] = tuple(max(0, min(255, c + v)) for c in METAL) + (255,)
img = img.filter(ImageFilter.GaussianBlur(0.7))
draw = ImageDraw.Draw(img)

# Framing.
draw.rounded_rectangle((46, 46, W-46, H-46), radius=46, outline=INK, width=20)
draw.rounded_rectangle((78, 78, W-78, H-78), radius=34, outline=WHITE, width=5)
for cx, cy in [(116,116), (W-116,116), (116,H-116), (W-116,H-116)]:
    rivet(draw, cx, cy)

# Top badges and title.
badge = (455, 118, 1945, 270)
draw.rounded_rectangle(badge, radius=76, fill=RED, outline=INK, width=9)
centered(draw, (1200, 194), "AIRSTREAM RALLY SPECIAL", font(FONT_BLACK, 61), WHITE)
centered(draw, (1200, 438), "MEET THE AUTHOR", font(FONT_BLACK, 177), INK)
centered(draw, (1200, 575), "SIGNED PAPERBACKS FROM THE ROAD", font(FONT_BOLD, 55), BLUE)

# Book covers with individual price badges.
cover_w, cover_h = 430, 646
start_x, gap, top = 185, 120, 700
for idx, (filename, price) in enumerate(BOOKS):
    x = start_x + idx * (cover_w + gap)
    box = (x, top, x + cover_w, top + cover_h)
    shadow(img, box, radius=12, offset=(0, 22), blur=16, alpha=115)
    with Image.open(OUT / "assets" / "books" / filename) as src:
        cover = src.convert("RGB").resize((cover_w, cover_h), Image.Resampling.LANCZOS).convert("RGBA")
        img.alpha_composite(cover, (x, top))
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle(box, radius=10, outline=INK, width=9)

    # Price medallion overlapping the lower-right corner.
    cx, cy, r = x + cover_w - 18, top + cover_h - 20, 94
    draw.ellipse((cx-r, cy-r, cx+r, cy+r), fill=GOLD, outline=INK, width=10)
    centered(draw, (cx, cy+2), price, font(FONT_BLACK, 67), INK)

# Individual price reminder.
centered(draw, (1200, 1496), "INDIVIDUAL TITLES  •  $15 / $15 / $15 / $10", font(FONT_BOLD, 46), NAVY)

# Dominant collection offer.
offer = (185, 1605, 2215, 2265)
shadow(img, offer, radius=58, offset=(0, 22), blur=20, alpha=120)
draw = ImageDraw.Draw(img)
draw.rounded_rectangle(offer, radius=58, fill=NAVY, outline=INK, width=13)
for cx, cy in [(245,1665), (2155,1665), (245,2205), (2155,2205)]:
    rivet(draw, cx, cy, 17)
centered(draw, (1200, 1743), "THE COMPLETE SIGNED COLLECTION", font(FONT_BLACK, 62), GOLD)
centered(draw, (1200, 1960), "ALL 4  •  $35", font(FONT_BLACK, 177), WHITE)
centered(draw, (1200, 2135), "SAVE $20", font(FONT_BLACK, 85), GOLD)
centered(draw, (1200, 2211), "compared with buying the books individually", font(FONT_BOLD, 39), WHITE)

# Bottom call to action.
cta = (315, 2380, 2085, 2635)
draw.rounded_rectangle(cta, radius=125, fill=GOLD, outline=INK, width=11)
centered(draw, (1200, 2507), "GET YOUR COPIES SIGNED TODAY", font(FONT_BLACK, 62), INK)
centered(draw, (1200, 2762), "BRIAN SMITH", font(FONT_BLACK, 105), INK)
centered(draw, (1200, 2862), "Stories, mishaps, aluminum and just enough poor judgment.", font(FONT_BOLD, 38), RED)

rgb = img.convert("RGB")
png_path = OUT / "book-prices-8x10-sign.png"
pdf_path = OUT / "book-prices-8x10-sign.pdf"
rgb.save(png_path, "PNG", dpi=(300, 300), optimize=True)
rgb.save(pdf_path, "PDF", resolution=300.0, quality=100)
print(png_path)
print(pdf_path)
print(f"pixels={W}x{H} dpi=300 page_inches=8x10")
