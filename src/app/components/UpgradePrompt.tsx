"use client";

import { Icons } from "./ui/icons";
import type { UserTier } from "../../types/recipe.ts";

interface UpgradePromptProps {
  /** What the user tried to do. */
  feature: string;
  /**
   * Minimum tier required. PR-01 (audit 2026-04-28): the `"base"`
   * variant is preserved on the type for backwards compat with
   * existing call sites; the prompt always pitches Pro post-collapse.
   */
  requiredTier: "base" | "pro";
  currentTier: UserTier;
  onUpgrade: () => void;
  onDismiss?: () => void;
}

// PR-01 (audit 2026-04-28): Base label folded into Pro for display.
// The only paid tier is Pro.
const TIER_LABELS: Record<string, string> = {
  base: "Pro",
  pro: "Pro",
};

/**
 * Inline upgrade prompt shown when a free/lower-tier user hits a gated feature.
 * Tapping "Upgrade" navigates to Settings → pricing / promo section.
 */
export function UpgradePrompt({ feature, requiredTier, currentTier, onUpgrade, onDismiss }: UpgradePromptProps) {
  if (currentTier === "pro") return null;
  // PR-01 (audit 2026-04-28): legacy `currentTier === "base"` rows
  // are treated as Free for gating — they have no active paid
  // entitlement post-collapse. The prompt fires regardless of which
  // legacy `requiredTier` value the caller passes.

  return (
    <div className="relative rounded-2xl border-2 border-primary/30 bg-primary/10 p-6 shadow-lg">
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="absolute top-3 right-3 p-1 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
        >
          <Icons.close className="w-4 h-4" />
        </button>
      )}
      <div className="flex items-start gap-4">
        <div className="shrink-0 p-2.5 bg-primary rounded-xl shadow-lg shadow-primary/20">
          <Icons.premium className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground mb-1">
            Upgrade to {TIER_LABELS[requiredTier]} to unlock
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {feature} requires a Pro plan. Plan your full week, log
            by photo or voice, and generate a ready-to-shop list.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onUpgrade}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all"
            >
              <Icons.sparkles className="w-4 h-4" />
              Upgrade
            </button>
            <a
              href="/pricing"
              className="text-sm font-medium text-primary hover:underline"
            >
              Compare plans
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact inline badge for save-limit warnings.
 */
export function SaveLimitBanner({
  savedCount,
  limit,
  onUpgrade,
}: {
  savedCount: number;
  limit: number;
  onUpgrade: () => void;
}) {
  if (savedCount < limit - 2) return null;

  const remaining = Math.max(0, limit - savedCount);
  const atLimit = remaining === 0;

  return (
    <div
      className={`rounded-xl px-4 py-3 text-sm font-medium flex items-center justify-between gap-3 ${
        atLimit
          ? "bg-warning/10 text-warning border border-warning/30"
          : "bg-muted text-muted-foreground border border-border"
      }`}
    >
      <span>
        {atLimit
          ? `You've reached the free limit of ${limit} saved recipes.`
          : `${remaining} free save${remaining === 1 ? "" : "s"} remaining.`}
        {" "}
        <a href="/pricing" className="underline font-semibold hover:opacity-80">
          See plans
        </a>
      </span>
      <button
        type="button"
        onClick={onUpgrade}
        className="shrink-0 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
      >
        Upgrade
      </button>
    </div>
  );
}
