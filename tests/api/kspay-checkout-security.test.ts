import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

test("외부 jQuery 로드는 고정 버전과 SRI 무결성 검사를 사용한다", () => {
  const source = readFileSync(join(process.cwd(), "components/kspay-checkout.tsx"), "utf8");
  assert.match(source, /jquery-1\.12\.4\.min\.js/);
  assert.match(source, /JQUERY_INTEGRITY = "sha256-[A-Za-z0-9+/]+=*"/);
  assert.match(source, /s\.integrity = integrity/);
  assert.match(source, /s\.crossOrigin = "anonymous"/);
  assert.match(source, /s\.referrerPolicy = "no-referrer"/);
});
