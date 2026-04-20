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
import { OnboardingV2Provider } from "@/app/components/onboarding-v2/context";
import { WebFlow } from "@/app/components/onboarding-v2/web-flow";

export const metadata: Metadata = {
  title: "Suppr — Onboarding v2 (preview)",
  // Don't index the preview route. The route is reachable in prod
  // for authenticated users so Grace (and anyone the `onboarding_v2`
  // PostHog flag matches) can preview the redesigned flow on real
  // infra. Middleware auth-gates the path — random unauthenticated
  // visitors still bounce to /login. The PostHog flag is currently
  // scoped to one email so the auto-redirect from /onboarding only
  // fires for that user; everyone else continues on the legacy flow.
  //
  // ⚠ The flow does not yet write `daily_targets` / `profiles` on
  // completion (OB2-1 in TODO.md). Completing it is harmless but
  // doesn't persist anything yet.
  robots: { index: false, follow: false },
};

export default function OnboardingV2Page() {
  return (
    <OnboardingV2Provider>
      <WebFlow />
    </OnboardingV2Provider>
  );
}
