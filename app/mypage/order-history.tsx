"use client";

import { Badge } from "@/lib/ui";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";

export type OrderRow = {
  id: string;
  href: string;
  statusLabel: string;
  badgeVariant: "green" | "red" | "gray";
  dateLabel: string;
  itemSummary: string;
  totalLabel: string;
};

const EASE = [0.16, 1, 0.3, 1] as const;

export function OrderHistory({ orders }: { orders: OrderRow[] }) {
  const reduce = useReducedMotion();

  return (
    <ul className="space-y-3">
      {orders.map((o, i) => (
        <motion.li
          key={o.id}
          initial={reduce ? false : { opacity: 0, y: 12 }}
          whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.5, ease: EASE, delay: Math.min(i * 0.05, 0.3) }}
        >
          <Link
            href={o.href}
            className="group block rounded-[var(--radius-lg)] border border-line bg-raised p-5 shadow-elev1 transition-all duration-fast hover:border-accent-cyan hover:shadow-glow-cyan"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-step--1 tracking-wide text-fg-subtle">{o.dateLabel}</span>
              <Badge variant={o.badgeVariant}>{o.statusLabel}</Badge>
            </div>
            <div className="mt-3 text-step-0 text-fg transition-colors duration-fast group-hover:text-accent-cyan">
              {o.itemSummary}
            </div>
            <div className="mt-1 font-mono text-step-0 font-bold text-fg">{o.totalLabel}</div>
          </Link>
        </motion.li>
      ))}
    </ul>
  );
}
