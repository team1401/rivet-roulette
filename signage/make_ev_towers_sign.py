from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import math
import random

OUT = Path(__file__).resolve().parent
W, H = 2400, 3000  # 8x10 inches at 300 DPI

NAVY = (38, 25, 104)
PURPLE = (84, 54, 196)
ORANGE = (255, 101, 57)
PINK = (227, 48, 156)
INK = (31, 40, 48)
WHITE = (252, 251, 248)
METAL = (220, 226, 230)
METAL_DARK = (142, 155, 164)

FONT_BLACK = "/System/Library/Fonts/Supplemental/Arial Black.ttf"
FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
FONT_REG = "/System/Library/Fonts/Supplemental/Arial.ttf"
LOGO_PATH = OUT / "assets" / "the-riveted-podcast-logo.png"


def font(path, size):
    return ImageFont.truetype(path, size=size)


def text_width(draw, text, f, stroke=0):
    box = draw.textbbox((0, 0), text, font=f, stroke_width=stroke)
    return box[2] - box[0]


def fit_font(draw, text, path, max_size, min_size, max_width):
    for size in range(max_size, min_size - 1, -2):
        f = font(path, size)
        if text_width(draw, text, f) <= max_width:
            return f
    return font(path, min_size)


def centered(draw, xy, text, f, fill, anchor="mm", stroke_width=0, stroke_fill=None):
    draw.text(xy, text, font=f, fill=fill, anchor=anchor,
              stroke_width=stroke_width, stroke_fill=stroke_fill)


def shadow(base, box, radius=45, offset=(0, 20), blur=20):
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    x0, y0, x1, y1 = box
    dx, dy = offset
    d.rounded_rectangle((x0+dx, y0+dy, x1+dx, y1+dy), radius=radius, fill=(31, 40, 48, 105))
    base.alpha_composite(layer.filter(ImageFilter.GaussianBlur(blur)))


def rivet(draw, cx, cy, r=24):
    draw.ellipse((cx-r, cy-r, cx+r, cy+r), fill=(67, 78, 87), outline=INK, width=4)
    draw.ellipse((cx-r+5, cy-r+5, cx+r-5, cy+r-5), fill=(164, 176, 183))
    draw.ellipse((cx-r+8, cy-r+8, cx+2, cy+2), fill=(248, 249, 250))
    draw.arc((cx-r+4, cy-r+4, cx+r-4, cy+r-4), 20, 155, fill=WHITE, width=4)


def bolt(draw, cx, cy, scale=1.0, fill=ORANGE, outline=NAVY):
    pts = [
        (cx-28*scale, cy-115*scale),
        (cx+54*scale, cy-115*scale),
        (cx+8*scale, cy-18*scale),
        (cx+66*scale, cy-18*scale),
        (cx-42*scale, cy+120*scale),
        (cx-8*scale, cy+22*scale),
        (cx-66*scale, cy+22*scale),
    ]
    draw.polygon(pts, fill=fill)
    draw.line(pts + [pts[0]], fill=outline, width=max(4, int(10*scale)), joint="curve")


# Brushed aluminum background.
random.seed(731)
img = Image.new("RGBA", (W, H), METAL + (255,))
pix = img.load()
assert pix is not None
for y in range(H):
    band = int(7 * math.sin(y / 24.0) + 3 * math.sin(y / 6.5))
    noise = random.randint(-4, 4)
    for x in range(W):
        cross = int(3 * math.sin((x + y) / 125.0))
        v = max(-17, min(17, band + noise + cross))
        pix[x, y] = tuple(max(0, min(255, c + v)) for c in METAL) + (255,)
img = img.filter(ImageFilter.GaussianBlur(0.7))
draw = ImageDraw.Draw(img)

# Border and corner rivets.
draw.rounded_rectangle((46, 46, W-46, H-46), radius=46, outline=NAVY, width=20)
draw.rounded_rectangle((78, 78, W-78, H-78), radius=34, outline=WHITE, width=5)
for cx, cy in [(116,116), (W-116,116), (116,H-116), (W-116,H-116)]:
    rivet(draw, cx, cy)

# Attention badge.
badge = (500, 120, 1900, 272)
draw.rounded_rectangle(badge, radius=76, fill=ORANGE, outline=NAVY, width=10)
centered(draw, (1200, 196), "EV TOWERS WANTED", font(FONT_BLACK, 67), WHITE)

# Main question.
centered(draw, (1200, 480), "TOW WITH", font(FONT_BLACK, 230), NAVY)
centered(draw, (1200, 730), "AN EV?", font(FONT_BLACK, 270), NAVY)

# Decorative charge-line and bolt.
draw.line((260, 930, 1035, 930), fill=PURPLE, width=18)
draw.line((1365, 930, 2140, 930), fill=PURPLE, width=18)
bolt(draw, 1200, 930, 0.62)

# Primary recruitment card.
panel = (185, 1070, 2215, 1595)
shadow(img, panel, radius=56)
draw = ImageDraw.Draw(img)
draw.rounded_rectangle(panel, radius=56, fill=NAVY, outline=INK, width=12)
centered(draw, (1200, 1236), "JOIN THE PANEL", font(FONT_BLACK, 148), WHITE)
centered(draw, (1200, 1402), "Share your real-world EV towing experience", font(FONT_BOLD, 61), ORANGE)
centered(draw, (1200, 1505), "with fellow owners and a live audience", font(FONT_BOLD, 54), WHITE)

# Topics strip.
topics = (205, 1680, 2195, 1880)
draw.rounded_rectangle(topics, radius=34, fill=WHITE, outline=NAVY, width=10)
centered(draw, (1200, 1744), "RANGE  •  CHARGING  •  CAMPGROUNDS", font(FONT_BLACK, 55), NAVY)
centered(draw, (1200, 1822), "WHAT ACTUALLY WORKS ON THE ROAD", font(FONT_BOLD, 46), PINK)

# Live show callout.
live = (300, 1950, 2100, 2165)
draw.rounded_rectangle(live, radius=106, fill=PURPLE, outline=NAVY, width=10)
centered(draw, (1200, 2058), "LIVE PODCAST  +  LIVE AUDIENCE", font(FONT_BLACK, 61), WHITE)

# Podcast logo in a white card.
logo_card = (155, 2250, 925, 2880)
draw.rounded_rectangle(logo_card, radius=42, fill=WHITE, outline=NAVY, width=10)
with Image.open(LOGO_PATH) as src:
    logo = src.convert("RGBA")
    logo.thumbnail((600, 600), Image.Resampling.LANCZOS)
    lx = logo_card[0] + (logo_card[2] - logo_card[0] - logo.width) // 2
    ly = logo_card[1] + (logo_card[3] - logo_card[1] - logo.height) // 2
    img.alpha_composite(logo, (lx, ly))

# Action card next to the logo.
draw = ImageDraw.Draw(img)
cta = (1000, 2250, 2245, 2880)
draw.rounded_rectangle(cta, radius=42, fill=ORANGE, outline=NAVY, width=10)
centered(draw, (1622, 2394), "INTERESTED?", font(FONT_BLACK, 91), NAVY)
centered(draw, (1622, 2538), "TALK TO BRIAN", font(FONT_BLACK, 82), WHITE)
centered(draw, (1622, 2662), "AT THIS BOOTH", font(FONT_BLACK, 78), WHITE)
centered(draw, (1622, 2782), "Real miles. Real stories. No hype.", font(FONT_BOLD, 39), NAVY)

rgb = img.convert("RGB")
png_path = OUT / "ev-towers-live-podcast-panel-8x10-sign.png"
pdf_path = OUT / "ev-towers-live-podcast-panel-8x10-sign.pdf"
rgb.save(png_path, "PNG", dpi=(300, 300), optimize=True)
rgb.save(pdf_path, "PDF", resolution=300.0, quality=100)
print(png_path)
print(pdf_path)
print(f"pixels={W}x{H} dpi=300 page_inches=8x10")
