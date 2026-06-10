import { Redirect } from "expo-router";

/**
 * `/plan` → `/planner` alias (e2e walk 2026-06-10).
 *
 * The Plan tab's route file is `(tabs)/planner.tsx`, but the tab is
 * NAMED "Plan" everywhere the user sees it — so `suppr:///plan` is the
 * natural deep-link guess for push notifications, Siri shortcuts, and
 * marketing links, and it previously dead-ended on the 404 screen.
 * Thin redirect, same pattern as the `/onboarding-v2` compat shim.
 */
export default function PlanAlias() {
  return <Redirect href="/(tabs)/planner" />;
}
