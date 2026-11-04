"use client";
export function PrintButton() {
  return <button type="button" onClick={() => window.print()} className="no-print min-h-11 rounded border border-line px-4 text-sm font-semibold">인쇄·PDF 저장</button>;
}
