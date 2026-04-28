/**
 * /onboarding/v2 — the redesigned onboarding flow.
 *
 * Phase scope (decision doc 2026-04-19):
 *  - 15 steps in fixed order; pace auto-skips when goal = maintain
 *  - Pace safety floor is SOFT-WARN — banner shows, Continue stays on
 *  - Recipe picker (≥5 saves) is the terminal step
 *  - Persistence flow at `web-flow.tsx#handleComplete` calls
 *    `persistOnboardingV2` → `resolveSeedsToRecipeIds` →
 *    `saveResolvedSeeds` → `buildFirstWeekFromSeeds`
 *
 * Server-rendered shell with a single client-component subtree below.
 *
 * AU-01 fix (2026-04-28): the previous comment claimed "doesn't
 * persist anything yet (OB2-1 in TODO.md)". That was stale —
 * `web-flow.tsx:124` calls `persistOnboardingV2` on completion and
 * has done since Phase 5. The page title's "(preview)" suffix was
 * also stale. Both removed.
 */

import type { Metadata } from "next";
import { OnboardingV2Provider } from "@/app/components/onboarding-v2/context";
import { WebFlow } from "@/app/components/onboarding-v2/web-flow";

export const metadata: Metadata = {
  title: "Suppr — Onboarding",
  // Don't index the onboarding route — it's a logged-in funnel, not
  // a marketing surface. /pricing and / are the canonical indexable
  // pages.
  robots: { index: false, follow: false },
};

export default function OnboardingV2Page() {
  return (
    <OnboardingV2Provider>
      <WebFlow />
    </OnboardingV2Provider>
  );
}
