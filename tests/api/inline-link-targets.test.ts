import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = process.cwd();

function source(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function assertAccessibleLink(target: string, href: string) {
  const match = target.match(
    new RegExp(
      `<(?:Link|a)\\b[^>]*href="${escapeRegExp(href)}"[^>]*className="([^"]*)"`,
    ),
  );

  assert.ok(match, `${href} 링크와 className을 찾을 수 있어야 한다`);
  assert.match(match[1], /(?:^|\s)inline-flex(?:\s|$)/, `${href} 링크가 자체 클릭 영역을 가져야 한다`);
  assert.match(match[1], /(?:^|\s)min-h-11(?:\s|$)/, `${href} 링크 높이가 44px 이상이어야 한다`);
  assert.match(match[1], /(?:^|\s)min-w-11(?:\s|$)/, `${href} 링크 너비가 44px 이상이어야 한다`);
  assert.match(match[1], /(?:^|\s)items-center(?:\s|$)/, `${href} 링크 문구가 클릭 영역 중앙에 있어야 한다`);
  assert.match(match[1], /focus-visible:ring-2/, `${href} 링크가 키보드 포커스를 표시해야 한다`);
  assert.match(match[1], /focus-visible:ring-accent-cyan/, `${href} 링크 포커스 색상이 보여야 한다`);
}

test("checkout 구매동의 정책 링크는 각각 44px 클릭 영역을 제공한다", () => {
  const checkout = source("app/checkout/checkout-form.tsx");
  const agreement = checkout.match(/<Checkbox[\s\S]*?<\/Checkbox>/)?.[0];

  assert.ok(agreement, "구매동의 Checkbox를 찾을 수 있어야 한다");
  for (const href of ["/policy/terms", "/policy/privacy", "/policy/refund"]) {
    assertAccessibleLink(agreement, href);
  }
});

test("FAQ와 고객센터 연락 링크는 각각 44px 클릭 영역을 제공한다", () => {
  const support = source("app/support/page.tsx");

  for (const href of [
    "/policy/shipping",
    "/policy/refund",
    "tel:070-4044-7008",
    "mailto:custom_sales@customorder.co.kr",
    "https://pf.kakao.com/_UhNxdn/chat",
  ]) {
    assertAccessibleLink(support, href);
  }
});

test("footer 고객센터 연락 링크는 각각 44px 클릭 영역을 제공한다", () => {
  const layout = source("app/layout.tsx");
  const businessInfo = layout.match(/전자상거래법 제10조[\s\S]*?<\/footer>/)?.[0];

  assert.ok(businessInfo, "footer 사업자정보 영역을 찾을 수 있어야 한다");
  for (const href of ["tel:070-4044-7008", "mailto:custom_sales@customorder.co.kr"]) {
    assertAccessibleLink(businessInfo, href);
  }
});
