# Today week strip — minimal current-day indicator (drop the filled pill)

- **Date:** 2026-06-03
- **Area:** Today tab — week strip (web + mobile)
- **Status:** Resolved
- **Related:** SLOE Today re-skin (`docs/prototypes/stitch-sloe/today.html`),
  `project_julienne_competitive_pattern`, `project_lifesum_aesthetic_direction`

## Problem

The SLOE Today re-skin marked the selected/today day in the week strip with a
**clay filled PILL** — a `rounded` clay rectangle spanning the whole day cell,
with a white day-letter, white number, and white status dot (mobile), and on
web a clay-filled `30px` circle with a green check-icon for logged days.

Grace's feedback: the filled treatment reads as **clunky** and heavy. She wants
the Julienne month-calendar language instead — the active day is just a small
orange dot under a bold orange number, with no filled background.

## Decision

Drop the filled pill/circle entirely. The week strip now uses a **minimal
current-day indicator** on both platforms:

| State | Number | Dot beneath |
|---|---|---|
| Selected day | clay (`#C8794E`), bold | clay dot |
| Today (not the selected day) | clay, bold | **no dot** (clay number alone marks it — avoids two competing clay dots) |
| Logged day (not selected) | neutral, semibold | sage dot (`#5E7C5A`) |
| Plain day | neutral, semibold | none |
| Selected **and** logged | clay, bold | **one clay dot** — clay precedence; the sage "logged" dot never wins on the both-case |

No day cell carries a background fill any more. The sage "logged" dots for
other days are preserved. On web this also removes the old green check-icon
(logged days now use the same sage dot as mobile, closing a small web↔mobile
divergence).

### Why today-not-selected shows no dot

Giving both the selected day and today a clay dot would put two clay dots on
screen whenever the user navigates to a past/future day, making it ambiguous
which day is selected. The selected day owns the clay dot; today stays findable
by its clay number colour alone. This keeps the strip calm and unambiguous.

## Implementation

The state→treatment rule is a **single shared, pure helper** so web and mobile
cannot drift and the rule is unit-tested independently of the rendered tree:

- `src/lib/today/dayStripIndicator.ts` — `dayStripIndicator(state)` returns
  `{ dotKind: "clay" | "sage" | "none", isActive }`; `dayStripIndicatorStyle`
  additionally resolves concrete `dotColor` / `numberColor` from injected
  tokens. No platform deps (mobile-importable via `@suppr/shared`).
- `apps/mobile/components/charts/DayStrip.tsx` — consumes
  `dayStripIndicatorStyle` with `Accent.primary` / `Accent.success`; the day
  Pressable no longer sets a `backgroundColor`. Adds `daystrip-dot-minimal-*`
  and `daystrip-pager` testIDs.
- `src/app/components/DayStrip.tsx` — consumes `dayStripIndicator`, maps
  `dotKind` to `bg-primary` / `bg-success`; renders a bold `text-primary`
  number for the active day and a `w-1 h-1` dot beneath; old `w-[30px]`
  filled circle + `Icons.check` path removed.

## Tests

- `apps/mobile/tests/unit/dayStripMinimalIndicator.test.tsx` — pins the pure
  helper for every state combination (incl. clay precedence) AND asserts the
  rendered mobile strip has no clay-filled day cell + the minimal dots render.
- `tests/unit/dayStripMinimalIndicatorWeb.test.tsx` — web twin: minimal dots
  present, old `w-[30px]` / `text-primary-foreground` filled-circle classes
  gone, logged day renders a sage dot (not a check icon).

## Parity

Implemented on **both** platforms in the same change (iOS led; web followed per
the "mobile design decisions apply to web" rule). The shared helper is the
single source of truth for the indicator rule — no intentional divergence.
