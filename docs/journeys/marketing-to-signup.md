# Marketing → Signup Loop

A visitor lands on a public web surface (landing, `/pricing`, `/roadmap`,
`/whats-new`, or a referral link), forms trust and pricing intent, and
converts into the [Onboarding → first log](./onboarding-to-first-log.md)
journey.

**Audience:** `(Developer)` | `(Internal)` — engineering, PM, and QA
reference for how the top-of-funnel surfaces behave today. Not user-facing
copy.

**Scope**
- **In:** the public landing page, `/pricing`, the referral invite sub-loop
  (`/g/<code>` → onboarding → server redemption), `/roadmap`, `/whats-new`
  (+ its RSS feed), and the trust/meta surfaces a visitor can reach before
  signing up (`/help`, `/licences`, `/dmca`, `/privacy`, `/terms`).
- **Out:** the onboarding step-by-step flow itself (see
  [onboarding-to-first-log.md](./onboarding-to-first-log.md)), the referral
  backend contract in depth (see [docs/product/referrals.md](../product/referrals.md)),
  the paywall/checkout mechanics beyond entry (see
  [monetisation-and-paywall.md](./monetisation-and-paywall.md)), and landing
  copy-maintenance mechanics (see
  [docs/product/landing-maintenance.md](../product/landing-maintenance.md) —
  that doc is the "how to edit a claim" reference; this doc is the
  "how a visitor moves through these surfaces" narrative).

This is the **front door of the whole product** — everything downstream
(onboarding, first log, retention) starts with a visitor trusting one of
these public pages enough to tap "Get started." Every public route here is
reachable **without authentication** by deliberate choice — legal surfaces
like the DMCA takedown flow have to be reachable pre-login for safe-harbour
protection to apply, and pricing/roadmap/changelog exist specifically to
build trust before signup, so gating them behind an account would defeat
the point. Because of that, this journey doubles as the map of "everything
cold, un-authed traffic can see."

---

## Journey map

```
Landing (/) ──▶ /pricing ──▶ get-started (/onboarding) ──▶ Onboarding → First Log loop
   │  ▲                          ▲
   │  │                          │
   │  └── /roadmap ── /whats-new ┘        (trust-building browse, any order, optional)
   │
   └── /help  /licences  /dmca  /privacy  /terms     (trust/meta — one line each, below)

Referral sub-loop:
  /g/<code> ──▶ localStorage code ──▶ /onboarding?ref=<code> ──▶ server redemption
  (web-only landing)                                              after real session
```

Every arrow above is a **link**, not a required step — a visitor can jump
straight from the landing hero to `/onboarding` without ever touching
`/pricing` or `/roadmap`. The trust surfaces exist to be browsed on demand,
not gated in sequence.

---

## 1. Landing → get-started

**Entry point:** `app/page.tsx` → `app/(landing)/LandingPage.tsx`, the public
`/` route (`suppr.app` / `suppr.club`).

**Why this step exists:** the App Store listing is pre-install awareness;
the landing page is where a visitor decides whether to create an account at
all. It is **web-only by design** — there is no native landing screen in the
mobile app, because a native landing page would only ever be seen by users
who already installed the app. That audience has already converted; there's
nothing left for a landing page to sell them.

**What the user does:** reads the hero (`HERO_HYBRID` by default —
tracker-and-coaching-first framing, with the recipe-import hook demoted to a
supporting line; see
[landing-maintenance.md](../product/landing-maintenance.md#hero-positioning--d-07-hybrid-eng-1204)
for the positioning rationale), scans feature/trust sections, and either
taps a **Get started** CTA (`SIGNUP_HREF = "/onboarding"`, three CTA
instances on the page) or browses one of the footer links (`/pricing`,
`/roadmap`, `/whats-new`, `/help`).

**What happens next:** `/onboarding` — see
[onboarding-to-first-log.md](./onboarding-to-first-log.md) for the full
Welcome → Signup → Reveal → First-log flow. This doc does not duplicate that
content.

**Web/mobile parity:** not a parity gap — the web-only landing page is a
documented, intentional divergence.

---

## 2. `/pricing` — region-aware, Stripe checkout entry

**Entry point:** `app/pricing/page.tsx`, linked from the landing nav/CTAs,
the roadmap header, deep links (`?from=` param), and gated in-app upgrade
prompts (`paywall_viewed.from`).

**Why this step exists:** pricing has to answer "what does this cost me,
here, right now" honestly — currency, VAT, and disclosure all vary by
region, and UK/EU consumer law requires VAT-inclusive pricing from £1/€1
regardless of the underlying entity's incorporation status (see the pricing
posture in `.claude/agents/_project-context.md`).

**What the user does:** reads the region-aware VAT note (`detectRegion` +
`resolveRenderedVatNote`), compares Free vs Pro against the shared
`PRICING_TIERS` / `PAYWALL_COMPARISON_ROWS` SSOT (same SSOT the landing page
and the mobile paywall read — see
[landing-maintenance.md](../product/landing-maintenance.md)), reviews the
competitor comparison and trajectory chart, optionally enters a promo code,
and taps a tier CTA. Free → `"Continue for free"` → `/onboarding`. Pro →
`"Upgrade to Pro"` → Stripe Checkout (web billing rail).

**What happens next:** Free continues into the same
[onboarding-to-first-log.md](./onboarding-to-first-log.md) loop as the
landing CTA. Pro enters Stripe Checkout — the checkout → webhook →
entitlement mechanics are out of scope here; see
[monetisation-and-paywall.md](./monetisation-and-paywall.md).

**Web/mobile parity — documented, intentional divergence:** web `/pricing`
uses Stripe directly; the mobile equivalent is the in-app paywall
(`apps/mobile/app/paywall.tsx`) reached from gated actions and using
RevenueCat/StoreKit, not Stripe. The billing-rail split is a known,
documented divergence (`.claude/agents/_project-context.md` cross-platform
parity rules); entitlements reconcile server-side in `profiles.user_tier`.
Both platforms share the `paywall_viewed.from` enum so analytics stay in
sync even though the checkout implementation differs.

---

## 3. Referral sub-loop — `/g/<code>` invite landing

**Entry point:** a shared invite link generated from the household-invite
surface (`HouseholdInviteDialog.tsx` web, `HouseholdInviteSheet.tsx` +
`ReferralRewardCard.tsx` mobile), pointing at `/g/<code>`. The route is
`robots: { index: false, follow: false }` — not meant to be crawled.

**Why this step exists:** a referral reward loop — both referrer and
referee earn Pro days when the invite converts. Full backend contract:
[docs/product/referrals.md](../product/referrals.md).

**What the user does:**

1. Opens `/g/<code>` (`app/g/[code]/page.tsx` → `ReferralLandingClient.tsx`).
   The client normalises the code (`normaliseReferralCode` — uppercase,
   strip non-alphanumerics, 16-char cap) and writes it to
   `window.localStorage` under `REFERRAL_STORAGE_KEY`
   (`"suppr.pending_referral_code"`) — best-effort; a storage failure just
   means redemption falls back to the `?ref=` query param carried into
   onboarding.
2. Sees a "Start with 30 Pro reward days" invite card and taps **Continue**,
   which forwards to `/onboarding?ref=<code>`.
3. Completes onboarding. Only **after** a real Supabase session exists does
   `WebFlow` call `redeemPendingReferral()` (`src/lib/referrals/pendingReferral.ts`),
   which reads the pending code and calls the authenticated
   `redeem_referral_code(code)` RPC. The ledger
   (`referral_credits`, 30 days each side, schema defined in
   `supabase/migrations/20260701103000_eng1236_referral_reward_loop.sql`) is
   **server-owned** — clients never insert referral rows directly, and the
   RPC rejects self-referral, invalid/flagged codes, and duplicate
   redemptions.

**What happens next:** on success, both parties' entitlement reflects the
30-day Pro credit through the same `profiles.user_tier` reconciliation path
described above — not a separate billing state. See
[docs/product/referrals.md](../product/referrals.md) for the full RPC
contract and rejection cases.

**Current status: off by default.** The referral loop sits behind the
`referral_invite_loop_v1` feature flag, which has been off by default since
2026-07-12. The loop promises "30 days of Pro" to both sides of an invite,
but there was no entitlement-grant path wired to a live paid rail to
actually honour that promise, so the loop was switched off rather than left
live making a commitment the product couldn't keep. The invite card, the
`/g/<code>` landing page, and the redemption flow described above all still
exist in the codebase and work correctly — they're simply unreachable by
default until the flag is re-enabled alongside a working paid rail. See
[docs/product/referrals.md](../product/referrals.md) for the current status
and the fraud safeguards added alongside the loop.

**Cross-platform gap: no redemption path on mobile.** The invite-*generation*
card is dual-platform (web `HouseholdInviteDialog`, mobile
`ReferralRewardCard`/`HouseholdInviteSheet`, both behind the same
`referral_invite_loop_v1` flag). But the `/g/<code>` landing page is
web-only, and mobile has no redemption call anywhere — `redeemPendingReferral`
/ `redeemReferralCode` are only invoked from
`src/app/components/onboarding/web-flow.tsx`; there is no equivalent call in
`apps/mobile/components/onboarding/mobile-flow.tsx` or anywhere else under
`apps/mobile/`. Concretely: an invitee who opens the `/g/<code>` link,
installs the iOS app from that page, and completes onboarding **inside the
app** has no path back to the code stored in the web page's `localStorage`
— the app onboarding never reads a `ref` param or attempts redemption.
Redemption only works today if the invitee completes onboarding in the
**web** flow.

**Reward headline drift risk.** The "30 Pro reward days" copy in
`ReferralLandingClient.tsx` ("Start with 30 Pro reward days" / "you both
earn a 30-day Sloe Pro reward") is a hardcoded string rather than being
sourced from the `REFERRAL_DAYS = 30` constant already exported by
`src/lib/referrals/referralClient.ts`. If the grant amount ever changes,
this headline won't update with it automatically.

---

## 4. `/roadmap` and `/whats-new` — SSOT-backed, can't drift from each other

**Entry points:** landing footer "Roadmap" / "What's new" links; `/roadmap`'s
"Shipped" rows link to `/whats-new`; direct URL; RSS auto-detect.

**Why this step exists:** transparency and trust-building for a visitor
deciding whether to commit — "is this actively built" (roadmap) and "does
what they ship match what they promised" (changelog). Web-only, same
landing-web-only rationale as the marketing page itself.

**`/roadmap`** (`app/roadmap/page.tsx`) reads the `ROADMAP` constant from
`src/lib/landing/content.ts` — **the same source of truth the landing
page's roadmap section reads.** The in-file comment is explicit about why:
*"Never hand-write prose bullets here — add to `ROADMAP` instead so the
parity tests catch drift."* Renders Shipped / Building / Planned buckets
with count chips.

**`/whats-new`** (`app/whats-new/page.tsx`) reads `getAllChangelogs()` from
`src/lib/changelog/entries.ts` — the same changelog entries also power the
`ROADMAP` "Now" bucket header (`currentAppVersionLabel()` pulls the latest
build label from this changelog) and the mobile `whats-new.tsx` screen.

**State this explicitly, because it is easy to miss:** these are not two
independently-maintained pages that happen to agree today. They are two
renderers reading **one shared data module each** — `ROADMAP` and
`getAllChangelogs()` respectively — enforced by
`tests/unit/landingParity.test.tsx`. **Nobody should ever hand-edit the
copy on `/roadmap` or `/whats-new` directly; edit the SSOT
(`src/lib/landing/content.ts` / `src/lib/changelog/entries.ts`) and both the
landing page and the standalone page update together.** See
[landing-maintenance.md](../product/landing-maintenance.md#ship-a-roadmap-item)
for the exact edit steps.

**What happens next:** a "Shipped" roadmap row → `/whats-new`; a `/whats-new`
visit deepens trust and loops back to `/pricing` or `/onboarding` via the
same footer/nav, or exits via RSS (`/whats-new/rss.xml`, discoverable via
`<link rel=alternate>` and a "Get notified — RSS" link on `/roadmap` — a
stand-in for a not-yet-built email-capture form).

### Mobile `/whats-new` — auto-surface only, and a docstring that overclaims

Mobile renders the same changelog SSOT at `apps/mobile/app/whats-new.tsx`,
but the surfacing model is different from web, and the screen's own header
comment describes an entry point that doesn't exist.

The mobile screen's docstring lists two entry points:
1. *"Settings → About → 'What's new' (manual)."*
2. *"Auto-surface on first launch after a build-number bump."*

**Entry point 1 does not exist.** There is no Settings/About link anywhere
in the mobile app that opens `/whats-new` — the only real entry point is #2,
a one-time auto-push from `_layout.tsx` (via `apps/mobile/lib/whatsNew.ts`)
the first time the app launches after its build number increments. Once a
user dismisses that auto-surfaced screen (tapping **Done**, which pops back
to the tabs), there is no way to reopen it until the next build bump.

**Open product question.** It isn't settled whether the one-shot
auto-surface-then-dismiss behaviour is the intended design — treating the
changelog as a transient "what changed since you last opened this" toast
rather than a browsable archive — or whether a manual Settings/About
re-entry point is genuinely missing and the docstring describes behaviour
that was never built. Either reading is plausible, but today's behaviour
isn't documented anywhere as a deliberate choice, and the entry point the
docstring claims exists isn't in the code. A Settings/About link shouldn't
be added on the strength of the docstring alone until this is decided.

The web docstring has a smaller version of the same issue: it also says
"Settings → About" as the manual entry point, when the real entry points
are the landing footer and roadmap "Shipped" links, and it carries a stale
"Suppr" brand reference. This is lower severity than the mobile case
because web's actual entry points work and are just mis-described, not
missing.

**Web/mobile parity — documented, intentional divergence (not drift):**
(1) web shows an all-releases scroll timeline by default; mobile shows only
the latest release unless `whats_new_timeline_v1` is on. (2) mobile
auto-surfaces on a build bump; web has no auto-surface (a modal on web would
feel heavy against a persistent nav, per the web docstring's own rationale).
(3) the manual re-entry gap described above is a genuine product gap, not
an intentional carve-out.

---

## 5. Trust / meta surfaces — one line each

These are reachable from the landing footer (help, what's-new, roadmap) or
by cross-link from each other (privacy/terms/dmca/licences link to one
another, but none of the four are in the landing footer — they're one hop
deeper, reached from within another trust page). Each gets a full narrative
elsewhere; here they're catalogued so this journey doesn't have an
unlinked hole where "the rest of the public site" would otherwise be.

- **Help centre** (`/help`, `app/help/page.tsx` + `HelpClient.tsx`) — search
  + accordion over how-Sloe-works, nutrition methodology, data sources, and
  disclaimers. No dedicated doc covers this surface yet.
- **DMCA / copyright takedown** (`/dmca`) — full §512(c) takedown flow with a
  working form, counter-notice + repeat-infringer sections, and a
  designated-agent email. Public reachability is a **legal requirement**,
  not a nice-to-have: DMCA safe harbour is conditional on the takedown path
  being reachable without authentication. The code side of this is done —
  what's still open is the operator side: US Copyright Office
  designated-agent registration needs to be completed before launch for the
  safe-harbour protection to actually apply.
- **Open-source & open-data licences** (`/licences`) — attribution tables
  for code dependencies and nutrition/product data sources. The
  data-licences table currently lists **Edamam Food Database API**
  ("Powered by Edamam" — restaurant/branded nutrition, commercial licence)
  as an active source, and the trademarks section separately credits
  "Edamam is a trademark of Edamam, LLC." That doesn't match the current
  integration footprint: the live nutrition sources today are FatSecret,
  Open Food Facts, and USDA — Edamam isn't one of them. Either Edamam is a
  live integration that isn't documented anywhere else, or `/licences` is
  crediting a vendor Suppr no longer has a relationship with. A "Powered by
  X" claim on a public legal page needs to be correct in either direction —
  it shouldn't omit a real vendor relationship, and it shouldn't credit one
  that no longer exists. This needs resolving before the licences page can
  be treated as accurate.
- **Privacy policy** (`/privacy`, v1.1 June 2026) — full narrative:
  [docs/journeys/trust-posture-2026-04-27.md](./trust-posture-2026-04-27.md).
  Mobile has no native privacy screen; `login.tsx` / `paywall.tsx` fine-print
  opens the same web URL — correct pattern, not a gap. The controller line
  still reads "Grace Howse as sole operator pending incorporation" — this
  needs updating once incorporation completes.
- **Terms of service** (`/terms`, v1.0 April 2026) — same pattern as
  privacy: web canonical, mobile links out. Carries the not-medical-advice
  and nutrition-estimates disclaimers that back the trust posture referenced
  throughout the nutrition docs.

None of `/help`, `/dmca`, `/licences`, `/privacy`, or `/terms` have a mobile
native screen — all mobile references open the equivalent web URL in the
browser. This is the same landing-web-only rationale as `/pricing` and
`/roadmap`: these are trust/legal surfaces, not conversion surfaces, so a
native re-implementation would duplicate content with no behavioural upside.

---

## Edge cases / limits

- **`localStorage` unavailable at `/g/<code>`.** The referral code write is
  wrapped in a `try`/`catch`; if storage is blocked (private browsing,
  extension interference), redemption still has a fallback path via the
  `?ref=` query param `/onboarding` reads directly — but if the visitor
  navigates away from `/onboarding` before completing signup and returns
  later without the query param, the code is lost. There's no recovery
  beyond that fallback.
- **Referral code redeemed twice / self-referral / invalid / flagged code.**
  All rejected server-side by `redeem_referral_code()`; the client removes
  the locally-stored pending code on any of `invalid_code`,
  `cannot_refer_self`, or `already_redeemed` so a broken code doesn't keep
  retrying on every subsequent onboarding attempt.
- **Region detection failure on `/pricing`.** What `detectRegion` /
  `resolveRenderedVatNote` do if region detection fails isn't documented —
  without a defined fallback, a region-mismatch bug (for example, a
  non-UK/EU visitor seeing a VAT-inclusive price) would be easy to miss.
- **`/whats-new` mobile empty-entry fallback.** If the latest changelog
  entry has no items yet (a build-N+1 placeholder), the mobile screen
  renders the header plus a one-line "we're cooking something up" note
  instead of a blank screen — a deliberately handled edge case, not a bug.
- **Promo codes on `/pricing`.** The `PromoCodeBlock` UI exists; end-to-end
  promo-code correctness (race conditions, expiry) is covered under
  monetisation, not here — see
  [monetisation-and-paywall.md](./monetisation-and-paywall.md).

---

## Related documents

- [onboarding-to-first-log.md](./onboarding-to-first-log.md) — the loop this
  journey feeds into; the canonical next step after any CTA on this page.
- [docs/product/referrals.md](../product/referrals.md) — the referral
  backend contract (ledger schema, RPC signatures, rollout flag). Its
  "default-on" description of the invite card is currently stale — see the
  referral sub-loop's current-status note in section 3 above.
- [docs/product/landing-maintenance.md](../product/landing-maintenance.md) —
  the copy-maintenance reference for the shared SSOT (`content.ts`,
  `entries.ts`) that `/pricing`, `/roadmap`, and `/whats-new` all read from.
- [docs/journeys/trust-posture-2026-04-27.md](./trust-posture-2026-04-27.md) —
  the trust-chip/source-dot language referenced by `/help` and `/privacy`.
- [docs/decisions/2026-07-12-launch-blocked-on-paid-rail.md](../decisions/2026-07-12-launch-blocked-on-paid-rail.md) —
  the exit criteria for turning the referral sub-loop back on.
- [docs/decisions/2026-05-05-public-routes-dmca-licences-whats-new.md](../decisions/2026-05-05-public-routes-dmca-licences-whats-new.md) —
  why every surface in this doc is reachable without authentication.
- [monetisation-and-paywall.md](./monetisation-and-paywall.md) — what
  happens after the `/pricing` Pro CTA / checkout entry documented in
  section 2.

## Known limitations and open product questions

- **Mobile referral redemption.** There is no code path in `apps/mobile/`
  that redeems a pending referral code, so it's an open question whether a
  mobile-native equivalent of `redeemPendingReferral` is planned — for
  example, reading `ref` from a universal link into onboarding — or whether
  completing onboarding on web is meant to be the only supported redemption
  path. This is a product decision as much as a code one: it determines
  what the invite flow can honestly promise a mobile-first invitee.
- **Mobile `/whats-new` re-entry.** Whether the one-shot
  auto-surface-then-dismiss behaviour is the intended design, or a manual
  entry point is genuinely missing, remains unresolved — see the
  `/whats-new` section above for the detail.
- **Edamam attribution on `/licences`.** Whether Edamam is still a live
  data source is unresolved. If it isn't, the licence and trademark entries
  need to come out; if it is, the integration footprint documented
  elsewhere is missing a row for it.
- **Referral reward headline.** `ReferralLandingClient.tsx`'s "30 Pro reward
  days" copy hardcodes the number rather than importing `REFERRAL_DAYS` from
  `referralClient.ts`, so the two can drift if the grant amount ever
  changes.
