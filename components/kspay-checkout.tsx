"use client";
// KSPAY 결제창 실행 — KSPayWeb 폼 + kspay_web_ssl.js의 _pay(). (셀러앱과 동일 브릿지)
// 결제창 인증 후 /api/pg/kspay/callback(rcv)이 parent.eparamSet()→goResult() 호출 →
// goResult()가 폼(snd*+re*+a=orderId)을 /api/pg/kspay/result 로 제출해 서버승인·주문확정.
import { useEffect, useRef } from "react";

const KSPAY_JS = "https://kspay.ksnet.to/store/KSPayWebV1.4/js/kspay_web_ssl.js";
const JQUERY_JS = "https://code.jquery.com/jquery-1.12.4.min.js"; // kspay_web_ssl.js의 $ 의존

declare global {
  interface Window {
    jQuery?: unknown;
    _pay?: (form: HTMLFormElement) => void;
    eparamSet?: (rcid: string, rctype: string, rhash: string) => void;
    goResult?: () => void;
    mcancel?: () => void;
  }
}

export function KspayCheckout({
  formAction,
  formFields,
}: {
  formAction: string;
  formFields: Record<string, string>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    const form = formRef.current;
    if (!form || startedRef.current) return;
    startedRef.current = true;

    const setField = (name: string, value: string) => {
      const el = form.elements.namedItem(name) as HTMLInputElement | null;
      if (el) el.value = value;
    };
    window.eparamSet = (rcid, rctype, rhash) => {
      setField("reCommConId", rcid);
      setField("reCommType", rctype);
      setField("reHash", rhash);
    };
    window.goResult = () => {
      form.action = "/api/pg/kspay/result";
      form.target = "";
      form.submit();
    };
    window.mcancel = () => window.location.reload();

    const loadScript = (src: string) =>
      new Promise<void>((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) return resolve();
        const s = document.createElement("script");
        s.src = src;
        s.addEventListener("load", () => resolve());
        s.addEventListener("error", () => reject(new Error(src)));
        document.body.appendChild(s);
      });

    void (async () => {
      try {
        if (!window.jQuery) await loadScript(JQUERY_JS);
        await loadScript(KSPAY_JS);
        window._pay?.(form);
      } catch {
        /* 스크립트 로드 실패 */
      }
    })();
  }, []);

  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <p className="text-sm text-gray-600">결제창을 여는 중입니다…</p>
      <p className="text-xs text-gray-400">잠시만 기다려 주세요. 자동으로 결제창이 표시됩니다.</p>
      <form ref={formRef} name="KSPayWeb" method="post" action={formAction} className="hidden">
        {Object.entries(formFields).map(([k, v]) => (
          <input key={k} type="hidden" name={k} defaultValue={v} />
        ))}
      </form>
    </div>
  );
}
