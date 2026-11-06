"use client";
import { useActionState, useEffect, useRef } from "react";
import { saveShipment, completeShipment } from "@/app/admin/shipping-actions";
import { refreshDocument, restoreDocumentPosition } from "@/lib/document-refresh";
import { COMMERCE_CARRIERS } from "@/lib/commerce/policy";
import { Button, Input, Label, Select } from "@/lib/ui";

export function ShippingForm({
  orderId,
  shipment,
}: {
  orderId: string;
  shipment: { carrier: string; trackingNumber: string; status: string } | null;
}) {
  const [saved, save, saving] = useActionState(saveShipment, {
    status: "idle",
  });
  const [completed, complete, completing] = useActionState(completeShipment, {
    status: "idle",
  });
  const refreshedSaved = useRef<typeof saved | null>(null);
  const refreshedCompleted = useRef<typeof completed | null>(null);
  useEffect(() => { restoreDocumentPosition("admin-orders"); }, []);
  useEffect(() => {
    if (saving || completing) return;
    const savedChanged = saved.status === "success" && refreshedSaved.current !== saved;
    const completedChanged = completed.status === "success" && refreshedCompleted.current !== completed;
    if (!savedChanged && !completedChanged) return;
    if (savedChanged) refreshedSaved.current = saved;
    if (completedChanged) refreshedCompleted.current = completed;
    refreshDocument("admin-orders");
  }, [saved, completed, saving, completing]);
  return (
    <div className="space-y-4">
      {shipment?.status !== "DELIVERED" && (
        <form action={save} className="space-y-3">
          <input type="hidden" name="orderId" value={orderId} />
          <fieldset
            disabled={saving || completing}
            className="grid gap-3 sm:grid-cols-2"
          >
            <div>
              <Label htmlFor={`carrier-${orderId}`}>택배사</Label>
              <Select
                name="carrier"
                id={`carrier-${orderId}`}
                defaultValue={shipment?.carrier ?? "CJ"}
              >
                {COMMERCE_CARRIERS.map((carrier) => (
                  <option key={carrier.code} value={carrier.code}>
                    {carrier.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor={`tracking-${orderId}`}>송장번호</Label>
              <Input
                name="trackingNumber"
                id={`tracking-${orderId}`}
                defaultValue={shipment?.trackingNumber ?? ""}
                minLength={8}
                maxLength={20}
                required
                placeholder="택배사 송장번호"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor={`note-${orderId}`}>처리 메모</Label>
              <Input
                name="note"
                id={`note-${orderId}`}
                maxLength={300}
                placeholder="발송·변경 사유 (선택)"
              />
            </div>
            <Button type="submit" size="lg" loading={saving}>
              {shipment ? "송장 수정" : "발송 등록"}
            </Button>
          </fieldset>
          {saved.message && (
            <p
              role={saved.status === "error" ? "alert" : "status"}
              className="text-sm"
            >
              {saved.message}
            </p>
          )}
        </form>
      )}
      {shipment?.status === "SHIPPED" && (
        <form action={complete} className="space-y-3 border-t border-line pt-4">
          <input type="hidden" name="orderId" value={orderId} />
          <Label htmlFor={`delivery-note-${orderId}`}>배송완료 확인 근거</Label>
          <Input
            name="note"
            id={`delivery-note-${orderId}`}
            maxLength={300}
            required
            minLength={5}
            placeholder="택배사 조회 또는 수령 확인 내용"
          />
          <p className="text-xs text-fg-subtle">
            택배사 배송완료 또는 고객 수령을 확인한 뒤 처리하세요.
          </p>
          <Button
            type="submit"
            size="lg"
            variant="secondary"
            loading={completing}
            disabled={saving}
          >
            배송완료 처리
          </Button>
          {completed.message && (
            <p
              role={completed.status === "error" ? "alert" : "status"}
              className="text-sm"
            >
              {completed.message}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
