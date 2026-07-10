# 2026-07-10 — One card grammar: 24px corners everywhere, flat cards WITH a bound separation mechanism

**Status:** Ratified (Grace, 2026-07-10, with Oura + Natural Cycles + own-app
screenshots). Supersedes `2026-06-25-v3-card-lift-reversal.md` on the
elevation axis and makes the v3 prototype **non-canonical on elevation**
(its `--shadow-card` floating-card doctrine no longer applies; its radius
tiers partially survive, see below). ENG-1497 epic.

## Grace's direction (verbatim intent)

> "One of the biggest design issues is the consistency of boxes / cards.
> Some are sharper squares and some are more rounded. All should be more
> rounded (like the Oura example and our own import from TikTok etc) also
> Oura's cards are flat, Natural Cycles' cards are flat — we need to fix
> this consistency issue as priority 1."

Reference read: Oura ≈20–24pt radii, flat, separation by surface tone on a
dark ground. Natural Cycles ≈16–20 radii, flat white cards on a clearly
grey ground, no shadows. In-app exemplar: the Discover TikTok-import card —
24px corner + flat lavender tint, no lift.

## The census (3-agent sweep, 2026-07-10)

Web runs FOUR competing card grammars side by side: (1) Today/Progress
24px SupprCard + soft lift; (2) Today legacy 8px `rounded-card` + soft
lift (57 uses); (3) Plan 16px `rounded-2xl` bordered-flat; (4) Discover
24px `rounded-3xl` tinted-flat. ~9 distinct radius values live on
card-like web elements (8/10/11/12/14/16/20/22/24), most off-token; the
web `rounded-*` namespace is entirely ungated by `check:token-scale`.
Mobile is more uniform (SupprCard 24) but the 24 itself is NOT a token
(`CARD_RADIUS` module constant in SupprCard.tsx; the Radius ladder tops
out at 12), and chrome elements split 8-vs-12 across Today/Plan.

## Ruling

### 1. Radius — ONE card corner: 24, tokenised, both platforms

- **Cards, banners, card-rows, sheets, tiles: 24.** Chips/pills: `full`.
  Inputs + nested inner elements: 12 (the concentric inset standard,
  2026-06-10, unchanged — 12-inside-24 stays correct).
- Mobile: `Radius.card: 24` joins the token ladder (theme.ts). SupprCard's
  `CARD_RADIUS`/`TILE_RADIUS`/`SHEET_RADIUS` consume it. The legal ratchet
  scale becomes 4/6/8/12/24/full (CLAUDE.md snap list updated).
- Web: the legacy `--radius-card` (8px, the tight-ladder relic behind 57
  `rounded-card` uses) is **flag-flipped to 24** — one token write moves
  every legacy card at once. Plan's 16px cards and the `rounded-3xl` /
  `rounded-[24px]` spellings migrate to the `rounded-card-lg` token in
  follow-up slices. The prototype's 16px "secondary card" tier is retired
  (mobile already deliberately overrode it, 2026-06-23).

### 2. Elevation — flat cards, WITH the separation mechanism bound in

Flat has failed twice here (2026-06-04 slabs; 2026-06-12 Withings-flat →
2026-06-16 ground patch → 2026-06-25 reversal) and both post-mortems agree
why: **a flat white card on a near-white ground is invisible.** Grace's own
references never do bare flat — NC pairs flat white cards with a visibly
grey ground; Oura separates by dark tonal steps. So this ruling binds the
mechanism to the flip; re-flattening without it is repeating history:

- Page-ground cards: **no shadow** + **hairline border** (`--border` /
  `colors.cardBorder`) — the grammar dark mode already uses.
- The ground stays the whisper-cool `#F7F6FA`; if captures read
  white-on-white despite the hairline, the bound lever is deepening the
  card-hosting ground one cool step (`--background-grouped` family), NOT
  reintroducing shadow.
- Sheets/dialogs/FAB keep their float (overlays are a different material).
  Tinted cards (import banner, empty-state cards) are already flat — no
  border added; the tint IS the separation.
- The 2026-06-09 meta-rule survives: ONE treatment per surface class.

### 3. Rollout

Behind **`card_grammar_v1`** (structural/visual → flag, per the
non-negotiable): flag ON = 24px legacy-card flip + flat-hairline cards;
OFF = today's soft-lift grammar (kill switch). Slices: S1 core token +
elevation flip (this change) → S2 web 16px/stray-radius migration to the
token → S3 mobile chrome radii + literal cleanup + web rounded-* ratchet
leg → S4 remove flag after Grace's sign-off window.

## Consciously superseded / edited in the same epic

- `2026-06-25-v3-card-lift-reversal.md` — reversed (this doc).
- v3 prototype elevation doctrine ("the fix is ELEVATION") — non-canonical
  on this axis from today; ENG-1247 conformance must not "fix" cards back
  to floating.
- CLAUDE.md UI-write discipline line ("page-ground cards soft lift…") —
  updated in this change (+ `npm run sync:agent-docs`).
- Lift-pinning guard tests re-pointed, not deleted.
