# 2026-04-21 — Household avatar initials: mixed 2-char / 1-char

**Status:** Resolved.
**Area:** Plan tab, `HouseholdCard` member avatar.
**Decided by:** ui-critic (agent call, 2026-04-21), confirmed by Grace.

## Decision

Household member avatars show:
- **2 chars** when the `displayName` splits on whitespace into 2+ chunks (`"Alice Smith"` → `"AS"`).
- **1 char** when the `displayName` is a single chunk (`"Grace"` → `"G"`).
- `"?"` for empty / missing names.

This is the F-32 ship behaviour — **keep it as-is.**

Rejected alternatives:
- **Always 1-char.** Lossy when multiple members share a first initial (couples, siblings, parent+child), which is common in a 2–6 person household.
- **Always 2-char, first+last-of-single-word for single-word names** (`"Grace"` → `"GR"`). Reads as a bug, not a convention. No mental model supports it.

## Why

Mirrors the convention used everywhere else users encounter avatars with initials — email clients, Slack, Linear, Apple Contacts. Users don't read `"G"` next to `"AS"` as inconsistent; they read it as "Grace chose to go by Grace." The avatar respects the displayName; the displayName doesn't get mangled to serve grid uniformity.

At a 22×22 circle with 9px/700 text, the visual weight difference between 1 and 2 chars is negligible. Uniformity is not worth the collision risk.

## Applies to

- [apps/mobile/components/HouseholdCard.tsx](../../apps/mobile/components/HouseholdCard.tsx) F-32 block.
- Any future web `HouseholdPanel.tsx` parity port — same rule.
