"use client";

import { Flame, ShoppingCart, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { isFeatureEnabled } from "@/lib/analytics/track";
import { SupprButton, type SupprButtonVariant } from "../suppr/suppr-button";
import { cn } from "../ui/utils";

/**
 * PlanV3WebRail — the desktop Plan dashboard's right rail: a grounded "This
 * week" insight card (only when slots are actually open), then the batch-cook
 * and shopping-list tool cards.
 *
 * Extracted from `PlanV3WebDashboard` in the design-consistency pass
 * (2026-07-24) — the dashboard is a composition surface and was over the
 * 400-line screen cap; the rail is the coherent sub-unit to lift out.
 *
 * Everything here is plan-derived. The insight headline names the real days
 * with open slots and the shopping line shows live counts — no invented
 * suggestions, and the whole rail disappears rather than inventing filler when
 * there is nothing to say.
 *
 * No mobile twin by design — mobile Plan is phone-only and carries these
 * actions in `PlanToolsV3`, a row list rather than a rail. (Intentional
 * platform-shape difference, not a parity gap.)
 */
export interface PlanV3WebRailProps {
  /** Weekday names that still have an open slot. Empty hides the insight card. */
  openDays: string[];
  onGenerate: () => void;
  batchCookSubtitle: string;
  onOpenBatchCook: () => void;
  shoppingItemCount: number;
  servingCount: number;
  onOpenShopping: () => void;
}

/**
 * The rail's CTAs. Design-consistency pass 2026-07-24: all three were
 * hand-rolled pills — one a bespoke filled bar, two a bordered OUTLINE
 * treatment the button system does not have (the 2026-06-12 ruling collapsed
 * outline + tonal secondaries into ghost). Under `design_consistency_v1` they
 * resolve to the real `SupprButton` grammar — one filled action in the rail
 * (the insight card's), ghost for the tool cards. The else branch keeps the
 * pre-pass markup verbatim so the flag stays a true kill switch.
 */
function RailCta({
  variant,
  label,
  onClick,
  width,
}: {
  variant: SupprButtonVariant;
  label: string;
  onClick: () => void;
  /** ENG-1551 — tool CTAs are content-width pills; the insight CTA is banner. */
  width: "full" | "fit";
}) {
  const w = width === "full" ? "w-full" : "w-fit";
  if (isFeatureEnabled("design_consistency_v1")) {
    return (
      <SupprButton
        variant={variant}
        size="sm"
        onClick={onClick}
        label={label}
        className={cn("mt-3", w)}
      />
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "mt-3 h-9 rounded-full px-4 text-[13px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        w,
        variant === "primary"
          ? "bg-primary text-primary-foreground transition-[transform,opacity] hover:opacity-90 active:scale-[0.99]"
          : "border border-border bg-card text-foreground transition-[background-color] hover:bg-[var(--background-secondary)]",
      )}
    >
      {label}
    </button>
  );
}

function InsightCard({
  openDays,
  onGenerate,
}: {
  /** Non-empty — the card only renders when there are open slots to nudge. */
  openDays: string[];
  onGenerate: () => void;
}) {
  // A single honest, plan-derived nudge to finish the week. When the week is
  // already complete this card is not rendered at all (the verdict header
  // confirms the success; the shopping card carries the next action) — no
  // invented advice.
  const headline =
    openDays.length === 1
      ? `${openDays[0]} still needs a meal`
      : `${openDays.length} days still need a meal`;
  return (
    <div className="rounded-card-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <span
          className="grid size-7 shrink-0 place-items-center rounded-full"
          style={{ backgroundColor: "var(--accent-primary-soft)" }}
          aria-hidden
        >
          <Sparkles
            className="size-3.5"
            style={{ color: "var(--primary)" }}
            strokeWidth={2}
          />
        </span>
        <h3 className="text-[13px] font-semibold text-foreground">This week</h3>
      </div>
      <p className="mt-2 text-[13px] font-semibold text-foreground">{headline}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-foreground-tertiary">
        Let Sloe fill the open slots around your targets, or add meals yourself.
      </p>
      {/* The rail's ONE filled action (the tool cards below are ghost). */}
      <RailCta
        variant="primary"
        label="Fill the open slots"
        onClick={onGenerate}
        width="full"
      />
    </div>
  );
}

/**
 * The rail's "here is a tool" cards (batch cook, shopping list). These were two
 * line-for-line duplicates that had already begun to drift; "same element, same
 * treatment" makes that a bug, not a style preference.
 */
function RailCard({
  icon: Icon,
  title,
  body,
  actionLabel,
  onAction,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="rounded-card-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <span
          className="grid size-7 shrink-0 place-items-center rounded-full"
          style={{ backgroundColor: "var(--background-secondary)" }}
          aria-hidden
        >
          <Icon className="size-3.5 text-foreground" strokeWidth={1.9} />
        </span>
        <h3 className="text-[13px] font-semibold text-foreground">{title}</h3>
      </div>
      <p className="mt-2 text-[11px] text-foreground-tertiary">{body}</p>
      <RailCta variant="ghost" label={actionLabel} onClick={onAction} width="fit" />
    </div>
  );
}

/** The live shopping summary, or the honest "nothing to buy yet" line. */
function shoppingCardBody(itemCount: number, servingCount: number): string {
  if (itemCount === 0) return "Your shopping list builds from the week's recipes.";
  const items = `${itemCount} item${itemCount === 1 ? "" : "s"}`;
  return `${items} · for ${servingCount > 1 ? `${servingCount} people` : "you"}`;
}

export function PlanV3WebRail({
  openDays,
  onGenerate,
  batchCookSubtitle,
  onOpenBatchCook,
  shoppingItemCount,
  servingCount,
  onOpenShopping,
}: PlanV3WebRailProps) {
  return (
    // Sticks while the week scrolls.
    <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
      {openDays.length > 0 ? (
        <InsightCard openDays={openDays} onGenerate={onGenerate} />
      ) : null}
      <RailCard
        icon={Flame}
        title="Batch cook"
        body={batchCookSubtitle}
        actionLabel="Plan a batch"
        onAction={onOpenBatchCook}
      />
      <RailCard
        icon={ShoppingCart}
        title="Shopping list"
        body={shoppingCardBody(shoppingItemCount, servingCount)}
        actionLabel="Open shopping list"
        onAction={onOpenShopping}
      />
    </aside>
  );
}

export default PlanV3WebRail;
