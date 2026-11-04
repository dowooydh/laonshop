// 상품 상세의 상품정보 고시와 배송·교환·반품 안내. 사이즈는 별도 공개 섹션에서 표시한다.
import Link from "next/link";
import type { ReactNode } from "react";

const NOTICE_ROWS: [string, string][] = [
  ["제품 소재", "상품 상세 설명 및 제품 라벨 참조"],
  ["색상·치수", "색상은 상품 이미지, 실제 치수는 제품 라벨·고객센터에서 확인"],
  ["제조자(수입자)", "㈜커스텀오더 셀렉트 (브랜드별 상이, 제품 라벨 표기)"],
  ["제조국", "제품 라벨 표기"],
  ["세탁 방법", "제품 라벨의 취급 주의사항 참조"],
  ["품질보증 기준", "관련 법령 및 소비자분쟁해결기준에 따름"],
  ["A/S 책임자·연락처", "㈜커스텀오더 고객센터 070-4044-7008"],
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="group border-t border-line">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-sm font-semibold text-fg transition-colors duration-fast hover:text-fg-muted [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 break-keep [overflow-wrap:anywhere]">
          {title}
        </span>
        <span
          aria-hidden
          className="shrink-0 text-fg-subtle transition-transform duration-fast group-open:rotate-45"
        >
          +
        </span>
      </summary>
      <div className="min-w-0 pb-5 text-step--1 leading-relaxed text-fg-muted [overflow-wrap:anywhere]">
        {children}
      </div>
    </details>
  );
}

export function ProductInfoSections({ category }: { category: string | null }) {
  return (
    <div
      className="border-b border-line"
      aria-label={`${category ?? "상품"} 상품 고시와 배송 안내`}
    >
      <Section title="상품정보 제공고시">
        <dl className="space-y-2">
          {NOTICE_ROWS.map(([k, v]) => (
            <div
              key={k}
              className="flex min-w-0 flex-col gap-1 sm:flex-row sm:gap-4"
            >
              <dt className="break-keep font-medium text-fg-subtle sm:w-32 sm:shrink-0 sm:font-normal">
                {k}
              </dt>
              <dd className="min-w-0 [overflow-wrap:anywhere]">{v}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="배송·교환·반품">
        <ul className="space-y-1.5">
          <li>전 상품 무료배송 · 결제 확인 후 영업일 2~3일 내 출고</li>
          <li>
            수령 후 7일 이내 청약철회(반품) 가능 · 단순 변심 반품 배송비는
            소비자 부담
          </li>
          <li>상품 하자·오배송은 배송비 전액 회사 부담</li>
        </ul>
        <p className="mt-3">
          <Link
            href="/policy/shipping"
            className="inline-flex min-h-11 min-w-11 items-center rounded px-1 underline underline-offset-2 hover:text-fg focus-visible:ring-2 focus-visible:ring-accent-cyan"
          >
            배송 안내
          </Link>
          {" · "}
          <Link
            href="/policy/refund"
            className="inline-flex min-h-11 min-w-11 items-center rounded px-1 underline underline-offset-2 hover:text-fg focus-visible:ring-2 focus-visible:ring-accent-cyan"
          >
            청약철회·교환·환불 안내
          </Link>
        </p>
      </Section>
    </div>
  );
}
