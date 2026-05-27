# Onboarding advances past signup pre-auth and discards answers on /login bounce

- **Date:** 2026-05-26
- **Area:** Onboarding · Auth · Data-loss
- **Status:** Resolved
- **Severity:** Urgent / launch-blocker (worst first impression for MFP refugees)
- **Linear:** ENG-672
- **Platforms:** Mobile (primary) + web (same class of bug, fixed for parity)

## Summary

The onboarding signup step could advance the flow **before a real Supabase
session landed**, letting a user complete all 13 steps unauthenticated. The
terminal step's completion handler then bounced them to a bare `/login`,
**discarding every computed target + seed** — the worst possible first
impression for the MFP-refugee cohort we are trying to capture.

On mobile, the global footer Continue was *also* never suppressed on the
signup step (`canAdvance("signup")` returned `true` unconditionally), so a
user could leap the auth handshake entirely with one tap on a button that
had nothing to do with signing in.

Security-reviewer confirmed NO server writes happen unauthenticated (RLS +
the terminal handler's `if (!userId)` short-circuit), so this was a
**client-side data-loss + UX bug, not a security hole**.

Secondary defect: the signup step advertised an **email field that did
nothing** — real email sign-up isn't available yet; the only complete path
is Apple Sign-In. The "arrives in a future build" note was buried in fine
print. An input that silently does nothing is a trust-killer.

## Root cause

1. **Premature advance.** Mobile `steps/signup.tsx` called `go(1)`
   immediately after `signInWithIdToken`, described as a "defensive
   double-advance". For any case where the `session` hadn't yet propagated
   to the auth context this advanced ahead of authentication. Web
   `steps/signup.tsx` called `go(1)` after `signUp` even in confirm-email
   mode (`data.user` present, `data.session` null) — advancing an
   unauthenticated user into the flow.

2. **No session gate on the shared validator.** `canAdvance("signup", …)`
   in `src/lib/onboarding/state.ts` returned `true` unconditionally. On
   mobile the flow shell never suppressed the footer Continue on signup
   (web did, via `!isSignup`), so the always-true validator left an active
   Continue button that leapt auth.

3. **Bare /login bounce.** The mobile terminal handler did
   `router.replace("/login")` when `!userId`, throwing away all in-memory +
   persisted onboarding answers. Web reloaded `/onboarding`, which restores
   the persisted terminal step and loops.

## Fix

1. **Session gate in the shared validator (single source of truth).**
   `CanAdvanceContext` gains `hasSession?: boolean`. `canAdvance("signup", …)`
   now returns `ctx?.hasSession === true` — default-deny when the flag is
   absent. Both flow shells thread `hasSession` from their platform auth
   context (web `authedUserId != null`; mobile `session?.user?.id != null`).
   This is the gate the footer Continue and any deep-link / keyboard path
   all honour.

2. **Remove the premature advance.** Mobile signup no longer calls `go(1)`
   after Apple Sign-In; advance is owned solely by the shell's existing
   auto-skip effect, which fires only once a real session lands. Web signup
   only reacts to a landed session (the `AuthSessionContext` subscriber →
   auto-skip effect); in confirm-email mode it shows an honest "check your
   email" state and stays put.

3. **Suppress the footer Continue on signup (mobile).** Parity with web's
   `!isSignup` guard. The signup step owns its own "Sign in with Apple" CTA;
   a disabled footer Continue next to it read as a dead-end.

4. **Never bare-bounce to /login.** On the defence-in-depth `!userId`
   terminal branch, both platforms now send the user **back to the signup
   step** with all answers intact (in memory + persisted) and surface why,
   rather than discarding state. Mobile uses an Alert; web sets the existing
   `completionError` alert region.

5. **Email honesty.** Mobile signup removes the email field entirely and
   surfaces Apple Sign-In as the single path; the note now reads "Email
   sign-up is coming soon." (honest, not a fake promise). First name stays
   as an optional field (Apple sends `fullName` only on first sign-in, so
   it's a useful `display_name` fallback). Web keeps its real email sign-up
   form (web has a working email path) but no longer advances on an
   unconfirmed account.

## Preserved guardrails (2026-05-25 root-cause)

The terminal persist path's `result.ok` inspection (don't navigate-as-
success on a failed write), the no-client-tier-write rule, and the
static-import rule are all **untouched** — this change does not go near the
persist call itself, only the pre-persist auth gate and the post-failure
navigation.

## Web vs mobile parity

| Aspect | Web | Mobile |
|---|---|---|
| Auth path | Real email signUp (working) | Apple Sign-In only (email not built) |
| Email field on signup | Present (works) | Removed (advertised a dead path) |
| Footer Continue on signup | Suppressed (`!isSignup`) | Suppressed (new — parity) |
| Session gate | `canAdvance` + auto-skip effect | `canAdvance` + auto-skip effect |
| Confirm-email mode | "Check your email" interstitial, no advance | n/a (Apple sign-in lands a session synchronously) |
| `!userId` at terminal | Back to signup + `completionError` | Back to signup + Alert |

The web↔mobile signup divergence (email form on web, Apple-only on mobile)
is the documented platform-native auth divergence (Apple Sign-In is
mobile-first per the cross-platform parity matrix in `_project-context.md`);
this change keeps it honest on both surfaces rather than introducing new
drift.

## Verification

- `tests/unit/onboardingState.test.ts` — the signup `canAdvance` cases now
  assert default-deny; a dedicated ENG-672 describe block pins
  session-true→advance / session-false→block / undefined→block.
- `tests/unit/onboardingSignupSessionGate.test.tsx` (web) — confirm-email
  mode shows the honest interstitial and does NOT advance; no self-advance
  on a landed session; error states stay on signup.
- `apps/mobile/tests/unit/onboardingSignupSessionGate.test.tsx` — no email
  field; Apple CTA present; honest "coming soon" copy; no self-advance
  after Apple sign-in; error stays on signup.
- `apps/mobile/.maestro/00c1_onboarding_signup_preauth_guard.yaml` — pre-auth
  Maestro flow (requires a signed-out sim; documents the manual check for
  the auth-timeout case, since the always-authed E2E seam can't exercise
  the signed-out path).
- Web + mobile `tsc --noEmit` clean; ESLint clean on all touched files.

## Review flag

This touches the auth gate. **Needs security-reviewer + data-integrity
sign-off at PR time** — confirm (a) the session gate can't be bypassed by a
deep-link that pre-seeds `step` past signup, and (b) the back-to-signup
recovery never re-fires `onboarding_completed` as a real completion.
