/**
 * /onboarding-v2 — the redesigned mobile onboarding flow.
 *
 * Mounted directly (no flag yet) so Grace + reviewers can interact
 * with it on a real device before sign-off. Stage E adds the
 * `onboarding_v2` PostHog flag + the redirect from the existing
 * `app/onboarding.tsx`.
 *
 * Note: this is reachable via `expo-router` at /onboarding-v2 in dev.
 * Production gating happens at the redirect/flag layer (Stage E) — the
 * route is harmless on its own because the flow doesn't write to
 * Supabase yet.
 *
 * See `docs/decisions/2026-04-19-onboarding-redesign-scope.md` for the
 * full phased plan and locked scope decisions.
 */

import { GestureHandlerRootView } from "react-native-gesture-handler";
import { OnboardingV2Provider } from "@/components/onboarding-v2/context";
import { MobileFlow } from "@/components/onboarding-v2/mobile-flow";

export default function OnboardingV2Screen() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <OnboardingV2Provider>
        <MobileFlow />
      </OnboardingV2Provider>
    </GestureHandlerRootView>
  );
}
