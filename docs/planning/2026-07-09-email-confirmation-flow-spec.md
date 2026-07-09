# Email-confirmation on signup — flow spec (NOT an implementation)

**Date:** 2026-07-09
**Status:** Spec / not yet actioned
**Area:** Auth / signup hardening / anti-abuse
**Related:** ENG-1395 (per-IP AI spend ceiling — the code backstop that
lands independent of this), ENG-672 (web confirm-email interstitial —
already built)

## Why this document exists

The AI spend-ceiling work (ENG-1395, Layer C in
`docs/decisions/2026-05-14-ai-cost-circuit-breaker.md`) caps
account-farming at the AI cost layer: a farmer rotating throwaway
accounts behind one IP is now bounded by a per-IP daily call cap. That is
a **backstop**, not a cure. The root cause it works around is that
**Suppr signup is currently instant-session** — Supabase GoTrue is
configured with `mailer_autoconfirm=true` (or the equivalent
"Confirm email" toggle OFF in the dashboard), so `supabase.auth.signUp`
returns a live `session` immediately with no email round-trip. Creating N
accounts costs nothing but N throwaway addresses.

The proper long-term hardening is to **require email confirmation on
signup** so each account costs the attacker a real, deliverable inbox.
This document specifies that flip — what it touches, what breaks if done
naively, the pieces required (including the load-bearing mobile
deep-link work), and a verification plan. It is a spec only. The flip
itself is a **founder / Supabase-dashboard action**, not an engineering
deploy, and must not be done before the pieces below are in place.

Confidence that this is the right posture: **8/10.** Email confirmation
is table stakes for a public consumer app and the wedge against farming
is real. The 2/10 doubt is purely about *timing* — see "Interaction with
the launch funnel" — not about direction.

## What "flip it naively" breaks

Setting `mailer_autoconfirm=false` (or toggling "Confirm email" ON in the
Supabase Auth dashboard) with no other change breaks three flows that
today rely on `signUp` returning a session synchronously:

1. **Web / cloud-dev instant onboarding.** Per the root `CLAUDE.md`
   Cursor-Cloud notes, the web app talks to live hosted Supabase with no
   `.env.local` and "email sign-up returns a session immediately (no
   confirmation), so auth/data work out of the box." Flip confirmation on
   and every cloud-agent + local-dev signup stalls at "check your email"
   with no inbox to check — auth/data work stops out of the box. Dev
   ergonomics regress hard.

2. **The MFP-refugee capture funnel.** The whole point of the
   MFP-refugee wedge is a low-friction "import your data and see value in
   30 seconds" path. An email-confirmation wall *before* the user reaches
   value is exactly the friction that funnel is designed to avoid.
   Inserting it naively (confirm-then-onboard) will measurably drop
   activation. The mitigation is sequencing, not abandonment — see the
   test/verification plan.

3. **Mobile signup with no return path.** `apps/mobile/app/login.tsx`
   `signUp` does **not** pass `emailRedirectTo` and does not handle a
   confirmation deep-link. Today that's fine (instant session). With
   confirmation ON, a mobile user who signs up with email/password gets a
   confirmation email whose link opens a **web page**, not the app —
   they confirm in mobile Safari, then have to manually switch back to the
   app, which may or may not have picked up the session. That is a broken,
   confusing return path. (Note: mobile's *primary* auth is Apple Sign In,
   which is already confirmed-by-Apple and unaffected — but the
   email/password path is still present and must not dead-end.)

The web path is the least broken of the three: ENG-672 already built the
"check your email" interstitial in
`src/app/components/onboarding/steps/signup.tsx` (it advances only when a
real `session` lands and preserves answers in localStorage across the
redirect). So web is *mechanically* ready; what's missing is the
GoTrue-side pieces and the mobile deep-link.

## Required pieces (all must land before the flip)

### 1. GoTrue configuration (Supabase dashboard — founder action)

- Set **`mailer_autoconfirm = false`** (Auth → Providers → Email →
  "Confirm email" ON).
- Confirmation email **template** reviewed and branded (Auth → Email
  Templates → "Confirm signup"). Copy should match Suppr voice and set
  expectation ("Confirm to finish setting up — your answers are saved").
- **Redirect allow-list** (Auth → URL Configuration → Redirect URLs) must
  include every origin we redirect back to, or GoTrue silently drops the
  redirect and lands the user on the Site URL:
  - `https://<prod-web-origin>/onboarding`
  - `https://<preview/staging origins>/onboarding` as needed
  - `http://localhost:3000/onboarding` for local dev
  - the **mobile deep-link** target (see piece 3) — e.g.
    `suppr://onboarding` (custom scheme) and/or the Universal Link
    `https://<origin>/auth/confirm` if we route through a web bounce page.

### 2. Web `emailRedirectTo` (already wired — confirm, don't rebuild)

`src/app/components/onboarding/steps/signup.tsx` already passes
`emailRedirectTo: ${window.location.origin}/onboarding`. Verify this
origin is in the GoTrue allow-list per piece 1 and that the terminal
`/onboarding` resume path (the WebFlow auto-skip effect referenced in the
ENG-672 comments) still carries a freshly-confirmed session forward.
No new web code is expected; this is a verification line item.

### 3. Mobile deep-link handling (the load-bearing new work)

This is the piece that does not exist today and is the reason the flip
can't be a pure dashboard action.

- **Pass `emailRedirectTo` from mobile signup.** `apps/mobile/app/login.tsx`
  `signUp` must set `options.emailRedirectTo` to a URL that returns to the
  **app**, built with `expo-linking` (`Linking.createURL(...)`) so it
  resolves to the `suppr://` scheme (app.json `"scheme": "suppr"`) in
  dev-client / TestFlight builds.
- **Handle the inbound confirm link.** The app already has deep-link
  routing infra (`apps/mobile/lib/deepLinkRouting.ts`,
  `resolveImportUrl.ts`, both on `expo-linking`). Extend it to recognise
  the auth-confirm link, extract the GoTrue token fragment
  (`access_token` / `refresh_token` or the `token_hash` + `type=signup`
  PKCE-style params depending on the flow the project uses), and call
  `supabase.auth.setSession(...)` / `verifyOtp({ type: "signup", ... })`
  so the session lands **in the app**, not just in Safari.
- **iOS association.** For a Universal Link (recommended over the raw
  custom scheme for deliverability and to survive email-client link
  rewriting), add the `applinks:` associated-domain to `app.json`
  (`ios.associatedDomains`) and host the `apple-app-site-association`
  file on the web origin. If we ship the custom `suppr://` scheme only,
  no association file is needed but some email clients strip / warn on
  non-https links — call that risk out before choosing.
- **Interstitial parity.** Mobile needs the equivalent of the web
  "check your email" state after `signUp` returns a user-without-session,
  matching `signup.tsx`'s ENG-672 behaviour, so the mobile user isn't
  dropped into an unauthenticated app. (Web/mobile parity is
  non-negotiable per `apps/mobile/CLAUDE.md`.)

### 4. Resend + error states

- "Didn't get it? Resend" using `supabase.auth.resend({ type: "signup" })`
  on both surfaces (web interstitial already has a "try a different email"
  affordance; add resend).
- Expired/invalid-link copy: GoTrue confirm links expire; the landing
  page (web) and deep-link handler (mobile) must surface an honest
  "link expired, resend" state rather than a blank error.

## Interaction with the launch funnel (the real decision)

The friction cost is concentrated at the top of the MFP-refugee funnel.
Options, and the recommendation:

- **Confirm-before-value (naive).** Wall the user at signup. Highest
  security, worst activation. Rejected as the default for the viral push.
- **Confirm-after-value (deferred confirmation).** Let the user onboard
  and reach the aha-moment on an instant session, then require
  confirmation before privileged / cost-bearing actions (AI calls,
  data export). This preserves activation while still making a *usable*
  farmed account cost a real inbox. This is the posture to aim for — but
  it's more than a dashboard flip (it needs a "confirmed?" gate on the
  AI/cost surfaces), so it's a follow-up beyond this spec's flip.
- **Backstop-only for now (status quo + ENG-1395).** Keep instant-session
  signup, rely on the per-IP AI cap (ENG-1395) to bound farming cost,
  and schedule the confirmation flip for the post-launch hardening window
  once the funnel metrics are established.

**Recommendation:** ship ENG-1395 now (done), keep signup instant-session
through the launch window, and land pieces 1–4 above so the flip is a
*ready* dashboard action Grace can pull the moment farming shows up in
the per-IP alarm data — ideally paired with confirm-after-value gating so
activation doesn't take the hit. The per-IP cap buys the time to do the
confirmation flow *right* rather than rushing a naive wall pre-launch.

## Test / verification plan

Before the flip is considered safe to pull:

1. **Web happy path (confirm ON, staging project).** Sign up → land on
   "check your email" interstitial → open the confirm link → redirect to
   `/onboarding` → session present → onboarding resumes with the saved
   answers (ENG-672 path). Assert no answer loss across the redirect.
2. **Mobile happy path (dev-client, confirm ON).** Sign up with
   email/password → interstitial → tap the confirm link in the email →
   app opens via deep-link → `setSession`/`verifyOtp` lands the session
   **in the app** → user is authenticated in-app, not just in Safari.
3. **Apple Sign In unaffected.** Confirm the Apple path still returns an
   immediate session with confirmation ON (Apple-verified email).
4. **Expired link.** Wait past expiry (or use a stale token) → both
   surfaces show an honest "link expired — resend" state, resend works.
5. **Redirect allow-list negative test.** A signup from an origin NOT in
   the GoTrue allow-list must fail loudly in testing (so we catch a
   missing origin before prod), not silently redirect to Site URL.
6. **Dev ergonomics.** Confirm the local/cloud-dev story: either keep a
   non-prod Supabase project with confirmation OFF for dev (documented in
   the Cursor-Cloud notes), or a documented test-inbox flow — so
   "auth/data work out of the box" stays true for agents/dev.
7. **Funnel metric guardrail.** Instrument signup→activation before and
   after in a staged rollout; a material activation drop is the signal to
   move to confirm-after-value rather than confirm-before-value.

## Relationship to ENG-1395 (explicit)

- **ENG-1395 (this PR's sibling work) is the code backstop.** It caps
  AI-cost farming *regardless* of the signup posture, ships behind the
  existing `AI_BUDGET_ENFORCEMENT_ENABLED` flag, and needs no dashboard
  action — so it protects the runway *today*, while instant-session
  signup remains.
- **The email-confirmation flip (this spec) is the founder / dashboard
  action.** It removes the underlying cheapness of account creation. It is
  gated on pieces 1–4 above (chiefly the mobile deep-link) and on the
  funnel-timing decision, and should not be pulled before those land.

The two are complementary: the backstop holds the line while the
confirmation flow is built and sequenced correctly.
