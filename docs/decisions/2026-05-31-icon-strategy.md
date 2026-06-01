# Icon & animated-icon strategy (2026-05-31)

**Status:** Resolved
**Area:** Engineering / design-system
**Owner:** Grace

## Question
"Are we still lucide-only? Are there better/more modern icon libraries we should use?"

## Decision — **stay on Lucide (primary), add Lottie for win-moments, SF Symbols only for iOS-native chrome**

1. **Keep Lucide as the single primary glyph set** (`lucide-react-native` mobile + `lucide-react` web). It is the correct 2026 default for a premium RN+web product and Suppr is already fully invested — 111 mobile + 73 web import sites, meal-slot glyphs already mapped. The decisive reason: **lucide-react-native is first-party** (same org ships web + native), so glyphs render **pixel-identical across platforms** — exactly the cross-platform parity CLAUDE.md demands. ~1,500 icons, ISC licence, clean 24px/2px-stroke. In 2026 "modern" is restraint + consistency (Linear/Vercel/Notion tier), **not** glyph count.

2. **Eliminate functional emoji.** Emoji used as UI (macro tiles, the prototype's 🥣🥗 placeholders) must NOT ship — they render differently per OS/font and look amateurish at the premium bar. Replace every functional emoji with a Lucide glyph. (Decorative emoji in copy/celebratory toasts is fine.)

3. **Add Lottie for 2–4 win-moment micro-interactions** (`lottie-react-native` + dotLottie) — goal-hit, streak, log-confirm. This is the animation mechanism for the win-moment work (ENG-798). Rive is better tech (≈60fps, smaller files, state machines) but its ~200KB WASM runtime only pays off with *many* animated icons; Suppr needs a handful → Lottie is the right footprint. **Check Lordicon licence/attribution before shipping any pre-made Lottie.**

4. **SF Symbols only for iOS-native chrome** (tab bar / native headers via `expo-symbols`) where it buys the liquid-glass native feel — **never as the primary set**, because it falls back to Material Symbols on web, which would make iOS glyphs ≠ web glyphs (the platform divergence CLAUDE.md forbids).

## Watch (not now)
**Phosphor** is the only library that out-classes Lucide on a real axis — 9,000+ icons across 6 coherent weights incl. duotone, with a first-party web lib. Revisit **only** if a future design language commits hard to a weight/duotone hierarchy across both platforms. Today its RN port is community-maintained (parity/maintenance risk) and migrating 184 sites buys a weight system Suppr has no concrete need for. Bad trade now.

## Rejected
- **Switch to Phosphor wholesale** — community RN port = parity risk; migration not justified.
- **SF Symbols everywhere** — web fallback breaks cross-platform glyph parity.
- **Heroicons** — no official RN package (stale third-party wrappers only).
- **Hugeicons / Untitled UI** — full sets are Pro-gated; coverage isn't the 2026 differentiator.

## Rules going forward
- Per-icon **named imports only** (no barrel imports) — keeps the RN bundle lean (codebase already does this).
- Any new glyph: Lucide first; if missing, check Lucide Lab before reaching elsewhere.
- No functional emoji.

Source: post-prototype icon research, 2026-05-31 (workflow `wf_0291dc62-53b`).
