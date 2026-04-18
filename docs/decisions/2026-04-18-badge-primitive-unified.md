# Decision: Badge primitive unified (2026-04-18, audit H2)

## Context

Batches 2.7 / 3.9 / 3.10 / 4.11 / 5.13 each added a new badge label
(Override / Added / Custom / Leftover / Pro / Freeze / AI / AI estimate)
with its own inline rendering. The results had divergent paddings
(`px-1.5 py-0.5` vs `px-2.5 py-1`), divergent font sizes
(`text-[9px]` / `text-[10px]` / `text-[11px]`), and divergent fills
(muted background vs border-only vs coloured emoji). Users would read
the inconsistency as "different apps glued together."

## Decision

Badges use the shared `<Badge variant=… />` primitive. No inline-span
badges.

- Web: `src/app/components/suppr/badge.tsx`
- Mobile: `apps/mobile/components/Badge.tsx`

Variants and their colour tokens are as defined in `docs/ux/patterns.md`
under "Badges". The primitive fixes shape (size + padding + radius +
weight + tracking) and lets variants swap colour **only**.

Every current badge usage is routed through the primitive — no more
inline `<span className="… px-1.5 py-0.5 text-[9px] …">` or
`<View style={{ paddingHorizontal: 6, paddingVertical: 2 }}><Text …>`.

## Extending

Extending the badge set **requires adding a new variant to the primitive
and its colour map**, not re-rolling a new pill component. Anything more
than a colour difference (e.g. a different shape) belongs in a different
primitive.

## Accessibility

Variants that carry semantics (`pro` / `override` / `leftover` / `freeze`
/ `ai` / `added` / `custom`) ship a default `aria-label` /
`accessibilityLabel`. Callers override when they need runtime context
(e.g. "Leftover of Chicken Tikka Masala" or "2 streak freezes available").

## References

- `src/app/components/suppr/badge.tsx`
- `apps/mobile/components/Badge.tsx`
- `docs/ux/patterns.md` — Badges section
- `docs/technical/components.md` — `suppr/Badge` + mobile `Badge` rows
- `docs/DOCUMENTATION_HUB.md` — 2026-04-18 Badge primitive unified row
