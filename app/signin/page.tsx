import type { Metadata } from "next";
import { LoginClient } from "../login/ui.tsx";

/**
 * /signin — canonical sign-in entry point.
 *
 * The Sign Up flow lives at /onboarding (the v2 onboarding flow runs
 * the real Supabase signUp inline at its second step). Keeping a Sign
 * Up tab here would split the sign-up surface and re-create the
 * duplicate-account-creation bug Grace hit on suppr-club.com.
 *
 * `hideTabs` strips the Sign Up / Sign In tab strip and pins the form
 * to the signin handler. The "New to Suppr? Create your account" link
 * at the bottom of the form points back to /onboarding so users who
 * land on /signin by accident can still get to the right place.
 */
export const metadata: Metadata = {
  title: "Sign in — Suppr",
  description: "Sign in to your Suppr account.",
};

export default function SignInPage() {
  return <LoginClient initialMode="signin" hideTabs />;
}
