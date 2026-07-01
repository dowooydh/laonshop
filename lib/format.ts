/** 금액/주문번호 포맷 유틸 (라온페이 @laonpay/shared에서 발췌 — 이 앱이 쓰는 것만) */

/** 1234567 → "1,234,567원" */
export function formatKrw(amount: number): string {
  return `${amount.toLocaleString("ko-KR")}원`;
}

/** 1234567 → "₩1,234,567" */
export function formatKrwSign(amount: number): string {
  return `₩${amount.toLocaleString("ko-KR")}`;
}

/** 주문번호(moid) 자동생성 — LP + yyyyMMdd + HHmmss + 랜덤3 (특수문자 금지: KSNET 제약) */
export function generateMoid(now = new Date()): string {
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  const rand = String(Math.floor(Math.random() * 1000)).padStart(3, "0");
  return `LP${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}${rand}`;
}

/** KSNET 요청 파라미터 금지 특수문자 제거: ` ~ ' " */
export function sanitizePgParam(value: string): string {
  return value.replace(/[`~'"]/g, "");
}
