"use client";

/**
 * Suppr `<EmptyState />` — the single empty-state primitive (audit M5,
 * 2026-04-18).
 *
 * Before this primitive shipped, each empty-state card invented its
 * own copy + layout — QuickAddPanel alone had 4 bespoke versions. This
 * component keeps the shape (icon / title / description / optional
 * action) identical everywhere, so users don't read different tabs as
 * "different apps glued together."
 *
 * 2026-05-02 (ui-critic finding #6, P1) — type ladder + illustration
 * upgrade. The previous primitive surfaced empty tabs as 13pt bold
 * over a tiny gap — too quiet to read as a state. The new primitive:
 *  - Optional `illustration` slot rendered inside a 72px circular
 *    `bg-primary/10` disc.
 *  - Title at 18px (`text-[18px] font-semibold leading-[22px]`) —
 *    on-scale per theme.css type ladder.
 *  - Description at 14px (`text-sm leading-5 text-muted-foreground`)
 *    — mirrors mobile `Type.body`.
 *  - 12px rhythm between elements; 24px paddingTop/Bottom.
 *  - Optional `cta` prop (alias for `action`).
 *
 * Prop contract stays backward compatible — `icon`, `title`,
 * `description`, `action`, `className` still accepted. New props are
 * additive: a caller of `<EmptyState title="..." />` still renders.
 *
 * Copy stays at the call site — the component enforces no copy rules
 * beyond a factual, non-shame voice.
 *
 * Mirror: `apps/mobile/components/EmptyState.tsx` (same prop contract,
 * same strings).
 */

import * as React from "react";
import { cn } from "../ui/utils";

export interface EmptyStateProps {
  /** Backwards-compat — small leading icon rendered above the title.
   *  New callers should prefer `illustration` for the 72px disc. */
  icon?: React.ReactNode;
  /** Optional ~32px lucide glyph rendered inside a 72px
   *  `bg-primary/10` tinted disc. */
  illustration?: React.ReactNode;
  /** Short title — typically a plain string, but accepts rich content
   *  (`<span>` / `<strong>` etc.) so callers can preserve existing
   *  inline emphasis without forking the primitive. */
  title: React.ReactNode;
  /** Multi-sentence factual description. No shame, no hype. */
  description?: React.ReactNode;
  /** Backwards-compat alias for `cta`. Either prop renders the same
   *  slot — the component prefers `cta` if both are passed. */
  action?: React.ReactNode;
  /** Optional primary CTA below the description. */
  cta?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  illustration,
  title,
  description,
  action,
  cta,
  className,
}: EmptyStateProps) {
  // `cta` wins when both are passed — keeps the API forward-looking
  // while preserving every legacy `action`-only call site.
  const ctaNode = cta ?? action;
  return (
    <div
      data-slot="suppr-empty-state"
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-4 pt-6 pb-6 text-center",
        className,
      )}
    >
      {illustration ? (
        <div
          aria-hidden
          className="flex size-[72px] items-center justify-center rounded-full bg-primary/10 text-primary [&>svg]:size-8"
        >
          {illustration}
        </div>
      ) : icon ? (
        <div aria-hidden className="text-muted-foreground [&>svg]:size-6">
          {icon}
        </div>
      ) : null}
      <p className="text-[18px] font-semibold leading-[22px] text-foreground">
        {title}
      </p>
      {description ? (
        <p className="text-sm leading-5 text-muted-foreground">{description}</p>
      ) : null}
      {ctaNode ? <div className="mt-2">{ctaNode}</div> : null}
    </div>
  );
}

export default EmptyState;
