# Settings "Your name" field — Today-greeting personalisation

- **Date**: 2026-06-04
- **Status**: Resolved
- **Area**: web Settings; mobile Settings; Today greeting; shared account lib
- **Decided by**: product engineer (dispatcher: Grace)

## Problem

The Today hero greeting personalises ("Morning, Grace") when a display
name is present on the auth session's `user_metadata`
(`apps/mobile/app/(tabs)/index.tsx` reads it via the
`full_name` / `name` / `first_name` / `preferred_name` precedence, first
token). But there was **no in-app way to set that name** — it only ever
arrived via Apple Sign-In's FULL_NAME scope at first sign-in
(`apps/mobile/app/login.tsx`). A user who signed in with email, or who
declined the Apple name scope, could never personalise their greeting.

Separately, the **web** Today greeting (`NutritionTracker.tsx`) derived
its name from `profileDisplayName` (the `profiles.display_name` column),
not from `user_metadata` — so even if a name were set in auth metadata,
web wouldn't read it. The two platforms sourced the greeting name from
two different stores.

## Decision

Add an editable **"Your name"** field to Settings on both platforms. It
writes the auth user's `user_metadata.full_name`; the Today greeting
reads it back. One canonical source, one shared write path, one shared
extraction helper.

### Where the name is stored

`user_metadata.full_name` on the Supabase **auth** user — written via
`supabase.auth.updateUser({ data: { full_name: <trimmed> } })`.

**Not** `profiles.display_name`, deliberately:

1. The greeting already reads `user_metadata` on mobile; metadata is the
   natural home.
2. Writing to `profiles` client-side risks the tier-lockdown trigger
   (`feedback_persist_path_guardrails`) — any `profiles` update that
   touches entitlement columns rejects the whole row. Keeping the write
   on `auth.updateUser` sidesteps that surface entirely.
3. The existing read-only **Display Name** field (web Personal card) and
   the `/profile` editor already own `profiles.display_name`. "Your name"
   is a distinct, narrowly-scoped field for the greeting. They are
   intentionally separate; the web Personal card shows both (the new one
   editable, the legacy one read-only) until a later consolidation.

### Shared code (no duplication)

- **`src/lib/account/displayName.ts` → `saveDisplayName(client, rawInput, currentName)`**
  — the single save path. Trims, no-ops when unchanged (avoids a
  redundant `USER_UPDATED` on every blur), writes `{ full_name }` only,
  returns a typed `{ ok, value, changed } | { ok:false, message }`.
  Imported by web directly and by mobile via `@suppr/shared/account/displayName`.
- **`src/lib/copy/today.ts` → `firstNameFromMetadata(metadata)`** — the
  shared name-extraction (precedence + first token + empty→undefined),
  so web and mobile resolve the greeting name identically.

### Behaviour

- Pre-filled from the current metadata (full name, so the surname isn't
  lost on edit). Trims on save. **Empty/whitespace clears** the name →
  greeting falls back to "Good morning".
- Commits on blur and via the Save control / Enter / submit.
- After a successful change, the screen calls `supabase.auth.getSession()`
  so the auth context re-emits and the greeting refreshes **without an
  app restart**.

### Web greeting source change

`NutritionTracker.tsx` now reads the greeting name from
`authUserMetadata` (newly exposed by `AuthSessionContext`, re-emitted on
`USER_UPDATED`) via `firstNameFromMetadata`, instead of
`profileDisplayName`. This is **data-source-only** — web keeps its
existing "Good morning, {name}" wording. (Converging web onto the shared
`todayGreeting` wording — "Morning, {name}" — would be a meaning-changing
copy shift and is left as a separate feature-flagged change per the
CLAUDE.md visual-change rule.)

## Parity

| Concern | Web | Mobile |
|---|---|---|
| Field | "Personal" card, first row (`settings-name-input`) | "Personal" section, first card (`settings-bundle-name-input`) |
| Save path | `saveDisplayName` → `auth.updateUser` | `saveDisplayName` → `auth.updateUser` |
| Stored at | `user_metadata.full_name` | `user_metadata.full_name` |
| Clears on empty | yes | yes |
| Session refresh after save | `getSession()` | `getSession()` |
| Greeting reads | `user_metadata` via `firstNameFromMetadata` | `user_metadata` (inline, same precedence) |
| Input masking | global `maskAllInputs: true` | global `maskAllTextInputs: true` |

Intentional difference: web greeting wording stays "Good morning, {name}";
mobile uses the shared `todayGreeting` ("Morning, {name}"). Not new drift
— pre-existing, and the convergence is a separate flagged change.

## Tests

- `tests/unit/greetingNameMetadata.test.ts` — `firstNameFromMetadata`
  precedence, first-token, empty/whitespace → undefined → fallback.
- `tests/unit/saveDisplayName.test.ts` — trimmed `full_name` write,
  empty clears, no-op when unchanged, error + thrown-client handling,
  payload contains only `full_name`.
- `tests/unit/settingsYourNameParity.test.ts` — both platforms render
  the field, use the shared helper, refresh the session, never write a
  `profiles` column, AND nest the field inside a matching "Personal"
  settings group (placement parity, added with the 2026-06-04 relocation).
- `tests/unit/nutritionTrackerRender.test.tsx` — greeting now reads the
  name from `user_metadata.full_name` and falls back when it's absent.
- `apps/mobile/tests/unit/settingsBundleParity.test.ts` — the three new
  name-field testIDs are pinned.

## How to verify (iOS sim)

1. Open the app signed in, go to Progress → Settings.
2. Under the profile card, the **Personal** section is the first group;
   its first card holds the "Your name" field. Type `Grace`, tap Save (or
   blur the field).
3. Go to Today — the hero greeting reads "Morning, Grace" (mobile uses
   `todayGreeting`; with a name it renders "{TimeOfDay}, Grace", e.g.
   "Morning, Grace" / "Afternoon, Grace" / "Evening, Grace").
4. Return to Settings, clear the field, Save — Today greeting falls back
   to "Good morning".

## Follow-up — 2026-06-04: relocated into a "Personal" group

Grace: the name field "should be a general part of the user's personal
settings" — not a standalone "Your name" card. Relocated on both platforms
so the field sits inside a shared **Personal** group (identity-first, top
of the settings list):

- **Mobile** (`apps/mobile/components/settings/SettingsBundleContent.tsx`):
  the `SectionHeading` "Your name" became "Personal"; the per-field "Your
  name" label now sits inside the card. Card/input/save testIDs unchanged
  (`settings-card-name`, `settings-bundle-name-input`,
  `settings-bundle-name-save`).
- **Web** (`src/app/components/Settings.tsx`): the existing "Account" card
  heading became "Personal" (the name field was already its first row).
  Group name now matches mobile for sync-enforcer parity.

No logic change: `saveDisplayName`, on-blur commit, and the post-save
`getSession()` refresh are untouched; the Today greeting still reads
`user_metadata` via `firstNameFromMetadata`. Placement parity is pinned by
`tests/unit/settingsYourNameParity.test.ts` ("Personal" group assertion).
