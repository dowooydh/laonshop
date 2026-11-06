import { createHmac, timingSafeEqual } from "node:crypto";

export type SessionCredentialUser = { id: string; passwordHash: string };
export type SessionCredential = { userId?: string; credentialTag?: unknown };

function signingSecret(value = process.env.SESSION_SECRET): string {
  if (!value || value.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
  return value;
}

/** Store a keyed credential binding in the encrypted cookie, never a password hash. */
export function createSessionCredentialTag(user: SessionCredentialUser, secret?: string): string {
  return createHmac("sha256", signingSecret(secret))
    .update(`laonshop-session-credential:v1\u0000${user.id}\u0000${user.passwordHash}`)
    .digest("hex");
}

/** Legacy cookies without a binding require a fresh login. Password changes revoke copied cookies. */
export function isSessionCredentialCurrent(
  session: SessionCredential,
  user: SessionCredentialUser,
  secret?: string,
): boolean {
  const tag = session.credentialTag;
  if (session.userId !== user.id || typeof tag !== "string" || !/^[a-f0-9]{64}$/.test(tag)) return false;
  const expected = createSessionCredentialTag(user, secret);
  return timingSafeEqual(Buffer.from(tag, "hex"), Buffer.from(expected, "hex"));
}

export const MAX_NEW_PASSWORD_BYTES = 72;
export const MAX_LOGIN_PASSWORD_BYTES = 1024;

/** bcrypt uses only the first 72 UTF-8 bytes; reject ambiguous newly chosen passwords. */
export function isSupportedNewPassword(value: string): boolean {
  return value.length <= MAX_NEW_PASSWORD_BYTES && Buffer.byteLength(value, "utf8") <= MAX_NEW_PASSWORD_BYTES;
}

/** Preserve ordinary legacy >72-byte logins while bounding input processing. */
export function isBoundedLoginPassword(value: string): boolean {
  if (value.length === 0 || value.length > MAX_LOGIN_PASSWORD_BYTES) return false;
  const bytes = Buffer.byteLength(value, "utf8");
  return bytes > 0 && bytes <= MAX_LOGIN_PASSWORD_BYTES;
}
