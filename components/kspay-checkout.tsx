"use client";
// KSPAY 결제창 실행 — KSPayWeb 폼 + kspay_web_ssl.js의 _pay(). (셀러앱과 동일 브릿지)
// 결제창 인증 후 /api/pg/kspay/callback(rcv)이 parent.eparamSet()→goResult() 호출 →
// goResult()가 폼(snd*+re*+a=orderId)을 /api/pg/kspay/result 로 제출해 서버승인·주문확정.
import { useEffect, useRef, useState } from "react";
import { Button, Spinner } from "@/lib/ui";

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
  const [error, setError] = useState("");

  useEffect(() => {
    const form = formRef.current;
    if (!form || startedRef.current) return;
    startedRef.current = true;
    let active = true;

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
        const timer = window.setTimeout(() => reject(new Error("timeout")), 8_000);
        s.addEventListener("load", () => resolve());
        s.addEventListener("error", () => reject(new Error(src)));
        s.addEventListener("load", () => window.clearTimeout(timer));
        s.addEventListener("error", () => window.clearTimeout(timer));
        document.body.appendChild(s);
      });

    void (async () => {
      try {
        if (!window.jQuery) await loadScript(JQUERY_JS);
        await loadScript(KSPAY_JS);
        if (!window._pay) throw new Error("KSPAY unavailable");
        window._pay(form);
      } catch {
        if (active) {
          setError("결제창을 불러오지 못했습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.");
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-sm flex-col items-center justify-center text-center">
      <div className="glass w-full rounded-[var(--radius-lg)] border border-line p-8 shadow-elev2">
        <p className="font-mono text-step--1 uppercase tracking-[0.3em] text-accent-cyan">Payment</p>
        {error ? (
          <>
            <p role="alert" className="mt-6 text-step-0 font-medium text-danger">{error}</p>
            <Button type="button" variant="outline" className="mt-5" onClick={() => window.location.reload()}>
              다시 시도
            </Button>
          </>
        ) : (
          <>
            <div className="mt-6 flex justify-center"><Spinner /></div>
            <p className="mt-5 text-step-0 font-medium text-fg">결제창을 여는 중입니다</p>
            <p className="mt-1.5 text-step--1 text-fg-subtle">잠시만 기다려 주세요. 자동으로 결제창이 표시됩니다.</p>
          </>
        )}
      </div>
      <form ref={formRef} name="KSPayWeb" method="post" action={formAction} className="hidden">
        {Object.entries(formFields).map(([k, v]) => (
          <input key={k} type="hidden" name={k} defaultValue={v} />
        ))}
      </form>
    </div>
  );
}
