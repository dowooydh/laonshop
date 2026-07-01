/**
 * KspayProvider — KSNET KSPAY 통합모듈 V1.4 (결제창 리다이렉트) 골격.
 * 근거: laonpay_docs/04_PG_KSNET/KSNET_KSPAY_연동스펙_레퍼런스.md
 *      (통합모듈관련안내문서(V1.4)(WEB).docx + 통합모듈V1.4 (PC)/web/JSP/utf-8 샘플 분석본)
 *
 * 플로우:
 *  [1] createAuthOrder → KSPayWeb 폼(snd*) 구성, kspay_web_ssl.js의 _pay()가
 *      https://kspay.ksnet.to/store/KSPayWebV1.4/KSPayPWeb.jsp 로 POST (iframe)
 *  [2] KSNET → sndReply(rcv 핸들러)로 reCommConId/reCommType/reHash POST
 *  [3] approveAuthCallback → recv_post.jsp에 sndActionType=1 서버 승인 (거래 성립 시점)
 *      응답: 백틱(`) 구분 EUC-KR 문자열, authyn === 'O' 만 성공
 */
import { sanitizePgParam } from "@/lib/format";
import type {
  AuthOrderRequest,
  AuthOrderResponse,
  CancelRequest,
  CancelResult,
  EasyPayRequest,
  InquiryResult,
  OldAuthRequest,
  PgApprovalResult,
  PgProvider,
  RecurringChargeRequest,
} from "./types";

const KSPAY_PWEB_URL = "https://kspay.ksnet.to/store/KSPayWebV1.4/KSPayPWeb.jsp";
// 원본 샘플 기준 http — 운영 전 KSNET에 https 지원 확인 필요
const KSPAY_WEBHOST_URL = "http://kspay.ksnet.to/store/KSPayWebV1.4/web_host/recv_post.jsp";
const RECEIPT_URL = "https://ksta.ksnet.co.kr/mint/tsk/pgi01/mad/pgimad04m0.jsp";

/** 승인 응답 요청 필드 (백틱 구분). 원본 샘플 + resultcd 추가 요청 */
const RPARAMS = [
  "authyn", "trno", "trddt", "trdtm", "amt", "authno",
  "msg1", "msg2", "ordno", "isscd", "aqucd", "result", "resultcd",
] as const;

export class KspayProvider implements PgProvider {
  readonly mode = "kspay" as const;

  constructor(
    private readonly config: {
      storeId: string; // 상점ID — 테스트: 2999199999
      storeKey?: string; // NEEDS_PG_SPEC: V1.4 결제창 방식엔 Key 사용처 없음(reHash 검증 스펙 미공개)
    },
  ) {}

  async createAuthOrder(req: AuthOrderRequest): Promise<AuthOrderResponse> {
    // 금지 특수문자(` ~ ' ") 제거 — 백틱은 응답 프로토콜 구분자
    const formFields: Record<string, string> = {
      // 공통 (JSP utf-8 샘플 기준 — sndPaymethod 자릿수는 모듈 버전 확인 필요)
      sndPaymethod: "1000000000", // 신용카드만 (간편결제는 sndQpayType으로 결제창 내 표시)
      sndStoreid: this.config.storeId,
      sndOrdernumber: sanitizePgParam(req.moid),
      sndGoodname: sanitizePgParam(req.goodsName).slice(0, 25),
      sndAmount: String(req.amount), // 콤마/단위 금지
      sndOrdername: sanitizePgParam(req.ordername).slice(0, 25),
      sndEmail: req.buyerEmail ?? "",
      sndMobile: (req.buyerPhone ?? "").replace(/\D/g, ""), // 하이픈 금지
      sndReply: req.callbackUrl, // rcv 핸들러 절대 URL
      sndCharSet: "utf-8",
      iframeYn: "Y",
      // 신용카드
      sndShowcard: "C",
      sndCurrencytype: "WON",
      sndInstallmenttype: "ALL(0:2:3:4:5:6:7:8:9:10:11:12)",
      sndInteresttype: "NONE",
      sndQpayType: "1", // 결제창 내 간편결제 표시 (EASY)
      // hidden — rcv 브릿지의 eparamSet()이 채움 (변수명 변경 금지)
      reCommConId: "",
      reCommType: "",
      reHash: "",
      // 가맹점 임의 패스스루 (KSNET 미저장 — order→result 폼 전달용)
      // 필드명은 샘플(kspay_wh_order.html / result.jsp) 기준 a/b/c/d. a=우리 paymentId, b=결과 복귀 경로
      a: req.paymentId,
      b: req.returnUrl,
      c: "",
      d: "",
    };
    return { formAction: KSPAY_PWEB_URL, formFields };
  }

  async approveAuthCallback(params: Record<string, string>): Promise<PgApprovalResult> {
    const amount = Number(params.sndAmount ?? params.amount ?? 0);

    // 사용자가 결제창에서 취소
    if (params.reCnclType === "1") {
      return { success: false, amount, failReason: "사용자 결제 취소" };
    }
    const commConId = params.reCommConId;
    if (!commConId) {
      return { success: false, amount, failReason: "인증키(reCommConId) 누락" };
    }

    // [3] 서버 승인 — sndActionType=1 (이 호출이 실제 거래 성립 시점)
    const body = new URLSearchParams({
      sndCommConId: commConId,
      sndActionType: "1",
      sndAmount: String(amount),
      sndRpyParams: RPARAMS.join("`"),
    });
    const res = await fetch(KSPAY_WEBHOST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const buf = await res.arrayBuffer();
    // msg1/msg2 한글 — EUC-KR 디코딩 필수 (Node full-ICU 기본 내장)
    const text = new TextDecoder("euc-kr").decode(buf);

    // 백틱 split: parts[0]은 선행 토큰 — 버리고 names[i] → parts[i+1] 매핑
    const parts = text.split("`");
    if (parts.length <= RPARAMS.length) {
      return {
        success: false,
        amount,
        failReason: "승인 응답 파싱 실패 — kspay_send_msg(1) 재조회 필요(당일 한정)",
        raw: { response: text.slice(0, 500) },
      };
    }
    const r: Record<string, string> = {};
    RPARAMS.forEach((name, i) => (r[name] = (parts[i + 1] ?? "").trim()));

    const success = r.authyn === "O"; // 유일한 성공 판정 기준 (대문자 O)
    return {
      success,
      approvalNo: success ? r.authno : undefined, // 거절 시 authno=에러코드 — 노출 금지
      pgTrno: r.trno, // 영수증/취소 Key (성공/실패 무관 유니크)
      installment: r.halbu ? Number(r.halbu) : undefined,
      amount: Number(r.amt || amount),
      paidAt: success ? new Date() : undefined,
      failReason: success ? undefined : [r.msg1, r.msg2].filter(Boolean).join(" ") || "승인 거절",
      raw: r, // cardno는 RPARAMS에 미요청 — 카드정보 비저장 원칙
    };
  }

  // NEEDS_PG_SPEC: 구인증(직접입력) API — KSNET V1.4 샘플에 없음. 별도 스펙 요청 중 (pgmodule@ksnet.co.kr)
  async payOldAuth(_req: OldAuthRequest): Promise<PgApprovalResult> {
    throw new Error("NEEDS_PG_SPEC: KSNET 구인증 직접입력 API 스펙 미수령 — PG_MODE=mock 사용");
  }

  // NEEDS_PG_SPEC: 간편결제(네이버페이 등)는 PG 결제창에 통합 — PG사·수단 확정 후 createAuthOrder에 반영
  async payEasy(_req: EasyPayRequest): Promise<PgApprovalResult> {
    throw new Error("NEEDS_PG_SPEC: 간편결제 PG 연동 미확정 — PG_MODE=mock 사용");
  }

  // NEEDS_PG_SPEC: V1.4 문서·샘플에 취소 API 없음 — KSTA 관리자페이지(ksta.ksnet.co.kr) 수동 취소
  async cancel(_req: CancelRequest): Promise<CancelResult> {
    throw new Error("NEEDS_PG_SPEC: KSNET 취소 API 스펙 미수령 — 관리자 '수동 처리 기록' 사용");
  }

  // NEEDS_PG_SPEC: 거래조회 REST API 없음. 당일 한정 kspay_send_msg(1) 재조회만 존재
  async inquiry(_req: { moid: string; pgTrno?: string }): Promise<InquiryResult> {
    throw new Error("NEEDS_PG_SPEC: KSNET 거래조회 API 스펙 미수령");
  }

  // NEEDS_PG_SPEC: 빌링키 없는 정기결제의 PG 구현 방식 확인 중 (지시서 11장 3)
  async chargeRecurring(_req: RecurringChargeRequest): Promise<PgApprovalResult> {
    throw new Error("NEEDS_PG_SPEC: 빌링키 없는 정기결제 방식 미확정 — PG_MODE=mock 사용");
  }

  /** 신용카드 매출전표: ?tr_no={trno} */
  receiptUrl(pgTrno: string): string {
    return `${RECEIPT_URL}?tr_no=${encodeURIComponent(pgTrno)}`;
  }
}
