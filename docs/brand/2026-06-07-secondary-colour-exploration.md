# Sloe — secondary colour exploration

**Status: DECIDED 2026-06-07 — Grace chose Direction D (Frost / the bloom).** Plum `#3B2A4D` stays hero; Damson `#6A4B7A` = white-text CTA/active fill; Frost lilac `#9B8FB0` / `#C9C2D6` = soft accents/chrome/dividers; Honey `#D6A24A` retained for food-warm; status colours + carbs/sugar stay warm. Token rewrite to be implemented flag-gated (web + mobile lockstep, before/after captures, PostHog ramp). Brand-manager to validate the applied result.
Date: 2026-06-07 · Owner: Grace · Hero (plum `#3B2A4D`) unchanged in every option — only the **secondary accent** moves.

Visual board: [`docs/brand/secondary-colour-board.html`](./secondary-colour-board.html) → rendered
[`screenshots/brand/secondary-colour-board.png`](../../screenshots/brand/secondary-colour-board.png)
(five columns: live clay reference + four proposed directions, each applied to a CTA pill, calorie ring, recipe card, section heading, encouragement pill, and a labelled swatch strip).

---

## 1. The competitive finding

The nutrition + recipe lane is colour-crowded, and Sloe's current clay secondary (`#C8794E`) sits in the **single most crowded slot** in it.

**What's taken:**

- **Green** — the overwhelming default: Lifesum, Cronometer, ReciMe, Honeydew, Yazio, plus "goal-met" green states everywhere.
- **Blue** — owned by MyFitnessPal (deliberately, to stand apart from the green/orange crowd), but isolated.
- **Orange / amber** — Lose It! owns it as its **primary**; MFP and Cal AI use it as a functional accent. The generic "warm wellness" colour.
- **Red** — Paprika (literal paprika-tin red), the warm/appetite end.
- **Black/white mono** — Cal AI and MacroFactor, the trendy "AI/premium neutral" look.
- **Warm terracotta / cream-beige** — the warm-editorial recipe lane: **Julienne** (EB Garamond serif on a cream/beige canvas, food-photo as colour hero) and Lifesum's warm off-white.

**The clay problem.** Sloe's clay `#C8794E` is a saturated terracotta. It reads closest to **Lose It!'s** primary orange and to **Paprika's** warm red, and it sits in the **same warm-neutral lane Julienne already owns**. So clay differentiates Sloe from the green/blue crowd, but it does **not** differentiate Sloe within the warm recipe-app cohort — it's the crowded, "expected" colour a warm recipe app reaches for. Dropping clay is the single highest-leverage de-confliction move available.

> Caveat carried from the audit: Julienne's exact warm hex/saturation could not be pixel-confirmed (JS-rendered site, blocked App Store/Mobbin text fetch). The lane overlap is confident; the precise terracotta-vs-pale-cream saturation is the one open question. It does not change the recommendation.

**What's open:**

- **Purple / plum / berry / damson** — **no competitor owns it as a primary.** Lifesum uses purple only as a small, design-critiqued header accent. Genuinely open — *and* directly on-brand, because **a sloe is a deep purple-red hedgerow berry.** The name literally hands you the colour.
- **Soft lavender / mauve** — the cited 2026 wellness colour trend ("soft-tech pastels"), a lighter sibling to plum.
- Magenta/fuchsia and indigo/blue-violet — also unowned, higher-energy accent room.

Berry is **clash-free** with the category's functional coding: green = "goal met", brick = "over budget", amber = "warning" stay exactly as they are — purple is semantically neutral in nutrition UIs, so Sloe can own plum as the brand hue without touching status colours.

---

## 2. The four directions

Plum `#3B2A4D` stays the hero in all four. Status colours (sage / brick / amber) are untouched in all four. Each accent is shown applied to real Sloe surfaces on the board.

### A — Sloe Berry  ·  accent `#8E3B5E` (mulberry)  ·  **recommended**
Drop clay; deep damson/mulberry becomes the brand + CTA accent. The most on-name option by a wide margin — the palette becomes literally the berry the brand is named after. Mulberry sits one jewel-step warmer and brighter than the plum hero and the existing damson, so it reads as a deliberate accent against the plum chrome, not a muddy near-match.
- Supporting: `#5B2E4A` Mulberry Deep (pressed), `#6A4B7A` Damson (active, existing `--accent-win`), `#F1E0E8` Bloom Pink (tint), **`#D6A24A` Honey retained** (existing `--activity`) for food-warm micro-moments.
- **Highest differentiation** — no competitor owns berry-magenta; removes the direct Julienne/Lose It! overlap.
- Watch-item: purple is a cool, appetite-suppressing family **if it touches the plate**. Mitigated structurally — the accent only does chrome/CTA/chip work and never lands on food; food warmth comes from the Oat ground, the meal-image prompt's baked-in `#C8794E` photography warmth, and the retained honey.

### B — Camel warm-neutral  ·  accent `#B98A4E`  ·  safe fallback
Keep a warm accent but pull all the saturation out — a quiet, dusty, slightly-gold tan (oat / toasted-nut / linen). Most conservative re-skin; lowest cool-food risk; pairs beautifully with Oat + Fraunces.
- Supporting: `#A8742E` Ochre Deep (text/icon), `#6A4B7A` Damson, `#F2E7D6` Camel Soft (tint), `#8A5A14` Deep Ochre (AA text).
- **Weakest distinctiveness** — a muted warm-neutral is the "generic premium wellness" move; says nothing about a purple berry.
- **Forces a build change:** white-on-camel is `2.4:1` (fails even AA-Large) → CTA must use **plum text on camel** (`4.7:1`, AA pass). A distinctive editorial button, but a real change from today's white-on-clay.

### C — Burnt sienna / rust  ·  accent `#9E4624`  ·  lowest disruption
Push clay decisively redder/earthier — out of peach into brick-and-iron-oxide. Carbs/sugar can stay put with minimal hue shift; smallest token migration; excellent for food photography.
- Supporting: `#B5532A` Sienna (fill/arc), `#7A3318` Rust Deep (pressed), `#6A4B7A` Damson, `#F3E0D5` Rust Soft (tint).
- **Moderate-low differentiation** — still fundamentally warm-orange-red, so it stays adjacent to Julienne's lane and faintly rhymes with Paprika's spice-red. Differentiates from clay specifically, not from the warm-orange category. Dilutes the biggest differentiation win.

### D — Frost (the bloom)  ·  accent `#9B8FB0` / `#C9C2D6`  ·  most ownable
Promote the berry's frosted bloom — `#C9C2D6`, already `--border-strong` ("the ownable accent no competitor has") — from passive border to active secondary identity. Dusty-lilac Frost for chrome/dividers/inactive states; `#9B8FB0` where the accent needs more presence; Damson `#6A4B7A` as the white-text-safe CTA fill; Honey for the single warm food note. Whole palette becomes plum + frost + honey, almost entirely **reuse** of existing tokens.
- Supporting: `#C9C2D6` Frost (chrome), `#6A4B7A` Damson (CTA), `#EDEAF1` Frost Mist (tint, existing `--ring-bg`), `#D6A24A` Honey.
- **Tied with A for highest differentiation** — frosted-lilac is genuinely unowned across the entire tracker + recipe lane, and it's the colour the brand was literally designed around. A 3-note system (plum hero + frost identity + damson CTA + honey warmth) that needs design discipline to not feel busy; frost is too soft to carry a CTA, so Damson does that work.

---

## 3. Accessibility notes (CTA white-text vs accent, unless noted)

| Direction | Accent | CTA model | Ratio | Verdict |
|---|---|---|---|---|
| Today (clay) | `#C8794E` | white-on-clay | **3.37:1** | AA-Large only (the floor we're improving on) |
| **A — Berry** | `#8E3B5E` | white-on-mulberry | **4.9:1** | **AA PASS** — strict upgrade; pressed `#5B2E4A` = 7.5:1 |
| B — Camel | `#B98A4E` | white **fails** (2.4:1) → **plum-on-camel** | **4.7:1** | AA PASS, but forces a plum-text button system |
| C — Rust | `#9E4624` | white-on-rust | **4.8:1** | AA PASS — upgrade; Sienna `#B5532A` is fill-only (≈3.9:1) |
| D — Frost | `#9B8FB0`/`#C9C2D6` | frost too light → **white-on-damson** `#6A4B7A` | **6.9:1** | AA PASS; plum-on-frost chip = 6.8:1 PASS |

Three of four directions (**A, C, D**) strictly improve CTA contrast over today's clay. B passes only by switching to plum text. Berry's `#8E3B5E` is the cleanest white-text upgrade.

**Token-migration guardrail (all directions):** clay is load-bearing as `--accent-primary`, `--macro-carbs`, `--macro-sugar`, and the celebration-gradient mid-stop. **Carbs/sugar must NOT inherit a berry/magenta** — too close to destructive red `#C0533F` — so carbs likely stays a warm hue even if the CTA goes berry. This is a design-system-enforcer task, not a find-and-replace.

---

## 4. Recommendation

**Lead with Direction A — Sloe Berry (`#8E3B5E`), keeping plum `#3B2A4D` as the hero, and ship it as a hybrid that retains Honey `#D6A24A` for food-warm micro-moments.**

It is the only option that simultaneously:
1. **Makes the palette literally true to the berry the brand is named after** — the name finally hands you the colour.
2. **Is the most differentiated against the entire competitor set** — nobody owns berry-magenta, and dropping clay removes the single biggest overlap (Julienne's warm-editorial lane + Lose It!'s orange) in one move.
3. **Strictly improves CTA accessibility** — white-on-mulberry `4.9:1` clears full AA normal-text vs clay's `3.37:1` AA-Large-only.

The one real risk — a cool berry cooling food photography — is neutralised *structurally*, not hoped away: the accent never sits on a plate (chrome / CTA / chips / wordmark only), food warmth lives in the Oat ground + the meal-image prompt's baked-in `#C8794E` photography warmth, and **Honey `#D6A24A` is retained** for the food-adjacent moments (best-day star, "room for this" encouragement pill). Plate stays warm, chrome goes on-name, CTA passes AA.

**Fallbacks, ranked:** **D (Frost)** is the differentiation co-leader and the most token-reuse-friendly if Grace wants the softest, calmest register rather than a jewel — it's the same "own the berry" story told quietly instead of with retail punch. **B (Camel)** is the zero-cool-tones-anywhere safe choice but the least distinctive and forces a plum-text button. **C (Rust)** is the lowest-effort path but stays in the crowded warm-orange lane and dilutes the main win — not recommended.

### Before anything ships
- **This is a brand-token / colour-mapping change → it meets the feature-flag bar.** Ship gated, web + mobile in lockstep, with before/after captures on real Today + Recipe + paywall surfaces. Old (clay) path stays alive in the `else`; ramp via PostHog; remove the gate only after the flag holds 100% for two weeks with no regression.
- Route the chosen direction to **design-system-enforcer** for the token-level rewrite (clay is load-bearing — carbs/sugar must stay warm, not move to a berry that reads as destructive red).
- Route to **ui-product-designer** to validate the accent against the approved Figma frames and against real food imagery on the Oat ground.
- **Do not edit live theme tokens until signed off.** This document and the board are exploration artefacts only.

---

## 5. Implementation — flag-gated build (2026-06-07)

Direction D (Frost) is wired behind the feature flag **`brand_frost_secondary`**, web + mobile in lockstep. The flag is **NOT** in `REDESIGN_DEFAULT_ON` on either platform — the old clay path stays the default in the `else`, and the flag ramps later via PostHog (per the gate above). Before/after (flag off vs on) captures owned by Grace.

**Token mapping (the secondary accent only — everything else cascades):**

| Surface | Light (flag on) | Dark (flag on) |
|---|---|---|
| `--accent-primary` (CTA / active fill) | `#6A4B7A` Damson | `#9A7BAA` lifted Damson |
| `--accent-primary-solid` (text/icon/link) | `#54356A` | `#B6ACC6` |
| `--accent-primary-soft` / `-ring` / `--accent-muted` | damson alphas | lifted-damson alphas |
| `--sidebar-ring` | `#6A4B7A` | `#9A7BAA` |
| `--north-star-bg-to` | damson 0.05 | lifted-damson 0.06 |
| `--elev-float-primary` (primary glow) | damson 0.40 | lifted-damson 0.45 |
| `--accent-win-gradient` (mid stop) | plum → **damson** → honey | lifted plum → **lifted damson** → honey |

**Stays clay / unchanged in BOTH flag states (regression-guarded):** `--macro-carbs`, `--macro-sugar`, `--chart-3` (carbs/sugar identity); all status hues (success / warning / destructive / over-budget); honey (`--activity*`); plum nav / wordmark / brand-mark; meal-slot / source / confidence dots.

**Where the flag is read:**
- **Web:** `.flag-frost` overrides in `src/styles/theme.css`; toggled on `<html>` by `src/app/components/FrostFlagToggle.tsx` (mounted in `app/providers.tsx` near `AnalyticsProvider`, covers app + marketing). The `__SUPPR_FORCE_FLAGS__` / `--flags` path flips it for Playwright goldens.
- **Mobile:** `AccentFrost` + `AccentWinGradientFrost` in `apps/mobile/constants/theme.ts`; surfaced via `apps/mobile/context/theme.tsx` (`useAccent()` / `useWinGradient()`). Migrated high-visibility consumers (flag-ON coverage): bottom-tab active tint (`SupprTabBar` + `(tabs)/_layout.tsx`), the win-moment gradient (`WinMomentPlayer`), and the live Today CTA links ("Add food" in `TodayMealsSection`, "Log today" in `TodayPlannedMealsCard`). The long tail of inline `Accent.*` CTAs stays on clay until the flag proves out; the live Log FAB stays plum (`navPrimary`) by design.

**Regression guards:** `apps/mobile/tests/unit/accentTokens.test.ts` (mobile — `AccentFrost`/`AccentWinGradientFrost` keep carbs/sugar/status clay; only the 8 secondary-accent keys move) and `tests/unit/frostFlagTokens.test.ts` (web — `.flag-frost` blocks redefine the right tokens, never carbs/sugar/chart-3, and the flag is absent from `REDESIGN_DEFAULT_ON`).
