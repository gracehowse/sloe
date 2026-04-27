/**
 * /onboarding — server-side redirect to /onboarding/v2.
 *
 * Onboarding-v2 has been at 100% rollout since 2026-04-20. The 1-week
 * validation window closed on 2026-04-27 with no v2 regressions; the
 * legacy form + ?legacy=1 escape hatch were removed in this commit
 * (see docs/decisions/2026-04-27-delete-legacy-onboarding.md). The
 * /onboarding route is now an unconditional 307 to /onboarding/v2.
 */

import { redirect } from "next/navigation";

export default function OnboardingPage() {
  redirect("/onboarding/v2");
}
