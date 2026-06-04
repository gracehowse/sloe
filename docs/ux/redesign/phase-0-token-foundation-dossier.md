# Phase 0 dossier — Token + font foundation (Sloe)

**Status:** AWAITING GRACE APPROVAL (no code until approved; nothing committed).
**Scope:** Re-skin the *whole* app at once by changing token **values** (not names) + wiring fonts. Touches `src/styles/theme.css`, `apps/mobile/constants/theme.ts`, `app/layout.tsx`, mobile font load, and the token tests. No component/layout changes — those come per-surface later.
**Why first:** every other surface inherits from these tokens. Get this right → the app is never half-migrated.

---

## 1. EXISTING (what's there today)

- **Web** `src/styles/theme.css` — `:root` (light) + `.dark`, ~190 vars, mapped to Tailwind via `@theme inline`. Anchored on a **blue "8-slot lock"** (Red `#F16264` / Magenta `#DF5EBC` / Purple `#9679D9` / Blue `#588CE4` / Green `#56A775` / Lime `#81BE38` / Yellow `#F3C336` / Orange `#F78A32`). Primary = blue.
- **Mobile** `apps/mobile/constants/theme.ts` — `Accent`, `MacroColors`, `SlotColors`, `Colors.light/dark`, `Spacing`, `Radius`, `Type`, `Elevation`. Hand-mirrored to the web hexes.
- **Fonts:** Web = **Inter** only (`next/font/google` → `--font-inter`, `app/layout.tsx`). Mobile = **System font** (San Francisco) — `Fonts.sans = 'System'`, `Type.*` sets no `fontFamily`, no custom font is loaded anywhere. **Newsreader is wired nowhere.**
- **Enforced by tests:** `crossPlatformThemeTokens.test.ts` pins web↔mobile hexes (background, ink, card, border, primary, over-budget, macro-protein/carbs/fat/calories, ring track) **and** the old ring rule ("over budget → destructive red"; "NET over → amber"). Plus `designTokensPhase1`, `settingsMacroTokens`, `slotColorTokensParity`, `calorieRingSolidGreenAtTarget`, `householdMemberAccents`, etc.

## 2. BENCHMARK

Lifesum (warm serif + muted naturals), Bon Appétit / NYT Cooking (editorial serif headlines), Things 3 / Notion (restraint, hairlines). Sloe's plum/clay/sage/amber + Newsreader is already validated across the 44 approved Figma frames — Phase 0 just makes the real app match that.

## 3. PROPOSED — the semantic remap (token **names stay**, values change)

### 3a. Surfaces + ink
| Token | Current light | → Sloe light | Sloe dark |
|---|---|---|---|
| `--background` | `#fbfaf6` | **white `#FFFFFF`** | `#19181C` |
| `--background-secondary` | `#f5f3ec` | `#F6F5F2` | `#232126` |

> **CORRECTION (Grace 2026-06-03):** the page is **white `#FFFFFF`**, not oat. Oat `#FBF8F3` was a dossier-invented "warm page" that appears in none of the actual Figma designs (all white). Reverted in `theme.css` + `theme.ts`.
| `--card` | `#ffffff` | `#FFFFFF` | `#232126` |
| `--card-elevated` | `#fbf8f0` | card `#F6F5F2` | `#2A2730` |
| `--foreground` (ink) | `#1a1714` | **ink `#221B26`** | `#F5F3F4` |
| `--foreground-secondary` | `#5b554b` | ink-soft `#6A6072` | `#B7B2BA` |
| `--foreground-tertiary` | `#8a8377` | ink-faint `#9B93A3` | `#857F8B` |
| `--border` | `#ebe7dc` | **line `#E8E2EC`** | `#35323A` |

### 3b. Action + state (the semantic slots)
| Role (token) | Current | → Sloe light | Sloe dark | Note |
|---|---|---|---|---|
| **Primary / CTA** `--accent-primary` | blue `#588CE4` | **clay `#C8794E`** | `#D58A5E` | the warm "Get the app" terracotta |
| **Chrome / brand** (sidebar, wordmark, nav, ring centre text) | ink/blue | **plum `#3B2A4D`** | `#815E91` | Sloe's signature aubergine |
| **Success** `--accent-success` | green `#56A775` | **sage `#5E7C5A`** | `#83A57E` | |
| **Warning** `--accent-warning` | orange `#F78A32` | **amber `#C9892C`** | `#D6A24A` | |
| **Destructive** `--accent-destructive` | red `#F16264` | **`#C0533F`** | `#DC6B55` | warm brick |
| **Win / celebration** `--accent-win` | purple `#9679D9` | **damson `#6A4B7A`** (+ warm gradient) | `#815E91` | see decision D-3 |
| **Ring empty track** `--ring-bg/-track` | blue tint `#D6E0F5` | **frost-mist `#EDEAF1`** | `#372F44` | |

### 3c. Macros (the ring + tiles)
| Token | Current | → Sloe light | Sloe dark |
|---|---|---|---|
| `--macro-calories` (calorie ring) | green `#56A775` | **plum `#3B2A4D`** | `#815E91` |
| `--macro-protein` | blue `#588CE4` | **olive-sage `#7C8466`** | `#A2AE88` |
| `--macro-carbs` | amber-orange `#E8721E` | **clay `#C8794E`** | `#D58A5E` |
| `--macro-fat` | magenta `#DF5EBC` | **amber `#C9892C`** | `#D6A24A` |
| `--macro-fiber` | green `#56A775` | **teal `#4A7878`** | `#6FA3A3` |

### 3d. Fonts
- **Web:** add **Newsreader** via `next/font/google` (`--font-newsreader`) alongside Inter; add Tailwind `fontFamily.headline/display → Newsreader`, `body/label → Inter`. Apply Newsreader to `h1–h3` + display/ring numerals in `@layer base`.
- **Mobile:** load **Newsreader + Inter** via `expo-font` `useFonts` in `apps/mobile/app/_layout.tsx` (gate splash until loaded); set `fontFamily` on `Type.display/title/headline → Newsreader`, `Type.body/label/caption → Inter`. This is the bigger lift (mobile has no custom fonts today).
- Numeric features (tabular-nums) preserved.

## 4. PRESERVE (must not change)
- **All token NAMES** — callers (`bg-primary`, `Accent.success`, `--macro-fat`, …) keep working; only values move. No mass find-replace in components in Phase 0.
- Spacing, radius ladder, elevation tokens, motion/easing, icon sizes — **unchanged** (already premium; out of scope).
- The **8-slot collapse is intentional**: Sloe is a warm, harmonious 6-hue family, not 8 saturated ones. Distinguishability handled per decision D-4.
- Web↔mobile parity — both sides updated to identical hexes in the same change; parity test stays green (values updated on both + test).
- The `design_system_*` flags exist in the current code as the old re-skin's gates — **the Sloe rollout is flag-free** (your call), so Phase 0 sets the *base* token values directly. (Existing flag branches that hardcode old hexes get cleaned as we hit each surface, not en masse here.)

## 5. DECISIONS FOR YOU (where Sloe's smaller palette forces a choice)

- **D-1 — Calorie ring rule changes.** Old: under = green, over = red, at-target = solid green (pinned by `calorieRingSolidGreenAtTarget.test.ts`). **Sloe: under = plum arc, over = full plum + red overage** (the locked ring rule you approved). I'll rewrite those ring assertions. ✅ already implied by "Sloe ring wins."
- **D-2 — Over-budget colour = red, not amber.** Today the over-budget *stat/NET* uses amber to stay distinct from fat (magenta). In Sloe, **fat = amber**, so over-budget moves to **red `#C0533F`** (matches your S6 prototype "−140 over" in red). This frees amber to mean fat + (rare) warnings. Recommend: **yes, over-budget = red.**
- **D-3 — Win/celebration colour.** Current win = a blue→purple→magenta brand-spectrum gradient. Sloe equivalent: persistent win = **damson `#6A4B7A`**; celebration moment = a warm **plum → clay → amber** gradient (Sloe's own colours). Alternatively keep it purely in the purple family (plum → damson → frost). *Recommend warm plum→clay→amber* (more ownable, ties to the brandmark). — pick one.
- **D-4 — Meal-slots / source-dots / charts need distinct hues from a smaller palette.** Proposed: meal slots breakfast = amber, lunch = sage, dinner = damson, snack = teal; source dots USDA = sage, OFF = teal, FatSecret = amber, Manual = grey, AI = damson; charts reuse the macro hues. I'll validate these render as distinguishable with `design-system-enforcer` during implementation (rendered, not on paper).

## 6. RISKS (top 3) + mitigation
1. **Contrast regressions** — clay/amber/sage on white/oat must clear WCAG AA (4.5:1 text, 3:1 UI). *Mitigation:* run the existing `contrast-audit` Playwright sweep + getComputedStyle after, before claiming done (per the root-cause-the-class memory). Some hues may need a `-solid` darker variant for text-on-white (clay `#C8794E` is ~2.9:1 on white → needs a darker `--accent-primary-solid` for text/icons, like blue does today).
2. **Parity test churn** — `crossPlatformThemeTokens.test.ts` + ~6 others assert specific hue families (e.g. `macro-fat === Accent.magenta`). *Mitigation:* update both platforms + the tests in the same change; re-run `npm run ci` (web+mobile vitest) locally before showing you.
3. **Mobile font load** — adding `useFonts` gates the splash; a missing/!loaded font flashes System or blanks. *Mitigation:* keep System as the fallback in the font stack, gate render on `fontsLoaded`, test cold-start in the sim before claiming done.

## 7. ALTERNATIVES considered
- **A. Flag-gated dual-palette** (old + Sloe behind `design_system_colours`). *Rejected* — you ruled flags out; flag-free direct-to-dev with the review gate as the net.
- **B. Single shared token source generating both files.** *Tempting* (kills the hand-mirror drift) but it's an infra refactor that expands Phase 0's blast radius. *Deferred* — author Sloe into both files now; propose the generator as a separate Platform-foundations task.
- **C. Values-only, names-kept (CHOSEN).** Lowest blast radius, no component edits, parity preserved, reversible.

## 8. CONFIDENCE: 8/10
High on the surface/ink/macro/primary mapping (palette is already approved across 44 frames). Lower on (a) the exact contrast-safe *text* variants of clay/amber (will tune against the audit), and (b) the mobile font-load cold-start. Both are validated empirically (render → screenshot → audit) before I call Phase 0 done.

## 9. PLAN once approved
1. Web `theme.css` values + Newsreader wiring → `next build` + contrast audit.
2. Mobile `theme.ts` values + `useFonts` Newsreader/Inter → sim cold-start render.
3. Update the token tests (parity + ring rule) → `npm run ci` green locally.
4. Render Today on iOS + web, screenshot, diff vs the Figma Today frame, `design-system-enforcer` pass.
5. Show you before/after on both platforms. **Stop. No commit until you approve.**
