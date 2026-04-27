# 2026 competition bar — multi-category scan (2026-04-27)

**Author:** competitor-analyst
**Method:** Cross-category teardown of 30+ consumer apps across nutrition, recipes, creator/discovery, productivity, finance, travel, habits. Evidence is behavioural (specific screen, gesture, transition) not adjectival.
**Audience:** `ui-product-designer`, `ui-critic`, `design-system-enforcer` — this is the standard the rest of the team should audit Suppr against.
**Scope discipline:** every claim names an app + a specific behaviour. Where I'm extrapolating I mark it `[inference]`.

---

## 1. Executive summary — the 2026 bar in 7 bullets

1. **Motion is now the design system.** Best-in-class apps no longer treat motion as polish — it carries hierarchy. Linear's command palette spring, Things 3's slide-out detail panel, Arc's tab-archive sweep, and iOS 17's interruptible animations have made "no motion" read as broken, not minimal. The bar is *interruptible, physics-based, scroll-linked* — not "fade in 200ms".
2. **One spatial model, end-to-end.** Top-tier apps make the user feel like they're navigating one continuous space, not jumping between screens. Arc's command bar, Things 3's "magic plus" anchor, Apple Notes' card-lifts-off-list transition, Airbnb's listing-to-detail shared element. Generic apps cut between unrelated screens; premium apps carry geometry forward.
3. **Empty / loading / error states are first-class surfaces.** Linear's empty inbox is a hand-illustrated dog. Things 3's empty Today is a quiet centred line. Arc shows personality-driven copy in error states. The mediocre tier shows a spinner on a white screen, then a full-page rerender. The bar: no app should ever show a generic spinner on a primary surface.
4. **Calm by default, density on demand.** Cash App, Things 3, Notion Calendar all hide complexity behind a calm primary surface and surface power on a deliberate gesture (long-press, swipe, command-K). MFP and Cronometer are the cautionary tale: 9 numbers above the fold and the user can't find any of them.
5. **Typography is the single biggest premium signal.** Linear (Inter, tightly tracked), Things 3 (custom serif accents, generous line-height), Arc (mixed weight ladder), Notion Calendar (display weight for dates, body weight for events). Generic apps use one weight at one size. Premium apps use a 4–6 step ladder relentlessly.
6. **Personalisation without an admin panel.** Notion Calendar's view-switcher feels like a UI toy, not a settings menu. Things 3 puts almost nothing in Settings — every preference is inline at the moment of use. Spotify's Daylist names itself for you. The bar: Settings pages are an anti-pattern for anything the user touches more than weekly.
7. **Cross-platform parity through metaphor, not pixels.** Linear, Notion, and Cash App feel like one product on iOS / Android / web — not because the pixels match (they don't) but because the *primitives* match: same command-K, same item-card, same empty-state voice. Suppr should aim for metaphor-parity, not pixel-parity.

---

## 2. Category sweep

### Nutrition tracking
- **MacroFactor** — clean typography hierarchy, single accent colour; weekly trend chart on dashboard is the model for "calm with depth on tap."
- **Cal AI / SnapCalorie** — first-run wow: photo → macro estimate in <3s, one tap to log. Onboarding skips the questionnaire on day 1.
- **Lifesum** — illustration system + warm, conversational onboarding (not clinical).
- **Below the bar:** MyFitnessPal (chrome-first, ad-laden, dated), Cronometer (Material 2-era density), Lose It (generic).

### Recipe / cooking
- **Samsung Food (formerly Whisk)** — cohesion: import-from-URL, meal plan, shopping list, pantry feel like one product.
- **Paprika** — content respect: recipes are the hero, chrome recedes. Visual tier feels 2017.
- **Kitchen Stories** — motion: cook-mode auto-advance, scroll-linked image parallax, real landscape mode.
- **Crouton** — tactile interaction: ingredient checkboxes have weight, timers feel physical. iOS-only and that's the point.
- **Below the bar:** BigOven (banner-ad-driven), post-IBM Yummly (design tier collapsed).

### Creator / discovery (TikTok-adjacent)
- **TikTok** — full-bleed content + invisible chrome; UI disappears unless touched.
- **Pinterest** — grid mastery: variable-height cards, predictable tap targets, board-detail shared-element transition.
- **Substack (mobile)** — reader-first: serif body, generous line-height, post-detail feels like a magazine.
- **Beli** (restaurant ranking) — replaced a primitive: pairwise comparison instead of stars. Worth studying.
- **Below the bar:** Instagram (cluttered), Patreon / Ko-fi mobile (web wrappers).

### Productivity (the quiet 2026 reference set)
- **Linear (mobile + web)** — command-K, keyboard-first parity, motion-as-hierarchy. Mobile view-switcher swipe is best-in-class.
- **Things 3** — restraint: 3 colours, 1 typeface family, 1 motion language, complete coverage. The "magic plus" is the most-imitated micro-interaction of the last 5 years.
- **Arc Browser** — personality through motion: tab archive sweep, command-bar physics, opinionated voice.
- **Notion Calendar (formerly Cron)** — weekday density without clutter, natural-language entry, keyboard pattern that translates to mobile.
- **Raycast** (desktop) — extension architecture without exposing seams.

### Finance
- **Cash App** — calm primary (one number, one button, one brand colour) hiding deep functionality behind taps.
- **Revolut** — category breadth without visual fragmentation: stocks, crypto, FX, savings as one app.
- **Monzo** — transaction-detail: pull a row up and get merchant logo, location, category, split, hide — one tap, one sheet.
- **Below the bar:** US bank apps (Chase, BofA) — chrome-first, ad-laden, dated.

### Travel / lifestyle
- **Airbnb** — shared-element transitions (card → detail), photo-first storytelling, bottom-sheet booking.
- **Hopper** — whimsical illustration + price-prediction confidence display.
- **Citymapper** — multi-modal route comparison without clutter.

### Habit / wellness
- **Streaks** (iOS) — restraint: 12-habits cap, beautiful daily rings.
- **Finch** — emotional design: a pet that grows from check-ins; micro-interactions are the product.
- **Calm / Oak** — breathing animations are the entire UI.
- **Below the bar:** Habitica (gamified to noise), most App Store habit-trackers.

---

## 3. Top 10 cross-category patterns to adopt

### 3.1 The interruptible spring
**Pattern:** Animations that respond mid-flight to a new gesture instead of completing then re-animating.
**Exemplar:** iOS 17 system animations, Linear's command-K open/close, Arc's tab archive.
**Why:** Communicates "the system is alive and listens to you." Non-interruptible animations are the single biggest tell of a non-premium app.
**Cost:** Medium. Reanimated 3 + Skia on mobile; Framer Motion on web. Needs a motion-primitive library, not one-offs.
**Suppr applicability:** High. Quick-log sheet, recipe card → detail, planner day-pill swap.

### 3.2 Shared-element / continuous geometry
**Pattern:** Tap a card to open detail and the card morphs into the detail page rather than stack-pushing on top.
**Exemplar:** Airbnb listing → detail, Pinterest pin → detail, Apple Photos thumbnail → fullscreen.
**Why:** Carries the user's spatial model. Stack-pushes feel like "now I'm somewhere else"; shared-element feels like "I'm looking at the same thing more closely."
**Cost:** Medium-high on RN (react-native-shared-element / Reanimated layout). Lower on web (View Transitions API now widely shipped).
**Suppr applicability:** Very high. Recipe card → recipe detail. Meal pill → meal detail. Macro tile → deep-dive.

### 3.3 Calm primary, power on gesture
**Pattern:** Default surface shows 1–3 things; everything else is one deliberate gesture away.
**Exemplar:** Cash App home, Things 3 Today, Notion Calendar.
**Why:** Reduces cognitive load on the surface seen most. Density is available when sought, not forced.
**Cost:** Low (mostly deletion) but politically expensive (people love widgets).
**Suppr applicability:** High. Today screen has been audited toward this; macro-tile / over-budget detail is the test.

### 3.4 First-class empty / loading / error states
**Pattern:** Zero-state and error screens have voice, illustration, and a useful next action — not a spinner or 404.
**Exemplar:** Linear's empty inbox, Things 3's "Nothing to do today", Arc's whimsical 404, Notion's per-database illustrations.
**Why:** These are the moments users judge most harshly. Generic states cost trust disproportionately.
**Cost:** Low per state (illustration + line of copy + CTA), high in volume — a system, not one-offs.
**Suppr applicability:** Very high. Empty Today, planner, pantry, search-no-results, network error are likely spinner-or-blank `[inference]`.

### 3.5 Inline preference instead of Settings
**Pattern:** Every preference lives at the moment of use; Settings is a fallback for low-frequency global toggles.
**Exemplar:** Things 3 (no per-list settings — long-press the list), Notion Calendar (view density inline), Arc (tab pin / archive on the tab).
**Why:** Settings pages are admin panels. Premium apps treat preferences as part of the content surface.
**Cost:** Medium. Requires a long-press / overflow vocabulary that exists everywhere.
**Suppr applicability:** High. Macro target tweaks, meal-plan preferences, household-mode toggles.

### 3.6 Typography ladder, ruthlessly applied
**Pattern:** A 4–6 step type scale (display, title, headline, body, caption, micro) used consistently across every screen.
**Exemplar:** Linear (Inter; 5 steps), Things 3 (mixed serif/sans; 4 steps), Notion (3 steps with discipline).
**Why:** Single biggest premium signal — more impactful than colour or motion. One-weight-one-size apps read as prototypes.
**Cost:** Low to define, high to enforce. Token table + lint.
**Suppr applicability:** Very high. Already implied by prototype carryover rules; enforcement is the open work.

### 3.7 Command-K everywhere (or the mobile equivalent)
**Pattern:** A single global entry point that lets you search, navigate, and act with one keystroke / gesture.
**Exemplar:** Linear, Notion, Raycast, Arc. Mobile equivalent: Spotlight, Things 3 quick-find.
**Why:** Power users discover it; new users don't trip over it. Replaces a thousand menu items.
**Cost:** Medium. Action registry (every navigable screen + actionable verb).
**Suppr applicability:** Medium. Web could ship cheaply (planner, recipes, log). Mobile equivalent is a quick-action sheet on a long-press.

### 3.8 Photo-first, chrome-recedes content
**Pattern:** When content is the point, chrome compresses or disappears; reappears on scroll-up or interaction.
**Exemplar:** Airbnb listing, Pinterest pin, TikTok feed, Apple Music now-playing, Substack reader.
**Why:** Honours the user's reason for being there. Persistent nav bars on a recipe page tell the user the app is more important than the recipe.
**Cost:** Low (layout decision); requires committing to the discipline.
**Suppr applicability:** Very high. Recipe detail is the test case. Currently `[inference]` likely chrome-heavy.

### 3.9 Haptic vocabulary
**Pattern:** A small set of haptics used consistently (light = selection, medium = confirm, heavy = irreversible).
**Exemplar:** Things 3, Streaks, Apple's own apps. iOS 17 systemwide haptic SDK use is now table stakes.
**Cost:** Very low (`expo-haptics` on RN, UIImpactFeedbackGenerator native). Mostly discipline.
**Suppr applicability:** Very high. Quick-log, complete-meal, undo, swipe-to-delete.

### 3.10 Personality in copy
**Pattern:** Microcopy with voice. Not joke-laden, not corporate — distinctively the app's voice.
**Exemplar:** Mailchimp (warm, slightly playful), Linear (terse, confident), Headspace (calm, second-person), Things 3 (almost no copy at all — and that's the voice).
**Why:** Voice is the cheapest premium signal once typography is fixed. Generic apps have no voice; premium apps have one consistent voice across empty states, errors, push, system emails.
**Cost:** Low to define, ongoing to enforce. Voice doc + microcopy review.
**Suppr applicability:** Very high. Suppr's brand has voice opportunity (UK English, food-warm but not twee).

---

## 4. Top 5 cross-category patterns to AVOID

### 4.1 Onboarding gauntlet
**Anti-exemplar:** Noom, MFP Premium funnel, Cal AI's 14-step quiz before any value. Long quizzes that gate the product behind self-reported data the app could infer.
**Why avoid:** D1 retention loss is steep and the data quality is suspect anyway. Industry consensus.

### 4.2 Manipulative streaks
**Anti-exemplar:** Duolingo's streak-shaming, Snap streaks. Streaks that punish absence rather than reward presence.
**Why avoid:** Optimises retention metric, erodes trust. App Store reviews trend negative on this exact axis. Industry consensus on the manipulative variant; plain streaks remain fine.

### 4.3 Skeumorphic / glass-morphism decoration
**Anti-exemplar:** Mid-tier fitness apps with metallic macro rings; the 2024–2025 glass-morphism wave.
**Why avoid:** Reads as fashion in 12 months. My recommendation, not consensus: flat-with-depth ages much better than glass.

### 4.4 Tab bar with 5+ tabs
**Anti-exemplar:** MFP (5 tabs + a centre +), most banking apps. Anything that requires "where do I find X?" thought.
**Why avoid:** Tab bars are spatial-memory devices. >4 tabs and the user pages through. Linear, Cash App, Things 3 all use 3–4.

### 4.5 Settings pages that hide product surface
**Anti-exemplar:** Apps that bury reminders, units, regional formatting, household mode, etc. in nested Settings.
**Why avoid:** Once a preference touches a primary loop more than weekly, it shouldn't live in Settings. Power users can't find it; new users can't discover it.

---

## 5. Screen-to-screen cohesion case studies

### Nail it: Things 3
Every list (Today, Upcoming, Anytime, Someday, project) uses the *same* row template, swipe gestures, long-press menu, magic-plus. The detail panel slides in from the right (iPad) or up from the bottom (iPhone) — same panel everywhere. Settings has almost nothing because preferences are inline. **The trick:** ruthless reuse of one row primitive. Not similar rows — the *same* row.

### Nail it: Linear
Issue cards are the same shape on inbox, projects, cycles, and search results. Hovering shows the same actions everywhere. Command-K is the same anywhere. Status changes use the same animation everywhere. **The trick:** every screen is "the issue list, filtered." One surface with different filters, not different surfaces.

### Nail it: Arc Browser
The command bar is home, search, URL entry, and tab switcher. Tab archive sweep is the same animation as folder archive. Personality-rich error states share voice with splash and changelog. **The trick:** consolidating four mental UI primitives (URL bar, search, tab list, history) into one. Saves cognitive load and reads as innovative.

### Fail: MyFitnessPal
Each tab is a different design era. Diary is Material 1.0 list, Plans is a 2022 redesign with cards, Premium is marketing-team layout, Recipe Discovery is a third style. Tabs cohere as wayfinding; screens don't cohere as a product. **Lesson:** modular tab architecture is fine; modular design language across tabs reads as Frankensteining.

### Fail: Spotify (mobile)
Individual screens are well-crafted, but the navigation model is incoherent. Home shuffles between daylist, podcasts, concerts, audiobooks — feels like a mall. The 2024 podcasts/audiobooks expansion broke the spatial model. **Lesson:** category breadth without a single navigational metaphor reads as bloat. Revolut does this right; Spotify doesn't.

---

## 6. Premium-feel taxonomy — moves scored on impact / ship cost

| Move | Impact | Ship cost | Verdict |
|---|---|---|---|
| 4–6 step typography ladder, enforced | Very high | Low | **Do it first** |
| Empty / loading / error state system | Very high | Medium | **Do it second** |
| Single accent colour discipline | High | Very low | **Do it now** |
| Haptic vocabulary on key actions | High | Very low | **Do it now** |
| Interruptible spring on sheets / detail | High | Medium | Worth scheduling |
| Shared-element card → detail | High | Medium-high | Pick 1–2 priority surfaces |
| Inline-preferences over Settings | High | Medium | Schedule per area |
| Microcopy voice doc | Medium | Low | Do alongside empty states |
| Command-K (web) | Medium | Medium | Schedule for web power tier |
| Long-press action menus | Medium | Low | Add as you build |
| Scroll-linked motion (parallax, sticky reveal) | Medium | Medium | Use sparingly; ages fast |
| Per-screen illustration system | Medium | High | Defer to brand pass |
| Custom typeface (vs system) | Medium | Low | Worth one round of evaluation |
| Glass-morphism / heavy gradients | Low | Medium | **Avoid** |
| Skeumorphic ring / dial visualisations | Low | High | **Avoid** unless central to brand |

**Industry consensus on this table:** the top 4 rows. The rest is my recommendation, weighted by 2026 fashion risk.

---

## 7. The gap for Suppr — 5 highest-leverage moves

(I have not opened Suppr surfaces for this brief; these are inferred from prior memory entries about prototype carryover, Today direction, and onboarding redesign. `ui-product-designer` should verify.)

### 7.1 Ship the empty / loading / error state system
**Why first:** every screen has these states; one good system multiplies across the app. Suppr likely has spinner-on-white in most places `[inference]`.
**Move:** define 6 states (empty, loading, error, offline, no-results, no-permission), each with illustration + voice + CTA. Ship as a `<State>` component with variants.

### 7.2 Lock the typography ladder + enforce it
**Why second:** prototype carryover rules already imply this; enforcement is what's open. Once enforced, the app reads premium even without motion changes.
**Move:** publish 5-step type tokens (display / title / headline / body / caption), lint for ad-hoc font sizes, sweep web + mobile in one pass.

### 7.3 Pick 2 hero transitions and ship them properly
**Why third:** shared-element card → detail on (a) recipe card → recipe detail and (b) meal pill → meal detail. Higher leverage than ten micro-animations.
**Move:** one transition primitive (Reanimated layout on mobile, View Transitions API on web), apply to those two surfaces only, leave the rest stack-pushed.

### 7.4 Ship a haptic + microcopy voice pass
**Why fourth:** very low ship cost, very high premium signal. One designer-week.
**Move:** define 4 haptic moments (select, confirm, success, undo), define 6 voice rules (UK English, second-person, food-warm, not twee, restrained punctuation). Apply across primary loops.

### 7.5 Move 3 settings inline
**Why fifth:** content-surface upgrade disguised as a settings cleanup. Candidates `[inference]`: macro-target tweaks, household mode, meal-plan preferences. Each becomes a long-press or sheet at the moment of use.
**Move:** audit Settings for items used >weekly; move them to natural surface; keep Settings for global, low-frequency state only.

**What I'm explicitly NOT recommending:** full visual rebrand, custom typeface, glass-morphism, an Arc-style command bar (mobile-first product first), or an illustration system. These are second-wave moves once 7.1–7.5 land.

---

## 8. Reference links

- Linear — https://linear.app — design method at https://linear.app/method
- Things 3 — https://culturedcode.com/things
- Arc — https://arc.net
- Notion Calendar — https://notion.com/product/calendar
- Cash App — https://cash.app · Revolut — https://revolut.com · Monzo — https://monzo.com (typography post: https://monzo.com/blog/2017/10/05/typography-at-monzo)
- Airbnb design system — https://airbnb.design/building-a-visual-language
- Pinterest Gestalt — https://gestalt.pinterest.systems
- Samsung Food — https://samsungfood.com · Paprika — https://paprikaapp.com · Kitchen Stories — https://kitchenstories.com · Crouton — https://croutonapp.com
- MacroFactor — https://macrofactorapp.com · Cal AI — https://calai.app
- Streaks — https://streaksapp.com · Finch — https://finchcare.com · Beli — https://beliapp.com
- Hopper — https://hopper.com · Citymapper — https://citymapper.com
- Apple HIG (iOS 17 motion) — https://developer.apple.com/design/human-interface-guidelines
- Material 3 Expressive (May 2025) — https://m3.material.io

---

## 9. Confidence

- **Well-evidenced:** category map, named exemplars, the 7-bullet executive summary, the 10 patterns to adopt, the 5 to avoid. All cite specific behaviours observable on shipping apps as of 2026-04.
- **Inferred but defensible:** the impact/cost scoring in section 6, and the "what ages well" calls in 4.3 / 4.5.
- **Inferred and Suppr-specific:** section 7. I did not audit Suppr surfaces — `ui-critic` and `ui-product-designer` should verify before committing to priority order.
- **Not covered:** Suppr feature gaps (tracking accuracy, recipe import, etc.). Those belong with `product-lead` and `repo-auditor`. This brief is the visual / interaction / cohesion bar only.

---

## 10. How to use this doc

- `ui-product-designer` — sections 3, 6, 7 as the brief for the next design pass.
- `ui-critic` — sections 1, 5, 6 as the rubric when auditing surfaces.
- `design-system-enforcer` — section 6's verdict column as prioritisation order; sections 4 and 7 as the "do not regress" list.
- `product-lead` — section 7 as candidate roadmap input for the next design-tier sprint.
