import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);

test("패치 minimatch는 실제 TypeScript ESLint 소비 경로의 함수·옵션을 유지한다", () => {
  const fromNextLint = createRequire(require.resolve("eslint-config-next"));
  const fromParser = createRequire(fromNextLint.resolve("@typescript-eslint/parser"));
  const fromEstree = createRequire(fromParser.resolve("@typescript-eslint/typescript-estree"));
  const { minimatch, Minimatch } = fromEstree("minimatch");
  assert.equal(minimatch(".hidden.ts", "*.ts", { dot: true }), true);
  assert.equal(minimatch("lib/item.ts", "app/**/*.ts", { dot: true }), false);
  assert.equal(new Minimatch("{app,lib}/**/*.ts").match("app/checkout/actions.ts"), true);
});

test("기존 ESLint 소비 경로의 minimatch3 함수 API를 메이저 override로 바꾸지 않는다", () => {
  const fromEslint = createRequire(require.resolve("eslint"));
  const minimatch = fromEslint("minimatch");
  assert.equal(typeof minimatch, "function");
  assert.equal(minimatch("app/page.tsx", "**/*.tsx"), true);
  assert.equal(minimatch("app/page.tsx", "**/*.css"), false);
});

test("패치 selector parser는 실제 Tailwind 경로의 클래스 escaping과 속성 선택자를 보존한다", () => {
  const fromTailwind = createRequire(require.resolve("tailwindcss"));
  const selectorParser = fromTailwind("postcss-selector-parser");
  const input = '[data-state="open"] .hover\\:bg-accent-cyan:hover';
  const parsed = selectorParser().astSync(input);
  const classes: string[] = [], attributes: string[] = [];
  parsed.walkClasses((node: { value: string }) => classes.push(node.value));
  parsed.walkAttributes((node: { attribute: string }) => attributes.push(node.attribute));
  assert.deepEqual(classes, ["hover:bg-accent-cyan"]);
  assert.deepEqual(attributes, ["data-state"]);
  assert.equal(parsed.toString(), input);
});

test("패치 source-map-js는 실제 PostCSS의 외부 source map 생성을 유지한다", () => {
  const postcss = require("postcss");
  const result = postcss.parse(".item { color: blue; }", { from: "src/input.css" }).toResult({ from: "src/input.css", to: "dist/output.css", map: { inline: false } });
  assert.match(result.css, /sourceMappingURL=output\.css\.map/);
  const map = result.map.toJSON();
  assert.equal(map.version, 3);
  assert.deepEqual(map.sources, ["../src/input.css"]);
});
