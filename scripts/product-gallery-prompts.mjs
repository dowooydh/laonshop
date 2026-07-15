import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync("data/product-galleries.json", "utf8"));

function prompt(product, shot, shotNumber) {
  return `Use case: product-mockup
Asset type: one full-frame LAON SHOP ecommerce product photograph
Primary request: Create exactly one natural 4:5 portrait photograph for ${product.name}. This is image ${shotNumber} of a five-photo set. The garment must be the same exact SKU in every image of the set.
Product: ${product.name}
Category: ${product.gender} / ${product.category}
Canonical color and pattern: ${product.canonical.color}
Canonical material: ${product.canonical.material}
Canonical silhouette: ${product.canonical.silhouette}
Canonical construction: ${product.canonical.construction}
Shot role: ${shot.role}
Composition and setting: ${shot.description}
Style and medium: photorealistic premium Korean online fashion mall photography, natural human anatomy and fabric behavior, believable commercial lighting, real camera depth and texture
Framing: a single continuous vertical scene with enough safe space on every edge for a minimal center crop to 1200x1500; keep the garment's important shape fully visible
Text (verbatim): none
Hard constraints: one frame only; one scene only; preserve the exact canonical color, pattern, material, sleeves, neckline, fasteners, pockets, proportions and logo state; no product substitution; no extra copy of the garment
Avoid: collage, diptych, split screen, contact sheet, before-and-after panels, borders, gutters, repeated pose, recycled crop, captions, labels, logos, watermarks, distorted anatomy, stretched fabric, cut-off garment, changed color or construction`;
}

const [selector, shotArg] = process.argv.slice(2);
const product = manifest.products.find((item) => item.slug === selector) ?? manifest.products[Number(selector)];

if (!product) {
  console.error(`Unknown product gallery selector: ${selector ?? "-"}`);
  process.exit(1);
}

if (shotArg === "--json" || !shotArg) {
  console.log(
    JSON.stringify(
      product.shots.map((shot, index) => ({
        version: manifest.version,
        batch: product.batch,
        slug: product.slug,
        photoId: product.photoId,
        name: product.name,
        shotNumber: index + 1,
        role: shot.role,
        description: shot.description,
        prompt: prompt(product, shot, index + 1),
      })),
      null,
      2,
    ),
  );
  process.exit(0);
}

const shotNumber = Number(shotArg);
const shot = product.shots[shotNumber - 1];
if (!shot) {
  console.error(`Invalid shot number: ${shotArg}. Expected 1..5`);
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      version: manifest.version,
      batch: product.batch,
      slug: product.slug,
      photoId: product.photoId,
      name: product.name,
      shotNumber,
      role: shot.role,
      description: shot.description,
      prompt: prompt(product, shot, shotNumber),
    },
    null,
    2,
  ),
);
