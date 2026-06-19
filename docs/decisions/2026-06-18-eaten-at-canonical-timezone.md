# `eaten_at` canonical timezone hardening

- **Date:** 2026-06-18
- **Area:** Nutrition journal / schema refactor
- **Status:** Resolved
- **Linear:** ENG-1076

## Decision

Meal day attribution helpers now accept an explicit canonical IANA timezone from
`profiles.tz_iana`. When present, `date_key` and `eaten_at` wall-clock
conversions are computed in that timezone instead of the JavaScript runtime's
ambient local timezone. When the profile timezone is null or invalid, helpers
fall back to the previous ambient-device behaviour.

## Rationale

The existing single-device flow was correct because the logging and editing
device were the same. Multi-device editing introduces a latent failure mode: a
late-night meal, for example 23:50 in the user's home timezone, could be edited
from a device in another timezone and silently re-bucket to the wrong
`date_key`. That corrupts daily totals even though the instant itself is valid.

Suppr already stores `profiles.tz_iana` for timezone-aware weekly recap fan-out,
so ENG-1076 reuses that canonical source instead of adding a second profile
column.

## Implementation notes

- `src/lib/nutrition/mealEatenAt.ts` remains the shared web/mobile source of
  truth.
- The conversion uses `Intl.DateTimeFormat(..., { timeZone }).formatToParts`;
  no timezone library was added.
- Web and mobile Today/Food Search/log-sheet flows thread `profileTimezone`
  where the profile is already loaded.
- Callers without a profile timezone keep current behaviour via the optional
  parameter fallback.

## Test pin

`tests/unit/mealEatenAt.test.ts` includes a runtime-`TZ` fixture proving a 23:50
entry follows the canonical timezone's calendar day, plus a cross-timezone
re-anchor case preserving canonical wall-clock time.
