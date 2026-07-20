"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/lib/ui/button";

export function BillingStatusSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="outline"
      size="lg"
      loading={pending}
      className="min-h-12 w-full !h-auto py-3 !whitespace-normal"
    >
      {pending ? `${label} 중` : label}
    </Button>
  );
}
