#!/usr/bin/env python3
import sys
from pathlib import Path
from PIL import Image, ImageOps


# LAON SHOP 상품 카드·상세 이미지 공통 권장 규격: 4:5 portrait.
TARGET_SIZE = (1200, 1500)
PAIRINGS = ((0, 1), (2, 3), (4, 0), (1, 4))


def split_panels(image: Image.Image) -> list[Image.Image]:
    width, height = image.size
    panel_width = width // 5
    gutter = max(0, round(width * 0.002))

    panels = []
    for index in range(5):
        left = index * panel_width + (0 if index == 0 else gutter)
        right = width if index == 4 else (index + 1) * panel_width - gutter
        panels.append(image.crop((left, 0, right, height)))
    return panels


def make_diptych(left: Image.Image, right: Image.Image) -> Image.Image:
    """두 원본 패널을 한 프레임에 배치해 비율과 전체 상품을 함께 보존한다."""
    height = min(left.height, right.height)
    left = ImageOps.fit(left, (round(left.width * height / left.height), height), Image.Resampling.LANCZOS)
    right = ImageOps.fit(right, (round(right.width * height / right.height), height), Image.Resampling.LANCZOS)

    # 원본 시트의 얇은 경계가 남지 않도록 바깥쪽 0.5%만 정리한다.
    trim_left = max(1, round(left.width * 0.005))
    trim_right = max(1, round(right.width * 0.005))
    left = left.crop((trim_left, 0, left.width - trim_left, height))
    right = right.crop((trim_right, 0, right.width - trim_right, height))

    gutter = max(2, round(height * 0.004))
    diptych = Image.new("RGB", (left.width + gutter + right.width, height), (242, 242, 242))
    diptych.paste(left, (0, 0))
    diptych.paste(right, (left.width + gutter, 0))

    # 단일 배율만 사용한다. 패널 자체를 가로로 늘리거나 전신을 반으로 자르지 않는다.
    return ImageOps.fit(
        diptych,
        TARGET_SIZE,
        method=Image.Resampling.LANCZOS,
        centering=(0.5, 0.5),
    )


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: python3 scripts/split-detail-sheet.py <source-image> <destination-dir>", file=sys.stderr)
        return 1

    source = Path(sys.argv[1]).resolve()
    destination = Path(sys.argv[2]).resolve()
    destination.mkdir(parents=True, exist_ok=True)

    image = Image.open(source).convert("RGB")
    panels = split_panels(image)

    for index, (left_index, right_index) in enumerate(PAIRINGS, start=1):
        panel = make_diptych(panels[left_index], panels[right_index])
        output = destination / f"{index:02d}.webp"
        panel.save(output, "WEBP", quality=88, method=6)
        print(output)

    print(f"Wrote 4 editorial detail images to {destination}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
