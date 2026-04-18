"use client";

/**
 * AiPaywallDialog (Batch 5.13, refreshed M2 2026-04-18) — factual Pro
 * paywall shown when a free user taps the Voice-log or AI-photo-log
 * entry point.
 *
 * Copy rules (CLAUDE.md + product-lead):
 *  - Factual, not pushy. No countdowns. No "only X seats left".
 *  - State exactly which feature is gated and why.
 *  - Link to the pricing page — do not try to upsell anything else.
 *
 * M2 (2026-04-18) — the mobile `AiPaywallSheet` is now the parity
 * counterpart of this dialog. Both share `FEATURE_COPY` (defined here
 * and mirrored verbatim in `apps/mobile/components/AiPaywallSheet.tsx`)
 * and fire the same three analytics events with identical payload
 * shapes:
 *  - `ai_paywall_sheet_viewed { feature }` — on mount.
 *  - `ai_paywall_sheet_dismissed { feature, reason }` — on every
 *    dismiss path. Web distinguishes `"not_now"` (the explicit button)
 *    from `"backdrop"` (overlay click + Escape — Radix collapses both
 *    to the same `onOpenChange(false)` callback). The `"close_button"`
 *    reason is fired only by the mobile sheet which has a dedicated X
 *    control; web does not render a separate X inside `DialogContent`.
 *  - `ai_paywall_sheet_cta_tapped { feature, action: "see_plans" }` —
 *    on primary CTA tap. Default `<a>` navigation proceeds to
 *    `/pricing?from={feature}`.
 *
 * Primary CTA label is "See Pro plans" on both platforms.
 */

import { useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Icons } from "../ui/icons";
import { track } from "../../../lib/analytics/track";
import { AnalyticsEvents } from "../../../lib/analytics/events";

export type AiPaywallFeature = "voice_log" | "photo_log";

/**
 * Shared copy. If you edit these strings, also update `FEATURE_COPY`
 * in `apps/mobile/components/AiPaywallSheet.tsx` so the two platforms
 * stay in lockstep. The content is product-approved — see
 * `docs/ux/patterns.md` → "Paywall surfaces — convention".
 */
const FEATURE_COPY: Record<AiPaywallFeature, { title: string; body: string }> = {
  voice_log: {
    title: "Voice logging is a Pro feature",
    body: "Describe what you ate, and we'll estimate macros using our verified nutrition database. Voice logging is included with a Pro subscription.",
  },
  photo_log: {
    title: "AI photo logging is a Pro feature",
    body: "Snap a photo of your meal and we'll identify foods, estimate portions, and match against our verified nutrition database. AI photo logging is included with a Pro subscription.",
  },
};

export type AiPaywallDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature: AiPaywallFeature;
};

export function AiPaywallDialog({ open, onOpenChange, feature }: AiPaywallDialogProps) {
  const copy = FEATURE_COPY[feature];
  const from = feature === "voice_log" ? "voice_log" : "photo_log";

  // `viewedForOpenRef` guards against StrictMode re-running the effect
  // twice on first mount. We only fire `ai_paywall_sheet_viewed` once
  // per open; a re-open (close → open again) fires a fresh view event.
  const viewedForOpenRef = useRef(false);
  useEffect(() => {
    if (!open) {
      viewedForOpenRef.current = false;
      return;
    }
    if (viewedForOpenRef.current) return;
    viewedForOpenRef.current = true;
    track(AnalyticsEvents.ai_paywall_sheet_viewed, { feature });
  }, [open, feature]);

  // When the user taps the explicit "Not now" button we fire the
  // `not_now` dismiss reason directly. Radix then calls `onOpenChange`
  // to close the dialog; we suppress the double-fire inside that
  // callback via `notNowFiredRef`.
  const notNowFiredRef = useRef(false);

  const handleNotNow = () => {
    notNowFiredRef.current = true;
    track(AnalyticsEvents.ai_paywall_sheet_dismissed, {
      feature,
      reason: "not_now",
    });
    onOpenChange(false);
  };

  const handleSeePlans = () => {
    track(AnalyticsEvents.ai_paywall_sheet_cta_tapped, {
      feature,
      action: "see_plans",
    });
    // Let the `<a>` default navigation proceed to /pricing.
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          // Backdrop / Escape / programmatic close all land here.
          // Skip the fire if we just handled "Not now" — otherwise the
          // funnel would double-count the dismiss.
          if (notNowFiredRef.current) {
            notNowFiredRef.current = false;
          } else {
            track(AnalyticsEvents.ai_paywall_sheet_dismissed, {
              feature,
              reason: "backdrop",
            });
          }
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Icons.premium className="size-5 text-primary" aria-hidden />
            {copy.title}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {copy.body}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={handleNotNow}>
            Not now
          </Button>
          <a
            href={`/pricing?from=${from}`}
            onClick={handleSeePlans}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            <Icons.sparkles className="size-4" aria-hidden /> See Pro plans
          </a>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AiPaywallDialog;
