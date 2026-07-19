# Search-results design language on the barcode + voice result sheets (mobile)

**Date:** 2026-05-31 (web voice parity added 2026-07-17, ENG-1429)
**Status:** Resolved (mobile implemented; web barcode ENG-737 + web voice ENG-1429 at parity; flag-gated OFF pending sign-off)
**Area:** Logging / Food search / Brand consistency
**Flag:** `redesign_search_results` (visual/structural → flag-gated per CLAUDE.md; same flag as the food-search redesign so the three logging entry points ramp together)
**Issue:** [ENG-817](https://linear.app/suppr/issue/ENG-817)
**Initiative:** Redesign — Design Direction 2026
**Direction:** [`2026-05-31-design-director-review-and-direction.md`](2026-05-31-design-director-review-and-direction.md)
**Prototype:** `docs/prototypes/2026-05-31-design-direction/surface-search-results.html`

## The gap

The food-search redesign introduces elevated result cards, a legible
Verified/Estimated confidence chip, and a blue commit CTA. Two other logging
entry points land the user on a *result* that the search redesign does not
touch, so they would read as the old flat style:

1. **Barcode scan result** (`app/(tabs)/barcode.tsx`) — after a successful
   lookup the result showed a near-invisible 14px grey `Check` "Verified"
   tick (a binary `product.verified` flag) and a **green** "Log this" commit
   CTA (`Accent.success`), colliding with the reserved calorie-ring green.
2. **Voice-log result** (`AiLogReviewItem.tsx`, hosted by `VoiceLogSheet`) —
   the per-item review row carried no search-results confidence-chip language;
   a voice-logged result read differently from the same food found via search.

## The decision

Apply the search-results language to both result surfaces, behind
`redesign_search_results`, with the old path alive in the `else`.

**Shared chip.** A new `components/ui/SearchResultConfidenceChip.tsx` renders
the prototype's two honest tiers — soft-blue **Verified** (Lucide `Check`) /
amber **Estimated** (Lucide `Info`). It is distinct from the existing neutral
grey `ConfidenceChip` (the low/medium/high TDEE pill, D-2026-04-27-12) — a
different role, different tokens. It renders *only* the tier the caller passes;
it never invents Verified.

**Barcode result.** Under the flag: the binary tick is replaced by the chip,
whose tier comes from `barcodeConfidenceTier(product)` — an honest classifier
in the side-effect-free `lib/barcodeConfidence.ts` (re-exported from
`verifyRecipe.ts`). A row is **Verified** only when the source row is flagged
`verified`; raw Open Food Facts data, community submissions, and any row whose
per-100g basis we had to reconstruct (`basisCorrected`) are **Estimated**. The
"Log this" and manual "Add to Tracker" commit CTAs flip from green to blue
(`Accent.primary`) via a call-site style override; the StyleSheet default stays
green for the flag-off path.

**Voice result.** Under the flag: each review row renders the chip as
**Estimated** — always. An AI-parsed item is an estimate by definition and can
never be "Verified" (CLAUDE.md trust posture). The existing granular High/Med/
Low confidence pill (a real model signal from `item.confidence`) stays. Non-
low-confidence rows additionally adopt the elevated result-card grammar (soft
`Elevation.cardSoft` shadow, hairline dropped); the **low-confidence amber
border is always kept** — it is a load-bearing trust signal, not chrome.

The voice "Parse" / "Log all" CTAs were already blue (`Accent.primary`); the
voice mic-icon tint stays `Accent.success` (macro-identity, not a commit fill —
left per the implementation plan).

## Trust posture (load-bearing)

No surface shows a confidence label not backed by a real signal:

- Barcode "Verified" = a genuinely verified source row (never the OFF default).
- Voice is always "Estimated" — AI output is never relabelled Verified.
- `basisCorrected` barcode rows drop to Estimated even when otherwise verified,
  because we no longer trust the published panel.

## Implementation

File lane (barcode + voice result sheets only — FoodSearchPanel and
BarcodeScannerModal are other lanes and untouched):

- `apps/mobile/components/ui/SearchResultConfidenceChip.tsx` (new) — the chip.
- `apps/mobile/lib/barcodeConfidence.ts` (new) — pure tier classifier.
- `apps/mobile/lib/verifyRecipe.ts` — re-exports the classifier.
- `apps/mobile/app/(tabs)/barcode.tsx` — flag read, chip, blue CTAs.
- `apps/mobile/components/AiLogReviewItem.tsx` — flag read, chip, elevated card.

`AiLogReviewItem` is also imported by `VoiceLogSheet` only (the photo sheet was
re-architected off it 2026-05-01), so the change is scoped to the voice path.

## Tests

- `apps/mobile/tests/unit/searchResultConfidenceChip.test.tsx` — 5 render
  cases: Verified/Estimated labels, default `confidence-chip` testID, a11y
  label, custom testID override, label override.
- `apps/mobile/tests/unit/barcodeConfidenceTier.test.ts` — 5 cases pinning the
  honest classifier (verified→verified; unverified/missing→estimated;
  basisCorrected→estimated even when verified).
- `apps/mobile/tests/unit/barcodeVoiceResultRedesign.test.ts` — 10 structural
  pins: both surfaces read `redesign_search_results`; render the shared chip;
  barcode derives its tier from the helper; old binary-tick path survives;
  commit CTAs go blue under the flag while the StyleSheet default stays green;
  voice chip is always `estimated` (never `verified`); low-confidence amber
  border preserved.

All 20 green. Mobile typecheck clean on all lane files (the two
`FoodSearchPanel.tsx` `renderEmptyState`/`renderListFooter` errors are from the
in-flight food-search lane, not this change).

**Web (ENG-1429):**

- `tests/unit/searchResultConfidenceChipWeb.test.tsx` — 5 render cases for the
  shared web chip: Structured/Estimated labels, the honest warm-amber
  `--chip-estimated` token (never the over-budget `--warning` orange), a11y
  label, custom testId override, label override.
- `tests/unit/voiceLogReviewItemChip.test.tsx` — 4 cases on the extracted voice
  review row: flag OFF → no chip; flag ON → `voice-confidence-chip` reading
  "Estimated"; the chip stays "Estimated" even for a 0.99-confidence item (never
  "Structured" — trust posture); the granular low-confidence verify gate + AI
  badge still render (extraction regression guard).
- `tests/unit/voiceLogChipParity.test.ts` — source-pin web↔mobile parity: BOTH
  voice surfaces render the shared chip as `tier="estimated"` on
  `redesign_search_results`; NEITHER photo surface renders it.

## Parity

The original note claimed barcode + voice were "mobile-only (no web
counterpart)". That was already inaccurate — web ships `today-barcode-dialog.tsx`,
`voice-log-dialog.tsx`, and `photo-log-dialog.tsx` — and is superseded:

- **Web barcode** reached chip parity in **ENG-737** (2026-06-17): the
  `today-barcode-dialog.tsx` result card renders the same Estimated/Verified
  chip, tier from `barcodeConfidenceTier`.
- **Web voice** reached chip parity in **ENG-1429** (2026-07-17): the voice
  review row was extracted to
  `src/app/components/suppr/voice-log-review-item.tsx` (mirroring the mobile
  `AiLogReviewItem`) and renders the shared web
  `src/app/components/ui/search-result-confidence-chip.tsx` as
  `tier="estimated"`, gated on the same `redesign_search_results` flag,
  addressable via the shared `voice-confidence-chip` test hook. The web chip was
  consolidated in the same change: `today-barcode-dialog.tsx` and the food-search
  row's `tierChip()` helper (`FoodSearchResultRow.tsx`, extracted from
  `FoodSearchPanel.tsx` by the unrelated ENG-1532 grammar-dedup work) were
  migrated off their formerly-inline/formerly-duplicated copies onto the one
  shared web primitive, so web now mirrors mobile's single-shared-chip
  architecture.
- **Photo (both platforms): no chip — by design.** The 2026-05-01 range-first
  re-architecture (`PhotoLogSheet` / `photo-log-dialog.tsx`) dropped the shared
  review row; neither platform's photo surface shows the confidence chip. This
  is intentional parity, not a gap — `tests/unit/voiceLogChipParity.test.ts`
  pins it (voice: both show; photo: neither) so a future web-only addition
  can't silently diverge.

No new cross-platform divergence: the chip uses the same Verified/Estimated
grammar and tokens (web `--chip-estimated` mirrors the mobile `#BF8324`) as the
food-search redesign, so every logging entry point reads as one product across
web and mobile.

## Rollout

Flag OFF in PostHog. Grace validates a scan result and a voice result in the
iOS sim; once confirmed, ramp via the PostHog dashboard alongside the rest of
the search redesign. After two weeks at 100% with no regression, the gate can
be removed in a follow-up cleanup PR.
