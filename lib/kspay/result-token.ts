import { createHmac, timingSafeEqual } from "node:crypto";

export type KspayResultTokenOrder = {
  id: string;
  moid: string;
  totalAmount: number;
};

function tokenSecret(secret?: string): string {
  const value = secret ?? process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
  return value;
}

function tokenPayload(order: KspayResultTokenOrder): string {
  return `${order.id}\u0000${order.moid}\u0000${order.totalAmount}`;
}

export function createKspayResultToken(order: KspayResultTokenOrder, secret?: string): string {
  return createHmac("sha256", tokenSecret(secret)).update(tokenPayload(order)).digest("base64url");
}

export function verifyKspayResultToken(
  order: KspayResultTokenOrder,
  candidate: string,
  secret?: string,
): boolean {
  if (!/^[A-Za-z0-9_-]{43}$/.test(candidate)) return false;
  const expected = createKspayResultToken(order, secret);
  const left = Buffer.from(candidate);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}
