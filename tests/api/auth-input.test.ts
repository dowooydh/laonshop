import assert from "node:assert/strict";
import test from "node:test";

import { getBoundaryWhitespaceTrimCandidate, normalizeEmail } from "../../lib/auth-input";

test("이메일 공백과 대소문자 변형을 같은 저장값으로 정규화한다", () => {
  assert.equal(normalizeEmail("  User.Name+Shop@Example.COM "), "user.name+shop@example.com");
});

test("비밀번호 양끝의 복사 공백만 진단 후보로 분리한다", () => {
  assert.equal(getBoundaryWhitespaceTrimCandidate(" password "), "password");
  assert.equal(getBoundaryWhitespaceTrimCandidate("\u200Bpassword\u200B"), "password");
  assert.equal(getBoundaryWhitespaceTrimCandidate("pass word"), null);
  assert.equal(getBoundaryWhitespaceTrimCandidate("password"), null);
  assert.equal(getBoundaryWhitespaceTrimCandidate("   "), null);
});
