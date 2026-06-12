import { Redirect, Stack } from "expo-router";

/**
 * Dev-route guard (audit 2026-06-12 P2 #3).
 *
 * Every file under `apps/mobile/app/` is shipped as an expo-router route in
 * the release binary, so the QA-scaffolding screens under `app/dev/`
 * (`edit-meal-states`, …) are reachable via deeplink (`suppr:///dev/*`) in a
 * production build. They can't write (handlers are no-ops / Save is hard-
 * blocked), but shippable dev scaffolding is a professionalism/trust surface
 * on a deep-linkable app.
 *
 * This layout is the PRIMARY guard for the whole `dev/` segment: in a release
 * build it renders `<Redirect href="/" />` so any `suppr:///dev/*` deeplink
 * resolves to Today instead of the dev screen. In `__DEV__` (the dev client +
 * the Maestro flows that drive `suppr:///dev/edit-meal-states`) the child
 * routes render normally.
 *
 * Guard style mirrors the canonical Hermes-DCE-friendly pattern in
 * `apps/mobile/components/settings/DevFlagOverrides.tsx` — `typeof __DEV__`
 * first so jsdom/vitest renders (where the RN global is undefined) never throw,
 * then `!__DEV__`. Individual dev screens keep their own `__DEV__` guard as
 * defence-in-depth (e.g. `dev/edit-meal-states.tsx`).
 */
export default function DevLayout() {
  if (typeof __DEV__ === "undefined" || !__DEV__) {
    return <Redirect href="/" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
