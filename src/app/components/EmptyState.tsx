"use client";

import type { LucideIcon } from "lucide-react";
import { AnalyticsEvents } from "../../lib/analytics/events.ts";
import { track } from "../../lib/analytics/track.ts";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  ctaLabel?: string;
  onCtaClick?: () => void;
  secondaryCtaLabel?: string;
  onSecondaryCtaClick?: () => void;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  ctaLabel,
  onCtaClick,
  secondaryCtaLabel,
  onSecondaryCtaClick,
}: EmptyStateProps) {
  return (
    <div className="text-center py-16 max-w-md mx-auto">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-violet-950/40 dark:to-indigo-950/40 flex items-center justify-center mx-auto mb-5">
        <Icon className="w-8 h-8 text-violet-500 dark:text-violet-400" />
      </div>
      <h3 className="mb-2 text-slate-900 dark:text-white font-semibold">{title}</h3>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">{description}</p>
      <div className="flex flex-wrap gap-3 justify-center">
        {ctaLabel && onCtaClick ? (
          <button
            type="button"
            onClick={() => {
              track(AnalyticsEvents.empty_state_cta_clicked, { title, ctaLabel });
              onCtaClick();
            }}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold hover:shadow-lg hover:shadow-violet-500/25 transition-all"
          >
            {ctaLabel}
          </button>
        ) : null}
        {secondaryCtaLabel && onSecondaryCtaClick ? (
          <button
            type="button"
            onClick={onSecondaryCtaClick}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all"
          >
            {secondaryCtaLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
