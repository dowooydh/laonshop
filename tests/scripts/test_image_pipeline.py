import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw


REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPT = REPO_ROOT / "scripts" / "split-detail-sheet.py"


class ProductImagePipelineTest(unittest.TestCase):
    def test_splitter_preserves_geometry_on_non_target_source_ratio(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "source.png"
            output = root / "output"

            sheet = Image.new("RGB", (1000, 500), "white")
            draw = ImageDraw.Draw(sheet)
            for index in range(5):
                panel_left = index * 200
                draw.rectangle((panel_left + 60, 150, panel_left + 140, 350), fill="black")
            sheet.save(source)

            subprocess.run(
                [sys.executable, str(SCRIPT), str(source), str(output)],
                cwd=REPO_ROOT,
                check=True,
                capture_output=True,
                text=True,
            )

            for index in range(1, 6):
                with Image.open(output / f"{index:02d}.webp") as source_image:
                    image = source_image.convert("RGB")
                    self.assertEqual(image.size, (1200, 1500))
                    # 손실 압축 경계 노이즈는 제외하고 검정 기준 도형만 측정한다.
                    mask = image.convert("L").point(lambda value: 255 if value < 64 else 0)
                    bbox = mask.getbbox()
                    self.assertIsNotNone(bbox)
                    assert bbox is not None
                    width = bbox[2] - bbox[0]
                    height = bbox[3] - bbox[1]
                    self.assertAlmostEqual(width / height, 80 / 200, delta=0.02)

    def test_checked_in_product_galleries_are_complete_and_four_by_five(self):
        products = json.loads(
            subprocess.check_output(
                ["node", "scripts/detail-image-prompts.mjs", "--json"],
                cwd=REPO_ROOT,
                text=True,
            )
        )
        detail_root = REPO_ROOT / "public" / "products" / "detail"
        expected_slugs = {product["slug"] for product in products}
        actual_slugs = {path.name for path in detail_root.iterdir() if path.is_dir()}

        self.assertEqual(actual_slugs, expected_slugs)
        for slug in expected_slugs:
            files = sorted((detail_root / slug).glob("*.webp"))
            self.assertEqual([file.name for file in files], [f"{index:02d}.webp" for index in range(1, 6)])
            for file in files:
                with Image.open(file) as image:
                    self.assertEqual(image.size, (1200, 1500), file)


if __name__ == "__main__":
    unittest.main()
