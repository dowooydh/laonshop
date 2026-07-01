"use client";

// Phase 1 검증용 디자인 시스템 쇼케이스 (핸드오버 §5 "스토리 페이지 하나에 모든 컴포넌트 렌더 + 대비 체크").
// 전역 셸은 Phase 2에서 다크 전환되므로, 이 페이지는 자체 다크 서피스(bg-void)로 감싸 토큰을 그대로 보여준다.
import { useState } from "react";
import {
  Amount,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  FieldError,
  Input,
  Label,
  Modal,
  Select,
  Spinner,
  StatCard,
  Textarea,
} from "@/lib/ui";

const COLORS: { name: string; cls: string; hex: string; ring?: boolean }[] = [
  { name: "bg-void", cls: "bg-void", hex: "#05060A", ring: true },
  { name: "bg-base", cls: "bg-base", hex: "#0A0C12", ring: true },
  { name: "bg-raised", cls: "bg-raised", hex: "#12151F", ring: true },
  { name: "bg-overlay", cls: "bg-overlay", hex: "#1A1E2B", ring: true },
  { name: "fg-primary", cls: "bg-fg", hex: "#F4F6FB" },
  { name: "fg-muted", cls: "bg-fg-muted", hex: "#9AA3B2" },
  { name: "fg-subtle", cls: "bg-fg-subtle", hex: "#5C6577" },
  { name: "accent-cyan", cls: "bg-accent-cyan", hex: "#4FD1FF" },
  { name: "accent-violet", cls: "bg-accent-violet", hex: "#8B5CFF" },
  { name: "accent-lime", cls: "bg-accent-lime", hex: "#C6FF4F" },
  { name: "success", cls: "bg-success", hex: "#3DDC97" },
  { name: "warning", cls: "bg-warning", hex: "#FFB84F" },
  { name: "danger", cls: "bg-danger", hex: "#FF5C7A" },
];

const TYPE = [
  { cls: "text-hero", label: "hero" },
  { cls: "text-step-3", label: "step-3" },
  { cls: "text-step-2", label: "step-2" },
  { cls: "text-step-1", label: "step-1" },
  { cls: "text-step-0", label: "step-0" },
  { cls: "text-step--1", label: "step--1" },
];

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line pt-10">
      <div className="mb-6 flex items-baseline gap-3">
        <span className="font-mono text-step--1 text-accent-cyan">{n}</span>
        <h2 className="text-step-1 font-semibold tracking-tight text-fg">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export default function DesignSystemPage() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mesh-hero -mx-4 -my-6 min-h-dvh px-4 py-10 text-fg [color-scheme:dark] sm:px-8">
      <div className="mx-auto max-w-5xl space-y-12">
        {/* 헤더 — 디스플레이 폰트 + 발광 */}
        <header className="space-y-4">
          <p className="font-mono text-step--1 uppercase tracking-[0.3em] text-fg-subtle">
            LAON SHOP · Design System
          </p>
          <h1 className="font-display text-step-3 font-bold tracking-tight text-fg">
            입는 것을 <span className="text-glow-cyan">공간</span>에서.
          </h1>
          <p className="max-w-xl text-step-0 text-fg-muted">
            Phase 1 — 다크 퍼스트 · 발광 악센트 · 글래스 · 필름 그레인. 모든 UI 컴포넌트와 §4 토큰의
            단일 참조 화면입니다.
          </p>
        </header>

        {/* 컬러 */}
        <Section n="01" title="Color">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
            {COLORS.map((c) => (
              <div key={c.name} className="rounded-[var(--radius-md)] border border-line bg-raised p-3">
                <div
                  className={`h-14 rounded-[var(--radius-sm)] ${c.cls} ${c.ring ? "ring-1 ring-inset ring-line" : ""}`}
                />
                <div className="mt-2.5 text-step--1 font-medium text-fg">{c.name}</div>
                <div className="font-mono text-step--1 text-fg-subtle">{c.hex}</div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-step--1 text-fg-subtle">
            악센트는 면적을 좁게 — 글로우·포커스·CTA에만. 그라디언트 메시는 히어로 배경 한정.
          </p>
        </Section>

        {/* 타이포 */}
        <Section n="02" title="Typography">
          <div className="space-y-4">
            {TYPE.map((t) => (
              <div key={t.label} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-line pb-4">
                <span className="w-16 shrink-0 font-mono text-step--1 text-fg-subtle">{t.label}</span>
                <span className={`font-display font-semibold tracking-tight text-fg ${t.cls}`}>
                  라온샵 Aa 24,000
                </span>
              </div>
            ))}
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[var(--radius-md)] border border-line bg-raised p-4">
              <div className="text-step--1 text-fg-subtle">Display</div>
              <div className="font-display text-step-1 text-fg">Space Grotesk</div>
            </div>
            <div className="rounded-[var(--radius-md)] border border-line bg-raised p-4">
              <div className="text-step--1 text-fg-subtle">Body (KR)</div>
              <div className="text-step-1 text-fg">Pretendard 본문</div>
            </div>
            <div className="rounded-[var(--radius-md)] border border-line bg-raised p-4">
              <div className="text-step--1 text-fg-subtle">Mono</div>
              <div className="font-mono text-step-1 text-fg">JetBrains 29,000</div>
            </div>
          </div>
        </Section>

        {/* 버튼 */}
        <Section n="03" title="Buttons">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary">발광 CTA</Button>
            <Button variant="violet">Violet</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="link">Link →</Button>
            <Button variant="primary" loading>
              처리 중
            </Button>
            <Button variant="secondary" disabled>
              Disabled
            </Button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button size="sm">sm</Button>
            <Button size="md">md</Button>
            <Button size="lg">lg</Button>
            <Button size="icon" aria-label="아이콘">
              ✦
            </Button>
          </div>
          <div className="mt-4 max-w-xs">
            <Button size="xl">xl 풀폭 결제 CTA</Button>
          </div>
        </Section>

        {/* 폼 */}
        <Section n="04" title="Form">
          <div className="grid max-w-lg gap-4">
            <div>
              <Label htmlFor="ds-email">이메일</Label>
              <Input id="ds-email" placeholder="you@laonshop.com" />
            </div>
            <div>
              <Label htmlFor="ds-size">사이즈</Label>
              <Select id="ds-size" defaultValue="M">
                <option>S</option>
                <option>M</option>
                <option>L</option>
                <option>XL</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="ds-memo">배송 메모</Label>
              <Textarea id="ds-memo" placeholder="문 앞에 두고 벨 눌러주세요" />
              <FieldError>필수 항목입니다.</FieldError>
            </div>
          </div>
        </Section>

        {/* 카드 & 스탯 */}
        <Section n="05" title="Cards">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>오버핏 코튼 반팔 티셔츠</CardTitle>
                <CardDescription>도톰한 코튼 원단의 데일리 오버핏.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Amount value={29000} className="text-step-1" />
                  <Button size="sm">담기</Button>
                </div>
              </CardContent>
            </Card>
            <div className="grid grid-cols-2 gap-4">
              <StatCard label="주문" value="128" tone="blue" sub="이번 주" />
              <StatCard label="매출" value="4.2M" tone="green" sub="원" />
              <StatCard label="취소" value="3" tone="red" />
              <StatCard label="대기" value="7" tone="orange" />
            </div>
          </div>
        </Section>

        {/* 배지 */}
        <Section n="06" title="Badges (주문 상태)">
          <div className="flex flex-wrap gap-2">
            <Badge variant="blue">PAID</Badge>
            <Badge variant="gray">PENDING</Badge>
            <Badge variant="red">FAILED</Badge>
            <Badge variant="redOutline">CANCELED</Badge>
            <Badge variant="green">배송완료</Badge>
            <Badge variant="orange">취소요청</Badge>
            <Badge variant="lightgray">만료</Badge>
          </div>
        </Section>

        {/* 발광 & 오버레이 */}
        <Section n="07" title="Glow · Overlay · Motion">
          <div className="flex flex-wrap items-center gap-4">
            <div className="rounded-[var(--radius-lg)] p-5 text-fg shadow-glow-cyan ring-1 ring-accent-cyan">
              glow-cyan
            </div>
            <div className="rounded-[var(--radius-lg)] shadow-glow-violet ring-1 ring-accent-violet p-5 text-fg">
              glow-violet
            </div>
            <span className="font-display text-step-2 font-bold text-glow-violet">Kinetic</span>
            <Spinner />
            <Button variant="outline" onClick={() => setOpen(true)}>
              모달 열기
            </Button>
          </div>
          <div className="mt-4">
            <EmptyState title="비어 있는 상태" description="EmptyState 컴포넌트" />
          </div>
        </Section>

        {/* 접근성 */}
        <Section n="08" title="Accessibility">
          <ul className="space-y-1.5 text-step-0 text-fg-muted">
            <li>· 포커스 링: 발광 시안 2px 아웃라인 (Tab으로 확인).</li>
            <li>· 대비: fg-primary(#F4F6FB) on bg-void(#05060A) ≈ 18:1 → AAA.</li>
            <li>· fg-muted(#9AA3B2) on bg-void ≈ 8.8:1 → AA(본문) 충족.</li>
            <li>· <span className="font-mono text-fg">prefers-reduced-motion</span> 시 애니메이션 정지.</li>
          </ul>
        </Section>

        <footer className="border-t border-line pt-8 text-step--1 text-fg-subtle">
          LAON SHOP Design System · Phase 1 · 내부 참조용 (/design-system)
        </footer>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="결제를 진행할까요?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button onClick={() => setOpen(false)}>확인</Button>
          </>
        }
      >
        다크 글래스 패널 모달입니다. ESC 또는 바깥을 눌러 닫을 수 있어요.
      </Modal>
    </div>
  );
}
