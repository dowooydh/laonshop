import { readFileSync } from "node:fs";
import ts from "typescript";

const catalogSource = readFileSync("prisma/catalog.ts", "utf8");

function slug(product) {
  const source = [product.gender, product.category, product.name].filter(Boolean).join("-");
  let hash = 2166136261;
  for (let index = 0; index < source.length; index++) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `p-${(hash >>> 0).toString(36)}`;
}

function products() {
  const sourceFile = ts.createSourceFile(
    "prisma/catalog.ts",
    catalogSource,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  let catalogDeclaration;

  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === "CATALOG") {
      catalogDeclaration = node;
      return;
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  if (!catalogDeclaration?.initializer) throw new Error("prisma/catalog.ts에서 CATALOG 선언을 찾지 못했습니다.");

  function unwrap(node) {
    let current = node;
    while (
      ts.isAsExpression(current) ||
      ts.isSatisfiesExpression(current) ||
      ts.isParenthesizedExpression(current) ||
      ts.isTypeAssertionExpression(current)
    ) {
      current = current.expression;
    }
    return current;
  }

  function keyOf(name) {
    if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
    throw new Error(`지원하지 않는 CATALOG 키 표현식: ${name.getText(sourceFile)}`);
  }

  function propertyMap(node) {
    const object = unwrap(node);
    if (!ts.isObjectLiteralExpression(object)) {
      throw new Error(`CATALOG 객체를 해석할 수 없습니다: ${object.getText(sourceFile).slice(0, 80)}`);
    }
    return new Map(
      object.properties.map((property) => {
        if (!ts.isPropertyAssignment(property)) {
          throw new Error(`CATALOG에는 일반 속성만 사용할 수 있습니다: ${property.getText(sourceFile)}`);
        }
        return [keyOf(property.name), property.initializer];
      }),
    );
  }

  function stringValue(node, label) {
    const value = unwrap(node);
    if (!ts.isStringLiteral(value)) throw new Error(`${label}은 문자열 리터럴이어야 합니다.`);
    return value.text;
  }

  function numberValue(node, label) {
    const value = unwrap(node);
    if (!ts.isNumericLiteral(value)) throw new Error(`${label}은 숫자 리터럴이어야 합니다.`);
    return Number(value.text);
  }

  const rows = [];
  const catalog = propertyMap(catalogDeclaration.initializer);
  for (const gender of ["men", "women"]) {
    const genderNode = catalog.get(gender);
    if (!genderNode) throw new Error(`CATALOG.${gender}가 없습니다.`);

    for (const [category, categoryNode] of propertyMap(genderNode)) {
      const entries = unwrap(categoryNode);
      if (!ts.isArrayLiteralExpression(entries)) {
        throw new Error(`CATALOG.${gender}.${category}는 배열이어야 합니다.`);
      }

      for (const [entryIndex, entryNode] of entries.elements.entries()) {
        const entry = propertyMap(entryNode);
        const name = entry.get("name");
        const price = entry.get("price");
        const photoId = entry.get("id");
        if (!name || !price || !photoId) {
          throw new Error(`CATALOG.${gender}.${category}[${entryIndex}] 필드가 누락되었습니다.`);
        }
        rows.push({
          gender,
          category,
          name: stringValue(name, "name"),
          price: numberValue(price, "price"),
          photoId: stringValue(photoId, "id"),
        });
      }
    }
  }

  return rows.map((product, index) => ({ index, slug: slug(product), ...product }));
}

if (process.argv[2] !== "--json") {
  console.error("Usage: node scripts/catalog-image-manifest.mjs --json");
  process.exit(1);
}

console.log(JSON.stringify(products(), null, 2));
