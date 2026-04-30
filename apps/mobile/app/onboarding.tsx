/**
 * /onboarding — the canonical onboarding flow.
 *
 * Renamed 2026-04-30 from `/onboarding-v2`. The legacy 4-step form
 * was deleted in commit 2026-04-27 once the v2 flow hit 100% rollout
 * (PostHog flag id 648164, on since 2026-04-20). The PostHog flag
 * name + analytics events keep their original names to preserve
 * dashboards.
 *
 * See `docs/decisions/2026-04-19-onboarding-redesign-scope.md` for the
 * scope + decisions log entry; `2026-04-27-delete-legacy-onboarding.md`
 * for the legacy removal log.
 */

import { GestureHandlerRootView } from "react-native-gesture-handler";
import { OnboardingProvider } from "@/components/onboarding/context";
import { MobileFlow } from "@/components/onboarding/mobile-flow";

export default function OnboardingScreen() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <OnboardingProvider>
        <MobileFlow />
      </OnboardingProvider>
    </GestureHandlerRootView>
  );
}
