import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const TELECOM_SALES_REPORT_NUMBER = "2025-성남분당A-0152";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

test("footer는 발급된 통신판매업신고번호를 표시하고 예정 문구를 남기지 않는다", () => {
  const layout = source("app/layout.tsx");

  assert.match(
    layout,
    new RegExp(`통신판매업신고번호: ${TELECOM_SALES_REPORT_NUMBER}`),
  );
  assert.doesNotMatch(layout, /통신판매업신고[^\n<]*신고 예정/);
});
