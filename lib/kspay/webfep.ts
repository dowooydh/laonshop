// KSNET WEBFEP REST — 구인증(수기) 결제. 서버 간 API로 결제창 없이 카드정보 직접 승인.
// 스펙: laonpay_docs/04_PG_KSNET/KSNET_WEBFEP_REST_API_레퍼런스.md (paydev.ksnet.co.kr/kspay/webfep/doc)
//   POST {base}/kspay/webfep/api/v1/card/pay/oldcert · Authorization: pgapi {apiKey}
// ★사업부 별도 계약 필요 — KSPAY_API_KEY + KSPAY_REST_LIVE=1이 모두 있어야 실호출.
// 둘 중 하나라도 없으면 null 반환(호출부에서 허용된 테스트 계정만 mock 폴백).
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
  | { ok: false; message: string; indeterminate?: boolean };

export type KspayRestEnv = {
  KSPAY_API_KEY?: string;
  KSPAY_REST_LIVE?: string;
};

/**
 * WEBFEP 실승인 이중 가드.
 * API 키가 환경에 미리 등록되거나 잘못 노출되어도 명시적 운영 스위치 없이는 외부 승인 API를 호출하지 않는다.
 */
export function isKspayRestLiveEnabled(
  env: KspayRestEnv = {
    KSPAY_API_KEY: process.env.KSPAY_API_KEY,
    KSPAY_REST_LIVE: process.env.KSPAY_REST_LIVE,
  },
): boolean {
  return env.KSPAY_REST_LIVE === "1" && Boolean(env.KSPAY_API_KEY?.trim());
}

export async function payOldCert(req: OldCertRequest): Promise<OldCertResult | null> {
  const apiKey = process.env.KSPAY_API_KEY?.trim();
  if (!isKspayRestLiveEnabled() || !apiKey) return null; // 계약 전/운영 스위치 OFF — 호출부가 제한적으로 mock 폴백

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
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      return { ok: false, message: "결제 서버가 요청을 처리하지 못했습니다. 잠시 후 주문내역을 확인해 주세요.", indeterminate: true };
    }

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
    return {
      ok: false,
      message: "결제 서버 응답을 확인하지 못했습니다. 중복 결제를 피하려면 잠시 후 주문내역을 확인해 주세요.",
      indeterminate: true,
    };
  }
}
