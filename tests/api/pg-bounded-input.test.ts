import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { POST as callback } from "../../app/api/pg/kspay/callback/route";
import { BoundedInputError, PG_BODY_LIMIT_BYTES, readBoundedBody, readBoundedPgForm, singlePgValue } from "../../lib/security/bounded-form";

const url = "http://localhost/api/pg/kspay/callback";
const encoded = (body: string, headers: Record<string, string> = {}) => new NextRequest(url, {
  method: "POST", body, headers: { "content-type": "application/x-www-form-urlencoded", ...headers },
});
const errorStatus = (status: number) => (error: unknown) => error instanceof BoundedInputError && error.status === status;

test("본문 상한은 실제 UTF-8 bytes를 기준으로 누락·축소 Content-Length에도 적용한다", async () => {
  assert.equal((await readBoundedBody(new Response(new Uint8Array(32)), 32)).byteLength, 32);
  await assert.rejects(readBoundedBody(new Response("가".repeat(11)), 32), errorStatus(413));
  await assert.rejects(readBoundedBody(new Response("x".repeat(33), { headers: { "content-length": "1" } }), 32), errorStatus(413));
  await assert.rejects(readBoundedBody(new Response("x", { headers: { "content-length": "33" } }), 32), errorStatus(413));
  await assert.rejects(readBoundedBody(new Response("x", { headers: { "content-length": "invalid" } }), 32), errorStatus(400));
});

test("공개 결제 폼은 타입·중복·파일·필드 길이와 제어문자를 거절한다", async () => {
  await assert.rejects(readBoundedPgForm(new Request(url, { method: "POST", body: "{}", headers: { "content-type": "application/json" } })), errorStatus(415));
  const form = await readBoundedPgForm(encoded("a=one&a=two&c=token"));
  assert.throws(() => singlePgValue(form, "a", 128), errorStatus(400));
  const multipart = new FormData(); multipart.set("reHash", new Blob(["not-a-card"]), "value.txt");
  await assert.rejects(readBoundedPgForm(new Request(url, { method: "POST", body: multipart })), errorStatus(400));
  const tooLong = new FormData(); tooLong.set("a", "a".repeat(129));
  assert.throws(() => singlePgValue(tooLong, "a", 128), errorStatus(400));
  const control = new FormData(); control.set("a", "bad\u0000id");
  assert.throws(() => singlePgValue(control, "a", 128), errorStatus(400));
});

test("정상 KSNET 브릿지와 취소는 유지하고 script 닫기 입력은 실행문으로 만들지 않는다", async () => {
  const input = new URLSearchParams({ reCommConId: "synthetic-id", reCommType: "P", reHash: "</script><script>bad()</script>" });
  const response = await callback(encoded(input.toString()));
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.ok(html.includes("parent.eparamSet("));
  assert.ok(!html.includes("</script><script>bad()"));
  assert.ok(html.includes("\\u003c/script>"));
  const canceled = await callback(encoded("reCnclType=1"));
  assert.ok((await canceled.text()).includes("parent.mcancel"));
});

test("oversize·중복 provider 값은 결제 브릿지 생성 전 일반 오류로 거절한다", async () => {
  const large = await callback(encoded(`reHash=${"x".repeat(PG_BODY_LIMIT_BYTES)}`));
  assert.equal(large.status, 413);
  const duplicate = await callback(encoded("reCommConId=one&reCommConId=two"));
  assert.equal(duplicate.status, 400);
  assert.ok(!(await duplicate.text()).includes("parent.goResult"));
});
