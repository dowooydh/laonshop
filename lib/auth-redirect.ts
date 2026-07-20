const BILLING_RETURN_PATH = "/mypage/settings/billing/return";
const OPAQUE_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
const BILLING_RETURN_STATUSES = new Set([
  "pending",
  "processing",
  "succeeded",
  "declined",
  "unknown",
  "expired",
]);

export function safeLoginReturnTarget(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) {
    return null;
  }
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  try {
    const url = new URL(value, "https://laonshop.com");
    if (
      url.origin !== "https://laonshop.com" ||
      url.pathname !== BILLING_RETURN_PATH ||
      url.hash
    ) {
      return null;
    }
    const keys = [...url.searchParams.keys()];
    if (
      keys.some(
        (key) =>
          key !== "billingRegistrationId" && key !== "billingStatus",
      )
    ) {
      return null;
    }
    const registrationId = url.searchParams.get("billingRegistrationId");
    const status = url.searchParams.get("billingStatus");
    if (
      url.searchParams.getAll("billingRegistrationId").length !== 1 ||
      url.searchParams.getAll("billingStatus").length > 1 ||
      !registrationId ||
      !OPAQUE_ID_PATTERN.test(registrationId) ||
      (status !== null && !BILLING_RETURN_STATUSES.has(status))
    ) {
      return null;
    }
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}
