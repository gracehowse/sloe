# User Journey: Meal Sharing

**Audience:** Product / Design / Engineering

## One-line purpose

A user shares one logged meal via a durable link; the recipient — signed in,
signed out, or brand-new — opens it, picks a day and slot, and adds the exact
same items to their own diary. MFP-parity for "share a meal," replacing a
text-only share that never landed anything in the recipient's log.

## Status — read this first

**Implemented behind flag, migration staged, not yet ramped.**

- `meal_share_links_v1` (`MEAL_SHARE_FLAG`, `src/lib/share/mealShareLink.ts`
  / mobile `@suppr/shared/share/mealShareLink`) is in
  `KNOWN_DEFAULT_OFF_FLAGS` in both `src/lib/analytics/track.ts` and
  `apps/mobile/lib/analytics.ts` — **default off**. **The flag gates link
  CREATION only.** Flag off = byte-identical pre-ENG-1642 behaviour for the
  *sharer*: "Share meal" sends the existing macro-summary text only, no
  link, no `meal_shares` row. **Redemption is deliberately un-gated on both
  platforms** — the `/m/<token>` web landing, the `/home` post-auth resume
  (`SharedMealAcceptHost`), and mobile's `/meal-shared` accept screen all
  work regardless of the flag, so a link minted inside a partial ramp
  cohort still resolves for any recipient. See the flag JSDoc in both
  `KNOWN_DEFAULT_OFF_FLAGS` lists for the full rationale. A true security
  kill of redemption (not just new-link creation) requires a follow-up
  migration revoking the anon grant on `get_meal_share` — the flag alone
  does not do this.
- **`supabase/migrations/20260722090000_eng1642_meal_share_links.sql` (the
  `meal_shares` table + its three RPCs) is staged but not yet applied to the
  live DB.** It must be run via `supabase db push --linked` — Grace runs
  this, never MCP `apply_migration` (would rewrite `schema_migrations.version`
  to wall-clock NOW(), and this file is deliberately future-dated) — **before**
  the flag is ramped in PostHog. The pre-ramp gate is tracked as **ENG-1650**:
  migration apply → Playwright e2e + sim verification → ramp. Flipping the
  flag on without the migration applied means every `create_meal_share` /
  `get_meal_share` call fails at the RPC-not-found level; the client-side
  fallback path (below) degrades that to the pre-existing text-only share
  rather than a visible error, but no share link will ever actually work
  until the migration lands.
- Full detail on what's implemented, by file, is in the Steps below and the
  Web ↔ mobile parity table.

## Scope

**In scope:** sharing one logged meal from Today (web `NutritionTracker.tsx`
/ mobile `TodayMealsSection.tsx`) as a durable `/m/<token>` link, the anon-
reachable web landing page, the signed-in/signed-out accept flows on both
platforms, revocation, and the four new analytics events.

**Out of scope — go here instead:**
- **The pre-existing text-only "Share meal" action** (macro-summary text via
  the native/web share sheet, no durable record) — this doc's Step 1 covers
  how that action now *also* tries to mint a link; the plain-text
  serialization itself (`buildMealShareText.ts`) is unchanged and not
  re-documented here.
- **Household meal sharing** (a standing household sees a member's planned
  dinners) → [`household-sharing.md`](./household-sharing.md). Unrelated
  mechanism — that's continuous visibility between co-members of a household;
  this doc is a one-off, token-addressed snapshot handed to anyone with the
  link, member or stranger.
- **Recipe import / creator attribution links** →
  [`import-recipe.md`](./import-recipe.md),
  [`creator-platform.md`](./creator-platform.md). A meal share carries a
  logged meal's macros, not a recipe's full ingredient list or provenance.
- **Referral rewards** (`/g/<code>`) → [`docs/product/referrals.md`](../product/referrals.md).
  A separate code-redeemed reward system with no connection to meal shares.

## Where this sits in the loop

Meal sharing is a **branch off the Daily Logging Loop**, not a standalone
funnel — it starts from an already-logged meal and, for the recipient, ends
back at exactly the same place a normal log does:

```
Today: log a meal (food-tracking.md) ──> "Share meal" action (this doc)
                                             │
                                    mints /m/<token> link
                                             │
                          recipient opens link (signed in / signed out / new)
                                             │
                              picks day + slot ──> adds to THEIR log
                                             │
                                    Today: log a meal (closes the loop)
```

For a signed-out recipient, the loop detours through signup/login (the
Marketing → Signup Loop) before landing back on Today with the shared meal
already pending.

## Entry points

| Entry point | Web | Mobile |
|---|---|---|
| Share a logged meal | "Share meal" row on a Today meal card (`src/app/components/suppr/today-meals-section.tsx`) — `onShareMealLink` prop wired from `NutritionTracker.tsx` when the flag is on | Today meal long-press Alert **and** the branded action sheet both delegate to `shareJournalMeal()` (`apps/mobile/lib/mealShare.ts`), called from `apps/mobile/components/today/TodayMealsSection.tsx` |
| Open a share link (signed in, signed out, or new) | `/m/<token>` — public Next.js route, anon-reachable (`app/m/[token]/page.tsx` → `MealShareLandingClient.tsx`) | `suppr:///meal-shared?token=<hex>` resolves as a real Expo Router route (`apps/mobile/app/meal-shared.tsx`) — **not** a custom deep-link-pipeline case; `decideDeepLinkAction` explicitly `{kind:"ignore"}`s it so the recipe-import deep-link pipeline never intercepts it |
| Resume a share after signup/login | `?mealShare=<token>` query param on `/home` (consumed once by a ref-guarded effect in `SharedMealAcceptHost`, `src/app/components/suppr/shared-meal-accept-host.tsx`, mounted in `src/app/App.tsx`), or the `suppr.pending_meal_share` localStorage handoff (`storePendingMealShare` / `takePendingMealShare`, `mealShareClient.ts`) written by the landing page before it redirects to `/signup` or `/login` | ENG-1649 parity: the `/meal-shared` "Sign in to add this" tap stashes the token via `storePendingMealShare` (AsyncStorage, `mealShare.ts`); `ResumePendingMealShare` in `app/(tabs)/_layout.tsx` drains it once post-auth (session + onboarding gate = the `/home` analogue) and re-opens `/meal-shared` |

## Step 1 — Sharer: mint a link

**Why this exists:** the pre-ENG-1642 "Share meal" action (ENG-25,
`meal_share_invoked`) only ever produced plain text — a macro summary with no
way for the recipient to get the meal into their own log without re-typing
it.

**What the user does:** taps "Share meal" on a logged meal, exactly as
before. Nothing new to learn — the action's entry point, icon, and position
are unchanged on both platforms.

**What happens underneath (flag on):**
1. The meal's items are serialized via `mealToShareItem` (web
   `LoggedMeal` / mobile `JournalMeal` — a shared pure function in
   `mealShareLink.ts`) into the snake_case wire shape the `create_meal_share`
   RPC's server-side whitelist expects.
2. `createMealShare` (`mealShareClient.ts` web / `mealShare.ts` mobile) calls
   the RPC. On `status: "created"`, it returns a token; `buildMealShareUrl` /
   `buildMobileMealShareUrl` turn that into `https://<origin>/m/<token>` (web
   origin) or the mobile app's configured origin.
3. **Web:** `navigator.share({title, text, url})` if available, else the URL
   + macro text are copied to the clipboard together ("Share link copied"
   toast). A `NotAllowedError` from the browser's share API (Safari losing
   the user-activation window across the async RPC round trip) also falls
   back to clipboard rather than surfacing an error.
4. **Mobile:** the native `Share.share({message, url, title})` sheet opens
   with the plain-text macro summary AND the link concatenated into one
   message — there's no separate "copy link" affordance on mobile, the OS
   share sheet is the only path.
5. `meal_share_link_created {surface, itemCount}` fires once the RPC
   confirms `created`. `meal_share_invoked` (the pre-existing event) still
   fires on every share attempt, now carrying `mode: "link"` for this path.

**Fallback (flag off, RPC fails, or the meal doesn't serialize — e.g. a
non-finite macro):** falls straight through to the **exact pre-ENG-1642
text-only share** — same message, same share sheet, `meal_share_invoked`
carries `mode: "text"`. The user never sees an error for this fallback; the
share still happens, just without a durable link. This is a deliberate
graceful-degradation choice, not a swallowed bug: a share failing outright
(no text either) would be worse than losing just the "recipient can add this
to their log" upside.

**Rate limit:** `create_meal_share` caps a sharer at 100 shares / 24h
(counted inside the RPC, no separate counter table — the `ENG-1320`
convention). Hitting it returns `status: "rate_limited"`, which the client
treats the same as any other non-`"created"` status: fall through to text.

**Web:** `src/app/components/NutritionTracker.tsx` (`onShareMealLink`),
`src/app/components/suppr/today-meals-section.tsx` (the row + share-sheet
logic), `src/lib/share/mealShareClient.ts`, `src/lib/share/mealShareLink.ts`.
**Mobile:** `apps/mobile/lib/mealShare.ts` (`shareJournalMeal`,
`journalMealToShareInput`, `createMealShare`), `apps/mobile/components/today/TodayMealsSection.tsx`.

## Step 2 — The snapshot: what a `meal_shares` row actually is

**Why this exists:** the recipient must never be able to read the sharer's
live diary, targets, or day budget — only exactly the meal that was shared,
frozen at share time.

**What gets stored:** one `meal_shares` row per share — `title`, `meal_slot`,
and `items` (a jsonb array the RPC **rebuilds server-side against a
whitelist**, never trusting the client payload verbatim: `recipe_title`,
`calories`/`protein`/`carbs`/`fat` with bounded numeric ranges, and optional
`fiber_g`/`water_ml`/`portion_multiplier`/`source`/`nutrition_micros`/
`recipe_id`). `recipe_id` survives only when it resolves to a **published**
recipe — a private recipe id would otherwise leak through the anon-readable
payload.

**Immutable + no cross-user diary read (ENG-25 privacy pin, carried
forward):** a share row is written once and never updated except gaining
`revoked_at`. It carries meal contents only — never the sharer's targets,
remaining-today numbers, or any other diary content. There is no RLS grant
anywhere in this feature that lets a recipient (or anyone) read the sharer's
`nutrition_entries` directly; `get_meal_share` returns a value copied out of
`meal_shares`, never a live join into the sharer's diary.

**Live display name, never snapshotted (ENG-154):** `shared_by` is resolved
from `profiles.display_name` **at read time**, every time `get_meal_share` is
called — not stored on the row at share time. If the sharer renames or
deletes their account between share and open, the recipient sees the current
name (or, for a fully deleted account, `null` → "Someone shared a meal with
you"), never a stale pre-rename name.

**Token + expiry:** 32 lowercase-hex characters (128 bits, `gen_random_bytes(16)`
— sized up from the 6-byte household invite code specifically because this
token gates an *unauthenticated* read). Expires 30 days after creation
(checked at read time inside `get_meal_share`, never swept by a cron).

**Anon-callable by design:** `get_meal_share` is the **first anon-executable
RPC in the schema** — a deliberate, reviewed exception so the `/m/<token>`
web landing renders a preview for a signed-out recipient before they've
created an account. Scope stays narrow: a token-addressed read of one
sharer-authored snapshot, nothing else. `create_meal_share` and
`revoke_meal_share` remain `authenticated`-only.

**Migration + RPCs:** `supabase/migrations/20260722090000_eng1642_meal_share_links.sql`
— see `docs/data/schema.md` § `meal_shares` for the full column/RLS/RPC
reference.

## Step 3 — Recipient: open the link and accept

**Why this exists:** the recipient needs to see what they're being offered
before committing, choose *when* they want it logged (not necessarily
"right now" — MFP-parity means "add this to a day I choose"), and the flow
must work whether they already have an account, have an account but aren't
signed in, or have never used Sloe at all.

### Web — `/m/<token>` landing

**What the user does:** opens the link (from a text message, DM, wherever
the share sheet sent it). `middleware.ts`'s `isPublic()` allow-lists any
`/m/` path, so this renders with no session at all — the anon
`get_meal_share` call and `supabase.auth.getSession()` resolve in parallel.

**What they see, by state:**
- **Loading** — a skeleton (animated placeholder blocks).
- **Invalid / expired / revoked** — one of three distinct copy blocks (the
  RPC's own status distinguishes "never existed / malformed token" from
  "existed but timed out" from "sharer pulled it"); no generic "something
  went wrong."
- **Ok** — the sharer's live display name ("*Name* shared a meal" / "Someone
  shared a meal with you" if no name resolves), the meal title, slot badge,
  a per-item list with macro trailers, and a totals row.

**The CTA split (one filled CTA per state, per the house button-system
rule):**
- **Signed in** — a single primary "Add to my log" button that navigates to
  `/home?mealShare=<token>` (no further landing-page UI; the accept dialog
  takes over on the Today surface — see below).
- **Signed out** — primary "Join Sloe and add it" (stashes the token via
  `storePendingMealShare`, fires `shared_meal_signup_started
  {surface:"meal_share_landing"}`, routes to `/signup`) plus a ghost
  secondary "I already have an account" (stashes the token, routes to
  `/login`, no analytics fire — login isn't a conversion event). Neither the
  password signup nor login form supports a `?next=` redirect param, which
  is why the token is stashed in `localStorage` rather than carried through
  the query string across that hop.
- **Open in app (iOS UA only, both signed-in and signed-out states)** — a
  ghost "Open in the Sloe app" link below the primary CTA(s), rendered only
  after a client-side UA check (`/iPad|iPhone|iPod/i` — iOS-only, matching
  the mobile app's iOS-only build target: an Android visitor has no app to
  open, so the check deliberately excludes it; starts `false` and flips in
  a post-mount effect so SSR and the first client render match — no
  hydration mismatch). `href` is
  `suppr://meal-shared?token=<token>` — the app's registered scheme
  (`apps/mobile/app.json` `"scheme": "suppr"`), resolved by Expo Router's
  file-based convention straight to `apps/mobile/app/meal-shared.tsx`, no
  custom linking config needed. **This is the only entry point to the
  native accept screen that exists in v1** — `buildMobileMealShareUrl`
  always shares a plain `https://` URL (no universal links /
  `associatedDomains` yet, deliberately out of scope per the ticket), so
  without this handoff link `meal-shared.tsx` would be unreachable from any
  real share. If the app isn't installed, the scheme navigation silently
  no-ops and the visitor stays on this page — no error, no broken tab.

`meal_share_link_opened {status, authed}` fires exactly once per load
(ref-guarded against React re-renders re-firing it).

**What happens back on `/home`:** `SharedMealAcceptHost`
(`src/app/components/suppr/shared-meal-accept-host.tsx`, mounted once in
`src/app/App.tsx` alongside every other authed surface — **not** inside
`NutritionTracker.tsx`, which only wires the sharer-side
`useMealShareLinkCallback()`) runs a one-shot, ref-guarded effect that reads
`?mealShare=` (stripping it from the URL via `router.replace` the same way
the pre-existing `?openLog=1` alias does) or falls back to
`takePendingMealShare()` if the query param is absent. It normalises the
token, calls `getMealShare`, fires `meal_share_link_opened {status, authed}`
**again** here — this is a deliberate second fire, not a duplicate bug: the
landing-page fire measures link-open-before-auth, this one measures the
post-auth resume, and they're distinguishable by `authed` (the landing fire
is `authed:false` for anyone who just signed up). On `status:"ok"` it opens
`SharedMealAcceptDialog` (`src/app/components/suppr/shared-meal-accept-dialog.tsx`)
— a day/slot picker mirroring `CopyMealDialog`'s exact scaffolding (branded
header behind `redesign_branded_sheets`, 4-chip slot selector defaulting to
the payload's own slot, native date input + Today/Tomorrow quick chips).
Confirming calls the host's own `onConfirm`, which loops the payload's items
through `shareItemToLoggableMeal` and `addLoggedMealForDate` (source
`"shared_meal"` — this fires `food_logged` per item, same as any other
`addLoggedMealForDate` call) and fires `shared_meal_logged {surface,
itemCount, slot}`.

### Mobile — `/meal-shared?token=<hex>`

**What the user does:** taps the link from the native share sheet's message.
Because this is a first-class Expo Router route (not a `suppr://` custom
scheme handler), it opens directly — there is no separate deep-link
resolution step to reason about, and `decideDeepLinkAction` in
`apps/mobile/lib/deepLinkRouting.ts` explicitly ignores both the one- and
two-slash forms of the URL so the existing recipe-import deep-link pipeline
never mistakes it for an import.

**What they see:** loading spinner → one of three empty states (invalid /
expired / revoked, via `NutritionDetailEmptyState` with distinct icon +
copy per status, "Go back" CTA) → the accept screen: sharer line, meal card
(per-item calorie rows + a totals row), a 4-chip slot selector defaulting to
the payload's slot, and a 3-chip day picker (Today / Tomorrow / +2 days —
narrower than web's open date input, matching mobile's denser input model).

**The CTA split:** signed in → primary "Add to my log" (loading state while
submitting, disabled during submit — no double-submit) + ghost "Not now."
Signed out → primary label changes to "Sign in to add this"; the tap
stashes the token via `storePendingMealShare` (AsyncStorage,
`suppr.pending_meal_share`) then routes to `/login` (there's no
`nutrition_entries` row to write without a `user_id`, so this is a hard
gate, not a soft nudge). **Mobile now has the signed-out resume rail
(ENG-1649)** — mirror of web's: the token is drained once, post-auth, by
`ResumePendingMealShare` mounted in the fully-gated tab tree
(`apps/mobile/app/(tabs)/_layout.tsx` — session present + onboarding
complete, the mobile analogue of web's `/home` mount), which re-opens
`/meal-shared` so no re-tap of the original link is needed.

**On confirm:** builds one `nutrition_entries` row per item via
`shareItemToLoggableMeal` → `newMealId()` → `buildNutritionEntryRow`, a
single `.upsert(rows, {onConflict:"id"})`, then fires (fire-and-forget, per
row where applicable) `refreshAdaptiveTdeeForUser`,
`snapshotDailyTargetIfMissing`, and `writeMealToHealthKitIfEnabled` — the
same three side-effect calls a normal log commit makes, so a shared-meal
accept isn't a second-class citizen relative to a manually logged meal for
downstream TDEE/HealthKit purposes. Success: haptic + toast ("Added to your
log") + `shared_meal_logged {surface:"mobile_accept_screen", itemCount,
slot}` + `router.replace("/(tabs)")` after a 650ms beat (long enough for the
toast to be visible before the screen unmounts).

**Web:** `app/m/[token]/page.tsx`, `app/m/[token]/MealShareLandingClient.tsx`,
`src/app/components/suppr/shared-meal-accept-host.tsx` (`SharedMealAcceptHost`,
mounted in `src/app/App.tsx`), `src/app/components/suppr/shared-meal-accept-dialog.tsx`,
`src/lib/share/mealShareClient.ts`.
**Mobile:** `apps/mobile/app/meal-shared.tsx`, `apps/mobile/lib/mealShare.ts`.

## Step 4 — Sharer: revoke a link

**What exists:** `revoke_meal_share(p_share_id)` — an RPC, scoped to
`created_by = auth.uid()`, that sets `revoked_at` so any future
`get_meal_share` call on that token returns `status:"revoked"` instead of
`"ok"`. RLS `meal_shares_select_own` lets the owner list their rows. This
ships in v1.

**UI (ENG-1648):** Settings → Privacy **"My shared links"** (web + mobile),
behind flag `meal_share_manage_v1` (default OFF). Expandable list of
active / expired / revoked shares with per-row **Revoke** for active links.
Tracks `meal_share_link_revoked`.

## Edge cases

- **Migration not yet applied, flag flipped on anyway** → every
  `create_meal_share` / `get_meal_share` call errors at the RPC layer. The
  sharer-side fallback (Step 1) degrades this to the pre-existing
  text-only share with no visible error — the user experience doesn't break,
  but no link the fallback text might still reference (there is none — text
  fallback never includes a URL) will work either. Any already-shared
  `/m/<token>` link opened before the migration lands 404s at the RPC level;
  the landing page's own error handling (network/RPC failure → `"invalid"`,
  per `mealShareClient.ts`'s doc comment) means the visitor sees the generic
  "This link isn't valid" copy, not a crash.
- **Signed-out recipient on mobile** → resume rail now exists (ENG-1649,
  parity with web). The "Sign in to add this" CTA stashes the token
  (`storePendingMealShare`, AsyncStorage) before routing to `/login`; after
  auth + onboarding the user lands on the tab bar, where
  `ResumePendingMealShare` (`apps/mobile/app/(tabs)/_layout.tsx`) drains the
  token once and re-opens `/meal-shared` — no re-tap of the original link.
  The token is read-and-cleared (at-most-once), so a later normal launch
  never replays it.
- **A meal fails to serialize** (e.g. a non-finite macro, an empty recipe
  title) → `mealToShareItem` returns `null` before any RPC call; the sharer
  falls straight to the text-only path with no error surfaced — treated
  identically to a flag-off share.
- **Rate limit hit (100 shares/24h)** → `create_meal_share` returns
  `status:"rate_limited"`; client behaviour is identical to any other
  non-`"created"` status — falls through to text-only, no error shown to the
  user. A legitimate power-sharer hitting this limit gets a slightly
  degraded (text-only) share with no indication why, which is an accepted
  trade-off for not building user-facing rate-limit messaging in v1.
- **Sharer revokes, recipient already has the accept dialog open with a
  stale payload** → the payload was already fetched and rendered before
  revocation; confirming still writes rows to the recipient's log (the
  dialog doesn't re-check `get_meal_share` on confirm). This is the same
  class of race every token-addressed preview-then-confirm flow has; not
  specifically hardened against in v1.
- **Recipe id on a shared item points at a since-unpublished recipe** — the
  RPC re-checks `recipe_id` published-ness at **read time** inside
  `get_meal_share` (not just at share time): if the recipe has since gone
  private or been deleted, `recipe_id` is stripped from that item before the
  payload is served, and the rest of the item (title/macros) still renders
  normally. This closes the window where a stale id could otherwise survive
  up to 30 days and fail the recipient's FK write on accept.
- **Share tokens transit URLs** — `/m/<token>` and the `?mealShare=<token>`
  resume param are, like every URL-addressed link, visible to first-party
  telemetry that observes navigation: PostHog pageview capture and session
  replay, and Vercel access logs. This is the accepted posture, identical to
  household invite links (`household-sharing.md`) — no different handling
  was built or is planned for meal-share tokens. The `?mealShare=` param is
  stripped from the URL via `router.replace` immediately after
  `SharedMealAcceptHost` consumes it, so it doesn't persist in browser
  history beyond the initial load.

## Web ↔ mobile parity — quick reference

| Area | Status |
|---|---|
| Flag gate (`meal_share_links_v1`, default off) | Identical scope on both — both read `KNOWN_DEFAULT_OFF_FLAGS` in their respective analytics module, and both gate CREATION only. Redemption (`/m/<token>` landing, `/home` resume, `/meal-shared`) is deliberately un-gated on both platforms — see Status above |
| Share serialization + wire format | Identical — both call the same pure `mealShareLink.ts` (mobile via `@suppr/shared/share/mealShareLink`) |
| Share action entry point | Same "Share meal" affordance on Today; web tries `navigator.share`/clipboard, mobile always uses the native `Share.share` sheet — platform-idiomatic, not a gap |
| Text-only fallback (flag off / RPC fails / unserializable meal) | Identical behaviour and byte-identical to pre-ENG-1642 on both |
| Anon-reachable preview before accept | **Diverges by design** — web has a dedicated public `/m/<token>` landing page (browsers can open a link with no app installed); mobile's `/meal-shared` route requires the app to be installed and open (there's no mobile-web equivalent), but *does* render the same anon preview once opened, gating only the final "Add to my log" write on auth. The web landing's "Open in app" link (mobile UA only) is the sole route INTO the native screen — see Step 3 |
| Signed-out resume-after-auth | **Diverges — a real gap, not a deliberate difference.** Web stashes the pending token (`localStorage` + `?mealShare=` query fallback) and resumes automatically on `/home` after signup/login. Mobile has no equivalent — tracked as decision ticket **ENG-1649**, see Edge cases and Open product questions |
| Accept UI (day/slot picker) | Same shape (slot chips + day picker + item list + totals), platform-idiomatic day-picker widget: web uses an open date input + Today/Tomorrow quick chips, mobile uses a fixed Today/Tomorrow/+2-days 3-chip row (no open date picker) |
| Accept write path | Both write brand-new `nutrition_entries` rows via each platform's own build-row helper; both fire the same three post-write side effects (adaptive TDEE refresh, daily-target snapshot, HealthKit write — HealthKit obviously mobile-only in effect, but the call convention mirrors the manual-log path on both) |
| Analytics | Identical event names + payload shapes on both platforms (`meal_share_link_created`, `meal_share_link_opened`, `shared_meal_logged`, `shared_meal_signup_started` — the last is web-only in practice since it's a signup-CTA event and mobile has no equivalent landing-page signup CTA) |
| Revocation | RPC exists identically for both; **no UI on either platform** — tracked as **ENG-1648** (Step 4) |

## Analytics

Four new events. `meal_share_link_created` and the `mode: "link"` value on
`meal_share_invoked` are flag-scoped in practice (they only fire on the
create path, which requires the flag to be on). `meal_share_link_opened`
and `shared_meal_logged` are NOT flag-scoped — they fire on the un-gated
redemption path, so they can fire even with the flag off, for any
previously-minted (or forced-open) link. `shared_meal_signup_started` is
also un-gated (it fires from the landing page's signed-out CTA).

```
meal_share_link_created    { surface: string, itemCount: number }
meal_share_link_opened     { status: MealShareStatus, authed: boolean }
shared_meal_logged         { surface: string, itemCount: number, slot: "Breakfast" | "Lunch" | "Dinner" | "Snacks" }
shared_meal_signup_started { surface: string }
```

`MealShareStatus` is `"ok" | "invalid" | "expired" | "revoked"`.
`meal_share_link_opened` legitimately fires twice per web accept
(once on the `/m/<token>` landing pre-auth, once again on `/home` post-auth
resume) — each fire is ref-guarded against re-render duplication, and the two
fires are distinguishable by `authed`. Mobile fires it once, on
`/meal-shared` load.

The pre-existing `meal_share_invoked` event (ENG-25) gained an additive
`mode: "link" | "text"` property — `"link"` whenever the flag-on path
successfully minted a share URL before opening the share sheet, `"text"`
for every fallback case (flag off, unserializable meal, RPC failure, rate
limit). Existing dashboards reading this event without `mode` are
unaffected. `FoodLoggedSource` also gained `"shared_meal"` for the
recipient's re-logged rows so funnel dashboards can distinguish this
acquisition channel from every other logging path. `food_logged` DOES fire
on accept, once per shared item, on both platforms — web's
`addLoggedMealForDate` fires it as part of its normal insert path (same as
any other logging call), and mobile's `/meal-shared` accept screen fires it
per row it writes to `nutrition_entries`. This is on top of, not instead of,
`shared_meal_logged` (below) — one accept produces one `shared_meal_logged`
for the whole batch plus one `food_logged {source: "shared_meal"}` per item.

See `docs/data/schema.md` § "Meal share links (ENG-1642)" for the full
event/property reference alongside the rest of the analytics catalog.

## Open product questions

**Should mobile get a signed-out resume rail?** Today, a signed-out mobile
recipient who taps "Sign in to add this" loses the pending share entirely —
they land back on the tab bar with nothing queued, and have to re-open the
original link/message after authenticating. Web solves this with a
`localStorage` stash; mobile's equivalent would be `AsyncStorage` plus a
drain-on-launch check (mirroring the web pattern), which wasn't built in v1.
Whether this asymmetry is worth closing depends on how often a signed-out
recipient actually exists on mobile — most mobile shares arrive to someone
who already has the app installed (implying they likely have an account),
whereas the web `/m/<token>` landing is the more plausible entry point for a
genuinely new user (no app required to view it). Tracked as the decision
ticket **ENG-1649**.

**Should the "my shared links" management UI (list + revoke) ship in v1.1,
or wait for signal that anyone wants to revoke a link?** The RPC exists;
the UI doesn't. Tracked as **ENG-1648** rather than scope-crept into v1.

**Is a rate-limited or migration-not-applied share worth a visible error to
the sharer**, rather than the current silent degrade to text-only? The
current choice (never block a share outright, degrade gracefully) optimizes
for "the user's immediate action always succeeds in some form," at the cost
of a sharer never learning their link didn't actually get created. Whether
that trade-off needs revisiting once real usage data exists is open.

## Related documents

- [`docs/data/schema.md`](../data/schema.md) § `meal_shares` — the full
  column/RLS/RPC reference and the analytics event catalog entry this doc's
  Analytics section summarizes.
- [`docs/journeys/household-sharing.md`](./household-sharing.md) — the
  other "sharing" journey in the product; deliberately unrelated mechanism
  (standing multi-member visibility vs. a one-off token-addressed snapshot).
- [`docs/journeys/food-tracking.md`](./food-tracking.md) — the Daily
  Logging Loop this journey branches off of and returns to.
- `supabase/migrations/20260722090000_eng1642_meal_share_links.sql` — the
  staged, not-yet-applied migration; see its header comment for the full
  constraints/privacy-posture rationale.
