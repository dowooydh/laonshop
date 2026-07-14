#!/usr/bin/env python3
import sys
from pathlib import Path
from PIL import Image, ImageOps


# LAON SHOP 상품 카드·상세 이미지 공통 권장 규격: 4:5 portrait.
TARGET_SIZE = (1200, 1500)
BACKGROUND = (245, 245, 245)


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: python3 scripts/split-detail-sheet.py <source-image> <destination-dir>", file=sys.stderr)
        return 1

    source = Path(sys.argv[1]).resolve()
    destination = Path(sys.argv[2]).resolve()
    destination.mkdir(parents=True, exist_ok=True)

    image = Image.open(source).convert("RGB")
    width, height = image.size
    panel_width = width // 5
    gutter = max(0, round(width * 0.002))

    for index in range(5):
        left = index * panel_width + (0 if index == 0 else gutter)
        right = width if index == 4 else (index + 1) * panel_width - gutter
        panel = image.crop((left, 0, right, height))
        # 가로·세로를 별도로 늘리지 않는다. 전체 구도를 유지한 채 단일 배율로
        # 축소/확대하고 부족한 영역만 중립 배경으로 채운다.
        panel = ImageOps.pad(
            panel,
            TARGET_SIZE,
            method=Image.Resampling.LANCZOS,
            color=BACKGROUND,
            centering=(0.5, 0.5),
        )
        output = destination / f"{index + 1:02d}.webp"
        panel.save(output, "WEBP", quality=88, method=6)
        print(output)

    print(f"Wrote 5 detail images to {destination}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
