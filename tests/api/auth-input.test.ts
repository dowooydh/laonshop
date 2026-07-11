import assert from "node:assert/strict";
import test from "node:test";

import { normalizeEmail } from "../../lib/auth-input";

test("이메일 공백과 대소문자 변형을 같은 저장값으로 정규화한다", () => {
  assert.equal(normalizeEmail("  User.Name+Shop@Example.COM "), "user.name+shop@example.com");
});
