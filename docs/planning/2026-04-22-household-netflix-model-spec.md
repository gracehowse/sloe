# Household — Netflix-family product spec v1 (2026-04-22)

Source of brief: `product-lead` agent run 2026-04-22. TestFlight pilot-round C5 cluster (`ALpppRnGz`, `ALQQyjCH`, `AKQGhg8w`, `AGpLe8GO`) + Grace direction note `AJ1AeYJ--`.

## 1. Target model — plain English

A **Household** is a small group (2–6 people) under one **owner** who shares meal plans. Mental model: Netflix/BA Household.

- **Create**: Settings → Household → "Start a household" → name it ("The Turners") → caller becomes owner.
- **Invite**: owner generates a **6-character code** (or shareable link) with 7-day expiry. Invitee enters code in their own app.
- **Join**: user can belong to **exactly one** household at a time. Joining leaves any previous one after a confirm.
- **Manage**: Settings → Household lists members with avatar/initial + role. Owner can remove members, rename household, transfer ownership, or disband. Non-owners can leave.
- **See shared meals**: on Plan + Progress, shared meals surface as chips/bars attributed to the cooking member.

This replaces the current opaque "privacy toggle + weekly grid" which testers read as "what is this even doing".

## 2. Sharing granularity — presets lead, grid as escape

Keep both. Presets are the default; 7×4 custom grid is the escape hatch, not the default.

Five presets (radio list, one active at a time):

1. **All meals** — every slot, every day.
2. **Dinners only** — default; matches the "cook for the family" pattern.
3. **Dinners + weekends** — weekdays = dinner only; Sat/Sun = all meals.
4. **Lunch + dinner** — covers Grace's husband case.
5. **Custom…** — opens existing per-cell grid (`sharingGrid.ts`) with a "Back to presets" escape.

Presets write to the same underlying `share_slots` structure → no schema fork. Picking a preset after customising shows a "This will replace your custom schedule" confirm.

Kill the standalone "privacy toggle" — redundant once presets exist. "Share nothing" = leave the household.

## 3. What must never be shared

Household shares **planned meals and their nutrition per-portion only**. Never shared, never inferable:

- Personal macro targets (kcal/P/C/F/fibre/sodium goals)
- Weight, weight history, body metrics, HealthKit data
- Streak, adherence %, personal progress rings
- Private recipes not attached to a shared meal
- Grocery/pantry unless the meal is on a shared slot
- Payment, subscription, email, auth identifiers
- Onboarding answers, dietary flags, allergies (surface allergies only as a warning *to the cook*, never as data *about* the member)

**Rule of thumb:** a household sees what's on the table, not what's on the scale. Directly answers Grace's "my husband has different macros" note.

## 4. Edge cases — decisions

| Case | Decision |
|------|----------|
| Guest / temporary member | v1 = no. One class of member. Revisit if requested. |
| Mixed dietary prefs | Each member keeps own prefs. Shared meal shows per-member allergy/pref warnings to the cook only. |
| Kids / lower targets | Members retain individual macro targets. Shared dinner's portion count drives cook's grocery math; each eater logs their own portion. No "kid mode" v1. |
| Member leaves | Historical shared meals stay attributed (snapshot name preserved). Future slots unshare automatically. |
| Ownership transfer | Owner picks member → confirm → role swap. Last owner leaves → oldest remaining auto-promotes. Last member leaves → household soft-deleted (`disbanded_at` set), then hard-deleted after 30 days by the `POST /api/cron/household-purge` job (ENG-1359, shipped 2026-07-05 — see `src/lib/server/householdPurgeJob.ts`; previously this was a documented gap, no such job existed). |
| Owner deletes account | Force transfer or disband in the delete flow (`project_delete_account_flow_exists`). |

## 5. Data model — what exists vs missing

**Existing** (from `supabase/migrations/` — see `docs/planning/2026-04-20-household-full-flow-port.md`):

- `households` (id, name, owner_id, share_lunch flag)
- `household_members` (unique user constraint added 2026-04-24)
- `household_meals` (date-keyed, recipe title snapshot)
- `household_member_share_targets`
- Invite RPC + 7-day expiry migration

**Missing for v1**:

- `household_share_presets` — enum column on `household_members`: `all | dinners | dinners_weekends | lunch_dinner | custom`. Current grid becomes the `custom` payload.
- Invite codes table — short-code → household_id, expires_at, uses_remaining.
- Member display-name snapshot on `household_meals` for leavers.
- Ownership-transfer audit row (from, to, when).
- Soft-delete column `households.disbanded_at`.

Explicitly **not** needed: any cross-member macro/weight join table — that's the point of §3.

## 6. Minimum shippable v1 (7 items)

1. Create / name / disband household (owner flow).
2. Invite via 6-char code + link; join via code; leave household.
3. Members list with roles, remove, transfer ownership.
4. Five sharing presets with Custom grid as escape hatch.
5. Shared meals visible on Plan + Progress attributed to cook (keep current bars, relabel).
6. Strict privacy boundary enforced in RLS — no macro/weight/goal leak. Migration-level test required.
7. Web parity for all of the above (`HouseholdSettingsPage.tsx`).

**Explicitly deferred**: guest members, kid mode, per-meal override on top of preset, grocery-list merge, chat.

## 7. Route

- **ui-product-designer** — redesign `household-settings.tsx` + web equivalent around preset-first model; empty state, invite flow, member row, transfer confirm. Reference `docs/ux/claude-design-bundles/prototype/`.
- **data-integrity** — audit 10 existing household migrations, spec the 4 missing pieces in §5, write the RLS privacy test.
- **journey-architect** — own create → invite → join → share → leave journey end-to-end; add to `docs/journeys/`.
- **executor** — implement after design + schema land; web + mobile in one sweep per parity rule.
- **product-memory** — record: presets-first decision, "never share macros/weight" rule, one-household-per-user constraint, ownership auto-promotion rule.

## Existing docs this supersedes / extends

- `docs/planning/2026-04-20-household-full-flow-port.md` (port plan)
- `docs/research/household-planning-scope.md` (scoping)
- `docs/decisions/2026-04-21-household-surface-superseded-chip.md` (surface treatment)

None encoded the Netflix-family model or presets. This spec supersedes them on model + sharing UX.

## Open questions for Grace

- **Max household size** — proposing **6**. OK?
- **Preset override**: can a member unshare a single slot on top of a preset, or is preset authoritative? Proposing **preset authoritative v1**, per-slot override v2.
- **Attribution** on shared meals: cook's **first name + initial** or just avatar? Proposing first name + colour accent (`memberAccents.ts` already exists).

## Top 3 to fix first

1. Preset-first sharing UI.
2. Member invite/join/leave loop with code.
3. RLS privacy test proving macros/weight never cross members.
