import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

test("상품 사진 프롬프트는 4:5 안전영역과 임의 무늬 생성을 금지한다", () => {
  const output = execFileSync(process.execPath, ["scripts/product-gallery-prompts.mjs", "p-1dtc2le", "1"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  const generated = JSON.parse(output) as { prompt: string };

  assert.match(generated.prompt, /outer 15% at both the top and bottom is removed/);
  assert.match(generated.prompt, /complete head-to-shoes full-length outfit/);
  assert.match(generated.prompt, /no more than 70% of the source-frame height/);
  assert.match(generated.prompt, /never invent a jacquard, paisley, embossing/);
  assert.match(generated.prompt, /accidental joint crop, accidental garment crop/);
});

test("2차 상품 프롬프트는 SKU 명세와 제품 단독컷 역할을 그대로 결박한다", () => {
  const output = execFileSync(process.execPath, ["scripts/product-gallery-prompts.mjs", "p-ijqnm5", "4"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  const generated = JSON.parse(output) as {
    batch: string;
    name: string;
    role: string;
    prompt: string;
  };

  assert.equal(generated.batch, "b02");
  assert.equal(generated.name, "포켓 반팔 티");
  assert.equal(generated.role, "product-only");
  assert.match(generated.prompt, /무늬 없는 뮤트 올리브/);
  assert.match(generated.prompt, /왼쪽 사각 패치 포켓 1개/);
  assert.match(generated.prompt, /페이즐리·음각·프린트·로고 없음/);
  assert.match(generated.prompt, /Show the complete product and, when used, the complete hanger or hook/);
});

test("라이프스타일과 디테일은 전신 반복 대신 역할에 맞는 의도적 구도를 허용한다", () => {
  const lifestyle = JSON.parse(
    execFileSync(process.execPath, ["scripts/product-gallery-prompts.mjs", "p-ys2snp", "2"], {
      cwd: process.cwd(),
      encoding: "utf8",
    }),
  ) as { role: string; prompt: string };
  const detail = JSON.parse(
    execFileSync(process.execPath, ["scripts/product-gallery-prompts.mjs", "p-ys2snp", "5"], {
      cwd: process.cwd(),
      encoding: "utf8",
    }),
  ) as { role: string; prompt: string };

  assert.equal(lifestyle.role, "lifestyle");
  assert.match(lifestyle.prompt, /medium, three-quarter or full-length view is allowed for variety/);
  assert.doesNotMatch(lifestyle.prompt, /no more than 70% of the source-frame height/);
  assert.equal(detail.role, "detail");
  assert.match(detail.prompt, /one deliberate macro close-up/);
  assert.match(detail.prompt, /Cropping is expected/);
});
