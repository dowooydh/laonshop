import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync("data/product-galleries.json", "utf8"));

function framing(shot) {
  switch (shot.role) {
    case "hero":
      return "Show a complete head-to-shoes full-length outfit with the model occupying no more than 70% of the source-frame height. Keep the head, both sleeves, hands, garment hem and shoes inside the center safe area even if the outer 15% at both the top and bottom is removed.";
    case "lifestyle":
      return "Use a natural environmental composition. A medium, three-quarter or full-length view is allowed for variety, but every crop must be intentional and must not cut through the head, hands, elbows, neckline, pockets, fasteners or garment hem. Keep the defining garment construction clearly readable.";
    case "silhouette":
      return "Prioritize the garment's complete rear or side silhouette. Keep the complete neckline, shoulders, sleeves, pockets when present and garment hem inside the center safe area; feet may be outside only when the composition is an intentional three-quarter view.";
    case "product-only":
      return "Show the complete product and, when used, the complete hanger or hook. Keep the neckline, both sleeves and complete garment hem visible with at least 10% breathing room on every edge.";
    case "detail":
      return "Make one deliberate macro close-up of only the construction named in the shot description. Cropping is expected, but it must read as a single real camera detail photograph rather than a split panel or recycled enlargement.";
    default:
      throw new Error(`Unknown product gallery shot role: ${shot.role}`);
  }
}

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
Framing: a single continuous vertical scene prepared for a strict centered 4:5 crop to 1200x1500. ${framing(shot)}
Text (verbatim): none
Hard constraints: one frame only; one scene only; preserve the exact canonical color, pattern, material, sleeves, neckline, fasteners, pockets, proportions and logo state; never invent a jacquard, paisley, embossing, print, logo or decorative weave that is not explicitly named in the canonical fields; no product substitution; no extra copy of the garment
Avoid: collage, diptych, split screen, contact sheet, before-and-after panels, borders, gutters, repeated pose, recycled crop, captions, labels, logos, watermarks, invented surface motifs, distorted anatomy, stretched fabric, accidental joint crop, accidental garment crop, changed color or construction`;
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
