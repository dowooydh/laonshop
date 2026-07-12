// 자주 묻는 질문 + 고객센터 — 네이티브 <details> 아코디언 (정책 페이지와 중복 없이 6문항)
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata = { title: "자주 묻는 질문" };

const FAQS: { q: string; a: ReactNode }[] = [
  {
    q: "배송은 얼마나 걸리나요?",
    a: (
      <>
        결제 확인 후 영업일 기준 2~3일 이내 출고되며, 출고 후 1~2일 내 받아보실 수 있습니다. 전 상품
        무료배송입니다. 자세한 내용은{" "}
        <Link href="/policy/shipping" className="underline underline-offset-2 hover:text-fg">
          배송 안내
        </Link>
        를 확인해 주세요.
      </>
    ),
  },
  {
    q: "교환·반품은 어떻게 하나요?",
    a: (
      <>
        상품 수령 후 7일 이내에 마이페이지 → 주문 상세의 ‘취소·반품 신청’ 버튼 또는 고객센터로 신청할 수
        있습니다. 단순 변심 반품 배송비는 소비자 부담, 하자·오배송은 회사 부담입니다. 자세한 내용은{" "}
        <Link href="/policy/refund" className="underline underline-offset-2 hover:text-fg">
          청약철회·교환·환불 안내
        </Link>
        를 확인해 주세요.
      </>
    ),
  },
  {
    q: "어떤 결제수단을 쓸 수 있나요?",
    a: "신용카드와 간편결제(카카오페이·네이버페이·삼성페이)를 지원합니다. 결제는 KSPAY(KSNET) 인증결제창에서 안전하게 처리되며, 카드 정보는 저장되지 않습니다. 계좌이체·무통장입금은 순차 오픈 예정입니다.",
  },
  {
    q: "결제 영수증(매출전표)은 어디서 확인하나요?",
    a: "마이페이지 → 주문 상세에서 ‘영수증 보기’로 카드 매출전표를 확인할 수 있습니다.",
  },
  {
    q: "사이즈 선택이 고민돼요.",
    a: "각 상품 상세의 ‘사이즈 가이드’에서 실측 치수를 확인할 수 있습니다. 수령 후 사이즈가 맞지 않으면 동일 상품 재고 보유 시 교환 가능합니다.",
  },
  {
    q: "회원 정보 수정이나 탈퇴는 어디서 하나요?",
    a: "마이페이지 → 설정에서 이름·연락처·기본 배송지 수정, 비밀번호 변경, 회원 탈퇴를 직접 할 수 있습니다.",
  },
];

export default function SupportPage() {
  return (
    <div className="mx-auto max-w-3xl py-6">
      <header className="border-b border-line pb-7">
        <p className="font-mono text-step--1 uppercase tracking-[0.3em] text-accent-cyan">Support · FAQ</p>
        <h1 className="mt-2 font-display text-step-2 font-bold tracking-tight text-fg">자주 묻는 질문</h1>
      </header>

      <div className="mt-4 border-b border-line">
        {FAQS.map(({ q, a }) => (
          <details key={q} className="group border-t border-line">
            <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 py-2 text-[15px] font-medium leading-6 text-fg transition-colors duration-fast hover:text-accent-cyan min-[360px]:text-step-0 [&::-webkit-details-marker]:hidden">
              <span className="min-w-0 text-balance break-keep">{q}</span>
              <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center font-mono text-fg-subtle transition-transform duration-fast group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="pb-6 text-step--1 leading-relaxed text-fg-muted">{a}</p>
          </details>
        ))}
      </div>

      <div className="mt-8 rounded-[var(--radius-lg)] border border-line bg-raised p-5">
        <h2 className="font-mono text-step--1 uppercase tracking-widest text-accent-cyan">고객센터</h2>
        <p className="mt-3 text-step--1 leading-relaxed text-fg-muted [overflow-wrap:anywhere]">
          전화{" "}
          <a href="tel:070-4044-7008" className="text-fg hover:text-accent-cyan">
            070-4044-7008
          </a>{" "}
          (평일 09:00–18:00) · 이메일{" "}
          <a href="mailto:custom_sales@customorder.co.kr" className="text-fg hover:text-accent-cyan">
            custom_sales@customorder.co.kr
          </a>{" "}
          ·{" "}
          <a
            href="https://pf.kakao.com/_UhNxdn/chat"
            target="_blank"
            rel="noopener noreferrer"
            className="text-fg hover:text-accent-cyan"
          >
            카카오톡 문의
          </a>
        </p>
      </div>
    </div>
  );
}
