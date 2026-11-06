import assert from "node:assert/strict";
import test from "node:test";
import bcrypt from "bcryptjs";
import { sealData, unsealData } from "iron-session";
import {
  createSessionCredentialTag,
  isSessionCredentialCurrent,
  isSupportedNewPassword,
  isBoundedLoginPassword,
  type SessionCredential,
} from "../../lib/session-security";

const secret = "synthetic-session-secret-for-local-unit-tests-only";
const user = { id: "synthetic-user-a", passwordHash: "synthetic-original-credential-hash" };

test("현재 사용자·암호에 결박된 세션만 인정하고 위변조·타사용자·다른키를 거절한다", () => {
  const credentialTag = createSessionCredentialTag(user, secret);
  const session = { userId: user.id, credentialTag };
  assert.match(credentialTag, /^[a-f0-9]{64}$/);
  assert.equal(isSessionCredentialCurrent(session, user, secret), true);
  assert.equal(isSessionCredentialCurrent(session, { ...user, id: "synthetic-user-b" }, secret), false);
  assert.equal(isSessionCredentialCurrent({ ...session, userId: "synthetic-user-b" }, user, secret), false);
  assert.equal(isSessionCredentialCurrent(session, user, `${secret}-different`), false);
  for (const value of [undefined, null, 123, {}, [], "", "g".repeat(64), "0".repeat(63), "0".repeat(65), "0".repeat(64)]) {
    assert.equal(isSessionCredentialCurrent({ userId: user.id, credentialTag: value }, user, secret), false);
  }
});

test("암호가 변경되면 복사한 기존 iron-session 쿠키는 거절되고 재발급 쿠키만 허용한다", async () => {
  const original = { userId: user.id, credentialTag: createSessionCredentialTag(user, secret) };
  const cookie = await sealData(original, { password: secret, ttl: 3600 });
  const copied = await unsealData<SessionCredential>(cookie, { password: secret, ttl: 3600 });
  assert.equal(isSessionCredentialCurrent(copied, user, secret), true);
  const updated = { ...user, passwordHash: "synthetic-updated-credential-hash" };
  assert.equal(isSessionCredentialCurrent(copied, updated, secret), false);
  const renewed = { ...original, credentialTag: createSessionCredentialTag(updated, secret) };
  const renewedCookie = await sealData(renewed, { password: secret, ttl: 3600 });
  const renewedSession = await unsealData<SessionCredential>(renewedCookie, { password: secret, ttl: 3600 });
  assert.equal(isSessionCredentialCurrent(renewedSession, updated, secret), true);
  assert.equal(Object.hasOwn(renewedSession, "passwordHash"), false);
  assert.equal(Object.values(renewedSession).includes(updated.passwordHash), false);
});

test("tag가 없는 과거 쿠키는 재로그인을 요구하며 짧은 서명키로 tag를 만들 수 없다", async () => {
  const legacyCookie = await sealData({ userId: user.id }, { password: secret, ttl: 3600 });
  const legacy = await unsealData<SessionCredential>(legacyCookie, { password: secret, ttl: 3600 });
  assert.equal(isSessionCredentialCurrent(legacy, user, secret), false);
  assert.throws(() => createSessionCredentialTag(user, "too-short"));
});

test("새 암호는 문자 수가 아닌 bcrypt UTF-8 72바이트 경계를 지킨다", () => {
  assert.equal(isSupportedNewPassword("a".repeat(72)), true);
  assert.equal(isSupportedNewPassword("a".repeat(73)), false);
  assert.equal(isSupportedNewPassword("가".repeat(24)), true);
  assert.equal(isSupportedNewPassword("가".repeat(25)), false);
  assert.equal(isSupportedNewPassword("🙂".repeat(18)), true);
  assert.equal(isSupportedNewPassword("🙂".repeat(19)), false);
});

test("과거 긴 암호 로그인은 1024바이트까지 보존하고 과대한 입력은 거절한다", async () => {
  const legacy = "a".repeat(72) + "legacy-suffix";
  assert.equal(isBoundedLoginPassword(legacy), true);
  const hash = await bcrypt.hash(legacy, 4);
  assert.equal(await bcrypt.compare(legacy, hash), true);
  assert.equal(isBoundedLoginPassword("a".repeat(1024)), true);
  assert.equal(isBoundedLoginPassword("a".repeat(1025)), false);
  assert.equal(isBoundedLoginPassword("가".repeat(341)), true);
  assert.equal(isBoundedLoginPassword("가".repeat(342)), false);
  assert.equal(isBoundedLoginPassword(""), false);
});
