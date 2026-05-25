# Pricing default billing period divergence — web monthly, mobile annual

**Date:** 2026-04-19
**Status:** SUPERSEDED 2026-05-25 — this divergence is RETIRED. Both platforms now default to **monthly** (sweep decision, ENG-698; see `docs/decisions/2026-05-25-sweep-parity-ia-pricing-resolutions.md`). Verify the Apple IAP trial SKU still surfaces with a monthly default. The rationale below is preserved for history only — do **not** treat web-monthly/mobile-annual as a live carve-out.
**Decision owner:** product-lead
**Agents involved:** product-lead, sync-enforcer (flagged), ops-log (recorded)
**Related:** `docs/decisions/2026-04-19-pricing-v1.md`, `docs/decisions/2026-04-19-billing-architecture-pattern-a.md`

## Decision

Web `/pricing` defaults to the monthly billing period; mobile paywall defaults to the annual billing period. This divergence is intentional and must not be treated as drift by sync-enforcer or future auditors.

## Rationale

The two surfaces have opposite jobs, so opposite defaults are correct.

- **Web `/pricing`** is a cold-traffic comparison surface. Visitors are evaluating before committing. £3.99/month is the lowest-friction price anchor; the "Save 37%" badge is visible and nudges toward annual without forcing it. Defaulting annual on a cold-traffic surface would front-load sticker shock for visitors who are not yet sold on the product.
- **Mobile paywall** is a conversion surface. The user is already in-app and already activated. The 7-day free trial is the primary pitch, and that trial is on the annual Pro SKU only (Apple IAP constraint — the trial is attached to the annual product, not the monthly one). Defaulting monthly on mobile would bury the trial offer and mismatch the copy. Defaulting annual surfaces the trial and keeps the pitch coherent.

Same product, same prices, deliberately different defaults because the job of each surface is different.

## Code locations

| Surface | File | Line | Default |
|---|---|---|---|
| Web `/pricing` | `app/pricing/PricingTiersGrid.tsx` | 29 | `monthly` |
| Mobile paywall | `apps/mobile/app/paywall.tsx` | 191 | `annual` |

## Alternatives considered

- **Align both to annual** — rejected. Would front-load sticker shock on the cold-traffic web surface and likely depress conversion funnel entry. Annual is the right default only where the free trial is the pitch.
- **Align both to monthly** — rejected. Would bury the 7-day free trial on mobile, which is the product's primary conversion lever at launch. Apple IAP ties the trial to the annual SKU; defaulting monthly severs the trial from the default CTA.
- **Treat as drift and enforce parity** — rejected. The divergence was reviewed by product-lead and confirmed intentional on 2026-04-19. Enforcing parity here would actively harm conversion on at least one surface.

## Platforms

Both (web and mobile), deliberately different behaviour on each.

## Revisit on

- Web adds a free trial. At that point web-annual-default has lower friction and the monthly anchor advantage weakens.
- Post-launch A/B test (queued for `growth-strategist`) shows web-annual-default lifts paid conversion without tanking trial-start rate.
- Apple IAP policy changes such that monthly SKUs can carry a free trial, removing the annual-SKU constraint on mobile.

## Notes for sync-enforcer

Do not flag `PricingTiersGrid.tsx` line 29 (`monthly`) against `paywall.tsx` line 191 (`annual`) as a parity failure. This is an explicitly logged intentional divergence. Reference this file if the check reappears.
