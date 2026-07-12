"use client";

import * as React from "react";

import { cn } from "./utils";

export type AvatarDiscSize = 18 | 22 | 28 | 36 | 52;

export type AvatarDiscFill = "identity" | "member";

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
  className,
  style,
  ...rest
}: AvatarDiscProps) {
  const member = fill === "member";
  return (
    <span
      aria-hidden
      data-testid="avatar-disc"
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-bold",
        SIZE_CLASSES[size],
        member
          ? "text-foreground"
          : "bg-[var(--avatar-identity)] text-white",
        className,
      )}
      style={member && accent ? { backgroundColor: accent, ...style } : style}
      {...rest}
    >
      {initial}
    </span>
  );
}
