"use client";

import { Crown, Sparkles, X } from "lucide-react";
import type { UserTier } from "../../types/recipe.ts";

interface UpgradePromptProps {
  /** What the user tried to do. */
  feature: string;
  /** Minimum tier required. */
  requiredTier: "base" | "pro";
  currentTier: UserTier;
  onUpgrade: () => void;
  onDismiss?: () => void;
}

const TIER_LABELS: Record<string, string> = {
  base: "Base",
  pro: "Pro",
};

/**
 * Inline upgrade prompt shown when a free/lower-tier user hits a gated feature.
 * Tapping "Upgrade" navigates to Settings → pricing / promo section.
 */
export function UpgradePrompt({ feature, requiredTier, currentTier, onUpgrade, onDismiss }: UpgradePromptProps) {
  if (currentTier === "pro") return null;
  if (currentTier === "base" && requiredTier === "base") return null;

  return (
    <div className="relative rounded-2xl border-2 border-violet-200 dark:border-violet-800/60 bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-950/30 dark:to-indigo-950/30 p-6 shadow-lg">
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="absolute top-3 right-3 p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
      <div className="flex items-start gap-4">
        <div className="shrink-0 p-2.5 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl shadow-lg shadow-violet-500/20">
          <Crown className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-1">
            Upgrade to {TIER_LABELS[requiredTier]} to unlock
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            {feature} requires a {TIER_LABELS[requiredTier]} plan.
            {currentTier === "free" && requiredTier === "base"
              ? " Unlock unlimited saves, meal planning, shopping lists, and more."
              : " Get access to creator tools, advanced imports, and deeper analytics."}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onUpgrade}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-medium shadow-lg shadow-violet-500/20 hover:shadow-xl hover:shadow-violet-500/30 transition-all"
            >
              <Sparkles className="w-4 h-4" />
              Upgrade
            </button>
            <a
              href="/pricing"
              className="text-sm font-medium text-violet-600 dark:text-violet-400 hover:underline"
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
          ? "bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800/50"
          : "bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
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
        className="shrink-0 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 transition-colors"
      >
        Upgrade
      </button>
    </div>
  );
}
