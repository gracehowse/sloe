"use client";

/**
 * ProgressOnTargetRibbon — Sloe Figma `492:2` on-target-days ribbon.
 *
 * A calm cream card with a circular medal glyph + headline
 * "N on-target days this week" and a supportive subtitle. The count is
 * REAL (derived from the host's per-day on-target booleans). Renders
 * nothing when the count is 0 — we don't show an empty achievement.
 *
 * Mirror: `apps/mobile/components/progress/ProgressOnTargetRibbon.tsx`.
 */

import { Icons } from "../ui/icons";
import { SupprCard } from "../ui/suppr-card";

export interface ProgressOnTargetRibbonProps {
  /** Number of on-target days this week (real count). */
  onTargetCount: number;
  /** Supportive subtitle (e.g. "Your most consistent week this month."). */
  subtitle: string;
  className?: string;
}

export function ProgressOnTargetRibbon({
  onTargetCount,
  subtitle,
  className,
}: ProgressOnTargetRibbonProps) {
  if (onTargetCount <= 0) return null;
  return (
    <SupprCard
      data-testid="progress-ontarget-ribbon"
      padding="lg"
      radius="lg"
      className={["flex items-center gap-3", className].filter(Boolean).join(" ")}
    >
      <div
        className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
        aria-hidden
      >
        <span
          className="absolute inset-0 rounded-full"
          style={{ background: "var(--source-ai)", opacity: 0.12 }}
        />
        <Icons.award className="relative h-5 w-5" style={{ color: "var(--source-ai)" }} />
      </div>
      <div className="min-w-0">
        <p className="text-[15px] font-semibold text-foreground">
          {onTargetCount} on-target {onTargetCount === 1 ? "day" : "days"} this week
        </p>
        <p className="text-[13px] text-muted-foreground leading-snug">{subtitle}</p>
      </div>
    </SupprCard>
  );
}

export default ProgressOnTargetRibbon;
