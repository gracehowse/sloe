# Decision — Web shopping list partial mobile parity (F3)

**Date:** 2026-04-28
**Area:** Product / Shopping list / cross-platform parity
**Status:** Resolved

## Decision

Web shopping list ports the **lifecycle interactions** from mobile
(per-row remove, clear-checked, slim progress bar) but NOT the
**chrome** (share button, export menu, bulk-clear-all).

The prototype-strip baseline at `docs/ux/claude-design-bundles/prototype/project/screens-web.jsx`
holds for layout and chrome (no breadcrumb, no export menu, no
regenerate card, no out-of-sync banner). It does NOT hold for
lifecycle interactions — those follow mobile.

## What ships on web

1. **Per-row X to remove a single item** (mobile parity)
2. **"Remove N checked" link**, only when count > 0 (mobile parity)
3. **Slim progress bar** with `role="progressbar"` and
   `aria-valuenow` (mobile parity)
4. **Empty-state CTA** ("Your shopping list builds itself / Build
   this week") — already in the parked Batch 13 work, kept

## What does NOT ship on web

1. **Share button** — defer until the web share format is designed
   (mailto vs text vs PDF is a real product call)
2. **Trash (clear-all)** — redundant with clear-checked + the
   natural plan-regen path; reintroduces a destructive action
   with no undo
3. **Export menu** — stays stripped (chrome)
4. **Breadcrumb / regenerate card / out-of-sync banner / "Add
   custom item" input** — stay stripped (chrome)

## Why this isn't "carte-blanche flip to prototype" or "full mobile
copy"

Per memory `feedback_prototype_mix_and_match.md`: "never carte-blanche
flip to prototype; keep live where it's stronger; adopt selectively
with modifications."

Per memory `feedback_mobile_decisions_apply_to_web.md`: "visible UI
changes on mobile must land on the equivalent web surface in the
same commit."

The conflict between those rules dissolves when you realise the
prototype-strip was a chrome decision (correct) and the F3 finding
was a behaviour gap (also correct). Different categories.

## Test posture — split the file

- `tests/unit/shoppingListPrototypePort.test.tsx` keeps the
  **structural** prototype assertions (title, subtitle, 3-col
  grid, category overline, `{name} ({qty} {unit})` row format,
  circular checkbox, no breadcrumb, no Print, no actions menu, no
  Add custom item input, no Regenerate, no out-of-sync banner).
  Drop only the "no progress bar" + "no per-row remove" negatives.

- New file `tests/unit/shoppingListInteractionParity.test.tsx`
  asserts the F3 behaviours: progress bar present with correct
  `aria-valuenow`; per-row remove fires `removeShoppingItem`;
  "Remove N checked" appears when items are checked and clears
  them; empty-state CTA renders.

## Reconsider on

- A user (incl. Grace) asks for share or export on web → flips
  share from "undesigned" to "designed by demand."
- Telemetry shows >20% of web shopping sessions end with items
  still checked but not cleared → the clear-checked link is
  invisible; the trash button comes back.
- Mobile drops any of the three porting items → strip web to
  match (mobile is the canonical platform for lifecycle).

## Notion mirror

- Decisions log row: "F3 — Web shopping list partial mobile
  parity (hybrid)" — Resolved (mirrored 2026-04-28).
- Roadmap row: "F3 — Web shopping list partial mobile parity" —
  Open, target Next sprint (mirrored 2026-04-28).

## Source

product-lead verdict, `agentId: a2a727dac5afa3e14`, 2026-04-28.
