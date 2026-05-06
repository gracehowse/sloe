import { LoginClient } from "./ui";

type LoginPageProps = {
  searchParams: Promise<{ mode?: string | string[] }>;
};

/**
 * Debug audit 2026-05-04 (customer-lens P0 #8 + P2 #17): the landing's
 * "Sign in" CTA routes to `/login`, while "Get started" / "Sign up"
 * routes to `/onboarding` (the canonical signup surface). With the
 * old default, a returning user clicking "Sign in" landed on `/login`
 * with the **Sign Up** tab selected, an empty password field, and a
 * subtitle reading "Free to start. Set your targets and plan your
 * first week." A user could complete signup here and end up at /home
 * with no targets / no onboarding profile — bypassing the canonical
 * onboarding flow entirely.
 *
 * Now: `/login` defaults to **signin** mode. Account creation lives
 * at /onboarding. Tabs remain visible so a user who arrived in error
 * can still switch, but the default reflects what the route is for.
 * Pass `?mode=signup` to opt in to the signup tab from this route
 * (used by historic deep links).
 */
export default async function LoginPage({ searchParams }: LoginPageProps) {
  const sp = await searchParams;
  const raw = sp.mode;
  const modeStr = Array.isArray(raw) ? raw[0] : raw;
  const initialMode = modeStr === "signup" ? "signup" : "signin";
  return <LoginClient initialMode={initialMode} />;
}
