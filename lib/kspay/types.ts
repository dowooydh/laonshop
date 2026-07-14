/**
 * PG 추상화 — 지시서 12장 2: PgProvider 인터페이스 (payAuth/payOldAuth/cancel/inquiry)
 * 운영 경로는 PG_MODE=kspay만 허용한다. 미계약 기능은 mock 승인 없이 안전하게 차단한다.
 *
 * KSNET 미확보 스펙(NEEDS_PG_SPEC): 구인증 직접입력 API, 빌링키 없는 정기결제,
 * 취소 API(V1.4 문서에 없음 — KSTA 수동), 거래조회 API, 지급대행.
 */

export type PgMode = "mock" | "kspay"; // mock은 과거 타입 호환용이며 getPgProvider에서 거부한다.

/** 결제창 호출 수단 — KSNET sndPaymethod 비트플래그로 매핑 (가상계좌는 KSNET 미지원으로 제외) */
export type PayWindowMethod = "card" | "kakaopay" | "naverpay" | "bank";

/** 인증결제(결제창) 주문 — C-01/C-02에서 고객이 결제창을 열 때 */
export interface AuthOrderRequest {
  paymentId: string; // 자체 Payment.id — 패스스루(a1)로 전달
  /** 결제창 수단 (기본 card) */
  payMethod?: PayWindowMethod;
  moid: string; // 주문번호 (특수문자 ` ~ ' " 금지)
  amount: number; // 정수(원)
  goodsName: string;
  ordername: string; // 표시명(닉네임/상품명) — 입금자명 아님
  buyerPhone?: string;
  buyerEmail?: string;
  storeId: string; // KSNET 상점ID (mid)
  /** 인증 완료 후 고객 브라우저가 돌아올 URL (성공/실패 결과 페이지) */
  returnUrl: string;
  /** KSNET이 인증결과를 POST할 콜백(rcv) URL */
  callbackUrl: string;
  /** 주문 ID·주문번호·금액에 결박한 서버 HMAC. 브라우저 result 재전송 위조를 차단한다. */
  resultToken: string;
}

/** 결제창 호출 정보 — kspay: KSPayPWeb.jsp 폼 POST */
export interface AuthOrderResponse {
  /** 다른 PG 어댑터가 단순 리다이렉트를 제공하는 경우를 위한 호환 필드 */
  checkoutUrl?: string;
  /** 폼 POST가 필요한 경우 (KSPAY) */
  formAction?: string;
  formFields?: Record<string, string>;
}

export interface PgApprovalResult {
  success: boolean;
  moid?: string; // PG가 승인 응답으로 돌려준 주문번호(ordno)
  approvalNo?: string; // 승인번호 (카드사 부여 — 고유값 아님)
  pgTrno?: string; // PG 거래번호 (KSNET trno — 취소/영수증 Key)
  cardName?: string;
  cardLast4?: string;
  installment?: number;
  amount: number;
  paidAt?: Date;
  failReason?: string;
  /** 콜백 원문 — 저장 전 카드정보 마스킹 필수 */
  raw?: Record<string, unknown>;
}

/**
 * 구인증 입력 (S-05) — 카드번호+유효기간+비밀번호 앞2자리+생년월일.
 * NEEDS_PG_SPEC: KSNET V1.4 샘플에 없음. 별도 WEBFEP 계약·키·운영 가드 전에는 비활성.
 * 카드정보는 서버 미저장(전송 즉시 폐기), 로그 마스킹.
 */
export interface OldAuthRequest {
  paymentId: string;
  moid: string;
  amount: number;
  goodsName: string;
  storeId: string;
  tid: string; // 구인증 TID (인증 TID와 분리)
  cardNo: string;
  expMm: string; // MM
  expYy: string; // YY
  cardPw2: string; // 비밀번호 앞 2자리
  birth6: string; // 생년월일 6자리
  installment: number; // 0 = 일시불
}

/**
 * 간편결제 (S-간편) — 네이버페이·카카오페이·토스페이 등. TID=AUTH(인증 계열).
 * NEEDS_PG_SPEC: 간편결제는 PG사 결제창에 이미 연동된 수단을 사용 — 우리가 네이버/카카오 API를
 * 직접 붙이지 않는다. 현재 KSPAY 결제창의 수단별 플래그로만 호출한다.
 */
export type EasyPayProvider = "naverpay" | "kakaopay" | "tosspay" | "payco";

export interface EasyPayRequest {
  paymentId: string;
  moid: string;
  amount: number;
  goodsName: string;
  storeId: string;
  tid: string; // 인증 TID
  provider: EasyPayProvider;
}

export interface CancelRequest {
  pgTrno: string;
  moid: string;
  amount: number; // 전체취소만 — 부분취소 없음
  reason?: string;
}

export interface CancelResult {
  success: boolean;
  canceledAt?: Date;
  failReason?: string;
}

export interface InquiryResult {
  found: boolean;
  status?: "PAID" | "CANCELED" | "FAILED";
  raw?: unknown;
}

/** 정기결제 청구 — NEEDS_PG_SPEC: 빌링키 없는 방식 PG 확인 중 (지시서 1장 4) */
export interface RecurringChargeRequest {
  planId: string;
  paymentId: string;
  moid: string;
  amount: number;
  goodsName: string;
  customerName: string;
  customerPhone: string;
  storeId: string;
}

export interface PgProvider {
  readonly mode: PgMode;

  /** 인증결제: 결제창 호출 정보 생성 (TID=AUTH) */
  createAuthOrder(req: AuthOrderRequest): Promise<AuthOrderResponse>;

  /** 인증결제 콜백 수신 → 승인 확정 (KSPAY: sndActionType=1 서버 승인이 거래 성립 시점) */
  approveAuthCallback(params: Record<string, string>): Promise<PgApprovalResult>;

  /** 구인증 직접입력 즉시 승인 (TID=OLD_AUTH) — NEEDS_PG_SPEC */
  payOldAuth(req: OldAuthRequest): Promise<PgApprovalResult>;

  /** 간편결제 승인 (네이버페이·카카오페이 등) — 직접 API는 미계약으로 비활성 */
  payEasy(req: EasyPayRequest): Promise<PgApprovalResult>;

  /** 전체취소 (관리자 전용 — 셀러 호출 금지) — NEEDS_PG_SPEC: V1.4에 취소 API 없음 */
  cancel(req: CancelRequest): Promise<CancelResult>;

  /** 거래 능동조회 (타임아웃 결과 보정) — NEEDS_PG_SPEC */
  inquiry(req: { moid: string; pgTrno?: string }): Promise<InquiryResult>;

  /** 정기결제 청구 — NEEDS_PG_SPEC: 미계약으로 비활성 */
  chargeRecurring(req: RecurringChargeRequest): Promise<PgApprovalResult>;

  /** 매출전표(영수증) URL */
  receiptUrl(pgTrno: string): string;
}
