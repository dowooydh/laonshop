import assert from "node:assert/strict";
import test from "node:test";
import { cn } from "../../lib/ui/cn";
import { buttonVariants } from "../../lib/ui/button";

test("커스텀 글자 크기를 바꿔도 버튼의 전경색을 보존한다", () => {
  const classes = cn(
    buttonVariants({ variant: "primary", size: "xl" }),
    "text-sm sm:text-step-1",
  );
  assert.ok(classes.split(" ").includes("text-void"));
  assert.ok(classes.split(" ").includes("text-sm"));
  assert.ok(classes.split(" ").includes("sm:text-step-1"));
});

test("모든 유동 글자 크기는 전경색·반응형 색상과 독립적으로 병합된다", () => {
  for (const size of [
    "step--1",
    "step-0",
    "step-1",
    "step-2",
    "step-3",
    "step-hero",
  ]) {
    assert.equal(
      cn("text-fg-muted", `text-${size}`),
      `text-fg-muted text-${size}`,
    );
    assert.equal(
      cn(`text-${size} text-danger`, "text-step-0 text-success"),
      "text-step-0 text-success",
    );
    assert.equal(
      cn(`sm:text-fg sm:text-${size}`, "sm:text-step-0"),
      "sm:text-fg sm:text-step-0",
    );
  }
});
