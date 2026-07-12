"use client";
// 다음(카카오) 우편번호 서비스 기반 주소 입력 — 실제 쇼핑몰형 배송지 등록 UX.
// 주소 검색으로 우편번호·도로명주소를 채우고, 상세주소만 직접 입력한다.
import { Button, Input } from "@/lib/ui";
import { useCallback, useState } from "react";

const POSTCODE_SRC = "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";

type DaumPostcodeData = {
  zonecode: string;
  roadAddress: string;
  jibunAddress: string;
  buildingName?: string;
};

declare global {
  interface Window {
    daum?: {
      Postcode: new (opts: { oncomplete: (data: DaumPostcodeData) => void }) => { open: () => void };
    };
  }
}

let postcodeLoader: Promise<void> | null = null;
function loadPostcodeScript(): Promise<void> {
  if (window.daum?.Postcode) return Promise.resolve();
  if (!postcodeLoader) {
    postcodeLoader = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = POSTCODE_SRC;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        postcodeLoader = null;
        reject(new Error("우편번호 스크립트 로드 실패"));
      };
      document.head.appendChild(s);
    });
  }
  return postcodeLoader;
}

export type AddressValue = { zipcode: string; address: string; addressDetail: string };

export function AddressInput({
  initial,
  idPrefix = "addr",
  onChange,
}: {
  initial: AddressValue;
  idPrefix?: string;
  onChange?: (v: AddressValue) => void;
}) {
  const [value, setValue] = useState<AddressValue>(initial);
  const [searchFailed, setSearchFailed] = useState(false);

  const update = useCallback(
    (next: AddressValue) => {
      setValue(next);
      onChange?.(next);
    },
    [onChange],
  );

  const search = useCallback(async () => {
    try {
      await loadPostcodeScript();
      new window.daum!.Postcode({
        oncomplete: (data) => {
          const base = data.roadAddress || data.jibunAddress;
          update({
            zipcode: data.zonecode,
            address: data.buildingName ? `${base} (${data.buildingName})` : base,
            addressDetail: "",
          });
          // 주소 선택 직후 상세주소로 포커스 이동 — 실쇼핑몰 관행
          setTimeout(() => document.getElementById(`${idPrefix}-detail`)?.focus(), 50);
        },
      }).open();
    } catch {
      // 스크립트 차단(광고차단기 등) 시 직접 입력으로 전환
      setSearchFailed(true);
    }
  }, [idPrefix, update]);

  const manual = searchFailed;

  return (
    <div className="space-y-2">
      <div className="flex min-w-0 flex-wrap gap-2">
        <Input
          id={`${idPrefix}-zipcode`}
          name="zipcode"
          value={value.zipcode}
          readOnly={!manual}
          onChange={(e) => update({ ...value, zipcode: e.target.value })}
          placeholder="우편번호"
          inputMode="numeric"
          className="w-[min(100%,6rem)] min-w-0 max-w-full px-[14px]"
          aria-label="우편번호"
        />
        <Button
          type="button"
          variant="outline"
          size="md"
          className="min-h-[44px] min-w-[min(100%,6rem)] max-w-full break-keep px-[12px] py-[10px] !h-auto !whitespace-normal leading-tight"
          onClick={search}
        >
          주소 검색
        </Button>
      </div>
      <Input
        id={`${idPrefix}-address`}
        name="address"
        value={value.address}
        readOnly={!manual}
        onChange={(e) => update({ ...value, address: e.target.value })}
        placeholder={manual ? "주소를 직접 입력해 주세요" : "주소 검색을 눌러 주소를 선택해 주세요"}
        aria-label="기본 주소"
      />
      <Input
        id={`${idPrefix}-detail`}
        name="addressDetail"
        value={value.addressDetail}
        onChange={(e) => update({ ...value, addressDetail: e.target.value })}
        placeholder="상세 주소 (동·호수 등)"
        aria-label="상세 주소"
      />
    </div>
  );
}
