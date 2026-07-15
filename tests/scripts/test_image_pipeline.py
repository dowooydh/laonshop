import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw, ImageStat


REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPT = REPO_ROOT / "scripts" / "prepare-product-photo.py"


class ProductImagePipelineTest(unittest.TestCase):
    @staticmethod
    def _neutral_edge_ratio(image, x):
        pixels = [image.getpixel((x, y)) for y in range(image.height)]
        return sum(all(abs(channel - 245) <= 5 for channel in pixel) for pixel in pixels) / len(pixels)

    @classmethod
    def _artificial_side_padding(cls, image):
        preview = image.convert("RGB").resize((120, 150), Image.Resampling.LANCZOS)
        left = 0
        while left < preview.width and cls._neutral_edge_ratio(preview, left) >= 0.98:
            left += 1
        right = 0
        while right < preview.width and cls._neutral_edge_ratio(preview, preview.width - 1 - right) >= 0.98:
            right += 1
        return (left + right) / preview.width

    def test_preparer_preserves_geometry_on_non_target_source_ratio(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "source.png"
            output = root / "output.webp"

            sheet = Image.new("RGB", (1000, 500), "white")
            draw = ImageDraw.Draw(sheet)
            draw.rectangle((400, 50, 600, 450), fill="black")
            sheet.save(source)

            subprocess.run(
                [sys.executable, str(SCRIPT), str(source), str(output)],
                cwd=REPO_ROOT,
                check=True,
                capture_output=True,
                text=True,
            )

            with Image.open(output) as source_image:
                image = source_image.convert("RGB")
                self.assertEqual(image.size, (1200, 1500))
                mask = image.convert("L").point(lambda value: 255 if value < 64 else 0)
                bbox = mask.getbbox()
                self.assertIsNotNone(bbox)
                assert bbox is not None
                width = bbox[2] - bbox[0]
                height = bbox[3] - bbox[1]
                self.assertAlmostEqual(width / height, 200 / 400, delta=0.02)

    def test_checked_in_product_galleries_are_complete_and_four_by_five(self):
        products = json.loads(
            subprocess.check_output(
                ["node", "scripts/catalog-image-manifest.mjs", "--json"],
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
            self.assertEqual([file.name for file in files], [f"{index:02d}.webp" for index in range(1, 5)])
            for file in files:
                with Image.open(file) as image:
                    self.assertEqual(image.size, (1200, 1500), file)
                    self.assertLessEqual(
                        self._artificial_side_padding(image),
                        0.12,
                        f"{file}: 좌우 인공 레터박스가 다시 생겼습니다.",
                    )

    def test_curated_galleries_are_five_independent_single_frame_photos(self):
        manifest = json.loads((REPO_ROOT / "data" / "product-galleries.json").read_text())
        gallery_root = REPO_ROOT / "public" / "products" / "gallery"

        for product in manifest["products"]:
            folder = gallery_root / product["batch"] / product["slug"]
            files = sorted(folder.glob("*.webp"))
            self.assertEqual([file.name for file in files], [f"{index:02d}.webp" for index in range(1, 6)])
            digests = set()
            for file in files:
                with Image.open(file) as opened:
                    image = opened.convert("RGB")
                    self.assertEqual(image.size, (1200, 1500), file)
                    self.assertLessEqual(self._artificial_side_padding(image), 0.12, file)

                    # 과거 diptych는 정중앙에 여러 픽셀 너비의 균일한 회색 gutter가
                    # 전 높이로 이어졌다. 독립 사진에서는 이 구조를 허용하지 않는다.
                    uniform_center_columns = 0
                    for x in range(590, 611):
                        column = image.crop((x, 0, x + 1, image.height))
                        variance = ImageStat.Stat(column).var
                        if max(variance) < 4:
                            uniform_center_columns += 1
                    self.assertLess(uniform_center_columns, 3, f"{file}: 중앙 분할선/패널 gutter 의심")

                digest = __import__("hashlib").sha256(file.read_bytes()).hexdigest()
                self.assertNotIn(digest, digests, f"{file}: 같은 상품 안에서 완전 중복")
                digests.add(digest)


if __name__ == "__main__":
    unittest.main()
