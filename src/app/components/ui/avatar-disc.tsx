"use client";

import * as React from "react";

import { cn } from "./utils";

export type AvatarDiscSize = 18 | 22 | 28 | 36 | 52;

export type AvatarDiscFill = "identity" | "member";

/**
 * Rule 7 monogram treatments (DESIGN-CONSTITUTION.md, `docs/ux/redesign/v3/`):
 * "People may use serif initials only with the frost-ring treatment, as a
 * stated placeholder until real photography lands." `"legacy"` (default) is
 * today's sans-bold initial, no ring — unchanged rendering. `"frostRing"` is
 * the Rule 7-compliant treatment; ships behind `avatar_monogram_frost_ring_v1`
 * (ENG-1593, default-OFF) — gate at the call site, this prop is
 * presentation-only and carries no flag knowledge itself. Mobile twin:
 * `apps/mobile/components/GradientAvatar.tsx`'s `AvatarMonogramTreatment`.
 */
export type AvatarMonogramTreatment = "legacy" | "frostRing";

/** Frost-ring box-shadow — lifted verbatim from the ratified prototype spec
 *  (`docs/ux/redesign/v3/Sloe-App.html` L1728, the "placeholder kill" rule):
 *  a 2px `--card`-coloured gap ring, then a 3.5px `--accent-frost` ring. */
const FROST_RING_BOX_SHADOW = "0 0 0 2px var(--card), 0 0 0 3.5px var(--accent-frost)";

/** Disc + initial size pairs — all on the type ladder (9/11/13/18). */
const SIZE_CLASSES: Record<AvatarDiscSize, string> = {
  18: "h-[18px] w-[18px] text-[9px]",
  22: "h-[22px] w-[22px] text-[9px]",
  28: "h-7 w-7 text-[11px]",
  36: "h-9 w-9 text-[13px]",
  52: "h-[52px] w-[52px] text-[18px]",
};

export type AvatarDiscProps = React.HTMLAttributes<HTMLSpanElement> & {
  /** Initial(s) to render — derive via `avatarInitials` (`@/lib/avatarInitials`). */
  initial: string;
  size?: AvatarDiscSize;
  /**
   * `identity` — the signed-in user ("you"): solid damson
   * (`--avatar-identity`) + white sans-bold initial. The ONE identity fill
   * per the S5 avatar ruling (2026-07-10, ENG-1375) — the accent-info fill
   * and the sidebar/pricing gradients are retired.
   *
   * `member` — a household member: per-member accent fill (pass `accent`
   * from `householdMemberAccent(index)`) + foreground-ink initial, the
   * functional micro-disc grammar (HouseholdBar).
   */
  fill?: AvatarDiscFill;
  /** Member accent colour (`householdMemberAccent`) — required for `member`. */
  accent?: string;
  /** Rule 7 monogram treatment — `"legacy"` (default, unchanged) or
   *  `"frostRing"` (serif initial + the prototype's double-ring halo). See
   *  `AvatarMonogramTreatment`. */
  treatment?: AvatarMonogramTreatment;
};

/**
 * AvatarDisc — the ONE initials-avatar primitive (S5 avatar ruling,
 * 2026-07-10, ENG-1375). Web twin of mobile `GradientAvatar`'s identity
 * default (Figma `654:6`, `Accent.purple` damson). Decorative by default
 * (`aria-hidden`) — the enclosing button/link carries the accessible label.
 */
export function AvatarDisc({
  initial,
  size = 36,
  fill = "identity",
  accent,
  treatment = "legacy",
  className,
  style,
  ...rest
}: AvatarDiscProps) {
  const member = fill === "member";
  const frostRing = treatment === "frostRing";
  return (
    <span
      aria-hidden
      data-testid="avatar-disc"
      className={cn(
        "grid shrink-0 place-items-center rounded-full",
        // Rule 7: serif initial only under the frost-ring treatment — the
        // legacy sans-bold initial stays sans (no ring to pair it with).
        frostRing ? "font-[family-name:var(--font-headline)] font-medium" : "font-bold",
        SIZE_CLASSES[size],
        member
          ? "text-foreground"
          : "bg-[var(--avatar-identity)] text-white",
        className,
      )}
      style={{
        ...(member && accent ? { backgroundColor: accent } : null),
        ...(frostRing ? { boxShadow: FROST_RING_BOX_SHADOW } : null),
        ...style,
      }}
      {...rest}
    >
      {initial}
    </span>
  );
}
