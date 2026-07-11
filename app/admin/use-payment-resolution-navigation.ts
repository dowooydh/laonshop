"use client";

import { useEffect } from "react";
import type { AdminPaymentState } from "./actions";

export function usePaymentResolutionNavigation(state: AdminPaymentState): void {
  useEffect(() => {
    if (state.status === "success" && state.redirectTo) {
      window.location.replace(state.redirectTo);
    }
  }, [state.redirectTo, state.status]);
}
