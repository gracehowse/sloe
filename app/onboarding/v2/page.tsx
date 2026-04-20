/**
 * /onboarding/v2 — the redesigned onboarding flow.
 *
 * Currently mounted UNGATED (no PostHog flag check yet); Stage E adds
 * the `onboarding_v2` flag + the redirect from /onboarding when the
 * flag is on. Until then, this route is reachable directly so Grace
 * + the design / specialist reviewers can poke at it on real browsers.
 *
 * Phase scope reminder (decision doc 2026-04-19):
 *  - 13 steps in fixed order; pace auto-skips when goal = maintain
 *  - Pace safety floor is SOFT-WARN — banner shows, Continue stays on
 *  - Sex copy + Pace danger-banner copy still pending sign-off from
 *    diversity-inclusion + legal-reviewer respectively (Stage F)
 *
 * Server-rendered shell with a single client-component subtree below.
 * No data dependency on auth; the actual signUp / Supabase
 * `user_profile` write happens in Stage E once the user advances past
 * the Reveal step.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OnboardingV2Provider } from "@/app/components/onboarding-v2/context";
import { WebFlow } from "@/app/components/onboarding-v2/web-flow";

export const metadata: Metadata = {
  title: "Suppr — Onboarding v2 (preview)",
  // Don't index the preview route — Stage E will add the proper
  // production-ready route + redirect handling.
  robots: { index: false, follow: false },
};

export default function OnboardingV2Page() {
  // Defence-in-depth: the middleware also denies this path in prod
  // (only allowed via `isDevPreview` in non-prod). If someone wires
  // the route into the prod allowlist by mistake, this 404s instead
  // of leaking the unfinished flow.
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <OnboardingV2Provider>
      <WebFlow />
    </OnboardingV2Provider>
  );
}
