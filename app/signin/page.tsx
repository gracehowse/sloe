/**
 * /signin — renders the sign-in card with `hideTabs=true`.
 *
 * Premium-bar audit 2026-05-17 (T2.4): previously a 307 redirect to
 * /login, which meant `/signin` and `/login` were byte-identical at
 * the pixel level — both rendered the Sign up / Sign in toggle inside
 * the card. The named-comparable read against Notion flagged this as
 * "3 routes that should be visually distinguishable from above-the-fold
 * pixels alone."
 *
 * Now: `/signin` renders LoginClient with `hideTabs={true}` so the
 * mode toggle is suppressed, and the LoginClient adds the existing
 * "New to Suppr? Create your account" cross-link in the card footer
 * (already wired at app/login/ui.tsx:462-476 for the hideTabs case).
 *
 * `/login` keeps the toggle as the "haven't decided" landing.
 * `/signup` keeps its 307 → /onboarding (signup is canonically inline
 * in the v2 onboarding flow per the duplicate-account-creation fix).
 *
 * Auth gating: middleware still 307s authed users away from /signin
 * back to /home. Existing bookmarks pointing at /signin still work —
 * they no longer redirect to /login but render the same auth surface
 * with a clearer intent signal.
 */

import type { Metadata } from "next";
import { LoginClient } from "../login/ui";

export const metadata: Metadata = {
  title: "Sign in — Suppr",
  description: "Welcome back. Sign in to continue.",
};

export default function SigninPage() {
  return <LoginClient initialMode="signin" hideTabs />;
}
