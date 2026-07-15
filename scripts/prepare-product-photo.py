#!/usr/bin/env python3
import argparse
from pathlib import Path

from PIL import Image, ImageOps


TARGET_SIZE = (1200, 1500)


def parse_args():
    parser = argparse.ArgumentParser(
        description="Convert one full-frame product photograph to LAON SHOP's 4:5 WebP format without stretching."
    )
    parser.add_argument("source")
    parser.add_argument("destination")
    parser.add_argument("--x", type=float, default=0.5, help="horizontal crop center, 0..1")
    parser.add_argument("--y", type=float, default=0.5, help="vertical crop center, 0..1")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if not 0 <= args.x <= 1 or not 0 <= args.y <= 1:
        raise ValueError("crop center must be between 0 and 1")

    source = Path(args.source).expanduser().resolve()
    destination = Path(args.destination).expanduser().resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)

    with Image.open(source) as opened:
        image = ImageOps.exif_transpose(opened).convert("RGB")
        # 단일 배율로 확대·축소하고 넘치는 가장자리만 자른다. 가로·세로를
        # 따로 늘리지 않으므로 인물과 상품의 원래 비율은 항상 유지된다.
        prepared = ImageOps.fit(
            image,
            TARGET_SIZE,
            method=Image.Resampling.LANCZOS,
            centering=(args.x, args.y),
        )
        prepared.save(destination, "WEBP", quality=88, method=6)

    print(destination)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
