from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUT = Path(__file__).resolve().parent
W, H = 2400, 3000  # 8x10 inches at 300 DPI

INK = (27, 34, 40)
NAVY = (36, 73, 101)
GOLD = (225, 167, 50)
PAPER = (248, 247, 243)
WHITE = (255, 255, 253)
LINE = (204, 207, 208)

FONT_BLACK = "/System/Library/Fonts/Supplemental/Arial Black.ttf"
FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
FONT_REG = "/System/Library/Fonts/Supplemental/Arial.ttf"

BOOKS = [
    ("aluminum-and-dust.png", ["ALUMINUM & DUST"], "$15"),
    ("good-idea.png", ["IT SEEMED LIKE A", "GOOD IDEA AT THE TIME"], "$15"),
    ("accidental-hero.png", ["ACCIDENTAL HERO"], "$15"),
    ("koa-golf-cart.png", ["CONFESSIONS OF A", "KOA GOLF CART"], "$10"),
]


def font(path, size):
    return ImageFont.truetype(path, size=size)


def centered(draw, xy, text, f, fill, anchor="mm"):
    draw.text(xy, text, font=f, fill=fill, anchor=anchor)


def shadow(base, box, radius=18, offset=(0, 12), blur=12):
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    x0, y0, x1, y1 = box
    dx, dy = offset
    d.rounded_rectangle((x0+dx, y0+dy, x1+dx, y1+dy), radius=radius, fill=(0, 0, 0, 40))
    base.alpha_composite(layer.filter(ImageFilter.GaussianBlur(blur)))


img = Image.new("RGBA", (W, H), PAPER + (255,))
draw = ImageDraw.Draw(img)

# Minimal outer frame.
draw.rounded_rectangle((55, 55, W-55, H-55), radius=28, outline=INK, width=10)

# Simple title.
centered(draw, (1200, 205), "SIGNED BOOKS", font(FONT_BLACK, 153), INK)
centered(draw, (1200, 332), "BRIAN SMITH", font(FONT_BOLD, 52), NAVY)
draw.line((270, 400, 2130, 400), fill=GOLD, width=12)

# Four clean product rows.
row_x0, row_x1 = 150, 2250
row_top = 455
row_h = 455
row_gap = 24
cover_w, cover_h = 258, 387

for idx, (filename, title_lines, price) in enumerate(BOOKS):
    y0 = row_top + idx * (row_h + row_gap)
    y1 = y0 + row_h
    row = (row_x0, y0, row_x1, y1)
    draw.rounded_rectangle(row, radius=24, fill=WHITE, outline=LINE, width=5)

    cover_x = 190
    cover_y = y0 + (row_h - cover_h) // 2
    cover_box = (cover_x, cover_y, cover_x + cover_w, cover_y + cover_h)
    shadow(img, cover_box, radius=7, offset=(0, 8), blur=9)
    with Image.open(OUT / "assets" / "books" / filename) as src:
        cover = src.convert("RGB").resize((cover_w, cover_h), Image.Resampling.LANCZOS).convert("RGBA")
        img.alpha_composite(cover, (cover_x, cover_y))
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle(cover_box, radius=5, outline=INK, width=5)

    # Title text, intentionally limited to one or two clean lines.
    title_x = 560
    if len(title_lines) == 1:
        draw.text((title_x, (y0+y1)//2), title_lines[0], font=font(FONT_BLACK, 74), fill=INK, anchor="lm")
    else:
        draw.text((title_x, (y0+y1)//2 - 54), title_lines[0], font=font(FONT_BLACK, 62), fill=INK, anchor="lm")
        draw.text((title_x, (y0+y1)//2 + 54), title_lines[1], font=font(FONT_BLACK, 62), fill=INK, anchor="lm")

    # Price is the strongest element in each row.
    centered(draw, (2040, (y0+y1)//2), price, font(FONT_BLACK, 126), NAVY)

# Bundle price. No sales copy, just the offer.
bundle = (150, 2425, 2250, 2835)
draw.rounded_rectangle(bundle, radius=38, fill=NAVY)
centered(draw, (1200, 2545), "ALL FOUR SIGNED", font(FONT_BLACK, 84), WHITE)
centered(draw, (1200, 2707), "$40", font(FONT_BLACK, 154), GOLD)

rgb = img.convert("RGB")
png_path = OUT / "book-prices-clean-8x10-sign.png"
pdf_path = OUT / "book-prices-clean-8x10-sign.pdf"
rgb.save(png_path, "PNG", dpi=(300, 300), optimize=True)
rgb.save(pdf_path, "PDF", resolution=300.0, quality=100)
print(png_path)
print(pdf_path)
print(f"pixels={W}x{H} dpi=300 page_inches=8x10")
