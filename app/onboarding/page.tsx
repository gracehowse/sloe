/**
 * /onboarding — server-side redirect to /onboarding/v2.
 *
 * As of 2026-04-20 the canonical onboarding lives at /onboarding/v2 (see
 * docs/decisions/2026-04-19-onboarding-redesign-scope.md → "Rollout"
 * section). The previous client-side, PostHog-flag-gated redirect was
 * unreliable in two cases:
 *   - cookie-consent gate suppressed PostHog before flags loaded
 *   - async /decide round-trip raced with the legacy form's own render
 * Both produced the symptom of users landing on the legacy 4-step form
 * even with the flag at 100%.
 *
 * This server component issues a 307 before any client JS runs. No
 * PostHog dependency, no flicker.
 *
 * Rollback hatch: append `?legacy=1` to render the preserved legacy
 * form (see ./legacy-form.tsx). Hatch + form file are scheduled for
 * deletion ≥ 2026-04-27 if no v2 regression surfaces.
 */

import { redirect } from "next/navigation";
import { LegacyOnboardingForm } from "./legacy-form";

// Next.js 15 made `searchParams` a Promise — see
// https://nextjs.org/docs/app/api-reference/file-conventions/page#searchparams-optional
interface OnboardingPageProps {
  searchParams?: Promise<{ legacy?: string }>;
}

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const params = (await searchParams) ?? {};
  if (params.legacy !== "1") {
    redirect("/onboarding/v2");
  }
  return <LegacyOnboardingForm />;
}
