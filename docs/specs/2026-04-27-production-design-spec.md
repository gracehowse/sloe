# Suppr production design spec — 2026-04-27

**Status:** Production design source-of-truth. Implementation is binding against this doc.
**Owner:** ui-product-designer (this spec) → executor (build) → visual-qa (verify) → sync-enforcer (parity)
**Authority:** ratifies and extends `docs/decisions/2026-04-27-strategic-direction.md` (17 binding decisions) and the locked structural mockup at `docs/specs/2026-04-27-whole-app-visual-review.html`.
**Scope:** motion, typography, depth, dark mode, iconography, source/provenance, CTA voice, accessibility, then per-surface production design across native iOS / mobile web / desktop web for 8 surfaces, and an implementation-handoff sequencing plan.
**Non-goals:** the structure (locked), creator/social (deferred D-2026-04-27-01), cook-mode beyond the existing freeze (D-2026-04-27-09), shoppable commerce (D-2026-04-27-10), Android Health Connect / Strava / Watch / iOS widget (out-of-scope per strategic doc).

---

## Part 1 — Design language (foundation)

### 1.1 Motion language

Suppr's motion vocabulary is the design system, not polish. Every motion call below maps to a token. Implementation primitives: `react-native-reanimated@^3` + `react-native-gesture-handler` on mobile, `framer-motion@^11` + the View Transitions API on web. No bespoke animations outside this vocabulary.

**Easing tokens (extend existing `--pm-ease` family in `theme.css`):**

| Token | Curve | Use |
|---|---|---|
| `--ease-pm` (existing) `cubic-bezier(0.22, 1, 0.36, 1)` | snappy-in, gentle-out | default for any state change |
| `--ease-spring-soft` `[0.34, 1.56, 0.64, 1]` (CSS approximation; on RN use `withSpring({ damping: 18, stiffness: 220, mass: 0.9 })`) | gentle overshoot | sheet present, confirm-success |
| `--ease-spring-snap` (RN: `withSpring({ damping: 22, stiffness: 320 })`) | crisp settle | tab switch, segmented control thumb |
| `--ease-decel` `cubic-bezier(0.05, 0.7, 0.1, 1)` | iOS standard out | dismiss, fade-out |

**Duration tokens (extend existing):**

| Token | Value | Use |
|---|---|---|
| `--pm-duration-sm` (existing) | 120ms | hover, micro-state |
| `--pm-duration` (existing) | 150ms | default transition |
| `--pm-duration-md` (existing) | 250ms | sheet drag, page slide |
| `--pm-duration-lg` (existing) | 350ms | shared element, hero reveal |

**Tab switch.** Mobile: cross-fade 120ms (`--pm-duration-sm` + `--ease-pm`) — no horizontal slide; tabs are not a swipeable carousel. Web sidebar: route content cross-fades 150ms; sidebar item active background tweens with `--ease-spring-snap`. Reduce-motion fallback: opacity-only crossfade, identical timing.

**Sheet present / dismiss.** Single primitive `<LogSheet>` and any future modal sheets share this config:
- Mobile (gorhom-bottom-sheet): `snapPoints = ['50%', '92%']`. Initial snap = 1 (92%) for the canonical Log sheet because logging needs vertical room; recipe-options sheets snap to 0 (50%) by default. Backdrop: opacity 0 → 0.4 over 200ms with `appearsOnIndex={0}`, `disappearsOnIndex={-1}`. `enablePanDownToClose: true`. `handleIndicatorStyle: { width: 36, height: 4, borderRadius: 2, backgroundColor: <muted> }`.
- Web (vaul): `snapPoints={[0.5, 0.92]}`, `dismissible`, `shouldScaleBackground` true. Backdrop blur 12px + black/40 over 200ms. Drag handle identical to mobile.
- Both: present uses `--ease-spring-soft`; dismiss uses `--ease-decel`. Both interruptible — re-trigger mid-flight reverses without restart (Reanimated `withSpring` natively; framer-motion `layout` + `animate`).

**Shared-element transitions.** Two priority surfaces (D-2026-04-27-04 makes recipe → detail the demo moment).
1. **Recipe card → Recipe detail.** The card image and title are continuous geometry. Mobile: `react-native-reanimated` shared-tag animation on the image (`sharedTransitionTag="recipe-{id}-image"`) and title (`-title`). Image grows from 16:10 thumb to 16:9 hero (200pt mobile / 380px desktop). Macro chip row fades out (image is the focal point now). Duration 350ms (`--pm-duration-lg`) with `--ease-pm`. Web: `view-transition-name: recipe-{id}-image` + `recipe-{id}-title` on both surfaces. Reduce-motion: skip the morph; cross-fade screens 150ms.
2. **Meal row → Meal edit sheet.** Tapping a logged meal row opens the edit sheet. The thumb (40×40) carries forward and grows to 56×56 in the sheet header; the row title carries forward and gains the source dot. 250ms (`--pm-duration-md`).

**Scroll-linked.**
- Today date header (mobile + mobile web): scroll Y > 64 → fade in a 44pt sticky header with "Mon 27 Apr · 553 left" tabular-nums. Implementation: Reanimated `useScrollViewOffset` + `interpolate` on opacity + translateY. The streak pip rides the sticky header at 11pt. Reduce-motion: header appears instantly at the threshold, no fade.
- Recipe detail hero parallax (mobile only): hero image translateY at 0.5 × scrollY for the first 200pt of scroll. Web: no parallax (sit-down surface; parallax breaks reading).
- Desktop web: no scroll-linked motion. Sidebar is sticky (already in mockup); main column scrolls cleanly.

**Micro-interactions.**
- **Ring fill on log.** When a meal is logged, the calorie ring's stroke-dasharray tweens from old→new value over 600ms with `--ease-spring-soft`. New macro bar fills tween together with the ring (so the eye sees one continuous "everything is updating") — staggered by 60ms each (P → C → F → Fibre).
- **Macro bar fill on log.** Per cell, `width` tween 600ms `--ease-spring-soft`. If the new value crosses target, the bar colour transitions from its macro hue to amber (`var(--warning)`) over 200ms after the fill completes — *not* during fill (avoids the "wiping past the target" anxiety colour change).
- **Cook mode progress bar.** 4px height (up from current 3px per ui-critic). `width` linear over the parsed step duration; pulse the head (1px outer glow at primary alpha 30%) every 1s with `--ease-pm`.
- **FAB tap.** Scale 1 → 0.94 → 1 over 180ms `--ease-spring-snap`. Combined with haptic medium (see below).
- **Card / row press.** Mobile: scale 1 → 0.98 over 100ms in, return on release. Web: opacity 1 → 0.92 over 100ms in. Long-press affordance for delete (Library cards): scale 0.97 + 120ms in, then a small tooltip "Hold to remove" fades in at 200ms.

**Haptic vocabulary.** Five named moments. iOS taxonomy + Android equivalent. `expo-haptics` on RN.

| Moment | iOS | Android | When |
|---|---|---|---|
| `selection` | `Haptics.selectionAsync()` (UISelectionFeedbackGenerator) | `Vibration.vibrate(10)` | tab switch, segmented control, sub-tab pill |
| `confirm` | `Haptics.impactAsync(Light)` | weak | "+" tap on a row in Log sheet, save toggle |
| `success` | `Haptics.notificationAsync(Success)` | medium | meal logged, recipe saved, plan generated |
| `warn` | `Haptics.notificationAsync(Warning)` | medium | over-budget threshold crossed, low-confidence chip surfaced |
| `decisive` | `Haptics.impactAsync(Medium)` | strong | swipe-to-skip on north-star, swipe-delete confirmed |

No `heavy` impacts in product flows — reserve `heavy` for irreversible deletes only (destructive-confirm modal). Web: no haptics; visual feedback substitutes (tween + colour pulse).

**Reduce-motion fallbacks.** Every motion above has a degraded path:
- Sheets: opacity 0 → 1 over 150ms; no translate, no spring.
- Shared element: cross-fade the two screens; no morph.
- Scroll-linked sticky header: appears at threshold without fade.
- Ring fill / macro fill: instant value change with a brief 200ms colour pulse on the affected cell.
- FAB tap / card press: opacity dim only, no scale.
- Mobile: respect `AccessibilityInfo.isReduceMotionEnabled()`. Web: respect `@media (prefers-reduced-motion: reduce)`.

### 1.2 Typography ladder

Five steps + landing display, ruthlessly enforced. Inter on web (existing), SF Pro on iOS (system), Roboto on Android (system) — all ship "tabular-nums" via `font-variant-numeric` / `fontVariant`. Tabular-nums on every numeric: calorie totals, macro grams, kcal counts, dates, prices, durations, percentages.

| Step | Mobile size / line / weight / tracking | Web size (rem / px) | Use |
|---|---|---|---|
| **Display** | 32 / 36 / 800 / -0.02em (mobile only on onboarding success) | `clamp(40px, 6.2vw, 72px)` / 1.05 / 800 / -0.02em | landing hero only; never in-product |
| **Title** | 24 / 28 / 700 / -0.02em | `1.75rem` (28px) / 1.2 / 700 / -0.02em | page heading on Today / Recipes / Plan / You |
| **Headline** | 17 / 22 / 700 / -0.01em | `1.125rem` (18px) / 1.3 / 700 / -0.01em | Progress story headline, north-star title, sheet title |
| **Body** | 14 / 20 / 500 (regular weight 400 on muted body copy) / 0 | `0.9375rem` (15px) / 1.5 / 400 / 0 | default reading text, row titles, paragraphs |
| **Label** | 11 / 14 / 700 / 0.08em uppercase | `0.6875rem` (11px) / 1.3 / 700 / 0.08em uppercase | overlines, eyebrows, section headers |
| **Caption** | 11 / 14 / 500 / 0 | `0.6875rem` (11px) / 1.4 / 500 / 0 | helper text, source labels, timestamps |

**Mobile token additions** — extend `apps/mobile/constants/theme.ts`:

```ts
export const Type = {
  display: { fontSize: 32, lineHeight: 36, fontWeight: '800' as const, letterSpacing: -0.6 },
  title:   { fontSize: 24, lineHeight: 28, fontWeight: '700' as const, letterSpacing: -0.5 },
  headline:{ fontSize: 17, lineHeight: 22, fontWeight: '700' as const, letterSpacing: -0.2 },
  body:    { fontSize: 14, lineHeight: 20, fontWeight: '500' as const, letterSpacing: 0 },
  bodyMuted:{ fontSize: 14, lineHeight: 20, fontWeight: '400' as const, letterSpacing: 0 },
  label:   { fontSize: 11, lineHeight: 14, fontWeight: '700' as const, letterSpacing: 0.88, textTransform: 'uppercase' as const },
  caption: { fontSize: 11, lineHeight: 14, fontWeight: '500' as const, letterSpacing: 0 },
  // numeric specials — always paired with `fontVariant: ['tabular-nums']`
  ringValue:{ fontSize: 36, lineHeight: 36, fontWeight: '700' as const, letterSpacing: -0.7 },
  ringValueLg:{ fontSize: 56, lineHeight: 56, fontWeight: '700' as const, letterSpacing: -1.2 }, // desktop only
};
```

`fontVariant: ['tabular-nums']` is set per usage on numeric Text. Web: existing `.tabular-nums` utility is correct; ensure `font-feature-settings: "tnum" 1, "ss01" 1` on `body` (already present in the structural mockup).

**Lint:** new rule "no ad-hoc font sizes outside the Type table". Sweep `apps/mobile/**/*.tsx` and `src/app/**/*.tsx` for `fontSize: <number>` and `font-size: <px>` literals; replace with `Type.*` / `var(--text-*)`.

### 1.3 Depth system

Four steps. No drop-shadow on the page background. No glass-morphism.

| Tier | Mobile (RN style) | Web (CSS) | Where |
|---|---|---|---|
| **Surface** | no shadow | no shadow | page background, list rows on a card |
| **Card** | `shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1` + 1px border `colors.cardBorder` | `box-shadow: 0 1px 2px rgba(0,0,0,0.04)` + 1px border `var(--border)` | meal cards, recipe cards, settings cards, north-star block |
| **Sheet** | `shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: -8 }` | `box-shadow: 0 -8px 32px rgba(0,0,0,0.12)` + backdrop blur 12px | Log sheet, edit-meal sheet, any modal sheet |
| **Floating** | `shadowOpacity: 0.24, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 8` | `box-shadow: 0 4px 16px rgba(76,108,224,0.4)` (FAB primary tint), or `0 8px 24px rgba(0,0,0,0.12)` for neutral floats | FAB, popovers, dropdowns, floating action toasts |

**Dark mode shadow rules.** Shadows are nearly invisible on dark; substitute with a 1px hairline `rgba(255,255,255,0.06)` top-edge highlight on cards and a slightly stronger border. Sheet on dark: drop the `box-shadow`, keep the backdrop blur.

**Token additions** — `theme.css`:
```css
--elev-card: 0 1px 2px rgba(0,0,0,0.04);
--elev-sheet: 0 -8px 32px rgba(0,0,0,0.12);
--elev-float: 0 4px 16px rgba(0,0,0,0.12);
--elev-float-primary: 0 4px 16px rgba(76,108,224,0.4);
```

Mobile: add `Elevation` object to `theme.ts` with `card / sheet / float / floatPrimary`.

### 1.4 Dark mode

Dark mode is a first-class peer to light. The intentional bg/card divergence between mobile (`#0a0a0f` / `#16161e`) and web (`#101014` / `#18181c`) is preserved (mobile theme.ts:115–118 documents OLED rationale).

| Role | Light | Dark | Notes |
|---|---|---|---|
| `--source-usda` | `#22a860` (success) | `#4cd080` (success-dark) | green dot |
| `--source-off` | `#4c6ce0` (primary) | `#6c8cff` (primary-dark) | blue dot |
| `--source-fatsecret` | `#f97316` (orange) | `#fb923c` | orange dot |
| `--source-manual` | `#94a3b8` (text-tertiary) | `#64748b` | grey dot |
| `--source-ai` | `#e04888` (magenta) | `#ff7eb3` | with sparkle glyph |
| `--confidence-neutral` | `#94a3b8` | `#64748b` | medium-confidence chip background base |
| `--north-star-bg-from` | `rgba(76,108,224,0.08)` | `rgba(108,140,255,0.14)` | linear-gradient start |
| `--north-star-bg-to` | `rgba(224,72,136,0.04)` | `rgba(255,126,179,0.08)` | linear-gradient end |
| `--north-star-border` | `rgba(76,108,224,0.18)` | `rgba(108,140,255,0.32)` | |
| `--over-budget-fg` | `#e8a020` (warning) | `#ffc04c` (warning-dark) | amber, never red, per memory |
| `--over-budget-soft` | `rgba(232,160,32,0.08)` | `rgba(255,192,76,0.14)` | streak-pip + over-budget tile bg |

**Dark-mode-specific calls (open sub-decisions flagged for visual QA):**
- North-star block gradient at full saturation feels too loud on dark; visual-qa should A/B against a more muted variant before locking. **Open sub-decision V-1.**
- Recipe card hero gradients (the light-orange `#ffd5a4 → #ffb380`) need dark-mode equivalents. Proposal: `#7a4a20 → #5a3015`. **Open sub-decision V-2.**

### 1.5 Iconography spec

**One library, one alignment grid.** `lucide-react-native` on mobile, `lucide-react` on web.

| Token | Size | Role |
|---|---|---|
| `--icon-xs` | 10px | macro chip glyph in recipe meta row, source dot pair |
| `--icon-sm` | 12px | row sub-text, eyebrow accent |
| `--icon-md` | 14px | settings row trailing chevron, search bar leading glyph |
| `--icon-base` | 16px | nav item, IconBox content, default in-card icon |
| `--icon-lg` | 18px | hero icon in IconBox, FAB content |
| `--icon-xl` | 20px | bottom-tab glyph |
| `--icon-hero` | 24px | empty-state illustration glyph |

**Lucide → role mapping (canonical):** Today=`Flame`, Recipes=`BookOpen`, Plan=`CalendarDays`, You=`CircleUser`, Search=`Search`, Voice=`Mic`, Photo=`Camera`, Barcode=`ScanBarcode`, Add=`Plus`, Close=`X`, Check=`Check`, Bookmark=`Bookmark`, Edit=`Pencil`, Trash=`Trash2`, Copy=`Copy`, Share=`Share2`, Heart=`Heart`, Bell=`Bell`, Cog=`Settings2`, Shield=`ShieldCheck`, Download=`Download`, Refresh=`RefreshCw`, Lock=`Lock`, Coffee (breakfast)=`Coffee`, Sun (lunch)=`Sun`, Utensils (dinner)=`UtensilsCrossed`, Cookie (snack)=`Cookie`, Beef (protein)=`Beef`, Wheat (carbs)=`Wheat`, Droplet (fat)=`Droplet`, Leaf (fibre)=`Leaf`, Sparkle (AI)=`Sparkles`, WiFi-off=`WifiOff`, TrendingUp=`TrendingUp`, Compass=`Compass`, LayoutGrid (week toggle)=`LayoutGrid`.

### 1.6 Source / provenance system

Per D-2026-04-27-16: trust posture on every macro-bearing row, app-wide. Single `<TrustChip>` and `<SourceDot>` primitive on each platform.

**Source-dot colours (1ch / 6px / 8px sizes):**

| Source | Token | Visual |
|---|---|---|
| USDA | `--source-usda` (success-green) | filled dot |
| OFF | `--source-off` (primary-blue) | filled dot |
| FatSecret | `--source-fatsecret` (orange) | filled dot |
| Manual | `--source-manual` (text-tertiary grey) | filled dot |
| AI estimated | `--source-ai` (magenta) | filled dot + lucide `Sparkles` 8px to its left |

**TrustChip variants** (sit prominently on detail surfaces):

| Variant | Background | Foreground | Glyph + label |
|---|---|---|---|
| `usda` | `rgba(34,168,96,0.08)` | `var(--success)` | `Check` 10px + "USDA verified" |
| `off-adjusted` | `rgba(76,108,224,0.08)` | `var(--primary)` | `Check` 10px + "OFF · adjusted" |
| `estimated` | `rgba(232,160,32,0.10)` | `var(--warning)` | `Sparkles` 10px + "Estimated · verify" |
| `manual` | `rgba(148,163,184,0.10)` | `var(--text-secondary)` | (no glyph) + "Manual" |
| `gluten-high-conf` | `rgba(34,168,96,0.08)` | `var(--success)` | `Check` 10px + "Gluten-free · high confidence" |
| `gluten-uncertain` | `rgba(232,160,32,0.10)` | `var(--warning)` | `Sparkles` 10px + "Gluten contamination risk · review" |

Pill geometry: 22pt/h × auto/w (mobile), 24px × auto (web). Padding 3px × 8px. Radius 999px (full).

**Confidence chip** — used for adaptive TDEE display (D-2026-04-27-12), NOT a warning. Neutral grey, label "medium confidence" or "high confidence" or "low confidence".

### 1.7 CTA voice pass

UK English. Second-person, food-warm, restrained. No emoji in CTAs.

| Surface | Old / generic | New CTA voice |
|---|---|---|
| Onboarding Welcome | "Continue" / "Get started" | "Set my targets" |
| Onboarding step transitions | "Continue" | "Looks right →" / "Got it →" / "Next →" used sparingly |
| Onboarding final step | "Continue" / "Finish" | "Build my first week" |
| Today FAB | (icon only) | VoiceOver: "Log a meal" |
| Today north-star primary CTA | "Cook" / "Add" | time-of-day inferred: "Log it" / "Cook it →" |
| Log sheet header | "Add food" / "Log" | "Log a meal" |
| Log sheet sub-tabs | "Search" / etc. | "Search foods" / "Recent" / "Saved meals" / "Voice log" / "Photo log" / "Scan barcode" |
| Recipe detail primary CTA | "Cook" or "Log" | dual: "Log this meal" + "Start cook mode" |
| Plan generate | "Create plan" / "Run" | "Build this week" first time, "Regenerate" subsequent |
| Pricing Free CTA | "Continue free" / "Skip" | "Use Free" |
| Pricing Pro CTA | "Subscribe" / "Buy" | "Try Pro free for 7 days" |
| Paywall trust footer | (none) | "Cancel anytime · Apple-secured payment · 7-day free trial" |
| Cancel patterns | "Cancel" | "Not now" in upgrade contexts; keep "Cancel" only for destructive confirms |
| Destructive confirm | "Delete" | "Delete account" / "Erase all data" — explicit |
| Verify recipe CTA (post save) | (no CTA — dead-end) | "Save & log this meal" or "Save without logging" |
| Cook done (mobile) | "Exit" only — dead-end | "Log this meal" + "Done" |

Voice rules:
1. **UK English** — "favourite", "personalise", "behaviour", "kilocalories", "fibre".
2. **Second-person** — "your library", "you'll see this", never "the user".
3. **Food-warm, not twee.**
4. **Restraint** — no exclamation marks anywhere except destructive-warning modal title.
5. **No dark patterns** — no countdown timers, no "limited time", no fake urgency.

### 1.8 Accessibility tier

- Touch targets: ≥44pt mobile, ≥36px web (44px coarse-pointer).
- Focus-visible ring (web): `2px ring-primary, ring-offset-2`.
- VoiceOver / TalkBack labels on every icon-only affordance.
- Dynamic Type scaling rules — Body, Caption, Label scale to 130%; Title to 115%; Display does not scale.
- Colour contrast verified at all token combinations (WCAG AA minimum, AAA on critical labels).
- Reduce-motion + reduce-transparency fallbacks named.

---

## Part 2 — Per-surface production design

### Surface A — Today

**Design intent.** Today is the calm primary. Two things matter most: the calorie remaining (ring) and what to eat next from your library (north-star). Everything else is progressive disclosure.

#### Layout — native iOS

1. **Status bar** (system).
2. **Date row** — 16pt horizontal padding, 8pt top, 12pt to next block. Left: `Type.title` "Mon, 27 Apr". Right: `<StreakPip>` 11pt with `Flame` lucide glyph + label.
3. **Calorie ring card** — `<SupprCard>` padding 20×14pt. Centred ring at 132pt diameter, stroke 8pt. Tap toggles remaining/consumed (selection haptic). Long-press shows percent.
4. **North-star block** — gradient card.
5. **Macros remaining bar card** — `<SupprCard>` padding 12×14pt. 4-cell grid with 10pt gap. Per-cell over-budget: cell value text turns `--over-budget-fg`; bar fill goes amber.
6. **Section header "Today's meals"** — `Type.label` 11pt 700 0.06em uppercase text-secondary.
7. **Meal cards** — see meal-card spec below.
8. **Progressive-disclosure rows** (under meals, only when populated): hydration → fasting → activity → recap. Max 2 visible at once; rest collapse under "Show more →".
9. **Bottom safe area + tab bar** (system, 83pt + safe area).
10. **FAB** — 56pt circle, `--primary` bg, `+` glyph 28pt 300, position `right: 18pt, bottom: 100pt`. Shadow `Elevation.floatPrimary`. Confirm haptic on tap. Tap → present `<LogSheet>`.

#### North-star block detail

- Geometry: gradient SupprCard 16pt radius, 12pt internal padding, flex-row with 12pt gap.
- Thumb 56×56pt with 12pt radius.
- Body: eyebrow `Type.label` primary "★ WHAT TO EAT NEXT" + title `Type.headline` + meta row: chip "Hits within 3%" success-tinted + caption-tier "520 kcal · 38P / 42C / 18F".
- CTA button time-of-day adaptive: morning "Log breakfast", lunch "Log lunch", afternoon "Cook ahead →", evening "Cook it →".
- **Swipe-to-skip gesture**: pan-left exposes destructive "Skip" up to 80pt. Release at >50pt → next-best suggestion slides in. Decisive haptic.
- **Empty (no fit)**: collapses to caption "Library has nothing under your remaining macros today." with `Browse →` text button.
- **Library < 5**: primary-tinted invitation: "Pick a few recipes you'd actually cook — we'll suggest from there." button "Open Library →".

#### Meal card spec

- SupprCard `Radius.md` 12pt, padding 10pt, flex-row align-centre gap 10pt, mb 6pt.
- Thumb 40×40pt 8pt radius, image or generated gradient.
- Body: title `Type.body` 13pt 600 1-line ellipsis. Sub-row `Type.caption`: `<SourceDot>` 6pt + label e.g. "Breakfast · 380 kcal · OFF".
- Trailing chevron `ChevronRight` 14pt text-tertiary.
- **Tap**: opens edit-meal sheet with shared-element from the row.
- **Long-press**: action menu "Edit / Duplicate / Delete / Save as recipe".
- **Swipe-left**: exposes Delete with `Trash2` glyph. Decisive haptic + 1.5s undo toast.
- **Swipe-right**: exposes Duplicate.

#### State coverage — Today

- **Default** (mockup approved).
- **Loading** — skeleton silhouettes matching real layout. Shimmer animation. No spinner.
- **Empty (first-run)** — onboarding seeds Library + plan, so empty Today never shows on first boot.
- **Error** — full-card SupprCard centred: `WifiOff` glyph + "Couldn't load today" + "Try again" primary button.
- **Partial** — render what's available. Inline error band on the failed section.
- **Offline** — "Offline" badge above the date row. Cached data renders. Logging queues locally with "Will sync" caption.
- **Over-budget (whole-ring)** — ring value flips to `--over-budget-fg`, label "OVER", arc colour amber. North-star block hides today, replaced with calm caption "You've hit your calories for today — eat freely, or save for tomorrow."
- **First-run** — date row + ring (full target left) + north-star pulled from auto-plan + empty meals section with "Log your first meal" caption + FAB pulse.

### Surface B — Log sheet

**Design intent.** One canonical entry point for every log path. Two taps from cold launch to logged-meal.

#### Layout — native iOS / mobile web

1. Drag handle 36×4pt centred, 8pt above content.
2. Header row: `Type.headline` "Log a meal" left + close `X` button 24pt right.
3. Sub-tab strip — segmented pill bar inside `--bg-secondary` rounded `Radius.sm`. Six tabs: Search foods · Scan barcode · Recent · Saved meals · Voice log · Photo log. Sliding indicator on swap. Selection haptic.
4. Content area — flex 1, scrollable.
   - **Search foods**: search input + results list. Each row: thumb + body (name + caption with `<SourceDot>` + kcal) + `+` button 28×28 primary-tinted.
   - **Scan barcode**: full-bleed camera viewport + corner brackets. On detect: viewport flashes white 60ms, sheet swaps to matched product card.
   - **Recent**: section "Today's recents" then "Earlier this week".
   - **Saved meals**: list of templates.
   - **Voice log**: large primary "tap to start" mic button 88×88. Ripple animation on record.
   - **Photo log**: full-bleed camera viewport + bottom shutter button 64×64.

#### Layout — desktop web

Centred modal 480×640px (max), `Elevation.sheet`. Drag handle drops; close `X` top-right. Backdrop blur 12px + black/40.

#### State coverage — Log sheet

- **Loading (Search results)**: 4 skeleton rows (thumb + 2 lines), shimmer.
- **Empty (Search no results)**: lucide `Search` 32pt + "No matches for '{query}'" + "Try fewer words, or scan a barcode" + button "Scan barcode".
- **Empty (Recent on day-1)**: caption "Your recent foods will appear here." + dual button "Search foods" / "Scan barcode".
- **Error (Search API down)**: `WifiOff` + "Couldn't search. Try again →" + retry button.
- **Partial (Barcode found product but 0 kcal data)**: shows product name + `<TrustChip>` `manual` + caption "No nutrition data — enter manually" + portion + macros editor pre-populated. **Unblocks Journey 5.**
- **Permission denied (Voice / Photo / Barcode)**: empty state with greyed glyph + caption "Grant {mic|camera} access to use {voice log|photo log|scan barcode}" + button "Open Settings".
- **Offline (Search)**: caption "You're offline. Searching cached foods only." Results limited to recents + saved.
- **First-run on Voice / Photo**: 2-line tip card at top "First time? Speak naturally — 'a chicken caesar salad with extra dressing' works." Dismissable.

### Surface C — Recipes (Library default + Discover sub-tab)

**Design intent.** Library is the user's hand-picked list. Discover is a sit-down browsing experience.

#### Layout

1. Title `Type.title` "Recipes" + 8pt below.
2. Sub-tab pill bar — "Library · 24" + "Discover". Active pill primary-tinted; sliding indicator.
3. Filter row (Library only) — horizontal scrollable chip rail.
4. Search bar.
5. Recipe-card list — single column on mobile, full-width.

#### Recipe-card spec

- SupprCard 16pt radius, overflow hidden.
- Image area `aspect-ratio: 16/10`. Save bookmark top-right with blur + `Bookmark` 14pt.
- Body padding 10×12pt: title + meta row (macro chips + kcal/min) + `<TrustChip>`.
- **Tap** → recipe detail (shared-element on image + title).
- **Long-press** → action menu: Save / Remove / Add to plan / Share / Move to category / Hide.

#### Layout — desktop web

3-column grid `repeat(3, 1fr)` with 12px gap. Hover: `transform: translateY(-1px); box-shadow: var(--elev-float)` over 150ms.

#### State coverage — Recipes

- **Empty (Library after onboarding-seeded reset)**: `BookOpen` 32pt + "Your Library is empty" + "Pick recipes from Discover to seed your week" + button "Browse Discover".
- **Empty (zero filter results)**: caption "No saved recipes match these filters. Clear filters →".
- **Error (Discover network)**: `WifiOff` + "Couldn't load Discover. Library still works." + retry button.
- **Partial (recipe with missing macros)**: card renders with `<TrustChip>` `estimated` + caption "Tap to verify".
- **Offline**: Library renders fully (cached). Discover shows "You're offline — Library works fine" banner.
- **First-run**: Library is pre-seeded with 5–10 recipes from D-2026-04-27-14.

### Surface D — Plan (this-week + shopping list sub-view)

**Design intent.** Plan is sit-down. Shopping is supermarket-phone.

#### Layout — native iOS (This week)

1. Title "Plan" + sub-tab pills "This week · Shopping list".
2. Header row: caption-tier "Hits targets 5 of 7 days" + text-button "Regenerate" with `RefreshCw`.
3. Day-cards stack — current-day highlighted with primary underline.
4. Per-day "Hits-targets indicator": 4 segments (P/C/F/Fibre), each green/amber/grey. Caption "Hits 4 of 4".

#### Layout — desktop web (This week)

7-column grid (one per day). Today column gets `border-color: var(--primary)`. Hover → expands inline; click → opens day in side panel slide-over.

#### Shopping list sub-view

- Items grouped by aisle: "Produce" / "Dairy & eggs" / "Pantry" / "Protein" / "Frozen" / "Other".
- Item row: round checkbox 22pt + name body-tier + quantity caption-tier right. Strikethrough on tick. Confirm haptic.
- Bulk-clear: text button-primary "Clear ticked items" — appears only when ≥1 ticked.
- Share-out: header `Share2` 18pt → native share sheet.

#### State coverage — Plan

- **Empty (no plan generated)**: `CalendarDays` 32pt + "We'll plan your week from your Library" + button "Build this week".
- **Empty (Library < 5)**: "Pick a few more recipes first to enable planning" + button "Open Library".
- **Error (plan generation failed)**: "Couldn't generate a plan. Try again or pick recipes manually." + dual button.
- **Partial**: default render; per-day indicator surfaces misses.
- **Offline**: cached plan renders; Regenerate shows lock + "Goes online to regenerate".
- **Shopping empty**: "Generate a plan first — your shopping list builds itself." + button "Open this week".

### Surface E — You (Profile + Progress story + Settings)

**Design intent.** You is one tab combining identity, the weekly story, and settings depth.

#### Layout — native iOS

1. Title "You" + 8pt.
2. **Profile card** SupprCard 16pt: `<GradientAvatar>` 48×48 + name `Type.body` 700 + tier pill primary-tinted "PRO" or "FREE".
3. **Progress hero (story-led)** SupprCard:
   - Eyebrow label-tier primary "THIS WEEK".
   - Headline `Type.headline` 17pt 700 — "Your maintenance adjusted up by 60 kcal".
   - Body body-tier text-secondary — engine commentary with **2,100 kcal** highlighted + confidence chip inline.
   - Optional inline weight-trend sparkline.
4. **Trend cards** (collapsed beneath, expand on tap): Weight chart + Calorie chart with time-range pills.
5. **Settings card** SupprCard sectioned rows:
   - Daily targets (IconBox `Flame` primary)
   - Settings (IconBox `Settings2` warning) — sub-routes: Notifications / Units / Theme / Adaptive TDEE / Caffeine + alcohol opt-in / Hydration / Household
   - Your data (IconBox `ShieldCheck` magenta) — Download / Privacy / Delete account
   - Subscription (IconBox `Heart` success) — Pro · £7.99/mo / Manage / Restore
6. **Build stamp** caption-tier text-tertiary "Build 1.0 · 42 (2026-04-22)".

#### Layout — desktop web

Two-column grid 1.4fr 1fr. Left: Progress hero + Weight chart + Calorie chart full-width. Right: Profile card + Settings card.

#### Settings sub-routes (callout)

- **Daily targets**: large display number for kcal target with "How we calculate this" link, then per-macro values. Edit-in-place; long-press → segmented "Custom" mode unlocks all four. Save inline (no Alert.alert; in-screen 1.5s success state).
- **Notifications**: list of switches with descriptions. Each setting writes immediately; "Saved" toast 200ms below.
- **Units**: segmented control "kg / lb · ml / fl oz · cm / in".
- **Theme**: segmented "System / Light / Dark". Animated thumb (`--ease-spring-snap`).
- **Adaptive TDEE**: explainer page — single hero card "How we estimate your maintenance" + body + "Confidence: medium" chip + history table.
- **Caffeine + alcohol**: opt-in toggles + (when on) tap-to-set targets per EFSA / FDA regional defaults. Off by default per D-2026-04-27-08.
- **Hydration**: opt-in toggle + cup-size config.
- **Household**: per memory; demoted to here, not in primary nav.

### Surface F — Onboarding final step ("Pick 5 recipes")

**Design intent.** End the user on a populated working artifact (D-2026-04-27-14). The last step should feel like reward.

#### Layout — native iOS

1. Stepper caption "Step 11 of 11" + thicker progress bar 6pt high.
2. SupprCard:
   - Eyebrow label-tier primary "★ LAST STEP" with `Sparkles` 10pt.
   - Title `Type.title` 22pt -0.01em "Pick 5 recipes you'd actually cook".
   - Body body-tier text-secondary "We'll seed your library and build your first weekly plan from these. You can change everything later."
   - Recipe grid 2-col gap 8pt — selected state: bg `rgba(76,108,224,0.08)` + border `--primary` + `Check` 12pt overlaid on thumb.
   - Counter caption-tier "4 of 5 picked".
3. Primary CTA "Build my first week" — disabled until ≥5 selected (opacity 0.5, no haptic).
4. On tap: success haptic + 600ms loader copy "Building your week…" → Today populated state.

#### Layout — desktop web

Centred 560px column. Title 32pt. Recipe grid 3-col. Otherwise identical.

#### State coverage — Onboarding final

- **Loading (recipe candidates fetching)**: skeleton tiles.
- **Empty (no candidates — only with broken backend)**: error band "Couldn't load recipe suggestions. Skip ahead and we'll seed your library from Discover later." + button "Skip and finish".
- **Disabled state (CTA not unlocked)**: button at 50% opacity, label "Pick {n} more to continue".
- **Success transition**: 600ms loader → Today populated. If plan-build fails: "We saved your recipes but couldn't build a plan. Try regenerate from the Plan tab." + button "Go to Today".

### Surface G — Pricing (Free + Pro)

**Design intent.** Two tiers, decisive. Pro is recommended; Free is honoured. No dark patterns.

#### Layout

1. Title "Pricing" + 14pt below caption-tier "Two tiers. Cancel anytime, no dark patterns."
2. Two-column grid 1fr 1fr gap 12pt:
   - **Free card** SupprCard: name "Free" + price `Type.title` "£0" + period "forever" + feature ul (Daily logging / 10 saved recipes / Free barcode scanner / Basic Today screen) + CTA "Use Free".
   - **Pro card** SupprCard with gradient bg, primary border, "Recommended" pill (-10pt above edge): name "Pro" + price "£7.99" + period "per month, or £59.99/yr" + feature ul (Unlimited recipes / What-to-eat-next AI / Voice + photo logging / Weekly plan + shopping / Adaptive maintenance / Coeliac/gluten depth) + CTA "Try Pro free for 7 days".
3. Trust footer caption-tier centred mt 14pt: "Cancel anytime · Apple-secured payment · 7-day free trial".

#### Trial / paid states

- **In-trial**: Pro card replaces CTA with "Trial active — ends Tue 5 May. Manage →" (ghost outline). Free card hides.
- **Paid**: Pro card replaces CTA with "Active · renews 12 May".

### Surface H — Recipe detail

**Design intent.** Recipes are the input layer that feeds tracking. Recipe detail must do three things calmly: communicate what's in this recipe (verified), make logging it trivial, and allow cooking it without leaving Suppr.

#### Layout — native iOS

1. **Hero image area** — 200pt high, full-bleed, parallax on scroll (mobile only). Top-left: back button. Top-right pair: Save bookmark + Share.
2. **Title block** padding 14×0:
   - Title `Type.headline` 18pt 700.
   - Sub `Type.caption` text-secondary "35 min · 4 servings · @suppr".
   - `<TrustChip>` per source. For coeliac/gluten content (D-2026-04-27-13), append "Gluten-free · high confidence" or "Gluten contamination risk · review".
3. **Macro tile row** — 4 cells flex-row gap 8pt. Each SupprCard 12pt radius padding 10pt text-centre. Cell 1 (kcal), Cell 2 (protein primary-coloured), Cell 3 (carbs warning-coloured), Cell 4 (fat magenta-coloured).
4. **Dual CTA stack**:
   - Primary "Log this meal" — full-width primary button.
   - Secondary "Start cook mode" — full-width ghost.
5. **Ingredients section** — section header "INGREDIENTS · {n}". Each row: bullet + name + quantity. Allergen flags as small chips. Source per ingredient at row right with `<SourceDot>` + estimated rows have inline "Verify →" text-button.
6. **Steps section** — numbered steps + "Start cook mode" at end.
7. **Bottom bar** sticky on scroll past dual CTA: condensed 60pt with "Log this meal" + "Cook" — always reachable.

#### Layout — desktop web

Two-column grid 1.4fr 1fr. Left: hero image 380px high + title + ingredients + steps. Right: SupprCard sticky-on-scroll: 140pt calorie ring + macros bar + dual CTA + Save + Share. Cook mode opens as side sheet (slide from right, 480px).

#### State coverage — Recipe detail

- **Empty (no ingredients yet — paste-import in flight)**: banner "We're parsing this recipe — try Verify to add ingredients" + button "Verify →".
- **Error (recipe failed to load)**: full-screen card "Couldn't load recipe — pull to retry".
- **Partial (macros but ingredients missing)**: macros render with `<TrustChip>` `estimated`. Ingredients section: "Tap Verify to fill in the details" + button.
- **Offline**: cached recipe renders. If not cached: "You're offline — this recipe isn't downloaded".
- **Over-budget (logging would push over)**: log button reads "Log it · +143 over" in warning colour and proceeds anyway. Toast confirms in warning tint. Never blocks.
- **Cook mode done**: terminal screen offers "Log this meal" primary + "Done" secondary (**fixes Journey 21 dead-end**).

---

## Part 3 — Implementation handoff

### Token additions (proposed)

Web `theme.css` (light + dark each):
- `--source-usda` / `--source-off` / `--source-fatsecret` / `--source-manual` / `--source-ai`
- `--confidence-neutral`
- `--north-star-bg-from` / `--north-star-bg-to` / `--north-star-border`
- `--over-budget-fg` / `--over-budget-soft`
- `--elev-card` / `--elev-sheet` / `--elev-float` / `--elev-float-primary`
- `--ease-spring-soft` / `--ease-decel`

Mobile `theme.ts`:
- `Type` object (display / title / headline / body / bodyMuted / label / caption / ringValue / ringValueLg)
- `Elevation` object (card / sheet / float / floatPrimary)
- `IconSize` object (xs / sm / md / base / lg / xl / hero)
- `Spring` config object — `softSheet` / `snapSegment` (Reanimated config)
- `Colors.{light,dark}` adds: `sourceUsda`, `sourceOff`, `sourceFatsecret`, `sourceManual`, `sourceAi`, `confidenceNeutral`, `northStarBgFrom`, `northStarBgTo`, `northStarBorder`, `overBudgetFg`, `overBudgetSoft`, `destructiveForeground`, `primaryForeground`

### New components

- `<SupprCard>` — single card primitive. Variants: `default`, `accent`, `tinted`, `gradient`, `destructive`.
- `<TrustChip>` — variants `usda`, `off-adjusted`, `estimated`, `manual`, `gluten-high-conf`, `gluten-uncertain`.
- `<SourceDot>` — sized 6 / 8 / 10pt; `source` prop.
- `<ConfidenceChip>` — neutral grey, 3 levels.
- `<StreakPip>` — 22pt height, `Flame` glyph, label.
- `<MacroBarCell>` — single cell of macros remaining bar.
- `<NorthStarBlock>` — gradient card with thumb / body / CTA / swipe gesture handler.
- `<LogSheet>` — bottom sheet with sub-tab strip + 6 sub-views.
- `<SubTabPill>` — segmented pill bar with sliding indicator.
- `<IconBox>` — 32×32 lucide-housed tinted square (consolidate to one primitive).
- `<GradientAvatar>` — 36 / 48 / 64pt sizes.
- `<EmptyState>` — universal: `icon`, `title`, `body`, `primaryCta`, `secondaryCta`.
- `<SkeletonRow>` / `<SkeletonCard>` — silhouettes matching real components.

### Components to retire

- All Ionicons / MaterialCommunityIcons usages → lucide-react-native.
- `Alert.alert(...)` for save confirmations → inline success state + 1.5s toast.
- Streak ribbon component → new pip.
- Per-screen IconBox reimplementations → consolidate to primitive.
- Caffeine + alcohol Today widgets → behind Settings opt-in.

### Sequence dependencies (executor sequencing)

**Phase 1 — Foundation (parallelisable):**
1. Token additions to `theme.css` and `theme.ts`.
2. `<SupprCard>` primitive on web + mobile.
3. `<TrustChip>` + `<SourceDot>` + `<ConfidenceChip>` + `<EmptyState>` + `<SkeletonRow>` primitives.
4. Lucide sweep — replace every Ionicons / MCI import (mechanical, staged per screen).
5. Type ladder enforcement — lint rule + sweep.

Phase 1 ships without changing visible structure — pure tokens + primitives.

**Phase 2 — Tab collapse + canonical Today (sequential):**
6. Tab structure 6→4 (B1.1).
7. Canonical Today refactor (B1.2).
8. Caffeine + alcohol behind Settings (B1.4).
9. Streak ribbon → pip.
10. FAB component + initial wiring.

**Phase 3 — Log sheet + north-star (depends on Phase 2):**
11. `<LogSheet>` primitive with 6 sub-tabs (B2.1).
12. North-star block on Today (B2.2).
13. Trust posture sweep (B2.4).
14. Onboarding final step + auto-plan-from-seed (B2.3).

**Phase 4 — You + Progress story:**
15. Merge Progress + Settings + More into `you.tsx` (B1.1 / B3.1).
16. Progress story headline + adaptive TDEE always-on (D-2026-04-27-12 + D-2026-04-27-17).
17. Settings sub-routes inline-confirm pattern.
18. Profile-targets shared context (fixes journey 26/27 cross-tab propagation).

**Phase 5 — Polish + dead-ends:**
19. Recipe verify post-save router.replace.
20. Cook done log CTA.
21. Shared-element transition recipe card → detail.
22. Pricing collapse Free + Pro (B1.3).
23. Coeliac/gluten depth chips (B3.2).
24. Reduce-motion + reduce-transparency QA.

---

## Open sub-decisions for visual QA

- **V-1.** North-star block dark-mode gradient saturation. Visual-qa to A/B against a more muted variant on a real OLED screen.
- **V-2.** Recipe-card hero gradients in dark mode. Proposed warm-dark amber `#7a4a20 → #5a3015`.
- **V-3.** North-star CTA copy for the 14:30–17:30 window — "Cook ahead →" reads as functional but might confuse first-time users. Customer-lens to read 3 testers' reaction.
- **V-4.** Streak pip glyph: lucide `Flame` versus the existing 🔥 emoji. Visual-qa to confirm rendering at 12pt isn't muddy on dark.
- **V-5.** "Verify →" inline CTA on estimated ingredient rows — placement competes with source dot. Visual-qa to test stacked variant.
- **V-6.** Onboarding minimum recipe count threshold (5 vs 3 vs 1-with-apologetic-copy) — flag-driven; nutrition-engine to characterise.
- **V-7.** Sticky condensed Today header transition timing — 64pt threshold may feel too eager; visual-qa to test 96pt vs 128pt.
- **V-8.** Adaptive maintenance card placement (right rail desktop only) vs inline in Progress hero on mobile.

---

## Cross-platform deviations (intentional)

- Mobile FAB / web sticky button (size + position differ).
- Mobile tab bar / web sidebar.
- Mobile parallax on recipe detail / web no parallax.
- Mobile haptics / web no haptics.
- Mobile Today ring tap-and-hold / web Today no toggle.
- Mobile shopping list / web no shopping list.
- Mobile move-meal / web no move-meal.
- Web Recipe Go Public / mobile no Go Public.
- Web pricing defaults monthly / mobile defaults annual.
- Mobile bg `#0a0a0f` / web bg `#101014` dark mode.
- Mobile install hint absent / mobile-web install hint present.
- Onboarding welcome copy "Join the Suppr Club" web / mobile prototype copy.

---

## Final acceptance — single rubric

A surface is shipped correctly when:
- (a) Layout matches the per-surface spec on iOS, mobile web, desktop web.
- (b) All seven states designed (default + loading + empty + error + partial + offline + first-run; over-budget if applicable) render and match the copy.
- (c) Every macro-bearing row carries `<SourceDot>`; every detail surface carries `<TrustChip>`.
- (d) Motion uses the named tokens; reduce-motion path tested.
- (e) Typography uses the Type ladder; no ad-hoc font sizes.
- (f) Icons are lucide; no Ionicons, no MaterialCommunityIcons.
- (g) CTAs use the voice in §1.7; no generic "Continue" / "Save" / "Cancel" outside destructive confirms.
- (h) Touch targets ≥44pt mobile / 36px web (44px coarse-pointer).
- (i) Focus-visible ring on every interactive element on web.
- (j) VoiceOver labels present on every icon-only affordance.
- (k) Cross-platform deviations only where listed.
- (l) The eight visual-qa open sub-decisions are explicitly resolved before merge.
