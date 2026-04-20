/**
 * /home — authenticated dashboard route.
 *
 * The dashboard used to live at `/`, which conflicted with Grace's
 * intent that suppr-club.com/ always render the marketing landing
 * page (Grace 2026-04-20). Visiting `/` while authed-but-onboarding-
 * incomplete was bouncing into /onboarding via the home gate, which
 * read as a redirect loop on the marketing URL.
 *
 * Auth gating is unchanged — the client gate (`useHomeProfileGate` in
 * HomePageClient) still bounces unauthed visitors to /login and
 * onboarding-incomplete users to /onboarding. Middleware also catches
 * unauthed access (/home is not in PUBLIC_ROUTES) and 307s to /login
 * before any client JS runs.
 */

import type { Metadata } from "next";
import { HomePageClient } from "../HomePageClient.tsx";

export const metadata: Metadata = {
  title: "Suppr — Dashboard",
  description:
    "Your meal plan, today's macros, and recipe library — all in one place.",
};

export default function HomeRoute() {
  return <HomePageClient />;
}
