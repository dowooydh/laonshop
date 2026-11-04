import assert from "node:assert/strict";
import test from "node:test";
import { getProductSizeGuide } from "../../lib/product-size-guide";

test("사이즈 비교는 실제 판매 옵션만 포함하고 예시를 상품 실측과 구분한다", () => {
  const guide = getProductSizeGuide({
    name: "오버핏 반팔 티셔츠",
    category: "상의",
    gender: "men",
    sizes: ["S", "M", "L", "XL", "M"],
  });
  assert.equal(guide.kind, "top");
  assert.deepEqual(
    guide.rows.map((row) => row[0]),
    ["S", "M", "L", "XL"],
  );
  assert.match(guide.note, /상품을 직접 측정한 수치가 아니며/);
  const onlyL = getProductSizeGuide({
    category: "상의",
    gender: "men",
    sizes: ["L"],
  });
  assert.deepEqual(onlyL.rows[0], guide.rows[2]);
});

test("하의 숫자 옵션은 SML 치수를 임의 대입하지 않고 인치를 정확히 환산한다", () => {
  const guide = getProductSizeGuide({
    name: "데님 팬츠",
    category: "하의",
    gender: "men",
    sizes: ["28", "30", "32", "34"],
  });
  assert.equal(guide.kind, "waist");
  assert.deepEqual(guide.rows[1], ["30", "30 in", "76.2 cm"]);
  assert.match(guide.note, /제품 실측과는 다를 수/);
});

test("신발은 해당 옵션 mm를 안내하고 의류 가슴·허리 치수를 만들지 않는다", () => {
  const guide = getProductSizeGuide({
    category: "신발",
    gender: "women",
    sizes: ["230", "240", "250"],
  });
  assert.equal(guide.kind, "footwear");
  assert.deepEqual(guide.rows[1], ["240", "240 mm", "24.0 cm"]);
  assert.ok(!guide.columns.includes("가슴단면"));
});

test("FREE·미지정·가방·스포츠 소품은 임의 의류 치수를 표시하지 않는다", () => {
  for (const sizes of [[], ["FREE"], ["ONE SIZE"]]) {
    const guide = getProductSizeGuide({ category: "상의", sizes });
    assert.equal(guide.kind, "one-size");
    assert.match(guide.note, /모든 체형에 맞는다는 뜻이 아닙니다/);
    assert.ok(guide.rows[0].includes("상품 실측 확인 필요"));
  }
  for (const [category, name] of [
    ["가방", "토트백"],
    ["액세서리", "키링"],
    ["스포츠", "요가 매트"],
    ["스포츠", "니트 레그워머"],
  ]) {
    const guide = getProductSizeGuide({ category, name, sizes: ["S", "M"] });
    assert.equal(guide.kind, "accessory");
    assert.ok(!guide.columns.includes("가슴단면"));
  }
});

test("원피스와 스커트 혼합 분류에서도 상품 종류에 맞는 측정 항목을 고른다", () => {
  const dress = getProductSizeGuide({
    name: "롱 슬립 원피스",
    category: "원피스/스커트",
    gender: "women",
    sizes: ["S", "M"],
  });
  const skirt = getProductSizeGuide({
    name: "A라인 미디 스커트",
    category: "원피스/스커트",
    gender: "women",
    sizes: ["S", "M"],
  });
  assert.equal(dress.kind, "top");
  assert.ok(dress.columns.includes("가슴단면"));
  assert.equal(skirt.kind, "bottom");
  assert.ok(skirt.columns.includes("허리단면"));
});
