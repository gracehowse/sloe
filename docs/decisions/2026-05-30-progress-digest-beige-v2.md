# Progress Week-Digest hero beige — pull mobile back to web's muted/40

**Date:** 2026-05-30
**Status:** Resolved (implemented mobile + tests; flag OFF, held for Grace's sim sign-off)
**Area:** Progress / Week Digest / premium polish
**Flag:** `progress_digest_beige_v2` (visual → flag-gated per CLAUDE.md)
**Issue:** [ENG-789](https://linear.app/suppr/issue/ENG-789)
**Related:** [`2026-05-26-progress-digest-blend`](../prototypes/2026-05-26-progress-digest-blend/index.html) (ENG-740, the merged card), prototype `docs/prototypes/2026-05-30-progress-beige-polish/index.html`

## The gap

Grace, on her own Progress tab (verbatim): *"some of the beige on this
page is too much too prominent too dark leaves it feeling less premium."*

The Week Digest card's hero — the one soft-filled "closest to target"
region from ENG-740 — had drifted out of parity between platforms:

- **Mobile** painted it `colors.backgroundSecondary` = **#f5f3ec, opaque**
  — a heavy slab, a touch darker even than the ENG-740 prototype that was
  signed off.
- **Web** painted it `bg-muted/40` ≈ **#fbfaf7** — a faint 40% tint.

So on her phone the beige *shouts*; on web it whispers. The defect is the
divergence, not the colour system. Per the 2026-05-22 lock, "warmth lives
in ink + hairlines, not fills" — an opaque fill is exactly the wrong place
for it.

## The decision

Ship **Option A** from the prototype: pull mobile's hero to the same
muted/40 tint as web (#fbfaf7). Options shown to Grace (before / A / B / C
hero treatments, iPhone-framed, browser-verified) at
`docs/prototypes/2026-05-30-progress-beige-polish/index.html`. She picked
A — the web-parity faintness.

Rejected: B (#f7f5ef ~80% — still too present), C (no fill + #ebe7dc
hairline — a bigger structural change than the complaint warranted).

## Implementation

**Mobile only.** Web already renders the target, so this is mobile coming
up to meet web, not a two-sided change.

- `apps/mobile/components/DigestBlended.tsx` — hero `backgroundColor` is now
  `heroFill`, gated:
  ```ts
  const heroFill = isFeatureEnabled("progress_digest_beige_v2")
    ? colors.backgroundSecondary + "66"   // 40% alpha → #fbfaf7 over the white card
    : colors.backgroundSecondary;          // legacy opaque #f5f3ec, alive in the else
  ```
  The 40% alpha (`"66"` = 102/255) over the white card (`colors.card`)
  composites to **#fbfaf7**, identical to web's `bg-muted/40`. Alpha — not a
  flat light hex — is deliberate: it keeps the fill **theme-aware**, so dark
  mode composites the dark `backgroundSecondary` over the dark card and
  stays correct. A hardcoded #fbfaf7 would have broken dark mode.

- **Web** (`src/app/components/suppr/digest-blended.tsx:226`) — **no change**.
  Already `bg-muted/40`. The flag is mobile-effective-only because only
  mobile had the defect; gating web between two identical values would be
  dead code. End-state parity = both platforms at #fbfaf7.

## Why a flag for a one-line colour move

CLAUDE.md gates visual/structural changes behind a flag with the old path
alive in the `else`, ramped via PostHog. A hero-fill colour is squarely
"visual", and Grace red-lines rendered pixels, not typed proposals — so the
old opaque fill stays one toggle away until she's confirmed the new tint in
the sim. Once it has held 100% for two weeks with no regression, the gate is
removed in a follow-up cleanup PR.

## Tests

`apps/mobile/tests/unit/digestBlended.test.tsx` — two gate cases added:
flag OFF → hero `#f5f3ec` (opaque legacy); flag ON → `#f5f3ec66` (the
muted/40 tint). 11/11 green. Mobile typecheck clean.

## Parity

Identical end-state hero tint (#fbfaf7) on both platforms, identical
testID (`digest-hero`). The only platform difference is mechanical: web
expresses the tint as a Tailwind `/40` opacity utility, mobile as an
8-digit-hex alpha on the same base token — same composite pixel.

## Rollout

Flag OFF in PostHog. Grace validates the new tint in the iOS sim (+ a
browser parity glance); once she confirms it reads more premium, ramp via
the PostHog dashboard. After two weeks at 100% with no regression, remove
the gate in a cleanup PR.
