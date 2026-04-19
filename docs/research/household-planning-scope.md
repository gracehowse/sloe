# Household / Partner Meal Planning -- MVP Scope

**Status:** Scoping (Phase F, not yet in active development)
**Date:** 2026-04-16
**Depends on:** Stable single-user meal planning (Phase A/C), day totals, profiles with macro targets

> **Shipping note (2026-04-18):** The Phase 1 read-only shared dinner list is live on web and mobile. Runtime data path for **both** platforms is `src/lib/household/householdClient.ts` — direct Supabase calls under RLS, plus a `security definer` RPC `public.household_join_by_invite_code` for the one operation RLS cannot express. The Next.js routes under `app/api/household/` still exist but are no longer the runtime path for the UI; do not add new household callers to those routes. See `docs/testflight-feedback/resolved.md` (2026-04-18 entry, ASC `AAegi1DJEiscjIFi_pYaep4`).
>
> **Scope narrowing (F-16, 2026-04-25, build 11) — supersedes the previous privacy note.** Following TestFlight feedback `AJ1AeYJ--fF` and legal-reviewer sign-off, household sharing is now tightened:
>
> 1. **Dinners shared by default.** Lunches are shared only when the household's owner flips `households.share_lunch` to `true`. Breakfasts and snacks are NEVER shared — there is no opt-in for them.
> 2. **Macro targets + remaining-today are PRIVATE.** `getMyHousehold` strips `targets`, `consumed`, and `remaining` from every member row that is NOT the caller. The caller's own row keeps them (so "my remaining today" still renders on the household surface). Other members' rows carry `{ userId, role, displayName }` only.
> 3. **One-time in-app notice.** Both platforms render a dismissible banner (`household_share_narrowing_seen_v1`) on first household-screen load after the upgrade, explaining what has changed.
> 4. **Copy is legal-approved verbatim.** Card header, join disclosure, and scope-narrowing notice live in `src/lib/household/scopeCopy.ts`. Both `src/app/components/HouseholdPanel.tsx` (web) and `apps/mobile/components/HouseholdCard.tsx` (mobile) import the constants. Rewording any of them requires a new legal review. Pinned verbatim by `tests/unit/householdJoinDisclosureCopy.test.ts`; scope read-path pinned by `tests/unit/householdScopeNarrowing.test.ts`.
>
> The `/api/household/join` route is still rate-limited to 5 attempts/min/IP (audit M1).

---

## Background

Phase F of the product roadmap defines "Friends, shared meals, and household meal plans." The recommended first slice is:

> Read-only shared dinner list for the week plus "remaining macros" on the partner's Today / planner before full co-editing, social graph, or complex permission models.

This document scopes that first slice into a buildable MVP.

---

## User Stories (MVP)

1. **As a meal planner**, I can create a household and invite my partner by email so we can share dinner plans.
2. **As a household member**, I can see shared dinners on my planner view, clearly distinguished from my personal meals, so I know what is being cooked tonight.
3. **As a household member**, I can set my portion size for shared meals (e.g. 1x, 1.5x, 0.75x) so the macros logged to my day reflect what I actually eat.
4. **As a household member**, I can see my remaining calories and macros for the day *after* shared meals are accounted for, so I can plan my breakfast, lunch, and snacks around dinner.
5. **As a meal planner**, I can mark specific meal slots as "shared" (typically dinners) while keeping all other slots private and personal.

---

## Data Model Sketch

### New tables

```sql
-- A household is a named group of 2+ Suppr users who share meals.
-- MVP: max 2 members (couple). Future: families of N.
create table households (
  id            uuid primary key default gen_random_uuid(),
  name          text not null default 'My Household',
  created_by    uuid not null references profiles(id),
  created_at    timestamptz not null default now()
);

-- Junction: who belongs to a household and their default portion.
create table household_members (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references households(id) on delete cascade,
  user_id         uuid not null references profiles(id),
  role            text not null default 'member' check (role in ('owner', 'member')),
  default_portion numeric(3,2) not null default 1.0,  -- e.g. 1.0, 1.5, 0.75
  joined_at       timestamptz not null default now(),
  unique (household_id, user_id)
);

-- An invitation to join a household.
create table household_invites (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references households(id) on delete cascade,
  invited_by      uuid not null references profiles(id),
  invited_email   text not null,
  status          text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'expired')),
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null default (now() + interval '7 days')
);

-- A shared meal pinned to a household + date + slot.
-- The planner (owner) writes these; members read them.
create table household_meals (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references households(id) on delete cascade,
  date_key        date not null,                       -- e.g. 2026-04-16
  meal_slot       text not null default 'dinner',      -- dinner, lunch, etc.
  recipe_id       uuid references recipes(id),
  recipe_title    text not null,
  calories        numeric not null default 0,          -- per single serving
  protein         numeric not null default 0,
  carbs           numeric not null default 0,
  fat             numeric not null default 0,
  fiber_g         numeric,
  servings_total  numeric not null default 2,          -- how many portions cooked
  created_by      uuid not null references profiles(id),
  created_at      timestamptz not null default now(),
  unique (household_id, date_key, meal_slot)
);

-- Per-member portion override for a specific shared meal (optional).
-- If absent, use household_members.default_portion.
create table household_meal_portions (
  id                uuid primary key default gen_random_uuid(),
  household_meal_id uuid not null references household_meals(id) on delete cascade,
  user_id           uuid not null references profiles(id),
  portion           numeric(3,2) not null default 1.0,
  unique (household_meal_id, user_id)
);
```

### RLS policy sketch

- `households`: members can SELECT their own household; owner can INSERT/UPDATE/DELETE.
- `household_members`: members can read members of their household; owner can manage.
- `household_meals`: owner can write; all members can read.
- `household_meal_portions`: each user can read/write their own portion row.
- `household_invites`: invited_by can write; invited user (matched by email on profiles) can read and accept/decline.

### Relationship to existing data

```
profiles ──< household_members >── households
                                       │
                                  household_meals ──< household_meal_portions
                                       │
                                  household_invites
```

The existing `meal_plans` (JSON blob per user) and `nutrition_journals` remain untouched. Shared meals are a **separate read layer** that the planner and Today views query in addition to the user's personal plan.

---

## MVP Feature Set (what ships first)

### Household setup
- Create a household (auto-become owner)
- Invite one partner by email
- Accept/decline invite (in-app notification + email deep link)
- Set default portion multiplier per member
- Leave or delete household

### Shared meal planning (owner writes)
- From the existing planner, long-press or tap a meal to "Share with household"
- This copies the meal into `household_meals` for that date + slot
- Owner can unshare (remove from household_meals)
- Only one shared meal per slot per day (MVP constraint)

### Shared meal viewing (all members read)
- Planner tab shows shared meals with a distinct "shared" badge/icon
- Shared meals appear on the correct date and slot
- Tapping a shared meal opens the recipe detail (read-only navigation)

### Remaining macros integration
- Today view and planner day summary compute: `personal target - (personal logged meals + shared meal * my_portion)`
- "Remaining" card explicitly shows the shared meal contribution: "Dinner (shared): 620 kcal"
- Gap-fill suggestions (if planner auto-generate is used) respect the fixed shared slot and only fill remaining slots

### Portion customization
- Each member can adjust their portion for any shared meal (0.25x to 3x in 0.25 increments)
- Default comes from `household_members.default_portion`
- Per-meal override stored in `household_meal_portions`

---

## What Does NOT Ship in v1

| Feature | Reason |
|---------|--------|
| Co-editing of shared meals | Conflict resolution is complex; MVP is owner-writes, members-read |
| Social graph / friends list | Separate Phase F concern; household is a tighter primitive |
| Shared shopping lists | Depends on shopping list being relational (currently JSON blob) |
| More than 2 members | Keeps portion math and UX simple; easy to lift later |
| Shared breakfast/lunch by default | MVP defaults to dinner-only sharing; other slots can be shared manually |
| Notifications for plan changes | Adds notification infrastructure load; v1 relies on members checking planner |
| Web parity | Mobile-first; web follows once mobile is validated |
| Privacy controls beyond "shared meals" | Person A cannot see Person B's full diary; only `household_meals` are visible |
| Meal plan generation for partner | Partner plans their own non-shared slots; no cross-person generation |

---

## Technical Approach

### Sharing mechanism
- **Invite by email.** The owner enters a partner's email. If the email matches a Suppr profile, an in-app invite appears. If not, a sign-up-and-join email is sent.
- No link-based sharing or QR codes in v1.
- `household_invites` row tracks state. A Supabase Edge Function or trigger can send the invite email.

### How shared meals interact with the planner (`planner.tsx`)
- Current planner loads from `meal_plans` JSON blob via `fetchMealPlanJson()`.
- Add a parallel query: `supabase.from('household_meals').select('*').eq('household_id', myHouseholdId).gte('date_key', startDate).lte('date_key', endDate)`.
- Merge shared meals into the `DayPlan[]` render. Shared meals get a `isShared: true` flag and are non-editable by non-owners.
- The `generateSmartPlan()` algorithm receives shared meals as "fixed slots" that it must not overwrite, and fills remaining slots to hit the user's personal targets minus shared meal macros.

### Portion math
- `household_meals` stores **per-single-serving** macros (matching `recipes` table convention).
- Each member's logged macros = `per_serving * portion_multiplier`.
- The planner computes: `my calories for this meal = household_meal.calories * my_portion`.
- This mirrors the existing `portionMultiplier` field already on `PlanMeal`.

### Privacy model (post-F-16)
- RLS ensures users can only read `household_meals` for households they belong to.
- No access to another member's `nutrition_journals`, `meal_plans`, or any personal data.
- The only cross-user visible data is membership info (name, role) plus the content of shared `household_meals` that pass the F-16 scope filter: dinners always, lunches only when `households.share_lunch = true`, breakfasts and snacks never.
- Per-member `targets` / `consumed` / `remaining` are stripped by `getMyHousehold` for every member that is not the caller. The caller's own row keeps them. No server-side policy covers this — it's a client-layer guarantee because the existing `profiles` / `nutrition_entries` reads are keyed on the member list; stripping happens immediately after the fan-out read and before the function returns.

### Migration path
- New migration creates the four tables with RLS policies.
- No changes to existing tables. The feature is entirely additive.
- `meal_plans` JSON blob is not modified; shared meals are a parallel data source.

### Mobile implementation outline
1. **Settings > Household** -- create/join/leave household, manage invites, set default portion.
2. **Planner tab** -- query and merge shared meals alongside personal plan; badge shared items.
3. **Today/progress views** -- subtract shared meal macros from remaining targets.
4. **Recipe detail** -- no changes needed; shared meals link to existing recipe pages.

### Web implementation (deferred but designed for)
- Same Supabase queries work from the web client.
- The `AppDataContext` can expose a `householdMeals` array alongside existing state.
- Planner and Today components on web would merge shared meals identically.

---

## Estimated Effort

| Work item | Estimate |
|-----------|----------|
| Database migration + RLS policies | 0.5 day |
| Invite flow (Edge Function for email + in-app accept/decline) | 1.5 days |
| Household settings screen (mobile) | 1 day |
| Planner integration (query + merge + badge) | 1.5 days |
| Portion picker UI | 0.5 day |
| Remaining macros integration (Today + planner summary) | 1 day |
| Gap-fill algorithm update (`generateSmartPlan` fixed slots) | 0.5 day |
| Testing (unit + integration + cross-user scenarios) | 1.5 days |
| Documentation updates | 0.5 day |
| **Total** | **~8.5 days** |

---

## Open Questions (to resolve before build)

1. **Invite UX for non-Suppr users:** Should we create a "pending member" row and send a sign-up link, or require the partner to sign up first and then accept?
2. **Household naming:** Is "household" the right user-facing term, or should it be "kitchen" / "table" / "crew"?
3. **Tier gating:** Is household planning a Pro feature, Base feature, or free? (Recommendation: Pro -- it is a power-user and retention feature.)
4. **Conflict on same slot:** If the owner changes Tuesday dinner after the partner already adjusted their portion, should the partner's portion reset or carry over?
5. **Phase 0 JSON blob interaction:** When a shared meal is added to a member's day, should it also be injected into their `nutrition_journals` JSON for backward compatibility, or should the Today view compute totals from both sources on the fly? (Recommendation: compute on the fly; avoid writing to another user's journal.)
