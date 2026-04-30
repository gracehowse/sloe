/**
 * /onboarding — the canonical onboarding flow (formerly /onboarding/v2).
 *
 * Onboarding-v2 has been at 100% rollout since 2026-04-20. The 1-week
 * validation window closed on 2026-04-27 with no v2 regressions; the
 * legacy form was removed in commit 2026-04-27. As of 2026-04-30 the
 * v2 suffix is removed from code surfaces — `/onboarding/v2` is folded
 * into `/onboarding`. PostHog flag `onboarding_v2` (id 648164) and
 * analytics event names are NOT renamed (live data integrity).
 *
 * Server-rendered shell with a single client-component subtree below.
 */

import type { Metadata } from "next";
import { OnboardingProvider } from "@/app/components/onboarding/context";
import { WebFlow } from "@/app/components/onboarding/web-flow";

export const metadata: Metadata = {
  title: "Suppr — Onboarding",
  // Don't index the onboarding route — it's a logged-in funnel, not
  // a marketing surface. /pricing and / are the canonical indexable
  // pages.
  robots: { index: false, follow: false },
};

export default function OnboardingPage() {
  return (
    <OnboardingProvider>
      <WebFlow />
    </OnboardingProvider>
  );
}
