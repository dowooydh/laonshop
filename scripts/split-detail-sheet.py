#!/usr/bin/env python3
import sys
from pathlib import Path
from PIL import Image


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
        panel = panel.resize((900, 1200), Image.Resampling.LANCZOS)
        output = destination / f"{index + 1:02d}.webp"
        panel.save(output, "WEBP", quality=88, method=6)
        print(output)

    print(f"Wrote 5 detail images to {destination}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
