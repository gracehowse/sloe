# Onboarding Welcome copy — intentional platform divergence

**Status:** Resolved
**Area:** Onboarding, brand, conversion
**Decided by:** Grace, 2026-04-21

## Decision

Web and mobile onboarding Welcome steps use **different headlines** and this divergence is intentional. `sync-enforcer` must not re-flag it as drift.

- **Web** (`src/app/components/onboarding-v2/steps/welcome.tsx`): headline = **"Join the Suppr Club"** + checkline trio + Sign-In button. Cold-traffic, marketing-leaning cold-open.
- **Mobile** (`apps/mobile/components/onboarding-v2/steps/welcome.tsx`): headline = **"Eat well, without overthinking it."** + FloatingPreview with "Matched to USDA · 94%" confidence chip. Post-install emotional warm-open.
- **Prototype** (`docs/ux/claude-design-bundles/onboarding/project/design/steps.jsx:156-171`) matches mobile.

## Rationale

Web onboarding receives cold traffic from the marketing site and paid campaigns. First impression needs the marketing anchor ("Suppr Club" = the product's brand promise) to earn the continued click. The checkline trio + Sign-In also serve users who already have accounts — a cold-traffic surface must make "this is what it is" and "I already have one" both discoverable.

Mobile onboarding runs only after install — the user already committed enough to download the app. Prototype copy ("Eat well, without overthinking it.") + FloatingPreview is the right emotional register for a user already past the trust hurdle. Marketing framing on mobile would read redundantly.

This mirrors the same logic that produced the **Pricing default billing period** divergence (web=monthly cold-anchor, mobile=annual conversion-surface) — see `docs/decisions/2026-04-19-pricing-default-billing-period-divergence.md`.

## Consequences

- `sync-enforcer` must not re-flag Welcome headline as a web↔mobile parity break.
- `copy-reviewer` owns both headlines independently — if either changes, treat the other as also-in-scope for a holistic re-consideration, but don't force unification by default.
- If A/B testing ever wants to try prototype copy on web, or marketing copy on mobile, treat as an experiment with explicit activation/conversion hypothesis — not a drift fix.

## Related

- Memory: `feedback_mobile_decisions_apply_to_web.md` — this decision is an explicit carve-out from that rule.
- Memory: `project_onboarding_redesign.md` — Phase 2 at 100% rollout context.
- Prototype reference: `docs/ux/claude-design-bundles/onboarding/project/design/steps.jsx:156-171`.
