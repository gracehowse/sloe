/**
 * / — marketing landing page, always.
 *
 * Grace 2026-04-20: "suppr-club.com = main landing page." This route
 * unconditionally renders the marketing landing for ALL visitors,
 * authed or not. The dashboard moved to /home. Sign-up CTAs point at
 * /onboarding (real Supabase signUp inline at v2 step 02); sign-in
 * CTAs point at /login.
 *
 * Previously this file did a server-side `supabase.auth.getUser()`
 * and rendered HomePageClient for authed users. That created a loop
 * for authed-but-onboarding-incomplete users: HomePageClient's gate
 * client-side-redirected to /onboarding, which 307s to /onboarding/v2,
 * which sometimes bounced back to / — every visit to suppr-club.com
 * felt broken.
 *
 * Authed users who want the dashboard navigate to /home (or are sent
 * there after sign-in / onboarding completion).
 */

import type { Metadata } from "next";
import { LandingPage } from "./(landing)/LandingPage.tsx";

export const metadata: Metadata = {
  title: "Suppr — The recipe and nutrition platform for people who actually cook",
  description:
    "Paste a link from Instagram, TikTok, or any recipe blog — Suppr parses every ingredient and matches it against USDA FoodData Central and other public food databases.",
};

export default function Page() {
  return <LandingPage />;
}
