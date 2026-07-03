// 상품 상세 하단 고지 3종 — 네이티브 <details> 아코디언 (JS 불필요, 서버 컴포넌트).
// ① 사이즈 가이드(의류몰 필수) ② 상품정보 제공고시(공정위 고시 — 심사 시 판매 실체 확인 요소) ③ 배송·교환·반품 요약.
import Link from "next/link";
import type { ReactNode } from "react";

type Row = [string, ...string[]];

const SIZE_GUIDE: Record<string, { head: string[]; rows: Row[]; note: string }> = {
  아우터: {
    head: ["사이즈", "어깨", "가슴", "총장"],
    rows: [
      ["S", "45", "54", "68"],
      ["M", "47", "57", "71"],
      ["L", "49", "60", "74"],
      ["XL", "51", "63", "76"],
    ],
    note: "단위 cm · 표준 실측 기준, 상품별 ±1~2cm 오차가 있을 수 있습니다.",
  },
  "원피스/스커트": {
    head: ["사이즈", "허리", "힙", "총장"],
    rows: [
      ["S", "64", "90", "88"],
      ["M", "68", "94", "90"],
      ["L", "72", "98", "92"],
    ],
    note: "단위 cm · 표준 실측 기준, 상품별 ±1~2cm 오차가 있을 수 있습니다.",
  },
  상의: {
    head: ["사이즈", "어깨", "가슴", "총장"],
    rows: [
      ["S", "43", "50", "66"],
      ["M", "45", "53", "69"],
      ["L", "47", "56", "72"],
      ["XL", "49", "59", "74"],
    ],
    note: "단위 cm · 표준 실측 기준, 상품별 ±1~2cm 오차가 있을 수 있습니다.",
  },
  하의: {
    head: ["사이즈", "허리", "힙", "총장"],
    rows: [
      ["S", "70", "94", "98"],
      ["M", "74", "98", "100"],
      ["L", "78", "102", "102"],
      ["XL", "82", "106", "104"],
    ],
    note: "단위 cm · 표준 실측 기준, 상품별 ±1~2cm 오차가 있을 수 있습니다.",
  },
  신발: {
    head: ["표기", "발길이(mm)"],
    rows: [
      ["230–235", "230–235"],
      ["240–245", "240–245"],
      ["250–260", "250–260"],
      ["270–280", "270–280"],
    ],
    note: "정사이즈 기준 · 발볼이 넓은 경우 반 사이즈 업을 권장합니다.",
  },
};

const NOTICE_ROWS: [string, string][] = [
  ["제품 소재", "상품 상세 설명 및 제품 라벨 참조"],
  ["색상·치수", "상품 이미지 및 사이즈 가이드 참조"],
  ["제조자(수입자)", "㈜커스텀오더 셀렉트 (브랜드별 상이, 제품 라벨 표기)"],
  ["제조국", "제품 라벨 표기"],
  ["세탁 방법", "제품 라벨의 취급 주의사항 참조"],
  ["품질보증 기준", "관련 법령 및 소비자분쟁해결기준에 따름"],
  ["A/S 책임자·연락처", "㈜커스텀오더 고객센터 070-4044-7008"],
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="group border-t border-line">
      <summary className="flex cursor-pointer list-none items-center justify-between py-4 font-mono text-step--1 uppercase tracking-widest text-fg-muted transition-colors duration-fast hover:text-fg [&::-webkit-details-marker]:hidden">
        {title}
        <span aria-hidden className="text-fg-subtle transition-transform duration-fast group-open:rotate-45">
          +
        </span>
      </summary>
      <div className="pb-5 text-step--1 leading-relaxed text-fg-muted">{children}</div>
    </details>
  );
}

export function ProductInfoSections({ category }: { category: string | null }) {
  const guide = SIZE_GUIDE[category ?? ""] ?? null;

  return (
    <div className="mt-10 border-b border-line">
      {guide && (
        <Section title="사이즈 가이드">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-line font-mono text-fg-subtle">
                {guide.head.map((h) => (
                  <th key={h} className="py-2 pr-4 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums">
              {guide.rows.map((r) => (
                <tr key={r[0]} className="border-b border-line/50">
                  {r.map((c, i) => (
                    <td key={i} className={`py-2 pr-4 ${i === 0 ? "font-semibold text-fg" : ""}`}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-fg-subtle">{guide.note}</p>
        </Section>
      )}

      <Section title="상품정보 제공고시">
        <dl className="space-y-2">
          {NOTICE_ROWS.map(([k, v]) => (
            <div key={k} className="flex gap-4">
              <dt className="w-32 shrink-0 text-fg-subtle">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="배송·교환·반품">
        <ul className="space-y-1.5">
          <li>전 상품 무료배송 · 결제 확인 후 영업일 2~3일 내 출고</li>
          <li>수령 후 7일 이내 청약철회(반품) 가능 · 단순 변심 반품 배송비는 소비자 부담</li>
          <li>상품 하자·오배송은 배송비 전액 회사 부담</li>
        </ul>
        <p className="mt-3">
          <Link href="/policy/shipping" className="underline underline-offset-2 hover:text-fg">
            배송 안내
          </Link>
          {" · "}
          <Link href="/policy/refund" className="underline underline-offset-2 hover:text-fg">
            청약철회·교환·환불 안내
          </Link>
        </p>
      </Section>
    </div>
  );
}
