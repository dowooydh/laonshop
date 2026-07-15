#!/usr/bin/env python3
import argparse
import json
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps


def load_products():
    raw = subprocess.check_output(["node", "scripts/detail-image-prompts.mjs", "--json"], text=True)
    return json.loads(raw)


def load_font(size):
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/Library/Fonts/Arial Unicode.ttf",
    ]
    for candidate in candidates:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


def fit_text(draw, text, font, max_width):
    words = text.split(" ")
    lines = []
    line = ""
    for word in words:
        candidate = f"{line} {word}".strip()
        if draw.textbbox((0, 0), candidate, font=font)[2] <= max_width:
            line = candidate
        else:
            if line:
                lines.append(line)
            line = word
    if line:
        lines.append(line)
    return lines


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--start", type=int, default=0)
    parser.add_argument("--end", type=int, required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--root", default="public/products/detail")
    args = parser.parse_args()

    products = load_products()[args.start : args.end]
    thumb_w = 180
    thumb_h = 225
    label_w = 260
    pad = 14
    row_h = thumb_h + pad * 2
    width = label_w + thumb_w * 4 + pad * 6
    height = row_h * len(products)

    sheet = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(sheet)
    label_font = load_font(16)
    meta_font = load_font(12)

    for row, product in enumerate(products):
        y = row * row_h
        if row % 2:
            draw.rectangle((0, y, width, y + row_h), fill=(246, 247, 249))

        label = f"{product['index']:03d} {product['name']}"
        meta = f"{product['gender']} / {product['category']}"
        for line_index, line in enumerate(fit_text(draw, label, label_font, label_w - pad * 2)):
            draw.text((pad, y + pad + line_index * 22), line, fill=(20, 24, 33), font=label_font)
        draw.text((pad, y + pad + 54), meta, fill=(95, 104, 116), font=meta_font)

        slug = product["slug"]
        for index in range(4):
            path = Path(args.root) / slug / f"{index + 1:02d}.webp"
            x = label_w + pad + index * (thumb_w + pad)
            if path.exists():
                with Image.open(path) as source:
                    image = ImageOps.pad(
                        source.convert("RGB"),
                        (thumb_w, thumb_h),
                        method=Image.Resampling.LANCZOS,
                        color=(245, 245, 245),
                        centering=(0.5, 0.5),
                    )
                sheet.paste(image, (x, y + pad))
            else:
                draw.rectangle((x, y + pad, x + thumb_w, y + pad + thumb_h), outline=(220, 80, 80), width=3)
                draw.text((x + 18, y + pad + 110), "missing", fill=(180, 40, 40), font=label_font)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out, quality=88)
    print(out)


if __name__ == "__main__":
    main()
