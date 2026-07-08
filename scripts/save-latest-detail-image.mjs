import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const index = Number(process.argv[2]);
if (!Number.isInteger(index)) {
  console.error("Usage: node scripts/save-latest-detail-image.mjs <product-index>");
  process.exit(1);
}

const generatedRoot = join(
  process.env.CODEX_HOME || join(process.env.HOME || "", ".codex"),
  "generated_images",
);

if (!existsSync(generatedRoot)) {
  console.error(`Generated image directory not found: ${generatedRoot}`);
  process.exit(1);
}

const latest = execFileSync("find", [generatedRoot, "-type", "f", "-name", "*.png", "-print"], { encoding: "utf8" })
  .trim()
  .split("\n")
  .filter(Boolean)
  .map((file) => ({ file, mtime: Number(execFileSync("stat", ["-f", "%m", file], { encoding: "utf8" }).trim()) }))
  .sort((a, b) => b.mtime - a.mtime)[0]?.file ?? "";

if (!latest) {
  console.error(`No generated png files found below ${generatedRoot}`);
  process.exit(1);
}

const product = JSON.parse(execFileSync("node", ["scripts/detail-image-prompts.mjs", String(index)], { encoding: "utf8" }));
const outDir = join("public", "products", "detail", product.slug);
execFileSync("python3", ["scripts/split-detail-sheet.py", latest, outDir], { stdio: "inherit" });
console.log(JSON.stringify({ index, name: product.name, slug: product.slug, latest, outDir }, null, 2));
