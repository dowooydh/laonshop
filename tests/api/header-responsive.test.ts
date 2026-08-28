import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = process.cwd();

test("전역 헤더는 큰 글자에서 행을 나누고 사용자 명령을 자르지 않는다", () => {
  const layout = fs.readFileSync(path.join(ROOT, "app/layout.tsx"), "utf8");
  const header = layout.match(/<header[\s\S]*?<\/header>/)?.[0];

  assert.ok(header, "전역 header를 찾을 수 있어야 한다");
  assert.match(header, /max-w-6xl flex-wrap/);
  assert.match(header, /max-w-full shrink-0 flex-wrap/);
  assert.doesNotMatch(header, /sm:flex-nowrap/);
  assert.doesNotMatch(header, /max-w-\[7rem\]|\btruncate\b/);
  assert.match(header, />마이페이지<\/span>/);
  assert.match(
    header,
    /href="\/shop\/men"[\s\S]*?inline-flex min-h-11 min-w-11/,
  );
  assert.match(
    header,
    /href=\{user\.role[\s\S]*?min-h-11 min-w-11/,
  );
  assert.match(
    header,
    /href="\/search"[\s\S]*?flex min-h-11 min-w-11/,
  );
});
