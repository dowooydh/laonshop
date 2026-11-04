import assert from "node:assert/strict";
import test from "node:test";
import { cn } from "../../lib/ui/cn";

test("커스텀 글자 크기를 합쳐도 버튼과 본문의 글자색은 보존한다", () => {
  for (const size of ["step--1", "step-0", "step-1", "step-2", "step-3", "hero"]) {
    const classes = cn("text-void", `text-${size}`).split(/\s+/);
    assert.ok(classes.includes("text-void"), size);
    assert.ok(classes.includes(`text-${size}`), size);
  }
  assert.equal(cn("text-fg-muted", "text-step--1"), "text-fg-muted text-step--1");
  assert.equal(cn("text-step--1", "text-fg-muted"), "text-step--1 text-fg-muted");
});

test("크기와 색상 충돌은 서로의 범위를 침범하지 않는다", () => {
  const classes = cn("text-step-1 text-void", "text-sm text-danger").split(/\s+/);
  assert.ok(classes.includes("text-sm"));
  assert.ok(classes.includes("text-danger"));
  assert.equal(classes.includes("text-step-1"), false);
  assert.equal(classes.includes("text-void"), false);
});

test("반응형 커스텀 글자 크기는 같은 breakpoint의 색상과 공존한다", () => {
  const classes = cn("text-void sm:text-void", "text-step-0 sm:text-step-1").split(/\s+/);
  for (const expected of ["text-void", "sm:text-void", "text-step-0", "sm:text-step-1"]) {
    assert.ok(classes.includes(expected), expected);
  }
});
