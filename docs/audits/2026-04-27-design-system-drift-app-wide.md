# Suppr Design System Drift Audit — 2026-04-27

**Owner:** design-system-enforcer specialist (audit)
**Status:** Findings — pending Grace's accept/reject + executor handoff

## Scope

App-wide drift sweep against the Claude Design prototype bundles (`docs/ux/claude-design-bundles/prototype/` + `docs/ux/claude-design-bundles/onboarding/`). Tokens grounded against `src/styles/theme.css` and `apps/mobile/constants/theme.ts`.

Bundle 3 (Suppr Landing) is not yet mirrored in the repo — landing findings are flagged with reduced confidence.

## Executive verdict

**Material drift, concentrated in mobile iconography and a few token-fidelity gaps. Web app is broadly aligned; landing is unverifiable until the bundle mirrors.**

- **Mobile is on Ionicons + MaterialCommunityIcons in every flagship surface** (Today's meals, date header, quick-log strip, library, settings, recipe detail, food search, onboarding, more) where the prototype is lucide-only. This is the single biggest brand-feel drift in the codebase.
- **Tokens are clean** — web theme.css and mobile theme.ts mirror the prototype tokens with documented intentional divergences (mobile OLED `#0a0a0f` bg, mobile card `#16161e`). No hardcoded hex worth flagging at the token level.
- **Web app is largely aligned** — `lucide-react` via `Icons` map, 248px sidebar, prototype-fidelity Today layout, but the gradient is correctly used only on paywall/avatar/marketing surfaces.

---

## Per-surface drift report

### Mobile · Today (`apps/mobile/app/(tabs)/index.tsx` + components)

**Keep:** dashboard macro tiles (`TodayDashboardMacroTiles.tsx:93-110`) — exact lucide port, matches prototype `MacroTile` 2-up grid with overline + value/target + bar + remain caption · `Beef`/`Wheat`/`Droplets`/`Leaf` mapping is byte-for-byte vs `screens-mobile.jsx:131-134`. Dashboard layout pattern (hero → 2x2 macros → meals → insight → suggestion) follows the prototype faithfully.

**Adopt from prototype:**
- Phone-top date overline + title hierarchy is in `TodayDateHeader` but the title sits at 22pt, prototype is 24pt with `letter-spacing: -0.02em` (`app.css:145`). Adopt 24pt and `-0.02em` tracking on the title to land the overline-vs-title size step the prototype rewards.
- 36×36 gradient avatar chip (`app.css:146-152`). Live uses a 32×32 monogram-on-tinted-square (`TodayDateHeader.tsx:171-182`). Adopt the prototype's gradient avatar — this is one of the very few places the brand gradient is sanctioned in product UI.
- "Tap for macros · hold to switch" hint copy + ring tap/hold gestures (prototype `screens-mobile.jsx:212-289`) — `TodayHero.tsx` likely doesn't carry the hold-to-toggle remaining/logged. Verify and adopt if missing.

**Swap in place:**
- `TodayDateHeader.tsx:77,111` `Ionicons name="chevron-back"/"chevron-forward"` → lucide `ChevronLeft`/`ChevronRight`. Prototype-wins.
- `TodayDateHeader.tsx:146,164` `Ionicons name="sunny-outline"/"grid-outline"` for Day/Week toggle → lucide `Sun`/`LayoutGrid`. Prototype-wins.
- `TodayQuickLogStrip.tsx:38-41` `search-outline`/`mic-outline`/`camera-outline`/`scan-outline` → lucide `Search`/`Mic`/`Camera`/`ScanBarcode`. Prototype-wins.
- `TodayQuickLogStrip.tsx:78` `Ionicons name="lock-closed"` → lucide `Lock`. Prototype-wins.
- `TodayMealsSection.tsx:78-83` slot icon map: Breakfast/Lunch/Dinner/Snacks via Ionicons + MaterialCommunityIcons (`cookie-outline`). Prototype uses lucide consistently — `Coffee`/`Sun`/`UtensilsCrossed`/`Cookie` (web Icons map at `src/app/components/ui/icons.ts:31-34` already uses these). Prototype-wins, and this fixes the F-12 dual-family hack.
- `TodayMealsSection.tsx:183,297,336,356,383,438,483,522` Ionicons (`copy-outline`, `add`, `refresh-outline`, `chevron-forward`, `trash-outline`, `bookmark-outline`) → lucide `Copy`, `Plus`, `RotateCw` (or `RefreshCw`), `ChevronRight`, `Trash2`, `Bookmark`. Prototype-wins.

**Justified divergence:**
- 3 hero variants (`HeroRing`/`HeroBar`/`HeroNumber`) match prototype fidelity. No-streak / no-disclaimer per `project_today_screen_direction_apr2026`.

### Mobile · Tab bar (`apps/mobile/app/(tabs)/_layout.tsx`)

**Keep:** lucide tab icons (`Flame`/`Compass`/`BookOpen`/`CalendarDays`/`TrendingUp`/`CircleUser` at `_layout.tsx:6`) — matches the prototype tabbar icon language.

**Adopt from prototype:** the prototype's tabbar uses `backdrop-filter: blur(18px)` with `color-mix(in oklab, var(--bg) 86%, transparent)` and a 1px top border + 10px/600 labels (`app.css:103-124`). Live tabbar at `_layout.tsx:58-69` uses solid `colors.background`, no blur, 9pt labels. Adopt translucent blur + 10pt labels for parity with the prototype.

**Swap in place:** active tint (`Accent.primary`, `_layout.tsx:56`) is correct in dark mode but the prototype lifts to `--primary` which is `#6c8cff` in dark and `#4c6ce0` in light — confirm `Accent.primary` is wired through `useThemeColors` (it appears not — uses static `Accent.primary` regardless of theme). Live-adapts theme should win.

**Justified divergence:** 6-tab structure (Today/Discover/Library/Plan/Progress/More) vs prototype's 5-tab. Documented in the layout comment as a tester-feedback decision (2026-04-26). Stays.

### Mobile · More tab (`apps/mobile/app/(tabs)/more.tsx`)

**Keep:** lucide-only icon imports (lines 7-33) — clean. Settings rows use `IconBox` 36×36 with prototype-matching tints. `SectionHeading` font/weight matches prototype.

**Adopt from prototype:** the prototype's More/Profile screen on `screens-mobile.jsx` shows badge-pro chip pattern + GradientAvatar at top — verify the live header carries them.

**Swap in place:** none flagged from sample — More appears to be the cleanest mobile surface.

### Mobile · Discover (`apps/mobile/app/(tabs)/discover.tsx`)

**Keep:** lucide-only imports at line 21 (`Search`/`Utensils`/`Flame`/`Beef`/`Wheat`/`Droplets`/`Leaf`/`Clock`/`Bookmark`/`LinkIcon`/`ChevronRight`/`ChefHat`). Strong.

**Swap in place:**
- `discover.tsx:60` `SourceBadge` uses hardcoded `#00000066` background and `#fff` text — should be `var(--overlay)` equivalent (`colors.overlay`) and `colors.text` (`#e4e4e8`/dark) to honour the "never pure white text on dark" rule. Token drift.

**Justified divergence:** B5 follow filter, Edamam eating-out row are product features beyond the prototype's discover feed — keep.

### Mobile · Library (`apps/mobile/app/(tabs)/library.tsx`)

**Keep:** macro chip lucide icons (line 19) — `Beef`/`Wheat`/`Droplets`/`Leaf`/`Flame`/`Clock`. Aligned.

**Swap in place:**
- Line 18: `Ionicons` import is unused-or-leaky for chrome (back chevrons, search, etc.). Audit + remove in favour of `ChevronLeft`/`Search` from lucide. Mixed-family rule.

### Mobile · Planner (`apps/mobile/app/(tabs)/planner.tsx`)

**Keep:** lucide-only imports (lines 26-38). Clean.

### Mobile · Recipe detail (`apps/mobile/app/recipe/[id].tsx`)

**Swap in place:**
- Line 22: `Ionicons` is the icon library throughout this screen. Prototype RecipeDetail uses lucide. Library-wide swap to lucide-react-native (`ChefHat`, `Clock`, `Bookmark`, `Share2`, `Copy`, `Heart`, etc.) — all present in the web `Icons` map.

### Mobile · FoodSearchModal (`apps/mobile/components/FoodSearchModal.tsx`)

**Swap in place:**
- Line 15: `Ionicons` for search icons, close, chevrons → lucide. Prototype-wins.

### Mobile · Settings (`apps/mobile/app/(tabs)/settings.tsx`)

**Keep:** lucide-react-native at line 19 (`ChevronRight`/`LogOut`/`Mail`). Clean — the current sample looks aligned.

### Mobile · Onboarding (`apps/mobile/app/onboarding.tsx`)

**Swap in place:**
- Line 19: `Ionicons` is used for the entire onboarding flow's icons (chevrons, checkmarks, info pills, etc.). Onboarding bundle's primitives use SVG-based or lucide-style affordances (`primitives.jsx:130-137` shows custom SVG checks). For carryover-rule consistency, swap to lucide-react-native (`Check`/`ChevronLeft`/`ChevronRight`/`Info`).

**Justified divergence:** 11-step (live STEP_ORDER) vs prototype's 12-step framework — already a documented onboarding-v2 product decision (`project_onboarding_redesign`).

### Web · Today (`src/app/components/NutritionTracker.tsx` + `today-*.tsx`)

**Keep:** `Icons` import map at line 3 — all lucide-react. Single `WifiOff` direct import (line 2) — fine. Today Hero ring/macros split-card layout matches prototype `WebToday` (`screens-web.jsx:120-244`).

**Adopt from prototype:** the right-rail Apple Health card with 4 rows (Steps/Active/Resting/Weight at `screens-web.jsx:217-230`) — confirm `today-steps-card.tsx` carries the same 4-row hierarchy and uses `var(--macro-fat)` for resting burn (subtle macro-tinted icon language, not a redesign).

**Swap in place:** none flagged at the icon level — web is clean.

### Web · Sidebar (`src/app/components/suppr/desktop-sidebar.tsx`)

**Keep:** 248px width, top-pinned brand mark, "Track" + "Recipes" sections, sticky vertical, More pinned to bottom. All matches prototype `WebApp` sidebar (`screens-web.jsx:24-51`).

**Adopt from prototype:** the bottom-pinned Free-tier upgrade card (gradient bg + Upgrade CTA at `screens-web.jsx:41-50`). Live sidebar bottom holds only the More item — it lacks the upgrade card. ADD: free-tier upgrade card (gated on `userTier === "free"`) above the More row using the brand-gradient-tinted card pattern.

### Web · Landing (`app/(landing)/LandingPage.tsx` + `landing.css`)

**Keep:** `lucide-react` icons (line 7-42), tokenised colour vars (`landing.css:9-31`), eyebrow + display heading tokens.

**Adopt from prototype:** Bundle 3 (`Suppr Landing.html`) is not mirrored in the repo (10MB WebFetch limit). Cannot make strong drift claims. **Action:** ask Grace for a fresh bundle export so this surface can be audited against ground truth. Until then, the landing page reads as on-brand given the token discipline.

### Onboarding · Web v2 (`app/onboarding/v2/page.tsx` + `app/components/onboarding-v2/`)

**Keep:** route shipped at 100% rollout, eyebrow + 42pt display title pattern landed (per `project_onboarding_redesign`).

**Adopt from prototype:** verify `app/components/onboarding-v2/web-flow.tsx` uses the mac-chrome frame with URL pill (`onboarding/project/design/web-flow.jsx`). If not, RELAYOUT to add it for parity with the side-by-side mock — but only if Grace wants the chrome frame visible to real users (it might be design-time-only).

**Justified divergence:** "Join the Suppr Club" web copy vs mobile prototype — `project_onboarding_welcome_divergence`. Stays.

---

## The 10 worst drift sites — ranked by impact-on-feel

1. **Mobile icon family chaos** — Ionicons + MaterialCommunityIcons + lucide-react-native co-exist in `TodayMealsSection.tsx:4`, `TodayDateHeader.tsx:3`, `TodayQuickLogStrip.tsx:3`, `FoodSearchModal.tsx:15`, `recipe/[id].tsx:22`, `discover.tsx` (lib only), `library.tsx:18`, `onboarding.tsx:19`. **Swap:** project-wide replace with `lucide-react-native` glyphs (one-to-one per the web Icons map). This is the single highest-impact fix.

2. **Mobile tabbar lacks blur translucency** — `_layout.tsx:58-65` uses solid `colors.background`. **Swap:** wire `BlurView` (`expo-blur`) at intensity ~80 with `tint` matching theme + `borderTopColor: colors.border` + the prototype's 86%-mix overlay.

3. **Date header avatar mismatch** — `TodayDateHeader.tsx:171-182` is a tinted-square monogram, prototype is a 36×36 gradient circle (the only sanctioned brand-gradient use in product UI). **Swap:** replace with `GradientAvatar` (already imported by `more.tsx:35`).

4. **Today title at 22pt vs prototype 24pt** — `TodayDateHeader.tsx:93`. **Swap:** 24pt + `-0.02em` tracking + the prototype's 12px/600 uppercase `letter-spacing: 0.08em` overline (currently 11pt + `letterSpacing: 1`).

5. **Mobile recipe-detail uses Ionicons everywhere** — `recipe/[id].tsx:22`. The recipe surface is the highest-density screen for the user; mixed icon family reads as cheap. **Swap:** lucide-react-native pass.

6. **Web sidebar lacks the gradient upgrade card** — `desktop-sidebar.tsx:106-113` ends at the More row. Prototype includes a free-tier upgrade card pinned bottom (`screens-web.jsx:41-50`). **Add:** gated upgrade card for `userTier === "free"`.

7. **Slot icons split between Ionicons and MaterialCommunityIcons** — `TodayMealsSection.tsx:78-83`. Prototype uses lucide `Coffee`/`Sun`/`UtensilsCrossed`/`Cookie` (web `Icons` map already does). **Swap:** unify on lucide-react-native and remove the SLOT_ICON discriminated union.

8. **Discover `SourceBadge` hardcoded `#00000066` + `#fff`** — `discover.tsx:60`. **Tokenise:** `var(--overlay)` (or theme-token `colors.overlay`) bg, `colors.text` fg.

9. **Quick-log strip lock icon is Ionicons `lock-closed`** — `TodayQuickLogStrip.tsx:78`. **Swap:** lucide `Lock`.

10. **TodayMealsSection delete trail uses raw `#fff` text on `Accent.destructive`** — `TodayMealsSection.tsx:383-385`. The destructive token is fine; the `#fff` text is a literal-hex drift. **Tokenise:** use the destructive-foreground token equivalent (mobile theme should expose `destructiveForeground`); white-on-red is the right contrast but should still come from a token.

---

## Token drift inventory

Cited file:line, grouped by surface.

- `discover.tsx:60` — `backgroundColor: "#00000066"`, `color: "#fff"`. Tokenise to overlay + text tokens.
- `TodayMealsSection.tsx:384-385,484` — `backgroundColor: Accent.destructive`, `color: "#fff"`. Add `destructiveForeground` token to `Colors.{light,dark}` and use it.
- `TodayDateHeader.tsx:148,167` — `color: "#fff"` for active toggle text. Same fix — `colors.primaryForeground` token (currently absent on mobile; web has `--primary-foreground`).
- No hardcoded macro hexes found in the audited mobile components — `MacroColors.*` is consistently used (`TodayDashboardMacroTiles.tsx:93-110`, `MacroRingSmall` accepts colour as prop).
- No hardcoded radii outside the canonical set in audited surfaces. `Radius.lg = 16` and `Radius.sm = 8` are the dominant choices.
- Mobile spacing literal `letterSpacing: 1.1` (`TodayDashboardMacroTiles.tsx:158`) and `letterSpacing: 1` (`TodayDateHeader.tsx:86`) — these are RN's number form for what should be `0.1em`-equivalent. Acceptable because RN ignores `em`. Document the intent rather than tokenise.
- `app/(landing)/landing.css:14,29` — `--lp-page-bg-soft: #f8fafc` and `--lp-fg-secondary: #475569` are duplicated literals from theme.css. Low-impact — landing CSS is a translation layer. Could refactor to `var(--bg-secondary)` / `var(--fg-secondary)` but not a brand drift.
- `landing.css:18-21` — `#0a0a0f` for phone bezel + footer bg. Fine literal — these match the prototype iPhone bezel colour `1a1a22`/`2a2a38` family. Document intent.

---

## Component drift inventory

- **Slot icon discriminated union** (`TodayMealsSection.tsx:74-84`) — exists only because Ionicons doesn't ship a cookie. Once mobile is on lucide, the `SlotIconSpec` union is redundant; collapse to a single `LucideIcon` type.
- **Mobile `IconBox` reimplemented per-screen** — `more.tsx:77`, `discover.tsx:38`. Both 36×36 with `+18` alpha on a colour. **Action:** lift to `apps/mobile/components/ui/IconBox.tsx` (or `apps/mobile/components/primitives/`) so radius (10) + size are tokenised and a single component covers every surface.
- **Today date-header day/week toggle is a one-off** — `TodayDateHeader.tsx:122-170`. Prototype doesn't have an equivalent. Keep for now (product feature) but consider tokenising as a `<SegmentedToggle>` primitive — it'll be reused.
- **Web sidebar upgrade card missing** — see #6 above.
- **Mobile `GradientAvatar` exists** (imported in `more.tsx:35`) but isn't wired into Today's date header. Reuse, don't reimplement.

---

## Cross-platform parity drift

| Intent | Web token / impl | Mobile token / impl | Verdict |
|---|---|---|---|
| Macro icons | lucide `Beef`/`Wheat`/`Droplets`/`Leaf` (web `Icons` map) | lucide-react-native (matched) | Aligned |
| Slot icons (Breakfast/Lunch/Dinner/Snack) | lucide `Coffee`/`Sun`/`UtensilsCrossed`/`Cookie` | Ionicons + MaterialCommunityIcons | **DRIFT** — swap mobile to lucide |
| Chrome icons (chevrons, search, plus) | lucide-react via `Icons` | Ionicons | **DRIFT** — swap mobile to lucide-react-native |
| Macro tile layout | `today-dashboard-macro-tiles.tsx` 4-up | `TodayDashboardMacroTiles.tsx` 2-up | Intentional (mobile narrower viewport) |
| Avatar | gradient circle (web topbar) | tinted-square monogram (Today date header) | **DRIFT** — swap mobile to GradientAvatar |
| Tab/sidebar treatment | 248px sticky sidebar (web) | 6-tab bottom bar, no blur (mobile) | Intentional structure; **drift** = no blur on mobile |
| Free-tier upgrade affordance | none in sidebar bottom | none in More tab | **DRIFT (parity-double)** — both lack the prototype's free-tier upgrade card; add to web sidebar bottom and mirror in mobile More tab |
| Onboarding welcome copy | "Join the Suppr Club" | mobile prototype copy | Intentional divergence (memory) |
| Move-meal | not present on web /planner | `MoveMealSheet.tsx` on mobile | Deferred (memory) |
| Recipe Go Public | `GoPublicDialog` on web | absent on mobile | Intentional (memory) |
| Today over-budget colour | `var(--warning)` | `Accent.warning` | Aligned (carryover #1) |
| Default billing period | `/pricing` defaults monthly | mobile paywall defaults annual | Intentional (memory) |

---

## Where the prototype is wrong for production

Restraint: most prototype patterns are right. Two exceptions worth flagging.

1. **Prototype's `position: "fixed"` `home-indicator` over-rendered** (`app.css:77-83`) — drawing a fake iOS home pill inside a web canvas is design-time chrome. Live web correctly drops it. Confirm `app/onboarding/v2/web-flow.tsx` doesn't render the fake home pill in the production browser path.

2. **Prototype's 12-step onboarding** is reference; live runs 11 steps with a calorie-schedule branch. Decision documented and right for production. Don't enforce 12.

3. **Prototype Today disclaimer** ("Values are estimates… not a medical device") is in the bundle but `project_today_screen_direction_apr2026` says drop it from Today. Don't re-flag the absence as drift.

---

## Justified divergences (do not re-flag — already in memory)

- Onboarding "Join the Suppr Club" web copy (`project_onboarding_welcome_divergence`).
- Recipe Go Public web-only (`project_recipe_go_public_web_only`).
- Move-meal mobile-only (`project_move_meal_web_gap`).
- Pricing default billing period divergence (memory).
- Mobile background `#0a0a0f` vs web `#101014` (mobile theme.ts:115 — OLED-friendly, documented).
- Mobile card `#16161e` vs web `#18181c` (mobile theme.ts:118 — sits on OLED bg, documented).
- 6-tab mobile vs 5-tab prototype (`_layout.tsx:84-94` decision comment).
- 11-step onboarding vs 12-step prototype (`project_onboarding_redesign`).

---

## Top 5 drift sites with one-line Swap recommendation

1. **Mobile lucide-react-native sweep** — Swap: replace every `Ionicons` / `MaterialCommunityIcons` import in `apps/mobile/**` with `lucide-react-native` glyphs from the web `Icons` map (one-to-one). Files: `TodayMealsSection.tsx:4,78-83`, `TodayDateHeader.tsx:3,77,111,146,164`, `TodayQuickLogStrip.tsx:3,38-41,78`, `FoodSearchModal.tsx:15`, `recipe/[id].tsx:22`, `library.tsx:18`, `onboarding.tsx:19`, `discover.tsx` (sub-imports).
2. **Mobile tabbar blur** — Swap: `_layout.tsx:58-65` solid bg → `expo-blur` `BlurView` at intensity ~80 with `color-mix`-equivalent overlay token (mobile theme needs a `tabBarBackground` token added).
3. **Today date-header avatar** — Swap: `TodayDateHeader.tsx:171-182` tinted-square monogram → `<GradientAvatar size={36} />` (already imported in `more.tsx:35`).
4. **Web sidebar free-tier upgrade card** — Add: gated card above More in `desktop-sidebar.tsx:106-113`, gradient-tinted bg per prototype `screens-web.jsx:41-50`. Mirror in mobile More tab for parity.
5. **Discover SourceBadge hex tokens** — Tokenise: `discover.tsx:60` `#00000066` → `colors.overlay`, `#fff` → `colors.text` (or a `colors.onOverlay` if introduced).

---

## Open questions

1. Is the mobile lucide sweep one PR or staged per surface? Mechanical but high-LOC — staged is safer for review.
2. Should the web sidebar free-tier upgrade card open `openUpgradeDialog("sidebar")` or route to `/pricing`? Prototype only shows the CTA, not the destination.
3. Bundle 3 (Suppr Landing) — can Grace re-export it under the 10MB limit so this surface can be audited against ground truth?
