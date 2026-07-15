/**
 * ENG-1537 — classify the result of `supabase.auth.signUp` so the two web
 * signup call sites (`app/login/ui.tsx` + onboarding `steps/signup.tsx`) can't
 * drift (the ENG-1512 residual was exactly a two-site divergence).
 *
 * With email confirmations ON, GoTrue's anti-enumeration behaviour makes a
 * signup for an ALREADY-registered confirmed email return an *obfuscated* fake
 * user — `identities: []`, `session: null`, and **no error** — and sends no
 * email. Treating that like a real signup produces two bugs:
 *   1. a false "Account created — check your email" (no account, no email), and
 *   2. spurious `user_signed_up` analytics for a signup that never happened.
 *
 * The fix must ALSO not become an enumeration oracle: a brand-new email with
 * confirmations ON returns a real user with a populated `identities` array and
 * no session. Both no-session cases must render identical copy so new vs
 * existing can't be told apart — only the analytics differ (real new user vs
 * obfuscated existing).
 *
 * Prod runs confirmations OFF (`supabase/config.toml`), so today a real signup
 * returns a live `session` → `signed_in`. This classifier arms the correct
 * behaviour if confirmations are ever enabled.
 */

export type SignUpOutcome =
  /** Live session returned (confirmations OFF) — silent success, redirect. */
  | "signed_in"
  /** New email, confirmations ON — a real confirmation link was sent. */
  | "confirm_pending"
  /** Already-registered confirmed email — obfuscated user, nothing was sent. */
  | "existing_obfuscated";

export interface SignUpResultLike {
  user: { identities?: unknown[] | null } | null;
  session: unknown | null;
}

/**
 * Map a (non-error) `signUp` response to its user-facing outcome. Callers show
 * identical copy for `confirm_pending` and `existing_obfuscated` (enumeration
 * safety) and fire signup analytics for everything EXCEPT `existing_obfuscated`.
 */
export function classifySignUpResult(data: SignUpResultLike): SignUpOutcome {
  if (data.session) return "signed_in";
  if (
    data.user &&
    Array.isArray(data.user.identities) &&
    data.user.identities.length === 0
  ) {
    return "existing_obfuscated";
  }
  return "confirm_pending";
}

/**
 * True when the outcome represents a genuine new signup worth attributing.
 * The obfuscated-existing case must NOT fire `user_signed_up` / `identify`.
 */
export function isRealSignUp(outcome: SignUpOutcome): boolean {
  return outcome !== "existing_obfuscated";
}
