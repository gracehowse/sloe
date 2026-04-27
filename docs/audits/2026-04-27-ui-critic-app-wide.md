# Suppr UI Critic — App-Wide Design Audit (2026-04-27)

**Owner:** ui-critic specialist (audit)
**Status:** Findings — pending Grace's accept/reject + executor handoff

---

## 1. Executive verdict

**Suppr is hovering at "Polished" overall — high craft on a handful of marquee surfaces (mobile Discover, mobile More, landing page, Today macro tiles), but dragged down to the prototype/generic edge by long-form data screens (Today hero stack, Progress, mobile Settings, mobile Onboarding) where component pile-up has outrun the design system.**

- **The mobile prototype port is uneven.** Discover, Library, More, and the macro tiles are paste-level fidelity to the Claude Design language and feel premium. Onboarding (legacy), Settings, Progress, the Today hero stack, Cook, and Burn-detail still wear the older 2025 RN-paper look — same product, two design vocabularies on the same device.
- **Web is a marketing site bolted to a frankensteined app.** The landing page is a legitimate flagship-tier marketing surface (custom CSS namespace, hero gradient, phone mock with proper bezel, dark-mode considered, premium type scale). The product surfaces behind it (DiscoverFeed, MealPlanner, NutritionTracker) are functional but read as "Notion-meets-Tailwind admin" — competent, not flagship.
- **Edge states are designed everywhere they're noticed and forgotten everywhere they aren't.** Library has a real empty state with two CTAs. Burn-detail has tiered loading/error/empty (recently fixed). Cook mode has a fallback. But Today's `loadError`, Verify's loading, Shopping's empty, Settings' load failure, and most modals still fall back to spinners or one-line strings. This is the single biggest tier-blocker app-wide.

---

## 2. Per-surface audit

### Mobile — Onboarding (`apps/mobile/app/onboarding.tsx`)
**Verdict: Prototype.** This is the legacy flow — Phase 2 v2 is at 100% rollout but the legacy file is still the screen for users who hit the route before the flag resolves (sync gate at line 277).

Tells:
1. Step content centre-justified on a flat white background, no surface elevation, no progress halo around the thin 4px green progress bar (line 492). Reads as a wizard from 2018, not a 2026 flagship.
2. The "RECOMMENDED / AVAILABLE / CHALLENGING / NOT RECOMMENDED" pill (line 804) with `letterSpacing: 1` and `#fff` on solid green/amber/red is the visual register of a debug overlay, not a calibrated plan badge.
3. Plan-pace cards are paged horizontally (line 801) but there are no page indicators — user has no idea there are 3 more cards beyond the first. Flagship-tier flows (Headspace, Whoop, Cal AI) put dot indicators or a swipeable visual cue here.
4. The `budgetNumber` 48-pt 900-weight number (line 551) is paired with 16-pt grey "calories per day" — proportions feel like a calculator, not a moment.
5. Sex selector "Prefer not to say" (line 660) breaks across two lines with `\n` and 12-pt text in the middle of an otherwise 15-pt 600-weight row — a layout escape hatch, not a designed treatment.

Upgrades (ranked):
1. Replace the flat progress bar with a stepper that shows `Step 4 of 11` numerically next to a thicker 6px primary-toned bar with a soft glow on the head. Tier: Prototype → Polished.
2. Plan-pace pager: add 4 dot indicators below the cards + a faint peek-of-next-card on the right edge. Tier: Prototype → Polished.
3. Budget reveal step: animate the number in (count-up from `tdee`), wrap it in a soft glow, and drop the restaurant icon for a calmer custom mark or no icon. Tier: Polished → Premium.
4. Sex row: drop the cramped 3-up grid; use a single "Biological sex (used for BMR)" disclosure → segmented control with proper `Female / Male / Prefer not to say` tokens at equal weight. Tier: Prototype → Polished.
5. Add a "How we calculate this" disclosure on the budget step. Tier: Polished → Premium.

### Mobile — Today (`apps/mobile/app/(tabs)/index.tsx`)
**Verdict: Polished.** The screen is a *stack of 9+ cards*. It doesn't read as one composed surface; it reads as a feature-flag feed.

Tells:
1. Hero card → adherence bar → quick-log strip → 2x2 macro tiles → activity card → fasting pill → eat-again banner → planned meals card → meals section → hydration card → activity bonus → date header. There is no governing rhythm. Each card has its own padding (Spacing.lg vs Spacing.xl vs hand-rolled 14), border treatment, and corner radius mix.
2. The hero is intentionally minimal (per `feedback_no_duplicate_today_hero_content`) — but the *minimal* state still shows the ring + macro inner rings + remaining/consumed toggle + variant picker affordance in the corner. That's three controls on a hero that's meant to be quiet.
3. `TodayDashboardMacroTiles` uses lucide icons (Beef, Wheat, Droplets, Leaf) at premium tier — but `TodayMealsSection` still uses Ionicons "cafe-outline" for breakfast (line 79) with a MaterialCommunityIcons fallback for cookie. Mixed icon library on the same screen reads cheap.
4. Source labels like "OFF · adjusted" / "Open Food Facts" / "USDA" (lines 192–198) appear under meal rows in a tiny tertiary-text format — competent but feels admin-grade.
5. The screen renders inside a plain `ScrollView` (line 1071 onwards) — no parallaxing of the date header, no sticky condensed hero, no `LargeTitle`-style animation.

Upgrades:
1. Unify the card system: every card on Today gets the same `borderRadius: 14`, `borderWidth: 1`, `borderColor: cardBorder`, `padding: 14`. Tier: Polished → Premium.
2. Migrate `TodayMealsSection` slot icons to lucide (`Coffee, Sun, UtensilsCrossed, Cookie`) so Today and Plan match. Tier: Polished → Premium.
3. Sticky condensed hero: when the user scrolls past the hero, fade in a 44pt header with `Today · 1,847/2,200`. Tier: Polished → Premium.
4. Source labels become coloured 1ch dots (USDA = green, OFF = blue, manual = grey). Tier: Polished → Premium.
5. Order discipline: hero → meals → macro tiles → activity is a defensible default order. Hydration / fasting / eat-again should collapse into a single "today's snapshot" row. Tier: Polished → Premium.

### Mobile — Discover (`apps/mobile/app/(tabs)/discover.tsx`)
**Verdict: Premium.** This is the strongest tab in the app.

Tells (positive):
1. BROWSE overline + 28pt -0.6 letter-spacing "Discover" title (lines 488–493) is exactly the prototype treatment.
2. Search bar uses `colors.card` background, 1px border, 14pt placeholder — calm, intentional.
3. Filter pills (line 521) with active state `accent + "10"` background and `accent` border — restrained and confident.
4. Hero card: 16:10 image, fallback gradient band when no image (line 294 — collapses to `aspectRatio: 8` so image-less rows don't dominate).
5. Each macro has its own coloured icon + tabular-nums value (lines 361–393).
6. Eating-out row is debounced 350ms, brand-uppercase, secondary-tinted.
7. Empty states have icons + maxWidth-clamped subtext + "Pull down to refresh" microcopy (line 619).

Tells (residual):
1. The "From your sources" Import + Library CTAs use the same icon-box + 13/11 two-line label + chevron pattern as five other surfaces.
2. Loading state is a centred ActivityIndicator + "Loading recipes..." at line 615. Feed-style apps use 2–3 skeleton cards.

Upgrades:
1. Skeleton cards on first load instead of spinner. Tier: Premium → Premium-flagship.
2. Add platform glyphs (Instagram, TikTok, paste) inline on the Import CTA. Tier: Premium → Premium-flagship.
3. Sticky-on-scroll filter pills with a subtle backdrop blur. Tier: Premium → Premium-flagship.

### Mobile — Library (`apps/mobile/app/(tabs)/library.tsx`)
**Verdict: Polished, almost Premium.**

Tells:
1. Header is `Library` + `{n} recipes · {n} saved` subtitle in tabular-nums (line 439).
2. Card uses 128px hero image + body padding + per-macro icon row matching Discover.
3. Sort cycle button is one-tap toggle (Recent → Calories → Protein) — efficient but doesn't telegraph what it'll cycle to.
4. Long-press to delete is correct (P2-32, 2026-04-25) — but there is no visible affordance hinting that long-press exists.
5. `cardGradient` is a 0-height passthrough (line 270) — leftover machinery.

Upgrades:
1. Sort control: replace the cycle button with a small dropdown menu (`Sort: Recent ▾`). Tier: Polished → Premium.
2. Long-press affordance: scale-down 0.97 + small "Hold to remove" toast at 120ms. Tier: Polished → Premium.
3. Empty state could carry a single sample card with a "Try saving this" pointer. Tier: Polished → Premium.

### Mobile — Plan (`apps/mobile/app/(tabs)/planner.tsx`, head only read)
**Verdict: Polished.** Strong icon system (lucide Coffee/Sun/UtensilsCrossed/Cookie at line 153 with a slot-colour map line 161). Smart day plan rendering with leftover handling (lines 64–75).

Tells:
1. Header treatment (offset above day cards) was migrated to prototype style — premium.
2. Move-meal sheet and templates sheet are both implemented (mobile-only).
3. The `snapDisplayMultiplier` (line 209) is a render-only correctness fix — defensible.

Upgrades:
1. Day cards likely need the same prototype port treatment as Library cards. Tier: Polished → Premium.
2. The 1/3/7 day toggle at the top doubles up with the start-offset toggle. Consider a single segmented control. Tier: Polished → Premium.

### Mobile — Progress (`apps/mobile/app/(tabs)/progress.tsx`, head only read)
**Verdict: Prototype edge of Polished.** Second-worst tab in the app, redesign already in flight per `project_progress_direction`.

Tells:
1. Range pills (`7d / 30d / 90d / All`, line 241) drive only the headline label — most cards still use their own scoped windows.
2. The screen has 6+ cards stacked: stat grid → weekly recap → daily calories chart → maintenance card → weight journey → digest → health card → steps. No governing rhythm.
3. Loading is gated by `chartsReady` (line 210) — useful, but the user sees a flash from skeleton → real chart with no transition.
4. Steps card has a tri-state sync status (lines 222–229) — design-system-grade thinking, but exposed as text rather than a glyph.

Upgrades:
1. Honour `project_progress_direction` Apr 2026: lead with a single "Closest to target" headline, then 3 supporting cards. Tier: Prototype edge → Polished.
2. Range pill drives every card on the screen. Tier: Polished → Premium.
3. Weight chart and calorie chart get the same axis treatment. Tier: Polished → Premium.

### Mobile — Settings (`apps/mobile/app/(tabs)/settings.tsx`, head only read)
**Verdict: Generic.** This screen is shipping technical correctness but reads as a Supabase admin form.

Tells:
1. Sectioned card with `borderBottomWidth: hairlineWidth` rows (lines 139–150) — competent stock RN.
2. Section titles are 13pt 700 with letterSpacing 1 uppercase — every section heading is the same colour with no hierarchy.
3. The `segmentedRow` (line 160) for theme picker is plain — no animated highlight on selection.
4. Per `project_delete_account_flow_exists`, the delete-account flow is wired but lives behind the More tab's reset modal — Settings has no link to it.

Upgrades:
1. Adopt the More tab's `IconBox + label + sub` row pattern for Settings rows. Tier: Generic → Polished.
2. Theme picker: animate the segment highlight with a `transform: translateX` spring. Tier: Generic → Polished.
3. Either consolidate Settings into More, or split More's items into Settings to give the two screens distinct roles. Tier: Generic → Polished.

### Mobile — More (`apps/mobile/app/(tabs)/more.tsx`)
**Verdict: Premium.** Second-most-confident screen in the app after Discover.

Tells:
1. ACCOUNT overline + "More" title + circular avatar top-right (lines 549–574) — exact prototype.
2. Profile card with gradient avatar + name + tier badge in a tinted pill (lines 580–619).
3. Recipes/Streak two-tile stat row replaces the previous 3-tile with the rejected "Score" — design memory is being applied (line 627).
4. SettingsRow (line 110) is a designed primitive: 36×36 IconBox + 13/11 two-line label + chevron + optional badge.
5. Section headings + cards have a clear rhythm.
6. Reset modal (line 922) has an icon-tinted header + 3 destructive buttons in escalating commitment (Reset → Erase → Delete account).
7. Build stamp (line 885) is a subtle but real piece of polish.
8. Caffeine and alcohol target sheets quote EFSA + FDA (line 1130), region-aware.

Tells (residual):
1. The profile card → stat row → membership card sequence is 3 different card systems on the same screen.
2. Build-stamp `MARKER F50-2026-04-22` is dev shorthand; production polish would render `Build 1.0 · 42 (2026-04-22)`.

Upgrades:
1. Card-padding harmonisation pass (1 hour). Tier: Premium → Premium-flagship.
2. Build stamp formatting (5 min). Tier: Premium → Premium-flagship.
3. Membership card on Free tier: trial-style copy + "From £2.50/mo" reference. Tier: Premium → Premium-flagship.

### Mobile — Recipe Detail (`apps/mobile/app/recipe/[id].tsx`, head only read)
**Verdict: Polished.** Custom SVG macro ring (line 165), ingredients support overrides via `effectiveMacros / hasOverride / recomputeRecipeTotals` (line 47), allergens list, source/creator byline, save toggle, share, cook mode, log-as-meal — all wired.

Upgrades:
1. Verified-source pill near the macros (1 day). Tier: Polished → Premium.
2. Ring stroke 4 at size 56 (5 min). Tier: Polished → Premium.

### Mobile — Cook (`apps/mobile/app/cook.tsx`, head only)
**Verdict: Polished.** Single-step focus, large 17pt step text, step counter, Menlo-monospaced 38pt timer (line 169), animated progress bar (line 76), keep-awake (line 29).

Tells:
1. Timer is a count-up stopwatch with no target — flagship cook modes have parsed step durations.
2. `headerExit` is a destructive-coloured "Exit" text button (line 127). Premium flagship would use a chevron-down close glyph.
3. Progress bar is 3px high (line 130) — flagship apps use 4–6px.

Upgrades:
1. Parse step durations on mobile too. Tier: Polished → Premium.
2. Replace destructive "Exit" with a close-chevron icon. Tier: Polished → Premium.

### Mobile — Paywall (`apps/mobile/app/paywall.tsx`, head only)
**Verdict: Polished, edge of Premium.** `PRICING_TIERS` SSOT (line 40), regional-aware via RC `priceString` (line 47), Pro-flavoured vs neutral context branching (line 152), trial timeline with proper icons (line 90).

Upgrades:
1. Trust footer line: "Cancel anytime · Apple-secured payment · Try free for 7 days". Tier: Polished → Premium.
2. Animated tick-list reveal on mount (200ms staggered). Tier: Polished → Premium.

### Web — Landing page (`app/page.tsx` → `LandingPage.tsx`)
**Verdict: Premium.** Strongest surface in the entire codebase.

Tells:
1. `landing.css` is properly tokenised — `.lp-` namespace, dark-mode considered, elevation shadow, backdrop-filter on nav.
2. Hero has a 2-column grid with `clamp(40px, 6.2vw, 72px)` display heading and a dual-radial-gradient background.
3. Phone mock has a real bezel (`44px` radius, `padding: 10px`), notch, screen aspect ratio `9 / 19.5`.
4. Theme toggle is a real custom 3-state segmented control with shadows on the active state.
5. Pricing/Roadmap/FAQ sections all read from a single SSOT.

Upgrades:
1. Add a third subtle highlight gradient on the hero. Tier: Premium → Premium-flagship.
2. Phone mock parallax on scroll. Tier: Premium → Premium-flagship.
3. Sticky-on-scroll CTA bar with a faint blur backdrop. Tier: Premium → Premium-flagship.

### Web — Library / Paywall (path-not-found)
Web Library is not at `LibraryView.tsx`; web Paywall is not at `PaywallModal.tsx`. Route to `repo-auditor` to confirm canonical paths.

---

## 3. Cross-cutting patterns of weakness

1. **Two design vocabularies on the same device.** Prototype-port screens use lucide-react-native + `IconBox` + 14pt 700 section headers + `cardBorder` 1px + 14px radius. Pre-port screens still use Ionicons + flat rows + `colors.border` + 12px radius.
2. **Edge states are uneven.** Burn-detail, Library, Discover got tiered loading/error/empty after explicit feedback rounds. Today's `loadError`, Verify's loading, Settings' `setError`, Shopping's empty are still spinner-or-string.
3. **Ionicons, lucide-react-native, MaterialCommunityIcons, and `@expo/vector-icons` all coexist.**
4. **Token usage is inconsistent.** `Spacing.xl` (24) shows up next to literal `14` and literal `Spacing.lg` (16) on the same screen.
5. **No motion language.** Apart from the onboarding step transition and the cook progress bar, the app has no motion vocabulary.
6. **Source/provenance hidden in tertiary text.** Trust signals live in 11pt grey at the bottom of meal rows.
7. **Two-toggle screens (Today week-mode/calorie-display, Plan days/start, Library sort).** Each individually defensible; together they create a "this app has settings everywhere" feel.
8. **Modals are bottom-sheets with no animation polish.**
9. **"Free / Base / Pro" tier copy is inconsistent.**
10. **CTA copy reads as a developer wrote it.** "Get Started", "Continue", "Save", "Cancel" everywhere.

---

## 4. Cross-cutting patterns of strength

1. **Prototype-port discipline is real and showing results.** Discover, Library, More, Today macro tiles, Plan icons match the 2026-04-19 Claude Design prototype.
2. **Web ↔ mobile parity is enforced architecturally.** Shared helpers prevent display drift.
3. **Provenance is technically correct everywhere.** USDA / OFF / FatSecret / AI source labels propagate.
4. **Tabular-nums on every number that matters.**
5. **Memo-led component design.**
6. **Documented design decisions in code.** Sibling-of-the-product comment blocks.
7. **Microcopy on Burn-detail empty states is genuinely good.**
8. **Region-aware substantiation.**
9. **Landing page is genuinely premium.**
10. **"Score doesn't mean anything" was removed twice.** Designers who can kill their own work are flagship-grade.

---

## 5. Top 15 highest-leverage upgrades app-wide

Ranked by impact-per-effort. "Effort" is engineering-days estimated.

1. **Icon-library consolidation pass.** Migrate every Ionicons / MCI usage to lucide-react-native. Effort: 1 day. Impact: every screen lifts a quarter-tier.
2. **Universal "Suppr card" primitive.** `&lt;SupprCard&gt;` codifies prototype card. Effort: 0.5 days. Impact: every screen lifts a quarter-tier.
3. **Skeleton states for the 4 highest-traffic surfaces.** Today, Discover, Library, Progress. Effort: 1 day.
4. **Settings ↔ More consolidation.** Effort: 1 day. Impact: Settings moves Generic→Polished.
5. **Provenance pill system.** USDA = green dot, OFF = blue dot, manual = grey dot, AI = sparkle, FatSecret = orange. Effort: 0.5 days.
6. **Onboarding stepper redesign.** Numbered "Step 4 of 11" + thicker progress bar. Effort: 0.5 days.
7. **Plan-pace pager with dot indicators.** Effort: 0.5 days.
8. **Today stack discipline pass.** Effort: 1.5 days. Impact: Today moves Polished→Premium.
9. **Sticky condensed header on Today + Discover.** Effort: 1 day.
10. **Long-press affordance hint on Library cards.** Effort: 0.5 days.
11. **Animated macro fills on log.** Effort: 0.5 days.
12. **Trust footer on Paywall.** Effort: 5 min. Impact: conversion lift expected.
13. **Build-stamp formatting cleanup.** Effort: 5 min.
14. **CTA voice pass.** Effort: 0.5 days. Impact: app-wide tier lift.
15. **Confirm web Library + Web Paywall component paths.** Effort: 0.5 days.

---

## 6. The 5 surfaces dragging the whole product down

In priority order:

1. **Mobile Onboarding (legacy).** Ship a real mobile `/onboarding-v2` mirror of the web flow, then deprecate this file.
2. **Mobile Settings.** Rebuild with the More-tab `SettingsRow` primitive + IconBox, or fold unique items into More.
3. **Mobile Progress.** Ship "Closest to target" headline + 3 supporting cards per the April direction doc; defer the rest.
4. **Mobile Today hero stack.** Universal Suppr card primitive + consolidate hydration/fasting/eat-again into a single conditional "today's snapshot" row.
5. **Mobile Cook.** Chevron-down close glyph instead of "Exit"; parse step durations server-side and switch mobile timer to countdown.

---

## 7. Open questions for ui-product-designer

1. Should mobile onboarding ship a route called `/onboarding-v2` mirroring the web flow exactly, or should the v1 file be evolved in place?
2. Universal `<SupprCard>` primitive — what's the exact set of variants needed (`default`, `accent`, `destructive`, `tinted`)?
3. Provenance pill colour assignments — does brand approve USDA=green / OFF=blue / manual=grey / AI=sparkle / FatSecret=orange?
4. Today screen "snapshot row" consolidation — what's the priority order for which extra (hydration/fasting/eat-again/activity-bonus) wins when several are populated?
5. The web Library and web PaywallModal component paths in the brief don't resolve to files — please confirm with `repo-auditor` whether they were renamed or removed.
