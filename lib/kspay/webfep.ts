// KSNET WEBFEP REST — 구인증(수기) 결제. 서버 간 API로 결제창 없이 카드정보 직접 승인.
// 스펙: laonpay_docs/04_PG_KSNET/KSNET_WEBFEP_REST_API_레퍼런스.md (paydev.ksnet.co.kr/kspay/webfep/doc)
//   POST {base}/kspay/webfep/api/v1/card/pay/oldcert · Authorization: pgapi {apiKey}
// ★사업부 별도 계약 필요 — KSPAY_API_KEY + KSPAY_REST_LIVE=1이 모두 있어야 실호출.
// 둘 중 하나라도 없으면 null 반환하며 UI·서버 모두 비활성화한다.
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
  KSPAY_WEBFEP_BASE?: string;
};

const DEFAULT_WEBFEP_BASE = "https://pay.ksnet.co.kr";
const ALLOWED_WEBFEP_HOSTS = new Set(["pay.ksnet.co.kr", "paydev.ksnet.co.kr"]);

function isAllowedWebfepBase(value: string | undefined): boolean {
  try {
    const url = new URL(value ?? DEFAULT_WEBFEP_BASE);
    return (
      url.protocol === "https:" &&
      ALLOWED_WEBFEP_HOSTS.has(url.hostname) &&
      !url.username &&
      !url.password &&
      !url.port &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

/**
 * WEBFEP 실승인 이중 가드.
 * API 키가 환경에 미리 등록되거나 잘못 노출되어도 명시적 운영 스위치 없이는 외부 승인 API를 호출하지 않는다.
 */
export function isKspayRestLiveEnabled(
  env: KspayRestEnv = {
    KSPAY_API_KEY: process.env.KSPAY_API_KEY,
    KSPAY_REST_LIVE: process.env.KSPAY_REST_LIVE,
    KSPAY_WEBFEP_BASE: process.env.KSPAY_WEBFEP_BASE,
  },
): boolean {
  return (
    env.KSPAY_REST_LIVE === "1" &&
    Boolean(env.KSPAY_API_KEY?.trim()) &&
    isAllowedWebfepBase(env.KSPAY_WEBFEP_BASE)
  );
}

export async function payOldCert(req: OldCertRequest): Promise<OldCertResult | null> {
  const apiKey = process.env.KSPAY_API_KEY?.trim();
  if (!isKspayRestLiveEnabled() || !apiKey) return null; // 계약 전/운영 스위치 OFF — UI·서버 모두 비활성

  const base = process.env.KSPAY_WEBFEP_BASE ?? DEFAULT_WEBFEP_BASE;
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
      // 카드 원문이 담긴 POST body를 301/302/307/308 목적지로 재전송하지 않는다.
      redirect: "error",
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
    const tid = json.data.tid?.trim();
    const approvalNumb = json.data.approvalNumb?.trim();
    if (!tid || tid.length > 128 || !approvalNumb || approvalNumb.length > 64) {
      // 성공 envelope만으로 PAID를 만들지 않는다. 식별자가 없으면 승인 성립 여부가 불명확하다.
      return {
        ok: false,
        message: "결제 승인 식별값을 확인하지 못했습니다. 중복 결제를 피하려면 주문내역을 확인해 주세요.",
        indeterminate: true,
      };
    }
    return {
      ok: true,
      tid,
      approvalNumb,
      cardName: json.data.issuerCardName?.trim().slice(0, 64) || "카드",
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
