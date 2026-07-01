"use client";

import * as React from "react";

import { Button } from "../ui/button";
import { track } from "../../../lib/analytics/track";
import { AnalyticsEvents } from "../../../lib/analytics/events";

/**
 * BarcodeShareOptIn (web) — parity twin of
 * `apps/mobile/components/barcode/BarcodeShareOptIn.tsx` (ENG-1247). Shown inside
 * CreateCustomFoodDialog AFTER a not-found barcode has been saved as a private
 * custom food, when the `barcode_community_contribution` flag is on. The explicit
 * default-OFF opt-in contributes the same nutrition to the shared `user_foods`
 * store via the host's `onShare` (web `submitFoodCorrection`).
 *
 * Posture (docs/decisions/2026-06-27-shared-food-db-contribution-opt-in.md,
 * legal-reviewed): a discrete affirmative "Share it" tap (never automatic); the
 * copy states what's shared + the purpose + links to the policy; the success card
 * is honest about pending-until-verified; a plausibility `block` shows the inline
 * reasons, NOT the success card. The consent meaning is identical to mobile — only
 * the platform-specific confirmation wording differs ("saved to your foods" vs the
 * mobile "logged to your tracker").
 */
export interface BarcodeShareOptInProps {
  onShare: () => Promise<{ ok: boolean; error?: string; reasons?: string[] }>;
  onDone: () => void;
  /** When set, fires `food_contribution_opt_in` on successful share (ENG-1251 P1-A). */
  barcode?: string;
}

type Phase = "prompt" | "sharing" | "success" | "blocked";

export function BarcodeShareOptIn({ onShare, onDone, barcode }: BarcodeShareOptInProps) {
  const [phase, setPhase] = React.useState<Phase>("prompt");
  const [reasons, setReasons] = React.useState<string[]>([]);

  const share = async () => {
    setPhase("sharing");
    const result = await onShare();
    if (result.ok) {
      if (barcode) {
        track(AnalyticsEvents.food_contribution_opt_in, {
          barcode,
          policy_version: "2026-06-27",
        });
      }
      setPhase("success");
    } else if (result.error === "plausibility_blocked") {
      // Honesty rule: a blocked submission NEVER shows the success card.
      setReasons(result.reasons ?? []);
      setPhase("blocked");
    } else {
      setReasons(result.error ? [result.error] : []);
      setPhase("blocked");
    }
  };

  if (phase === "success") {
    return (
      <div className="flex flex-col gap-3" data-testid="barcode-share-success">
        <p className="text-[18px] font-bold text-foreground">Saved — thank you</p>
        <p className="text-sm leading-5 text-muted-foreground">
          It&rsquo;ll show up straight away on your next scan of this barcode. Once a couple of people confirm the same
          numbers, it becomes the entry everyone sees when they scan it. You can remove your version any time from your
          saved items.
        </p>
        <Button type="button" onClick={onDone}>
          Done
        </Button>
      </div>
    );
  }

  if (phase === "blocked") {
    return (
      <div className="flex flex-col gap-3" data-testid="barcode-share-blocked">
        <p className="text-[18px] font-bold text-foreground">These numbers look off</p>
        <p className="text-sm leading-5 text-muted-foreground">
          We didn&rsquo;t add this to the shared database &mdash; double-check the values against the label.
          {reasons.length ? " " + reasons.join(" ") : ""}
        </p>
        <p className="text-sm leading-5 text-muted-foreground opacity-80">Your saved food is kept either way.</p>
        <Button type="button" variant="outline" onClick={onDone}>
          Got it
        </Button>
      </div>
    );
  }

  const busy = phase === "sharing";
  return (
    <div className="flex flex-col gap-3" data-testid="barcode-share-optin">
      <p className="text-[13px] font-semibold text-[var(--success)]">✓ Saved to your foods</p>
      <p className="text-[18px] font-bold text-foreground">Add this to Sloe&rsquo;s shared food database?</p>
      <p className="text-sm leading-5 text-muted-foreground">
        Optional. The name and nutrition you just entered would be shared so other people who scan this barcode can use
        it too &mdash; once it&rsquo;s confirmed. Nothing else from your account is shared.
      </p>
      <a
        href="/privacy#community-food-database"
        target="_blank"
        rel="noreferrer"
        className="text-[13px] font-semibold text-primary-solid underline underline-offset-2"
      >
        How this is used
      </a>
      <Button type="button" onClick={share} disabled={busy} aria-label="Share it">
        {busy ? "Sharing…" : "Share it"}
      </Button>
      <Button type="button" variant="outline" onClick={onDone} disabled={busy} aria-label="Keep it private">
        Keep it private
      </Button>
    </div>
  );
}

export default BarcodeShareOptIn;
