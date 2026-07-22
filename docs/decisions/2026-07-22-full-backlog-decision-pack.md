# Full backlog decision pack (Wave 1 defaults)

- **Date:** 2026-07-22
- **Area:** Launch sequencing / product policy
- **Status:** Recorded as recommended defaults (override in Linear if Grace disagrees)
- **Linear:** ENG-1661, ENG-1425, ENG-1655, ENG-1657, ENG-1656, ENG-1412, ENG-1411, ENG-1563, ENG-1641, ENG-1481; founder-only ENG-1433 / 1434 / 1402 / 1405

## Purpose

Batch the open product calls that block Waves 2–8 so agents implement against one
ratified pack instead of re-asking per ticket. Defaults below are **in force for
implementation** unless Grace comments an override on the linked issue.

## Decisions

| Ticket | Decision | Default |
|--------|----------|---------|
| **ENG-1661** | Notice radius | **24** (`Radius.card`) |
| **ENG-1661** | AddRow shape | **Full-width inset panel** (not GhostPill) |
| **ENG-1661** | App-wide chrome tweak bar | Keep **≤3-line** diffs for role-level changes |
| **ENG-1425** | Cap untrusted-source rows at partial? | **Yes** — Verify CTA stays visible |
| **ENG-1655** | Rhythm tiers | Within-group **8–12**; between-section **24** |
| **ENG-1657** | 0-day streak pip | **Match mobile** — always show |
| **ENG-1656** | Macro redesign | **Legend in hero foot + one bars band**; kill Tiles/Bars/Rings prefs behind flag |
| **ENG-1412** | Edamam | **Drop Edamam** if unused at scale; else paid tier; always add vendor-degraded alerts |
| **ENG-1411** | AI caps | Confirm `AI_BUDGET_ENFORCEMENT_ENABLED=true`; launch-day £ caps in this pack's companion section |
| **ENG-1563** | Cold flag / email | Latch flag to AsyncStorage; add discoverable email escape on signup |
| **ENG-1641** | Profile upgrade CTA | Single primary Upgrade in `EditorialProfileBlock` footer for non-Pro |
| **ENG-1481** | Auditable math v1 scope | Spec first: Maintenance already close; extend to **targets + expenditure only** in v1 |

## ENG-1391 — flag ramp (ops, not code)

Remaining trust remediation is PostHog-only:

1. Confirm `NEXT_PUBLIC_POSTHOG_KEY` is set in web production.
2. Before/after capture for `kcal_trust_qualifier_v1` + `discover_verified_filter_v1`.
3. Ramp both flags to **100%** in PostHog.
4. Hold 2 weeks, then collapse flags to default-on in code.

Agents cannot flip production PostHog rollouts without dashboard access —
Grace owns steps 1–3; agent owns step 4 after the hold.

## ENG-1411 — launch-day AI £ caps (pre-decide)

Until Grace overrides with live DAU numbers:

- **Daily AI text/voice budget:** £50/day (existing 1k-DAU sizing)
- **Daily fal/image budget:** £10/day
- **Enforcement:** `AI_BUDGET_ENFORCEMENT_ENABLED=true` in production
- **Redis fail-policy:** `falBudget` must fail closed the same way as the main AI budget breaker (deny when Redis is unavailable while enforcement is on)

## Founder-only (agents cannot close)

Schedule Grace calendar blocks — do not mark Done from agent work:

- **ENG-1433** — Stripe go-live bundle
- **ENG-1434** — Apple Small Business Program
- **ENG-1402** — Supabase/Vercel Pro
- **ENG-1405** — recovery vault

## Taxonomy ratification (ENG-1661)

Role taxonomy in `docs/design/2026-07-22-ui-anatomy-program.md` is **ratified**
with the Notice / AddRow / ≤3-line defaults above. Unlocks ENG-1663 (`check:anatomy`)
and ENG-1665 (Plan-first migrations).
