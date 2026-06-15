"use client";

import { X } from "lucide-react";

import { SupprButton } from "./suppr-button";
import { SupprCard } from "../ui/suppr-card.tsx";

export interface WeeklyCheckinBannerProps {
  onOpen: () => void;
  onDismiss: () => void;
}

/**
 * ENG-805 — non-blocking weekly check-in entry on Today (web parity with
 * mobile `WeeklyCheckinBanner`). Opens the modal only on explicit tap.
 */
export function WeeklyCheckinBanner({ onOpen, onDismiss }: WeeklyCheckinBannerProps) {
  return (
    <SupprCard
      data-testid="weekly-checkin-banner"
      elevation="card"
      padding="md"
      radius="lg"
      className="mb-4"
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-primary-solid">
            Weekly check-in
          </p>
          <p className="mt-0.5 text-sm font-semibold text-foreground">
            Your weekly check-in is ready.
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-foreground-secondary">
            See last week&apos;s intake and adjust your goal pace.
          </p>
        </div>
        <SupprButton
          variant="ghost"
          onClick={onOpen}
          data-testid="weekly-checkin-banner-open"
          aria-label="Open weekly check-in"
          className="shrink-0 px-3 py-2 text-[11px] font-bold tracking-wide text-primary-solid"
        >
          Open
        </SupprButton>
        <button
          type="button"
          onClick={onDismiss}
          data-testid="weekly-checkin-banner-dismiss"
          aria-label="Dismiss weekly check-in banner"
          className="shrink-0 rounded-md p-1 text-foreground-secondary hover:text-foreground"
        >
          <X className="h-[18px] w-[18px]" aria-hidden />
        </button>
      </div>
    </SupprCard>
  );
}
