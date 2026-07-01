export const metadata = { title: "개인정보처리방침 · RYU SHOP" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 py-4 text-sm leading-relaxed text-gray-700">
      <h1 className="text-xl font-bold text-gray-900">개인정보처리방침</h1>

      <section>
        <h2 className="mt-4 font-semibold text-gray-900">1. 수집하는 개인정보 항목</h2>
        <p>회원가입 및 주문 처리를 위해 다음 정보를 수집합니다: 이름, 이메일, 휴대폰번호, 배송지 주소, 주문·결제 내역.</p>
      </section>
      <section>
        <h2 className="mt-4 font-semibold text-gray-900">2. 개인정보의 수집 및 이용목적</h2>
        <p>회원 관리, 상품 주문·배송, 결제 처리 및 대금 정산, 고객 문의 응대, 법령상 의무 이행을 위해 이용합니다.</p>
      </section>
      <section>
        <h2 className="mt-4 font-semibold text-gray-900">3. 개인정보의 보유 및 이용기간</h2>
        <p>회원 탈퇴 시 지체 없이 파기합니다. 단, 전자상거래법 등 관련 법령에 따라 계약·청약철회 기록(5년), 대금결제 기록(5년), 소비자 불만·분쟁처리 기록(3년)은 해당 기간 보관합니다.</p>
      </section>
      <section>
        <h2 className="mt-4 font-semibold text-gray-900">4. 개인정보의 제3자 제공</h2>
        <p>결제 처리를 위해 결제대행사(KSNET)에 결제에 필요한 정보가 제공되며, 배송을 위해 배송업체에 수령인 정보가 제공됩니다. 그 외 본인 동의 없이 제3자에게 제공하지 않습니다.</p>
      </section>
      <section>
        <h2 className="mt-4 font-semibold text-gray-900">5. 개인정보의 파기</h2>
        <p>보유기간이 경과하거나 처리목적이 달성된 개인정보는 지체 없이 안전하게 파기합니다.</p>
      </section>
      <section>
        <h2 className="mt-4 font-semibold text-gray-900">6. 개인정보보호책임자</h2>
        <p>성명: 유동혁 / 연락처: help@ryushop.kr (사업자 정보 확정 후 갱신)</p>
      </section>
    </div>
  );
}
