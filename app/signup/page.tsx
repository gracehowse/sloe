import type { Metadata } from "next";
import { cookies } from "next/headers";
import { LoginClient } from "../login/ui";

export const metadata: Metadata = {
  title: "Suppr — Create account",
  robots: { index: false, follow: false },
};

type SignupPageProps = {
  searchParams: Promise<{ ref?: string | string[] }>;
};

/**
 * Dedicated signup surface (Premium P1 / RTP-1).
 *
 * Account creation used to 307 to `/onboarding`, which rendered the
 * marketing hero — not a form. Sign-up stays on its own URL for
 * password managers and email-confirm flows; the v2 onboarding flow
 * at `/onboarding` still owns profile + targets after first sign-in.
 *
 * ENG-5: `?ref=<code>` is forwarded from the /i/[code] landing page CTA.
 * We echo it into the `suppr_ref` cookie here so the ReferralRedeemer
 * component can redeem it post-onboarding even if the user navigated
 * directly to /signup without landing on /i/[code] first.
 */
export default async function SignupPage({ searchParams }: SignupPageProps) {
  const sp = await searchParams;
  const raw = sp.ref;
  const ref = Array.isArray(raw) ? raw[0] : raw;
  if (ref && /^[A-Za-z0-9]{4,16}$/.test(ref)) {
    const cookieStore = await cookies();
    cookieStore.set("suppr_ref", ref, {
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: false,
    });
  }
  return <LoginClient initialMode="signup" hideTabs postSignInHref="/onboarding" />;
}
