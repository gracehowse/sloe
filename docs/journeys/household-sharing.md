# User Journey: Household Sharing

**Audience:** Product / Design / Engineering

## One-line purpose

A household lets 2+ people share planned dinners (and, optionally, other meal
slots) and a live shopping list — without ever exposing anyone's weight,
calorie/macro targets, or nutrition log to the other members by default.
"Households see what's on the table, not what's on the scale."

## Status — read this first

Household sharing is a **post-onboarding Settings surface** — reachable only
once a session exists, from the Plan tab HouseholdBar, the Progress tab, or
Settings → Connections → Household. It has no relationship to onboarding
itself: a solo user sees no household UI until they deliberately create or
join one from Plan or Settings.

## Scope

**In scope:** creating/joining a household, the members list, inviting by
email or code, the sharing presets, the 7×4 day-by-slot custom grid, the
per-member `share_targets` privacy toggle, the privacy boundary that governs
what a household can and can't see, and how sharing threads into the Plan tab
and the Shopping list.

**Out of scope — go here instead:**
- **The shopping list itself** (aisle grouping, check-off, realtime sync,
  per-row attribution chips) →
  [`docs/journeys/shopping-list.md`](./shopping-list.md) §6. This doc covers
  only how household setup feeds into that surface, not the surface itself —
  duplicating its content here would create two drifting descriptions of the
  same realtime sync.
- **The Settings entry point / Connections row** →
  [`docs/journeys/settings-and-control.md`](./settings-and-control.md) §7.
  This doc covers only what happens once the user is *inside* the household
  surface.
- **Referral rewards** (the 30-Pro-days-each-side credit that appears
  alongside the invite card) →
  [`docs/product/referrals.md`](../product/referrals.md). Invites and
  referrals share a UI surface (`HouseholdInviteDialog` /
  `HouseholdInviteSheet` render a `ReferralRewardCard` when
  `referral_invite_loop_v1` is on) but are separate systems — a household
  invite does not itself grant referral credit; the referral code/link is a
  parallel, code-redeemed reward path.
- **Meal-plan generation itself** (source selector, day count, slot toggles)
  → [`docs/journeys/meal-planning.md`](./meal-planning.md). This doc covers
  only the household-context banner that plan generation surfaces, not
  planning mechanics.

## Where this sits in the loop

Household sharing isn't a funnel — it's a **standing configuration** that
changes what two other loops render:

```
Set up household (this doc) ──┬──> Plan tab: household context banner
                               └──> Shopping list: shared list + realtime + attribution
```

This is the **Household Sharing Loop**: set up → configure sharing →
household-aware Plan → household-aware Shopping list → members log their own
meals independently, with only the sharing-boundary-approved data ever
crossing between them.

## Entry points

| Entry point | Web | Mobile |
|---|---|---|
| Create / join a household | `HouseholdPanel` on the Plan tab (`src/app/components/HouseholdPanel.tsx`) | Plan tab equivalent panel |
| Configure an existing household (members, presets, grid, privacy) | `/home?view=household-settings` — **legacy alias, not a first-class route** (see below) | `router.push("/household-settings")` — a real Stack screen |
| Compact entry from Plan/Progress | `HouseholdBar` "Manage" link (`src/app/components/HouseholdBar.tsx`) | `HouseholdSummaryRow` chip (`apps/mobile/components/HouseholdSummaryRow.tsx`), Plan/Progress |
| From Settings | Settings → Connections → Household row (hidden when solo) | Settings → Connections → Household row (hidden when solo) — see [`settings-and-control.md`](./settings-and-control.md) §7 |

## Step 1 — Set up: create, invite, members list

**Why this exists:** the mental model is Netflix/BA Household — a small
group (owner + members) sharing a slice of planning, not a merged account.
Product spec:
[`docs/planning/2026-04-22-household-netflix-model-spec.md`](../planning/2026-04-22-household-netflix-model-spec.md).

**What the user does:**
1. **Create** — from `HouseholdPanel` on the Plan tab, names a household (or
   accepts the "My Household" default) and becomes owner.
2. **Invite** — from the Household settings screen's Members section, taps
   "Invite," which opens `HouseholdInviteDialog` (web) /
   `HouseholdInviteSheet` (mobile). Two paths, not either/or:
   - **By email** — types an email, taps Send. This calls the
     `household_invite_send` RPC, which writes a row the invitee sees as an
     Accept/Decline prompt the next time they open Sloe. There is **no
     transactional email sent** — discovery is in-app only, via the
     invitee's own `household_invites` row matched against their JWT email.
     A sent-invites list below shows status (Pending / Joined / Declined /
     Expired / Cancelled) with a cancel action on pending rows.
   - **By code** — a 6-character invite code (`households.invite_code`,
     7-day expiry) is always shown as a fallback; anyone with the code can
     join via "Join household" on their own device, routed through the
     `household_join_by_invite_code` RPC (a `security definer` function,
     because RLS can't let a non-member `SELECT` the target household to
     validate the code client-side).
3. **Members list** — the Household settings screen's Members card lists
   every member (avatar-initial chip + display name + role). The caller's
   own row is tappable and routes to `/targets`; other members' rows are
   **deliberately non-interactive** (no chevron) until a read-only member
   detail surface ships — the row doesn't advertise a destination that
   doesn't exist.

**A user belongs to exactly one household at a time.** Owner-leaves cascades
the household (deletes members + meals); a non-owner leaving just removes
their own row. If the last member leaves an already-owner-less household, it
is soft-deleted (`disbanded_at` set) and hard-purged 30 days later by a daily
cron (`src/lib/server/householdPurgeJob.ts`).

**Solo-household empty state:** when the caller is the only member, both
platforms show a prominent "Household is solo" invite card above the
otherwise-functional-but-pointless presets/grid — "Invite a partner,
flatmate, or family member to share meal plans and shopping lists," with a
ghost-styled Invite button. The rest of the screen still renders below it so
the user can preview what they'll get once a second member joins.

**Web:** `src/app/components/HouseholdPanel.tsx` (create/join/leave),
`src/app/components/HouseholdSettingsPage.tsx` (members list, invite
trigger), `src/app/components/household/HouseholdInviteDialog.tsx`.
**Mobile:** equivalent Plan-tab panel, `apps/mobile/app/household-settings.tsx`,
`apps/mobile/components/household/HouseholdInviteSheet.tsx`.

**Web ↔ mobile parity:** identical — both call the same shared
`householdClient.ts` functions (`createHousehold`, `joinHouseholdByInviteCode`,
`leaveHousehold`, `sendHouseholdInvite`, `listSentHouseholdInvites`,
`cancelHouseholdInvite`).

## Step 2 — Configure sharing: presets vs the 7×4 grid

**Why this exists:** the pre-Netflix-model household UI was a single
"share lunches too" toggle that testers found confusing — it wasn't obvious
what it actually turned on or off. The redesign gives **presets as the
default, the full grid as an escape hatch** — most households want "dinners
only" or "lunch + dinner," not a per-cell editor.

**What the user does:** on the Household settings screen, picks one radio
option under "Which meals are shared?":

| Preset | What it shares |
|---|---|
| All meals | Every slot, every day |
| Dinners only | Dinner every day, everything else solo (**default** for new households) |
| Dinners + weekends | Dinner every day, plus breakfast/lunch/snack on Sat/Sun |
| Lunch + dinner | Lunch and dinner every day |
| Custom… | Drops into the 7×4 grid below |

**Snacks are never pre-shared by any preset** — snack/breakfast sharing is
opt-in via Custom only, matching the original scope-narrowing decision.

Below the presets, the **7×4 grid** (7 days × breakfast/lunch/dinner/snack)
shows one cell per slot: tap to cycle solo → everyone → solo; right-click
(web) or long-press (mobile, 400ms) opens a "Who's eating?" picker to select
specific members rather than all-or-nothing. Picking a preset overwrites the
grid to match it; editing any individual cell flips the active selection to
"Custom" automatically. A header readout shows "N of 28 shared."

Only the **household owner** can save changes — the Save button is disabled
for non-owners with an explanatory caption ("Only the household owner can
change sharing").

**Web:** `src/app/components/HouseholdSettingsPage.tsx`,
`src/lib/household/sharingGrid.ts` (pure preset/grid logic — build, cycle,
toggle, count).
**Mobile:** `apps/mobile/app/household-settings.tsx`, same shared logic via
`@suppr/shared/household/sharingGrid`.

**Web ↔ mobile parity:** identical — both platforms import the exact same
`sharingGrid.ts` module for preset definitions, cycle/toggle behaviour, and
the derived summary count. Only the fine-picker *affordance* differs
(right-click vs long-press), matched to each platform's input model.

## Step 3 — Privacy: the per-member `share_targets` toggle and the hard boundary

**Why this exists:** a household sharing dinners is not the same thing as a
household sharing diet context. The original "share everything" model leaked
every member's calorie/macro targets and remaining-today numbers to
everyone else unconditionally — exposing a personal diet plan (cut / bulk /
maintenance) without consent. That's a real privacy failure, not just a UX
rough edge, which is why the model was redesigned around a boundary that
never exposes that data at all, plus one narrow, explicit opt-in on top of it.

### The hard privacy boundary (RLS-level, always on)

**No household migration writes RLS policies for, or RLS predicates that
join through, `profiles`, `weight_entries`, `nutrition_entries`,
`health_snapshots`, `daily_targets`, `user_activity`, `adaptive_tdee`,
`body_measurements`, or `user_foods`.** `household_meals` carries per-serving
recipe nutrition only — never a member's personal targets, weight, or streak
state. This invariant is pinned at migration level by
`tests/unit/householdPrivacyRls.test.ts`; a future change that adds a
household-scoped policy to any of those tables fails CI. This is the
boundary the whole feature is built around: **household reads never touch
weight, targets, or nutrition-log RLS — only meal visibility (which recipe,
which slot, which day, whose portion).**

### The `share_targets` opt-in (a separate, consent-gated exception)

On top of that boundary sits one deliberate, narrow, **opt-in** exception:
each member has their own `household_members.share_targets` boolean
(default **off**). The toggle, rendered on the Household settings screen's
Privacy card, reads **"Share my nutrition targets with household"** —
"When on, other household members can see your calorie and macro targets."
This is per-member (not owner-set on someone else's behalf): the RLS policy
`Members can update own share_targets` scopes the write to
`user_id = auth.uid()`, so a member can only flip their own row.

When a member has **not** opted in, `getMyHousehold` strips their
`targets`/`consumed`/`remaining` entirely before the data ever reaches the
client — other members' rows render `null` for those fields (UI shows
"Targets private"). The caller's own row always carries their own numbers
regardless of their toggle state.

**Join-time disclosure** (legal-reviewed copy,
`src/lib/household/scopeCopy.ts`, pinned verbatim by
`tests/unit/householdJoinDisclosureCopy.test.ts`): *"Joining shares your
planned dinners with everyone in this household. If the household turns on
lunch sharing, lunches are shared too. Breakfasts, snacks, your calorie and
macro targets, and your remaining-today numbers all stay private."*

**How the cross-account reveal actually works (ENG-1602, fixed 2026-07-21).**
`profiles` and `nutrition_entries` SELECT RLS is `profiles_select_own` /
"Own nutrition entries" — both strictly self-scoped, with no household-level
grant under the privacy boundary above. A direct cross-member `.in(...)`
read of those tables from the caller's own client session is therefore
RLS-inert: it silently returns zero rows, no error. Before this fix,
`getMyHousehold` tried exactly that direct read, and masked the empty result
with hardcoded `2000`/`130`/`250`/`65` fallback numbers — every opted-in
member saw identical fabricated data regardless of their real goals or
intake. It failed safe (no real data ever leaked to the wrong person — the
inverse direction, reveal when `share_targets` is off, was checked and does
not exist) but it did not deliver on its own copy: the toggle looked like it
worked and silently didn't.

The fix routes the opted-in reveal through
`get_household_shared_targets` — a `security definer` RPC
(`supabase/migrations/20260721100000_eng1602_household_shared_targets_rpc.sql`)
that re-verifies, server-side, both that the caller and the target are
co-members of the same household AND that the target's `share_targets` is
`true`, then returns ONLY `target_calories/protein/carbs/fat` plus
today's aggregated `consumed_calories/protein/carbs/fat` for that member —
never a raw `profiles` or `nutrition_entries` row, never any other column
(no `display_name`, no email, no weight). `getMyHousehold` calls this RPC
once per load and keys the results back to the `household_members` list it
already has; a member who hasn't opted in still gets the `null`
targets/remaining "Targets private" state exactly as before. If the RPC
ever legitimately has nothing for an opted-in member (a narrow read-time
race, or a member who opted in before ever setting numeric targets), the
client renders that same private/no-data state rather than any fallback
number — the fabricated-numbers failure mode this fix closes cannot recur
by construction, since there is no hardcoded fallback left in the opted-in
code path at all.

**Why an RPC and not an RLS carve-out.** RLS in Postgres is row-level, not
column-level — a household-scoped SELECT policy added to `profiles` would
expose the *whole* row (email, every other column) to co-members, not just
the four target columns; a much bigger leak than the one being fixed.
Column-level GRANTs are the only other real alternative and this codebase
has no precedent for them. A `security definer` RPC returning a narrow,
derived, explicitly-approved set of fields is the established pattern here
(23+ existing precedents, closest being `household_join_by_invite_code` for
the join-by-code read RLS also can't express) — see the migration file's
header for the full comparison.

**Web:** `src/app/components/HouseholdSettingsPage.tsx` (Privacy section),
`src/lib/household/scopeCopy.ts`.
**Mobile:** `apps/mobile/app/household-settings.tsx` (same section, native
`Switch`).

**Web ↔ mobile parity:** identical copy, identical toggle behaviour, same
shared client function (`setHouseholdMemberShareTargets`).

## Step 4 — How this threads into the Plan tab

**Why this exists:** once a household exists, Plan needs to answer "who am I
cooking for tonight?" without duplicating the full settings screen inline.

**What happens:** two levels of surfacing, both **read-only summaries** — the
Plan tab does not render a per-meal "shared with X" chip on individual meal
cards; sharing configuration is a Household-settings-only concern:

- **`HouseholdBar`** (legacy v3-OFF path, both Plan and Progress) — a
  horizontal pill row: "All N" plus one pill per member, letting the user
  pivot the tab's view to a single member without leaving it. A "Manage"
  link routes to Step 1/2's settings screen.
- **The v3 "Cooking for N" banner** (`sloe_v3_plan`, `useHouseholdBanner` /
  `PlanHouseholdBannerV3`) — stacked avatar initials + "Cooking for N ·
  [names]" + a chevron into settings. Renders only for 2+ members (hides
  entirely for solo households). If the recipe's serving count doesn't
  match the household's eater count, the chevron is replaced with an amber
  "N× — match" flag instead.
- **Mobile-only compact form:** `HouseholdSummaryRow` on the Plan tab renders
  a single line — "*Household name* · N members · sharing dinners [+
  lunches]" — that taps through to `/household-settings`. It self-hides for
  solo households.

**What the banner reads, not what it exposes:** all three surfaces above
source their data from `getMyHousehold` and only ever show member
count/names/avatars and the household's meal-sharing state — never a
target, weight, or log number. This is the Plan-side face of the Step 3
boundary, not a separate mechanism.

**Web:** `src/app/components/HouseholdBar.tsx`,
`src/hooks/useHouseholdBanner.ts`,
`src/app/components/plan/PlanHouseholdBannerV3.tsx`.
**Mobile:** `apps/mobile/components/HouseholdSummaryRow.tsx`, mobile
`useHouseholdBanner` + `PlanHouseholdBannerV3` twins.

**Web ↔ mobile parity:** the v3 banner is a direct parity pair (shared prop
shape, same copy). `HouseholdSummaryRow` is mobile-only; its web equivalent
is the always-present `HouseholdBar`, not a missing feature — the two
platforms chose different compact-summary chrome for the same underlying
data, not a gap.

## Step 5 — How this threads into the Shopping list

**Why this exists:** a shared meal plan with a per-user-only shopping list
means someone still has to coordinate the actual grocery run out loud. For
the family-planner persona, that gap undercuts the whole point of sharing a
plan — the list has to be shared too, or nothing downstream of "we're
cooking the same dinners" actually gets easier.

**What happens, in one line:** once a household exists, `shopping_items`
rows scope by `household_id` instead of `user_id`, checks propagate live via
Supabase realtime (~1s), and fully-checked groups get a per-row attribution
chip ("checked by Sarah"). **Full detail — grouping, realtime channel
handling, the attribution rule, and the backward-compat story for pre-existing
solo lists — lives in
[`docs/journeys/shopping-list.md`](./shopping-list.md) §6, not here**, to
avoid two drifting descriptions of the same realtime sync. The schema/RLS
decision record is
[`docs/decisions/2026-04-30-household-aware-shopping-list.md`](../decisions/2026-04-30-household-aware-shopping-list.md).

The connection to *this* doc's scope: the shopping list itself doesn't read
the sharing presets or the 7×4 grid at all — a household's shopping list
includes every meal in the household's shared plan, full stop. The presets/
grid (Steps 2–3 above) control which *meal-plan entries* are visible as
"household meals" in the first place (via `slotAllowedForPreset` filtering
in `getMyHousehold`); everything downstream of that — the shopping list,
the Plan-tab meal chips — inherits whatever the sharing configuration
already decided.

## Known gap — the custom 7×4 grid is device-local only, not server-synced

**This is a real, current product limitation.** Don't describe it as working
across devices, and don't work around it in code without a product decision
first.

**What's supposed to happen:** a user customises the 7×4 grid, saves, and
sees the same custom schedule on every device and for every household
member.

**What actually happens:** the server-persisted state for sharing is a
**per-member enum** — `household_members.share_preset`
(`all | dinners | dinners_weekends | lunch_dinner | custom`) — which can
represent *that a household member picked "Custom"* but **cannot store the
actual per-cell layout**. The full grid (`HouseholdSharingState`, the 7×4
cell map) is persisted to **local storage only** —
`localStorage` on web, `AsyncStorage` on mobile — keyed by household ID
(`src/lib/household/sharingGridStorage.ts`). On Save:
1. The full grid writes to local storage.
2. The schema-level preset (`all`/`dinners`/`dinners_weekends`/
   `lunch_dinner`/`custom`) writes to the server.
3. A derived `share_lunch` boolean (`true` if any lunch cell has 2+ members)
   writes to the server as a legacy compatibility signal.

**Concrete failure mode:** a user sets a bespoke custom grid on their phone
(say, "share breakfast on weekdays but not weekends, dinner every day,
lunch only on Fridays") — that exact grid lives in the phone's AsyncStorage.
Opening the household settings screen on web (or a second device) reads
`localStorage`/`AsyncStorage` fresh on that device, finds nothing stored,
and falls back to hydrating a *generic* grid from the server-side preset
enum (`custom` → an **empty** grid, since `buildGridForPreset("custom", …)`
returns all-solo by design — the caller is expected to overlay stored cells
that don't exist on this device). **The bespoke layout does not travel with
the user; only the coarse preset choice does, and `custom` itself carries no
recoverable data cross-device.**

**This is an open product question, not a bug to quietly patch around.**
Fixing it correctly means shipping a grid-schema migration (a real per-cell
server table or JSONB column) so the 7×4 layout round-trips like the preset
already does — that's a genuine schema decision, not a client-side fix. It
was intentionally deferred when the household model first shipped, as
scoped follow-up work rather than an oversight. Don't "fix" this by, e.g.,
syncing localStorage contents through some ad-hoc channel — that would
introduce an unreviewed cross-device sync mechanism for something that's
still an open schema question, not a settled implementation detail.

## Web-only gap — legacy `?view=` alias, not a first-class route

**Mobile** reaches Household settings via a real Stack screen:
`router.push("/household-settings")`.

**Web** reaches it only via `window.location.href = "/home?view=household-settings"`
(`src/app/components/HouseholdBar.tsx`), an alias the `App.tsx` shell's
internal view-router mounts client-side. There is no first-class
`/household-settings` (or similar) Next.js route — `HouseholdSettingsPage`
is a component mounted by view string, not a routed page. This means the
URL never reflects "household settings" as a real address a user could
bookmark, share, or have a browser back-button history entry for beyond the
generic `/home` page with a query param — it works, but it's the same class
of fragility already called out for this exact alias in
[`settings-and-control.md`](./settings-and-control.md) §7. Promoting it to a
real route is an open product question — see Open product questions.

## Edge cases

- **Solo user opens household settings with no household** → "No household
  yet" card with an "Open Plan" link, not an error state.
- **Non-owner tries to save sharing changes** → Save button is disabled with
  an explanatory caption; the write also fails server-side if attempted
  directly (owner-only RLS on the underlying columns), so the UI-level
  disable is belt-and-braces, not the only guard.
- **Owner leaves** → household (and all members' access to it) is deleted;
  members must be re-invited to a new household. Non-owner leaving just
  removes their own row and leaves the household intact for everyone else.
- **Last member leaves an already-owner-less household** → soft-deleted
  (`disbanded_at` set), hard-purged after 30 days by a daily cron — not
  immediate, so a mistaken leave has a recovery window at the data layer
  (though no UI "undo" exists today).
- **A member who left has historical shared meals** → those meals keep
  their attribution via a `cook_display_name` snapshot column, but the
  *live* read path resolves cook names from the **current**
  `profiles.display_name` where possible (falling back to "A member" for a
  fully deleted account) specifically to avoid leaking a stale pre-rename
  name — the snapshot column exists for admin/forensic use only, the client
  never reads it directly.
- **Picking a preset after having customised the grid** → overwrites the
  custom layout with the preset's hard-coded pattern; there's no "keep my
  custom cells, just switch the label" option.
- **`share_targets` toggle failure** → optimistic UI flip reverts on a
  failed write, with an inline error (web) / `Alert` (mobile) — no silent
  "looks saved but isn't."

## Web ↔ mobile parity — quick reference

| Area | Status |
|---|---|
| Create / join / leave (Step 1) | Identical, shared client functions |
| Invite by email + code (Step 1) | Identical — same dialog/sheet pair, same RPCs |
| Members list (Step 1) | Identical — self row → `/targets`, other rows non-interactive |
| Presets + 7×4 grid (Step 2) | Identical logic; picker affordance is platform-idiomatic (right-click vs long-press) |
| `share_targets` privacy toggle (Step 3) | Identical copy + behaviour on both — same `getMyHousehold` call, same `get_household_shared_targets` RPC (ENG-1602) |
| Plan-tab threading (Step 4) | v3 banner is a direct parity pair; `HouseholdSummaryRow` (mobile) vs always-on `HouseholdBar` (web) is a deliberate chrome difference, not a gap |
| Shopping-list threading (Step 5) | Identical — see `shopping-list.md` §6 |
| Custom grid persistence (Known gap) | **Broken on both, identically** — device-local storage on both platforms, no cross-device sync for either |
| Settings entry route (Web-only gap) | **Diverges** — mobile has a real route; web is a legacy `?view=` alias |

## Analytics

No household-specific analytics events are wired in
`src/lib/analytics/events.ts` beyond the general invite/referral surface
(`shopping_item_attribution_seen` is tracked separately as a shopping-side
event — see `shopping-list.md`). There is currently no way to tell from
PostHog how many households exist, how many use Custom vs a preset, or how
often `share_targets` gets toggled on — that instrumentation simply doesn't
exist yet.

## Open product questions

**Should the custom 7×4 grid get real cross-device sync?** Today it doesn't
(see Known gap above). Closing that gap means a real schema investment — a
per-cell server table or JSONB column — versus treating "presets sync,
custom doesn't" as an acceptable permanent posture, given household size is
typically small and often single-device-per-person. That's a product call,
not something to patch around client-side.

**Should `/home?view=household-settings` become a first-class route?** The
alias works today but doesn't behave like a real address — no bookmarkable
URL, no clean back-button history entry beyond the generic `/home` page.
Whether that's worth fixing with a dedicated route, or the alias is stable
enough to leave indefinitely, is the same open question raised independently
in `settings-and-control.md` §7.

**Is household adoption worth instrumenting yet?** There's no visibility
today into creation rate, preset-vs-custom split, or `share_targets` opt-in
rate. Whether that's worth building before or after the custom-grid sync
question is resolved is still undecided.

## Related documents

- [`docs/journeys/settings-and-control.md`](./settings-and-control.md) §7 —
  the Household row's entry point from Settings, and the same `?view=`
  alias gap noted independently there.
- [`docs/journeys/shopping-list.md`](./shopping-list.md) §6 — the full
  household-aware shopping list mechanics this doc threads into rather than
  duplicates.
- [`docs/journeys/meal-planning.md`](./meal-planning.md) — plan generation
  mechanics; this doc only covers the household-context banner layered on
  top of it.
- [`docs/product/referrals.md`](../product/referrals.md) — the referral
  reward card that shares UI real estate with the invite dialog/sheet but is
  a separate reward system.
- [Household Netflix-model v1 — schema + privacy boundary](../decisions/2026-05-01-household-netflix-model-v1-schema.md)
  — the ratified privacy boundary this doc's Step 3 is built on, and the
  source of the "next steps not in this change" that left the grid
  device-local.
- [Household — Netflix-family product spec v1](../planning/2026-04-22-household-netflix-model-spec.md)
  — the original product spec (presets-first model, edge-case decisions,
  max household size, ownership transfer).
- [Household-aware shopping list (Honeydew parity)](../decisions/2026-04-30-household-aware-shopping-list.md)
  — the schema/RLS decision behind Step 5.
