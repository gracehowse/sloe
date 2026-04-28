# UI critic — button-level audit, post-Phase 5 (commit `5149bce`)

**Owner:** ui-critic specialist
**Status:** Findings — pending Phase 6 design synthesis + execution
**Scope:** every interactive element in the shipped Suppr app, web + mobile, post-Phase-5

---

## Executive verdict

**Tier: Polished, needs nudge.** The post-Phase-5 redesign hit the structural tier — entry-point consolidation (LogSheet's six-tab consolidation of an 8+ splay), the persistent NorthStarBlock with proper four-state branches, and the ring-only canonical hero with the picker hard-pinned away are all real progress and visibly product-led. The information architecture is now coherent and the four-tab structure is correct.

**But Suppr is not yet flagship-tier consumer software at the button level.** The depth-and-motion-and-microcopy ladder that separates Linear / Things / Apple Fitness / Cash App from "well-designed prototype" is largely missing: press feedback is a generic 0.6 / 0.85 opacity drop on most Pressables instead of the 0.96–0.97 spring + medium haptic that flagship apps use; primary CTAs are flat fills with no shadow; web mirrors use focus-visible rings competently but hover states are mostly absent or default-Tailwind; reduce-motion fallbacks exist but are minimal; loading skeletons are static greys (no shimmer) on both platforms.

The product would not embarrass Suppr in the App Store today, but it would not be picked out of a lineup of mid-tier health apps either.

---

## Top 5 button-level gaps app-wide

1. **Press feedback is uniformly underdesigned.** Every Pressable in the codebase uses one of two patterns: `opacity: pressed ? 0.6 : 1` (e.g. `LogSheet.tsx:243-246`, `LogSheet.tsx:726`, `LogSheet.tsx:793`) or `opacity: pressed ? 0.85 : 1` (e.g. `NorthStarBlock.tsx:117-120`, `NorthStarBlock.tsx:307-315`). Only the LogFab has scale (`LogFab.tsx:93`). Apple Fitness, Things — every flagship app pairs press with a **scale-down (0.96–0.97) + light haptic + 120–180ms ease-out**. The current treatment reads as "RN-default press" — i.e. prototype-tier — and this ladder repeats across the entire app.

2. **Primary CTAs have no depth ladder.** The "Log it" CTA inside NorthStarBlock (`NorthStarBlock.tsx:307-318`), the LogSheet's "Log it" inside BarcodeManualEntry (`LogSheet.tsx:632-642`), the paywall TierCard CTAs (`paywall.tsx:1269-1289`), and the LogFab itself (`LogFab.tsx:85-99`) are all flat `Accent.primary` fills with sharp `Radius.md` corners and a `lineHeight 20` label. Cash App's "Cash Out" button has a 12pt soft-tinted shadow + a subtle inner highlight gradient + a 0.5pt outline; ours has nothing. Even the LogFab — which uses `Elevation.floatPrimary` — doesn't have a press-state shadow lift; on press it scales down but the shadow doesn't follow.

3. **Loading states are static skeleton blocks, not shimmer.** `LogSheet.tsx:359-374` (search loading) and `LogSheet.tsx:660-670` (recent loading) render a vertical stack of grey rectangles. The paywall's loading state is two `skeletonCard` solid grey blocks. No shimmer animation, no fade-in, no progressive content reveal. Fitness apps use a 1.2s left-to-right gradient sweep at 8% opacity; ours is genuinely static. Reads as prototype-tier on first paint.

4. **The over-budget state is a caption, not a moment.** `NorthStarBlock.tsx:84-96` over-budget kind renders a grey caption ("You've hit your calories for today — eat freely, or save for tomorrow"). The copy is good (calm, on-brand) but the rendering is a single 13pt grey line at default body weight. This is the kind of moment Apple Fitness celebrates with a colour-shift ring + a gentle haptic + a 200ms scale pulse. As designed, the user gets a near-invisible caption replacing the most prominent on-screen block. The result: the surface that should feel like an achievement actually feels like a degraded blank.

5. **Focus-visible rings exist on web but not consistently; mobile-web touch targets shrink desktop padding.** Web mirrors do focus-visible competently (`log-sheet.tsx:267-269`, `north-star-block.tsx:114-115`, `recipe-picker-grid.tsx:88-90`). But the mobile-web LogSheet sub-tab pills are 12pt 600 with `py-1.5` (`log-sheet.tsx:294`) which renders ~28pt tall — under the 44pt iOS / 48pt Android minimum tap target. The desktop modal layout doesn't bump pill height for mobile-web, so the same 12pt pill ships to a phone web user who needs ~44pt. This is the dominant mobile-web regression: web sizes read as "shrunk desktop", not "phone-native".

---

## Top 3 mobile-web regressions from native

1. **LogSheet sub-tab pills are too small for touch.** `src/app/components/suppr/log-sheet.tsx:286-299`. `text-[12px]` + `py-1.5` = ~28pt tall. **Fix:** mobile-web should bump to `py-2.5` and `text-[13px]` minimum, or add a `min-h-11` (44px). Linear's mobile-web does this; ours doesn't.

2. **NorthStarBlock CTA on web is a 36pt button on mobile-web.** `north-star-block.tsx:213-222` uses `h-9 px-3 text-[13px]`. The bigger problem: the web button has zero hover state beyond Tailwind's default (no `hover:bg-primary/90`, no `active:scale-[0.98]`, no transition). **Fix:** add `hover:brightness-110 active:scale-[0.97] transition-transform duration-150` to all primary CTAs in `suppr/*.tsx` web mirrors.

3. **The web LogSheet drawer uses `vaul` correctly but the desktop-modal break is at `desktop` prop, not a media query** (`log-sheet.tsx:174-175`, `:240-242`). When that prop isn't passed, mobile-web on a 1024px iPad-Mini-landscape gets the bottom-drawer treatment instead of the centred modal — even though the canvas is desktop-shaped. **Fix:** use a `useMatchMedia('(min-width: 768px)')` resolver inside the component, with `desktop` prop as override only.

---

## Top 3 web/mobile parity gaps that look like unintentional drift

(Filtering out documented intentional divergence per `project_onboarding_welcome_divergence`, `project_recipe_go_public_web_only`, `project_move_meal_web_gap`, `project_pricing_default_billing_period_divergence`.)

1. **NorthStarBlock thumbnail placeholder differs.** Mobile renders a flat tinted square: `NorthStarBlock.tsx:248` — `backgroundColor: \`${Accent.primary}26\`` (15% primary). Web renders a gradient: `north-star-block.tsx:184-188` — `bg-gradient-to-br from-primary/20 to-pink-300/20`. Web is visibly nicer; mobile is bleaker. No memory entry justifies this.

2. **NorthStarBlock skip affordance is gesture vs button by platform — but the web `X` button is permanently visible while the native `X` only shows under reduce-motion.** `NorthStarBlock.tsx:233-243` (native: X only when `reduceMotion && onSkip`) vs. `north-star-block.tsx:161-174` (web: X always when `onSkip` is passed). On parity grounds you'd expect either both to show the X (with native gesture as additional path) or both to suppress and surface skip via long-press.

3. **The LogFab is mobile-only.** I see `apps/mobile/components/today/LogFab.tsx` but no equivalent on the web composition root. The strategic-direction doc D-2026-04-27-15 says "Persistent Log FAB on Today" without web carve-out. Either web needs a floating "+ Log" affordance, or the divergence needs a memory entry.

---

## Per-surface deep audit

### Surface 1 — Today (mobile, `apps/mobile/app/(tabs)/index.tsx`)

**Tier verdict: Polished, needs nudge.**

| Element | File:Line | Verdict | Why |
|---|---|---|---|
| Hero ring tap (toggle expanded) | `TodayHero.tsx:104` | **Polished, needs nudge** | No haptic on toggle, no spring on expand. Apple Fitness rings respond with ~150ms eased scale + selection haptic. |
| Hero ring tap (toggle remaining/consumed) | `TodayHero.tsx:106` | **Polished, needs nudge** | Same: no haptic, no animation on the number swap. |
| Variant picker (corner grid) | `TodayHero.tsx:145-163` | **Hidden in Phase 5** | Correctly suppressed via `hidePicker`. Should be deleted in Phase 6. |
| LogFab | `LogFab.tsx:79-99` | **Premium ✓** | Flagship-tier. 56pt circle, scale-down on press, medium haptic, `Elevation.floatPrimary`. The single best button on the surface. |

### Surface 2 — LogSheet (canonical)

**Tier verdict: Polished, needs nudge.** Architecturally excellent. `LogSheetTabState` explicitly enumerates loading / error / offline / permissionDenied / showFirstRunTip — best state coverage in the app.

| Element | File:Line | Verdict | Why |
|---|---|---|---|
| Tab pill (active / inactive) | mobile `LogSheet.tsx:263-294` / web `log-sheet.tsx:286-299` | **Polished, needs nudge (mobile-web: prototype-tier)** | No transition between states. Web has `transition-colors` but no transform. Mobile-web hits the touch-target problem. |
| Close button (X) | mobile `LogSheet.tsx:238-249` / web `log-sheet.tsx:263-272` | **Polished** | Both lack hover/press lift; both flicker via opacity only. |
| Search input | mobile `LogSheet.tsx:325-341` | **Polished, needs nudge** | No clear/cancel button when query non-empty. No haptic on search submit. |
| Result row "+" add button | `LogSheet.tsx:412-428` | **Premium ✓** | Tinted background, bold "+", light haptic on tap, hitSlop 6. Reads as flagship-tier. |
| Result row tap | `LogSheet.tsx:722-727` | **Polished, needs nudge** | `opacity: pressed ? 0.6 : 1`. A flagship app would scale 0.98 + light haptic. |
| BarcodeManualEntry "Log it" CTA | `LogSheet.tsx:616-642` | **Polished, needs nudge** | 44pt height, success haptic — good. But fill is flat `Accent.primary`, no shadow, no press state. |

### Surface 3 — NorthStarBlock

**Tier verdict: Polished, needs nudge.** Conceptually flagship — execution 70% there.

| Element | File:Line | Verdict | Why |
|---|---|---|---|
| Default-kind CTA "Log it" | mobile `NorthStarBlock.tsx:303-318` / web `north-star-block.tsx:213-222` | **Polished, needs nudge** | No depth, no press scale, no hover on web. |
| Skip gesture (swipe-left) | `NorthStarBlock.tsx:210-228` | **Premium ✓** | PanResponder with 50pt threshold + medium haptic on commit. Flagship-tier interaction. |
| library-empty CTA "Open Library →" | `NorthStarBlock.tsx:113-124` | **Polished** | Adequate. Sparkles icon + 14pt 600 body. |
| no-fit "Browse →" link | `NorthStarBlock.tsx:139-153` / `north-star-block.tsx:135-141` | **Polished, needs nudge** | Web has hover:underline; mobile has no underline cue — looks like body text until you notice the colour. |
| over-budget caption | `NorthStarBlock.tsx:84-96` / `north-star-block.tsx:83-91` | **Prototype-tier** | Top-5 #4. |

### Surface 4 — Paywall (`apps/mobile/app/paywall.tsx`)

**Tier verdict: Polished, needs nudge.** Most-designed surface in the app.

| Element | File:Line | Verdict | Why |
|---|---|---|---|
| Close X (top-right over gradient) | `paywall.tsx:863-871` | **Polished** | 36pt circle, glassy background, hitSlop 12. No press state, no haptic on close. |
| Billing toggle Monthly/Annual | `paywall.tsx:906-921` / `:922-940` | **Polished, needs nudge** | Active state has card-bg + iOS shadow. Inline Badge needs contrast verification. |
| TierCard CTA (Pro / Base) | `paywall.tsx:1269-1289` | **Polished, needs nudge** | Disabled state correct. No press scale (just default Pressable opacity), no shadow. |
| "Continue for free" | `paywall.tsx:1050-1056` | **Polished** | Tertiary text-link, correct visual weight. |
| Restore purchase | `paywall.tsx:1146-1156` | **Polished** | Inline link with ActivityIndicator on loading. |

**State coverage:** Excellent. Skeleton cards on loading, unavailable state with CloudOff icon, early-redirect when already entitled. The auto-renew disclosure is genuine UK CMA-compliant work.

### Surface 5 — Onboarding RecipePicker

**Tier verdict: Premium ✓.** This is the surface that *does* hit flagship-tier.

| Element | File:Line | Verdict | Why |
|---|---|---|---|
| Recipe tile (unpicked) | `recipe-picker-grid.tsx:80-115` | **Premium ✓** | Border + bg shift on pick, hover state, focus-visible ring. Real ARIA (`aria-pressed`, `aria-label` with kcal/protein/min). |
| Recipe tile (picked) | same | **Premium ✓** | 12pt Check inside primary-fill 5×5 circle in corner. Selected bg specific 8% primary tint. |
| Counter "X of N picked" | `recipe-picker-grid.tsx:120-132` | **Premium ✓** | aria-live="polite". Conditional CTA hint when `!canSubmit`. |

### Surface 6 — Tab structure (`_layout.tsx`)

**Tier verdict: Polished, needs nudge.** Correct four-tab collapse. The `pathname`-aware tab-press listeners are clever.

The tab bar styling (`:90-104`) is bare — `borderTopWidth: 1`, no blur, no shadow. iOS native flagship apps use a translucent tab bar with `BlurView`. RN Expo can do this; currently the bar is a flat seam.

### Surfaces 7+ — extrapolated patterns

For the surfaces sampled by signature only (Discover, Planner, Shopping, Settings, More, RecipeDetail, Verify, CookMode, Progress, Library):

- **Press feedback uniformly opacity-only.** Same pattern as LogSheet rows.
- **Loading states are static skeletons or centred spinners.**
- **Error states use `Alert.alert(...)` on mobile.** Three Alert.alert calls in paywall and library. Alerts break design language vs flagship inline-errors pattern.
- **Empty states have decent copy but plain icons.**

---

## Cross-cutting weakness patterns

1. **Press-feedback ladder is missing globally.** Every Pressable needs to migrate to a shared `<PressableScale>` primitive. Currently `LogFab.tsx:93` is the only place this exists.

2. **No shadow ladder on primary CTAs.** Every primary fill button uses `Accent.primary` flat. Add `Elevation.ctaPrimary` token.

3. **Loading skeletons are static.** Either ship a `<Shimmer>` component (linear-gradient sweep, 1.2s loop) or accept that the bar is "skeleton + 200ms fade-in on load".

4. **Alerts are doing the work that inline errors should.** `Alert.alert` is used in paywall and library. Every flagship app inline-renders these.

5. **Web mirrors are honest mirrors but lack hover states.** Every primary button needs `hover:brightness-110` or `hover:bg-primary/90` and `transition-colors duration-150`.

6. **The variant-picker corner affordance pattern is half-removed.** Phase 6 should delete the dead code path.

## Cross-cutting strength patterns

1. **State-coverage discipline is real.** `LogSheetTabState`, `NorthStarKind` four-state union, paywall's `offeringsReady` + `subscriptionsUnavailable` + `earlyRedirected`. Most prototypes ignore offline / permission-denied entirely.

2. **Accessibility labels are consistently present.** `accessibilityRole`, `accessibilityLabel`, `accessibilityState`, hitSlop — every Pressable I read has them. Rare even in shipped apps.

3. **Haptics are used purposefully where they exist.** LogFab medium impact, tab selection, result-row add light impact, barcode-confirm success haptic, purchase-success haptic.

4. **The decision-log culture shows in the code.** Almost every file has a header docstring citing the spec, the authority decision (D-2026-04-27-XX), and the deviation rationale.

5. **Native gesture path on NorthStar is a flagship-tier interaction.** PanResponder commit-on-release-past-50pt + medium haptic + reduce-motion fallback.

---

## Top 30 button-level upgrades by impact-per-effort

1. **Ship `<PressableScale>` primitive.** Wraps Pressable with scale 0.97 + light haptic + 150ms ease. Migrate all Pressable usages. (1d effort, app-wide impact.)
2. **Add primary-CTA shadow tier to theme.** `Elevation.ctaPrimary` + `Elevation.ctaPrimaryPressed`. Apply to all `Accent.primary` fill buttons. (0.5d.)
3. **Replace static skeletons with `<Shimmer>` component.** Linear-gradient sweep, 1.2s. Apply to LogSheet search/recent/saved, paywall cards, Library cards. (1d.)
4. **Replace `Alert.alert` error paths with inline error bands.** Paywall + library + (likely) CookMode. Use the LogSheet WifiOff-band pattern as the template. (1d.)
5. **Web: add `hover:brightness-110 transition-all duration-150` to every primary button.** Grep-replace in `src/app/components/suppr/*.tsx`. (0.5d.)
6. **Mobile-web: bump LogSheet sub-tab pills to `min-h-11 text-[13px] py-2.5`.** (15min.)
7. **Add gradient thumbnail placeholder to mobile NorthStar.** Match web. (30min, parity.)
8. **Re-design the over-budget NorthStar branch.** Replace caption with a small celebratory card. (1d.)
9. **Add success haptic + scale pulse on hero ring tap.** (1h.)
10. **Add `react-native-blur` BlurView under tab bar.** (2h on iOS; Android falls back to solid.)
11. **Add "no seeds for your filters" empty state to RecipePickerGrid.** (30min.)
12. **Fix LogSheet desktop/mobile media-query.** Replace `desktop` prop with `useMatchMedia` resolver. (1h.)
13. **Permanently show NorthStar X on mobile (not just under reduce-motion). Or hide on web.** (15min, parity.)
14. **Add web LogFab equivalent on Today.** (2h, parity.)
15. **Variant-picker corner affordance: delete entirely.** (1h.)
16. **Sort button on Library: convert from text-cycle to a sort sheet.** (3h.)
17. **Bookmark dot on Library cards: animate fill on tap.** (1h.)
18. **Recipe detail Save / Cook / Log button row: add proper depth + press scale.** (2h.)
19. **CookMode step counter: number-flip animation on next/prev.** (2h.)
20. **Tab-bar transition: animate active-state colour shift over 200ms.** (1h.)
21. **Search input: add a clear (x) button when query non-empty.** Mobile + web LogSheet. (30min.)
22. **Result row: add scale-down on press in addition to opacity flicker.** (Covered by #1.)
23. **Paywall close X: add confirm-on-android-back-with-purchase-in-flight polish.** (1h.)
24. **Paywall TierCard: add subtle border-glow on hover/focus for the hero card.** (1h.)
25. **Promo apply button: replace "…" loading text with ActivityIndicator.** (15min.)
26. **TodayHero ring expand toggle: add 200ms eased height transition.** (1h.)
27. **NorthStarBlock no-fit "Browse →" link: add underline cue on mobile.** (15min.)
28. **Library card image: subtle 1pt inner shadow at top to anchor the image.** (15min.)
29. **Loading state for tab layout: skeleton tab bar + content skeleton instead of centred ActivityIndicator.** (1h.)
30. **Settings → list rows: confirm proper press feedback + chevron animation on tap.** (Covered by #1; verify after.)

---

## Top 10 mobile-web specific gaps

1. LogSheet sub-tab pill height < 44pt. (Top-3 #1.)
2. LogSheet desktop/mobile resolver uses prop, not media query. (Top-3 #3.)
3. NorthStar CTA on mobile-web has no hover/active states. (Top-3 #2.)
4. Web pricing grid (presumed): mobile-web column collapse may stack tiers awkwardly.
5. Onboarding step body on mobile-web: probably has desktop padding bleeding through.
6. Library card grid on mobile-web: 2-col? 1-col?
7. Discover feed images on mobile-web: lazy-loading? aspect-ratio CSS?
8. Settings on mobile-web: list rows likely too small in vertical density.
9. Modal sheets on mobile-web at iPad mobile-web range (768–1024px).
10. Focus-visible rings: great on desktop, only show on keyboard nav on mobile-web — fine.

## Top 10 web/mobile parity gaps

1. NorthStar thumbnail placeholder: mobile flat tint vs web gradient.
2. NorthStar skip X: web always-visible vs mobile reduce-motion-only.
3. LogFab mobile-only, no web equivalent.
4. Hover states exist on web mirrors only.
5. Today composition root: mobile is the new Phase-5 stack; web's `NutritionTracker.tsx` is divergent.
6. RecipeDetail (presumed): web `RecipeDetail.tsx` and mobile `recipe/[id].tsx` divergent.
7. Paywall mobile uses brand-gradient header; web pricing page (presumed) doesn't have an equivalent.
8. Library card design: 128pt image on mobile; web likely different.
9. CookMode: separate files mobile vs web.
10. Settings: separate files. List-row densities likely diverge.

---

## Open questions for `ui-product-designer`

1. **Should the over-budget NorthStar branch be a celebration moment (option A) or a calm caption (option B)?** A is what flagship apps do; B is what Suppr's "no nag, no shame" voice arguably requires. Values call.
2. **What's the press-feedback recipe across the app?** Specifically: scale value (0.96 vs 0.97), haptic intensity (light vs medium for primary CTAs), timing (120ms vs 150ms vs 180ms). Recommend 0.97 / light / 150ms; commit a single token spec.
3. **Web Today: does the LogFab pattern carry over, or is the desktop logging path the LogSheet trigger inside the page chrome?**
4. **Should `Alert.alert` be banned project-wide?** It's iOS-system-tier and breaks brand voice. Recommended replacement: shared `<InlineError>` band + `<Toast>` for transient success.
5. **What's the correct recipe for primary CTA shadows?** Need a spec (offset / opacity / radius / colour) so it propagates uniformly through `Elevation.ctaPrimary`.

---

## Routes for follow-up

- `ui-product-designer` — for upgrades #1–#5 + the five open questions.
- `visual-qa` — for top-3 mobile-web #1 (the under-44pt tap target is borderline broken).
- `journey-architect` — for parity #5 (Today web/mobile composition divergence).
- `sync-enforcer` — for parities #1, #2, #3 (NorthStar thumbnail / skip / LogFab — undocumented drift).
- `product-memory` — to record the press-feedback recipe and shadow-ladder tokens once committed.

---

**Honesty caveats:**
- Read canonical surfaces in depth (Today, NorthStar mobile + web, LogSheet mobile + web, LogFab, Paywall, Tab structure, Onboarding RecipePicker mobile + web, Library top 300 lines, TodayHero). For ~20 remaining surfaces sampled by signature/memory only — those verdicts flagged as extrapolated.
- Did not fully audit the seven cross-cutting states per surface — multi-day exercise. Gave state-coverage reads on the five surfaces read in depth; remaining ~25 need a follow-up pass.
