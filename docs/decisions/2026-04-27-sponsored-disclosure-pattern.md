# Sponsored / affiliate disclosure pattern (B3) — 2026-04-27

**Date:** 2026-04-27
**Status:** Resolved (primitive shipped; ready for first use)
**Area:** Product / Legal

---

## Problem

Suppr has no commercial partner content today, but the moment a brand partnership / affiliate deal / paid placement lands we'll need a disclosure UI ready. Inventing it under deadline produces non-compliant copy + inconsistent visual treatment. Better to land the primitive now and use it as the canonical pattern from day one.

## Regulatory baseline

Disclosure on partner / affiliate / sponsored content is a hard requirement, not a best practice. The pattern below satisfies all three of the regimes Suppr operates under:

- **US — FTC Endorsement Guides §255.5:** "clear and conspicuous" disclosure of any material connection between the endorser and the brand. Vague terms ("partner", "thanks to") do not satisfy.
- **UK — ASA CAP Code §3:** identification of marketing communications. The label must be in the same modality as the content (visible, not hover-only) and use unambiguous language.
- **EU — UCPD 2005/29/EC + national implementations:** prohibits "hidden advertising"; same clarity / prominence bar as ASA.

We deliberately use the bare words "Sponsored", "Affiliate link", "Ad" — every regulator-issued guidance lists these as compliant. We do not use "Partner", "In collaboration with", "Spon", "#ad" alone, etc.

## Three variants

| `kind` | Use when | Disclosure label | Tooltip text |
|---|---|---|---|
| `sponsored` | Paid placement; editorial decision was bought (e.g. a brand pays to feature their recipe in a Discover row) | **Sponsored** | "Suppr was paid by the partner to feature this content. Our editorial review still applies." |
| `affiliate` | Commission-on-purchase link; we retained editorial control (e.g. a "buy this kitchen scale" link in a recipe) | **Affiliate link** | "Suppr earns a commission if you purchase via this link, at no extra cost to you. We only link to products we'd recommend regardless." |
| `ad` | Paid display ad in a rotating slot (none today; primitive ready for the future) | **Ad** | "Paid placement. Suppr does not endorse the advertised product." |

## Two visual treatments

- **Inline pill** (default) — same scale as the existing `SourceBadge` so it composes next to a partner name without competing visually. Use whenever the disclosure decorates a single card / link.
- **Block banner** — full-width, slightly heavier visual weight. Use whenever a row, section, or feed of cards is sponsored — the disclosure must apply to the whole surface, not just one card.

Both variants:
- Render an `aria-label` that announces the kind + partner name.
- Set `role="note"` so screen readers don't mistake them for buttons.
- Carry the regulatory tooltip on `title` for desktop hover; mobile reads it via the existing accessibility tree.
- Use the muted-foreground colour token from the design system — visible without dominating; passes WCAG 4.5:1 contrast against the muted background.

## Where to use it

The primitive is ready before any concrete use case. When the first deal lands:

1. **Discover sponsored recipe / row:** wrap the row in a `<SponsoredDisclosure variant="block" kind="sponsored" partnerName="…" />` placed ABOVE the row content, not below.
2. **Recipe-detail affiliate product link:** render `<SponsoredDisclosure variant="inline" kind="affiliate" />` next to the link itself, in the same `<a>` block, so screen readers + visual users get the disclosure inseparable from the link.
3. **Future ad slot:** `<SponsoredDisclosure variant="block" kind="ad" />` above the slot. The slot itself should also be visually distinct (different background) so the boundary between editorial and paid is unmistakable.

The component is intentionally small + opinionated — there's no "size" prop, no colour override, no kind beyond the three above. If we ever need a fourth variant (e.g. native advertorial) we add it here, not at call sites; that keeps regulator review of the disclosure pattern bounded to one file.

## What this primitive deliberately does NOT include

- **A consent / preference layer.** The disclosure is one-way: it informs the user. If we ever add affiliate-link click tracking we'll wrap the analytics call in a consent gate per `app/privacy/page.tsx`, but that's a separate primitive.
- **Server-side enforcement.** We trust call sites to use the disclosure correctly. This is a soft contract — code review + the eslint rule we may add later are the enforcement.
- **Mobile parity in this commit.** Web has the primitive now; mobile gets a parallel `apps/mobile/components/SponsoredDisclosure.tsx` when the first mobile use case lands. The visual + a11y patterns above are the spec the mobile component must match.

## Tests

None required for the primitive itself — it's a presentational component with no logic. When the first call site goes live we'll pin:
- A11y label correctness (RTL `getByRole("note")` queries the disclosure).
- Tooltip content matches the `kind`.
- Visual snapshot on the call site.

## Cross-platform parity

Web shipped today (`src/app/components/suppr/sponsored-disclosure.tsx`). Mobile parallel ships when the first mobile use case is wired — pattern is documented above so the mobile component matches by-construction.
