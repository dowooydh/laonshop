// KSNET WEBFEP REST — 구인증(수기) 결제. 서버 간 API로 결제창 없이 카드정보 직접 승인.
// 스펙: laonpay_docs/04_PG_KSNET/KSNET_WEBFEP_REST_API_레퍼런스.md (paydev.ksnet.co.kr/kspay/webfep/doc)
//   POST {base}/kspay/webfep/api/v1/card/pay/oldcert · Authorization: pgapi {apiKey}
// ★사업부 별도 계약 필요 — KSPAY_API_KEY 미설정 시 null 반환(호출부에서 심사용 mock 폴백).
// 절대 규칙 2: 카드정보는 요청 후 즉시 폐기, 저장·로그 금지.

export type OldCertRequest = {
  orderNumb: string; // moid (≤50)
  userName: string;
  userEmail?: string;
  productName: string; // ≤50
  totalAmount: number; // 정수(원)
  cardNumb: string; // 15~16자리
  expiryDate: string; // yyMM
  password2: string; // 비밀번호 앞 2자리
  userInfo: string; // 개인: 생년월일 yyMMdd / 법인카드: 사업자번호 10자리
  payload?: string; // 가맹점 패스스루 (orderId)
};

export type OldCertResult =
  | { ok: true; tid: string; approvalNumb: string; cardName: string }
  | { ok: false; message: string };

export async function payOldCert(req: OldCertRequest): Promise<OldCertResult | null> {
  const apiKey = process.env.KSPAY_API_KEY;
  if (!apiKey) return null; // 계약 전 — 호출부가 mock으로 폴백

  const base = process.env.KSPAY_WEBFEP_BASE ?? "https://pay.ksnet.co.kr";
  const mid = process.env.KSPAY_STORE_ID ?? "2999199999";

  try {
    const res = await fetch(`${base}/kspay/webfep/api/v1/card/pay/oldcert`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `pgapi ${apiKey}`,
      },
      body: JSON.stringify({
        mid,
        payload: req.payload ?? "",
        orderNumb: req.orderNumb,
        userName: req.userName,
        userEmail: req.userEmail ?? "",
        productType: "REAL",
        productName: req.productName,
        totalAmount: req.totalAmount,
        cardNumb: req.cardNumb,
        expiryDate: req.expiryDate,
        installMonth: "00", // 일시불
        currencyType: "KRW",
        password2: req.password2,
        userInfo: req.userInfo,
      }),
      cache: "no-store",
    });

    // 공통 envelope { aid, code, message, data } — code A0200 + data.respCode 0000 만 성공
    const json = (await res.json()) as {
      code?: string;
      message?: string;
      data?: { respCode?: string; respMessage?: string; tid?: string; approvalNumb?: string; issuerCardName?: string };
    };
    if (json.code !== "A0200" || json.data?.respCode !== "0000") {
      return { ok: false, message: json.data?.respMessage ?? json.message ?? "카드사 승인이 거절되었습니다." };
    }
    return {
      ok: true,
      tid: json.data.tid ?? "",
      approvalNumb: json.data.approvalNumb ?? "",
      cardName: json.data.issuerCardName ?? "카드",
    };
  } catch {
    // 네트워크/파싱 오류 — 카드정보가 포함될 수 있는 원문은 절대 로깅하지 않는다
    return { ok: false, message: "결제 서버 통신에 실패했습니다. 잠시 후 다시 시도해 주세요." };
  }
}
