export const metadata = { title: "청약철회·교환·환불 안내 · RYU SHOP" };

export default function RefundPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 py-4 text-sm leading-relaxed text-gray-700">
      <h1 className="text-xl font-bold text-gray-900">청약철회·교환·환불 안내</h1>

      <section>
        <h2 className="mt-4 font-semibold text-gray-900">1. 청약철회 기간</h2>
        <p>상품을 공급받은 날부터 7일 이내에 청약철회(반품)를 신청할 수 있습니다. (전자상거래 등에서의 소비자보호에 관한 법률 제17조)</p>
      </section>
      <section>
        <h2 className="mt-4 font-semibold text-gray-900">2. 청약철회 제한 사유</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>소비자의 책임 있는 사유로 상품이 멸실·훼손된 경우</li>
          <li>소비자의 사용·착용으로 상품의 가치가 현저히 감소한 경우</li>
          <li>포장을 개봉하여 가치가 훼손된 경우(택 제거 등)</li>
        </ul>
      </section>
      <section>
        <h2 className="mt-4 font-semibold text-gray-900">3. 환불 방법 및 시기</h2>
        <p>반품 상품 회수 및 확인 후 3영업일 이내에 결제수단으로 환불합니다. 신용카드 결제의 경우 카드사 승인취소로 처리되며, 카드사 정책에 따라 환불 시점이 다를 수 있습니다.</p>
      </section>
      <section>
        <h2 className="mt-4 font-semibold text-gray-900">4. 교환</h2>
        <p>사이즈·색상 교환은 동일 상품 재고 보유 시 가능하며, 단순 변심에 의한 교환 시 왕복 배송비는 소비자가 부담합니다. 상품 불량·오배송의 경우 배송비는 회사가 부담합니다.</p>
      </section>
      <section>
        <h2 className="mt-4 font-semibold text-gray-900">5. 문의</h2>
        <p>고객센터(0000-0000) 또는 help@ryushop.kr 로 문의해 주세요. (사업자 정보 확정 후 갱신)</p>
      </section>
    </div>
  );
}
