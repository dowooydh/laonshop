import { PolicyShell } from "../policy-shell";

export const metadata = { title: "배송 안내" };

export default function ShippingPage() {
  return (
    <PolicyShell eyebrow="Shipping" title="배송 안내" effective="2026년 7월 1일">
      <section>
        <h2>1. 배송비</h2>
        <p>전 상품 무료배송입니다. 결제 금액 외 추가 배송비가 청구되지 않습니다.</p>
      </section>
      <section>
        <h2>2. 배송 기간</h2>
        <p>
          결제 확인 후 영업일 기준 2~3일 이내에 출고되며, 출고 후 1~2일 내 수령할 수 있습니다. 도서·산간
          지역은 1~2일 더 소요될 수 있습니다. 주문 폭주·재고 사정으로 지연될 경우 개별 안내드립니다.
        </p>
      </section>
      <section>
        <h2>3. 배송 방법</h2>
        <p>제휴 택배사를 통해 배송하며, 출고 시 문자 또는 이메일로 송장번호를 안내합니다.</p>
      </section>
      <section>
        <h2>4. 교환·반품 배송</h2>
        <p>
          단순 변심에 의한 교환·반품 배송비는 소비자 부담, 상품 하자·오배송은 회사 부담입니다. 자세한 내용은
          ‘청약철회·교환·환불 안내’를 따릅니다.
        </p>
      </section>
      <section>
        <h2>5. 문의</h2>
        <p>고객센터 070-4044-7008(평일 09:00–18:00) 또는 이메일 custom_sales@customorder.co.kr 로 문의해 주세요.</p>
      </section>
    </PolicyShell>
  );
}
