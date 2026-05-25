import type { Metadata } from "next";
import { LoginClient } from "../login/ui";

export const metadata: Metadata = {
  title: "Suppr — Create account",
  robots: { index: false, follow: false },
};

/**
 * Dedicated signup surface (Premium P1 / RTP-1).
 *
 * Account creation used to 307 to `/onboarding`, which rendered the
 * marketing hero — not a form. Sign-up stays on its own URL for
 * password managers and email-confirm flows; the v2 onboarding flow
 * at `/onboarding` still owns profile + targets after first sign-in.
 */
export default function SignupPage() {
  return <LoginClient initialMode="signup" hideTabs postSignInHref="/onboarding" />;
}
