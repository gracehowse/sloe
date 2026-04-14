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
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
        <Icon className="w-8 h-8 text-primary" />
      </div>
      <h3 className="mb-2 text-foreground font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground mb-6">{description}</p>
      <div className="flex flex-wrap gap-3 justify-center">
        {ctaLabel && onCtaClick ? (
          <button
            type="button"
            onClick={() => {
              track(AnalyticsEvents.empty_state_cta_clicked, { title, ctaLabel });
              onCtaClick();
            }}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-white font-semibold hover:shadow-lg hover:shadow-primary/25 transition-all"
          >
            {ctaLabel}
          </button>
        ) : null}
        {secondaryCtaLabel && onSecondaryCtaClick ? (
          <button
            type="button"
            onClick={onSecondaryCtaClick}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-border text-foreground font-semibold hover:hover:bg-muted/60 transition-all"
          >
            {secondaryCtaLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
