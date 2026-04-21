# Household full flow port — 2026-04-20

Prototype source: `docs/prototypes/2026-04-19-whole-app-experience/project/`
(`screens-mobile.jsx`, `flows.jsx`, `data.jsx`).

## Artefacts shipped

1. **Compact HouseholdBar** — pill row with `All N` + per-member
   initials-avatar chips. Rendered at the top of Plan + Progress on
   both platforms. Only visible when the signed-in user has a
   household (data fetched via the existing shared client —
   `src/lib/household/householdClient.ts`).
   - Web: `src/app/components/HouseholdBar.tsx`
   - Mobile: `apps/mobile/components/HouseholdBar.tsx`
   - Shared accent palette: `src/lib/household/memberAccents.ts`
     (pinned by `tests/unit/householdMemberAccents.test.ts`)

2. **Household settings page** — full screen with Members list,
   preset radio (All / Dinners / Dinners + weekends / Individual /
   Custom), 7×4 weekly grid with tap-to-cycle + long-press to pick
   specific members, and per-member legend.
   - Web: `src/app/components/HouseholdSettingsPage.tsx`,
     wired into `App.tsx` as `?view=household-settings`
   - Mobile: `apps/mobile/app/household-settings.tsx` Stack screen,
     registered in `_layout.tsx` with header hidden
   - Shared preset/grid model + derivation:
     `src/lib/household/sharingGrid.ts` (pinned by
     `tests/unit/householdSharingGrid.test.ts`)
   - Shared local-storage adapter:
     `src/lib/household/sharingGridStorage.ts` (pinned by
     `tests/unit/householdSharingGridStorage.test.ts`)

3. **More → Household row** — icon-box row with "4 people · dinners
   sharing" subtitle, routes to the settings page. Hidden for solo
   users.
   - Web: `src/app/components/Profile.tsx` — new "Everything else"
     section above Settings.
   - Mobile: `apps/mobile/app/(tabs)/more.tsx` — new "Everything
     else" section above "Goals & targets".

## Server vs local state

The server today persists a single `households.share_lunch` boolean
(F-16 scope narrowing). That column can't round-trip the 7×4 grid,
so the grid/preset are stored **client-side per household** via the
shared adapter:

- Key: `suppr.householdSharing.v1.{householdId}`
- Web uses `window.localStorage`
- Mobile uses `AsyncStorage`

On save, `deriveShareLunch(grid)` computes a boolean from the grid
(true iff any lunch cell has 2+ members) and writes it back via
`setHouseholdShareLunch` — so the legal-gated server filter stays
in lockstep with what the user sees in the grid.

### Follow-up — grid schema

A persisted grid schema is required to:

- share the grid across devices (currently web and mobile hold
  independent copies)
- let a member see the owner's grid without re-editing it locally
- unlock analytics on preset adoption

Suggested shape: `household_sharing_grids` with `(household_id,
day, slot)` composite PK + `members text[]`. Shaped to match the
helper library so the settings screen needs no UI changes when the
schema lands. Tracked here so whoever picks it up can swap the
storage adapter without touching the radio/grid/legend code.

## Parity

- Prototype persona colours (Alex blue #6c8cff / Sam green #4cd080 /
  Mia amber #ffc04c / Leo pink #ff7eb3) are encoded verbatim in
  `memberAccents.ts`, indexed by member-join-order. Both platforms
  sort `household_members` by `joined_at ASC` when reading, so a
  given member lands on the same colour on every client.
- The preset list order + copy matches the prototype 1:1 and is
  pinned by test.
- HouseholdBar selection state is local; neither web nor mobile
  currently filters the Plan / Progress rows by member (follow-up).

## Preserved

- Create / join / leave / invite-code flows continue to live in
  the original HouseholdCard (mobile) / HouseholdPanel (web). The
  new bar and settings page never duplicate that surface.
- Legal-gated `share_lunch` remains the server source of truth for
  which non-dinner meals leave the caller's own row (F-16 scope
  narrowing — `src/lib/household/scopeCopy.ts`).
- G-5 "Cal / Protein / Carbs / Fat left" labels on the self-row
  remain untouched.

## Tests

- `tests/unit/householdMemberAccents.test.ts` — 8 tests, palette +
  initials + first-name helpers.
- `tests/unit/householdSharingGrid.test.ts` — 14 tests, preset
  builder, cycle/toggle, share_lunch derivation, preset copy pins.
- `tests/unit/householdSharingGridStorage.test.ts` — 6 tests,
  round-trip + malformed-JSON normalisation.
