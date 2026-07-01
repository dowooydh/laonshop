export const metadata = { title: "이용약관 · LAON SHOP" };

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 py-4 text-sm leading-relaxed text-fg-muted">
      <h1 className="text-xl font-bold text-fg">이용약관</h1>

      <section>
        <h2 className="mt-4 font-semibold text-fg">제1조 (목적)</h2>
        <p>본 약관은 LAON SHOP(이하 “회사”)이 운영하는 온라인 쇼핑몰에서 제공하는 서비스의 이용조건 및 절차, 회사와 회원 간의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.</p>
      </section>
      <section>
        <h2 className="mt-4 font-semibold text-fg">제2조 (정의)</h2>
        <p>“회원”이란 본 약관에 동의하고 회사가 제공하는 서비스를 이용하는 자를 말합니다. “상품”이란 회사가 판매를 위해 등록한 의류 등 재화를 말합니다.</p>
      </section>
      <section>
        <h2 className="mt-4 font-semibold text-fg">제3조 (약관의 효력 및 변경)</h2>
        <p>본 약관은 서비스 화면에 게시함으로써 효력이 발생합니다. 회사는 관련 법령을 위배하지 않는 범위에서 약관을 변경할 수 있으며, 변경 시 사전 공지합니다.</p>
      </section>
      <section>
        <h2 className="mt-4 font-semibold text-fg">제4조 (회원가입)</h2>
        <p>회원가입은 이용자가 약관에 동의하고 가입 양식에 정보를 기입한 후 회사가 승낙함으로써 성립합니다.</p>
      </section>
      <section>
        <h2 className="mt-4 font-semibold text-fg">제5조 (구매 및 결제)</h2>
        <p>회원은 상품을 선택하여 주문하고, 회사가 제공하는 결제수단(신용카드 등, PG사 KSNET을 통한 결제)으로 대금을 지급합니다. 결제 승인 완료 시 계약이 성립합니다.</p>
      </section>
      <section>
        <h2 className="mt-4 font-semibold text-fg">제6조 (청약철회 및 환불)</h2>
        <p>회원은 「전자상거래 등에서의 소비자보호에 관한 법률」에 따라 상품 수령 후 7일 이내 청약철회를 할 수 있습니다. 자세한 내용은 ‘청약철회·교환·환불 안내’를 따릅니다.</p>
      </section>
      <section>
        <h2 className="mt-4 font-semibold text-fg">제7조 (면책)</h2>
        <p>천재지변 등 불가항력으로 인한 서비스 제공 불가 시 회사는 책임을 지지 않습니다.</p>
      </section>

      <p className="pt-4 text-xs text-fg-subtle">시행일: 2026년 7월 1일</p>
    </div>
  );
}
