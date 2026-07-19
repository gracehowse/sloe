# Sloe design-consistency sweep — 2026-07-17

Full code + pixel audit across web and mobile, run via two workflows (11-part code census + adversarial verify + synthesis; 10-part visual audit of captured screenshots against `docs/ux/redesign/v3/DESIGN-CONSTITUTION.md`). Raw agent outputs preserved alongside this file (`raw-code-census-output.json`, `raw-visual-audit-output.json`); screenshots in `captures/`.

## Executive summary

38 adversarially-CONFIRMED P0/P1 design-consistency defects (17 P0, 21 P1) plus a much larger unverified backlog resolve into 15 root-cause clusters. The single highest-leverage fact: the write-time rule sources agents are told to consult (`.claude/agents/_project-context.md` and its 36 citing files) are themselves broken or contradictory — a hardcoded dead path, a Radius scale missing 24, a retired soft-shadow elevation doctrine, and a 3-way-incompatible button-hierarchy rule that matches none of the shipped code — which is the structural reason the same drift (serif-as-section-head, off-canonical card radius, ad-hoc alpha chips) keeps recurring across new PRs instead of converging. Scale: mobile's canonical CARD_RADIUS is used in only 14/198 sampled card containers (7%) vs 89 legacy radii unmigrated (~5:1); web's own Tailwind radius base token is mis-derived (sm=2px, xl=10px, neither legal) touching 272 call sites; 437 web chip/badge fills bypass the sanctioned Soft/SoftStrong tokens via untracked Tailwind slash-opacity syntax — larger than the entire currently-pinned token-scale ratchet debt (690 hits/151 files) combined and invisible to CI; web type tokens are bypassed at ~45% of sized-text declarations and mobile at ~50%; web core screens split across 3 different page gutters with 121 off-scale spacing instances and zero CI gate; and 104 files exceed the 400-line screen budget by 73,896 lines combined, with TodayScreen.tsx having grown from CLAUDE.md's own cited 3,400-line legacy example to 5,912 lines since the rule was written.

- **Code census:** 38 adversarially-confirmed P0/P1 defects, 105 additional unverified findings, resolving into **15 root-cause clusters**.
- **Visual audit:** 94 pixel-grounded findings across 9 surfaces + a whole-product coherence pass.

## Root-cause clusters (ranked remediation order)

This is the order to fix in — shared components and rule-source fixes first, since they're why the same drift keeps recurring in new PRs.

### 1. Rule-source contradictions across agent docs — P0

The write-time rules every specialist agent is supposed to consult have drifted from the ratified truth and from each other. As tokens/decisions evolved (2026-05-22 radius lock → ENG-1012 spacing-dense → 2026-06-09 soft-elevation → 2026-06-25 reversal → ENG-1497 flat+hairline 2026-07-10 → 2026-06-12 button-system → 2026-07-17 consistency contract), the `.claude/agents/*.md` restatements of those rules were never reconciled against each new ruling. Worse, the one file every agent is told to read FIRST — `_project-context.md` — is referenced via a hardcoded absolute path (`/Users/graceturner/Suppr-1/...`) that does not exist on this machine, so it never actually loads for any of the 36 files citing it, even where its content is otherwise correct.

**Evidence:** 36/36 `.claude/agents/*.md` files cite a nonexistent context path (ENOENT confirmed via `ls`). 5 sites (incl. `_project-context.md` itself, `apps/mobile/CLAUDE.md`, `design-director.md`, `visual-qa.md`, `design-system-enforcer.md`) restate the Radius scale without 24 (the ENG-1497 card corner) — `visual-qa.md` even encodes this as an executable check, meaning it would flag every legitimate 24px card as a violation. 5 sites cite the retired 2026-06-09 'soft-lift' elevation doctrine verbatim instead of the current flat+hairline ruling. The button-hierarchy rule is stated 3 mutually incompatible ways: CLAUDE.md/AGENTS.md say 'secondary = outline,' DESIGN-CONSTITUTION.md says 'secondary = tonal,' and the shipped `SupprButtonVariant` type only has `"primary" | "ghost"` — none of the three docs matches the code. `design-system-enforcer.md`'s entire operating law is anchored to a superseded dark-first prototype bundle two design generations behind the current Sloe v3 ship state.

**Root cause:** Token/decision rulings landed in the codebase and root CLAUDE.md/AGENTS.md but the parallel restatements baked into specialist-agent prompt files were never updated in lockstep, and a literal path typo (a prior machine's home directory) has silently broken the one shared-context read every agent is told to perform.

**Remediation:** Doc fix, mechanical and cheap: (1) one `sed` across all 36 files fixing the broken path (or switch to a relative path); (2) correct the 5 Radius-scale-missing-24 sites and 2 spacing-missing-12 sites; (3) correct the 5 stale-elevation-doctrine sites to ENG-1497 flat+hairline; (4) reconcile the 3-way button-hierarchy contradiction to state the shipped truth everywhere; (5) rewrite `design-system-enforcer.md` off the superseded prototype bundle onto `Sloe-App.html`/`DESIGN-CONSTITUTION.md`. Do this first — it's the reason every other cluster below keeps recurring.

**Files:**
- `.claude/agents/_project-context.md`
- `apps/mobile/CLAUDE.md`
- `.claude/agents/design-director.md`
- `.claude/agents/visual-qa.md`
- `.claude/agents/design-system-enforcer.md`
- `.claude/agents/ui-critic.md`
- `.claude/agents/ui-product-designer.md`
- `.claude/agents/premium-auditor.md`
- `.claude/CLAUDE.md`
- `AGENTS.md`

### 2. Web radius token-ladder bug at the source — P0

Web's non-card Tailwind radius scale (`rounded-sm/md/lg/xl`) is derived via `calc()` offsets from a single 6px `--radius` base instead of being independently pinned to the legal 4/6/8/12/24/full ladder. This silently produces sm=2px and xl=10px — neither a legal value — across every one of the 272 call sites using those two classes, and the ratchet script allowlists them by class name rather than checking the resolved value.

**Evidence:** theme.css:929-932: `--radius-sm: calc(var(--radius) - 4px)` = 2px, `--radius-xl: calc(var(--radius) + 4px)` = 10px, base `--radius: 0.375rem` (6px) at line 54. 36 call sites use rounded-sm, 236 use rounded-xl. `check-web-radius.mjs` explicitly allowlists these named classes; its own code comment ('rounded-xl = 10px chrome until a later slice') carries no Linear ticket — itself a no-silent-deferral violation.

**Root cause:** The web radius ladder was generated by mathematical offset from a single base rather than independently authored to match the canonical mobile `Radius` object, and the offset was never reconciled with the 4/6/8/12/24/full ladder ratified alongside it.

**Remediation:** Mechanical token fix in one file: redefine `--radius-sm=4px`, `--radius-md=6px`, `--radius-lg=8px`, `--radius-xl=12px` as independent pinned values (not calc() offsets); file the missing Linear ticket; switch `check-web-radius.mjs` to value-based validation instead of name-based allowlisting so this class of bug can't recur.

**Files:**
- `src/styles/theme.css`
- `scripts/check-web-radius.mjs`
- `docs/decisions/2026-07-10-card-grammar-rounder-flat.md`

### 3. Web/mobile shared-primitive parity gaps — P0

SupprCard and SupprButton are documented in both platforms' own docstrings as mirrored primitives, but the actual padding/size maps were authored independently and have drifted by a full tier — this is invisible per-call-site but cascades silently to every consumer that passes an explicit prop, since the primitive itself is the point of divergence, not the call site.

**Evidence:** Web SupprCard paddingClasses: sm=8/md=12/lg=16/xl=20px vs mobile paddingValues: sm=8/md=16/lg=20/xl=24px — md/lg/xl shifted one tier apart, confirmed at TodayDashboardMacroBars (padding="md": 12px web vs 16px mobile) and ProgressTrajectoryHero (padding="lg": 16px web vs 20px mobile hand-rolled Spacing.lg). Web SupprButton has no `size` prop at all (mobile has md/sm), forcing one-off Tailwind height overrides at call sites. Paywall primary CTA renders as a 10px rounded-rect on web vs a full 9999px pill on mobile, with a 13px vs 16px label.

**Root cause:** Two engineers/agents built 'the same' primitive on each platform against different base units with no cross-platform parity test, so both docstrings' mirroring claim was never actually verified in code.

**Remediation:** Component-level token-alignment fix on the two shared files: pick one padding/size scale as ground truth (recommend mobile's Spacing-derived values since they're already on-scale) and align the other; add a size prop to web's SupprButton; add a lightweight parity test asserting the two maps stay equal so this can't silently re-drift. One fix cascades to every consuming card/button without touching call sites.

**Files:**
- `src/app/components/ui/suppr-card.tsx`
- `apps/mobile/components/ui/SupprCard.tsx`
- `src/app/components/suppr/suppr-button.tsx`
- `apps/mobile/components/ui/SupprButton.tsx`
- `src/app/components/suppr/today-dashboard-macro-bars.tsx`
- `apps/mobile/components/today/TodayDashboardMacroBars.tsx`
- `src/app/components/suppr/progress-hierarchy/progress-trajectory-hero.tsx`
- `apps/mobile/components/paywall/PaywallCta.tsx`
- `src/app/components/suppr/upgrade-paywall-dialog.tsx`

### 4. Header trailing-action-button shape drift, blocked on an unramped flag — P0

The code fix for this is already shipped and correct — Plan, Recipes, and Progress all converge on one 40px muted-circle icon button under `primary_screen_chrome_v1` — but the flag is registered default-OFF on both platforms with no PostHog rollout, so production today still shows three visibly different trailing-button treatments on three adjacent daily-loop tabs.

**Evidence:** Plan legacy: 38x38 hairline-bordered+shadowed square (Radius.xl/12). Recipes legacy: bare icon, 6px padding, no shape at all. Progress legacy: 36x36 bordered circle. `primary_screen_chrome_v1` confirmed inside `KNOWN_DEFAULT_OFF_FLAGS` on both `apps/mobile/lib/analytics.ts:797` and `src/lib/analytics/track.ts:633`, not in either platform's `REDESIGN_DEFAULT_ON` set.

**Root cause:** Per the project's own feature-flag policy, visual changes ship gated and ramp via PostHog dashboard — this is working as designed, but nobody has pulled the trigger on the ramp since the code merged (commit 0376b00a).

**Remediation:** Process fix, not a code fix: ramp `primary_screen_chrome_v1` via the PostHog dashboard per the standard canary→100% window; remove the flag fork in a follow-up cleanup PR once it holds 2 weeks clean. Nearly free, resolves multiple P0 findings (this cluster plus the page-title-drift and Settings-title-mismatch clusters) at once.

**Files:**
- `apps/mobile/components/plan/PlanHeaderV3.tsx`
- `src/app/components/plan/PlanHeaderV3.tsx`
- `apps/mobile/components/tabs/RecipesTabChrome.tsx`
- `src/app/components/suppr/recipes-tab-chrome.tsx`
- `apps/mobile/app/(tabs)/progress.tsx`
- `src/app/components/ProgressDashboard.tsx`
- `apps/mobile/lib/analytics.ts`
- `src/lib/analytics/track.ts`

### 5. Chip/pill soft-tint Tailwind-opacity blindspot (largest untracked debt) — P0

The ENG-1521 soft-tint remediation fixed mobile's alpha-concat/`withAlpha()` bypass but never covered the web-equivalent idiom — Tailwind's `bg-<semantic>/<NN>` slash-opacity syntax — which none of `check-token-scale.mjs`'s four regexes match (they only catch literal Tailwind palette hue names, not semantic names like `primary`/`warning`). This is structurally invisible to CI and larger than the entire currently-tracked legacy debt.

**Evidence:** 437 line-hits across 142 web files for the `bg|border|text-(primary|success|warning|destructive|muted)/NN` pattern — vs the entire pinned token-scale ratchet's 690 hits across 151 files (combined hex+rgba+Tailwind-palette+alpha-concat, both platforms). Confirmed live in the shared Badge primitive (`badge.tsx:39-58`, 7 variant fills) and in MealPlanner's Plan-tab option pills, whose own code comments cite mobile's now-superseded ~10% opacity value as their 'parity' justification — mobile has since migrated to `accent.primarySoft` (documented in-code as the ENG-1521 fix).

**Root cause:** check-token-scale.mjs's TW_RE regex only matches numeric Tailwind palette hues (e.g. `violet-500`), not semantic slash-opacity utilities (`bg-primary/10`) — a coverage gap in the ratchet itself, not a call-site mistake repeated 437 times independently.

**Remediation:** Rule-source fix first (cheap): add a 5th regex to check-token-scale.mjs matching semantic-color slash-opacity classes to stop growth immediately. Then mechanically migrate the 437 sites to the existing named Soft/SoftStrong tokens, starting with the shared `badge.tsx` primitive (cascades to every Badge consumer) and MealPlanner's pills (target value already documented in mobile's code comment).

**Files:**
- `src/app/components/MealPlanner.tsx`
- `src/app/components/ui/badge.tsx`
- `src/app/components/suppr/today-fasting-pill.tsx`
- `src/app/components/suppr/today-hero-stats.tsx`
- `src/app/components/suppr/upgrade-paywall-dialog.tsx`
- `src/app/components/imports/CsvImportPreview.tsx`
- `src/app/components/imports/NamedTrackerReassuranceStrip.tsx`
- `scripts/check-token-scale.mjs`

### 6. Serif used for structural section labels instead of the mandated overline — P0

The 2026-07-17 Design Constitution states 'serif never labels structure' — structural section groupers must be the 11px tracked-caps sans overline (Type.label) — but this rule postdates most of the offending components, and no shared SectionLabel component was ever built to enforce it. As a result, serif Type.title/Type.headline labels structural dividers on 4 of 6 core daily-loop surfaces, sometimes with an explicit comment confirming it was a deliberate (now-superseded) choice.

**Evidence:** 13+ confirmed instances: Today 'Activity & energy'/'Hydration & stimulants' (native+web, Type.title 24px serif); Progress §2-5 headers (Expenditure/Body composition/Maintenance/Journey, Type.headline serif) — directly named by the Constitution's own inconsistency ledger as unremediated; RecipeDetail 'Ingredients'/'Method' (Type.title, carrying a stale 2026-06-10 comment predating the ruling); web Settings' 8 section headers (20px serif) despite mobile Settings already migrating the identical labels to 11px sans overlines with an explicit code comment documenting the fix web never received; a bare `<h2>` in today-week-sidebar.tsx inheriting serif from the global heading rule.

**Root cause:** The label-grammar rule was ratified after most of these components shipped, and no lint/component enforcement exists to catch serif-as-structure — mobile Settings' independent fix proves the correct pattern was known, it just never propagated.

**Remediation:** Component extraction: canonicalize one `<SectionLabel>`/overline component on each platform (11px/700/uppercase/tracked-0.1em/fg-tertiary = Type.label), matching mobile Settings' already-correct implementation, then swap every cited serif call site to consume it. Highest visible-consistency-per-effort fix in the audit — one component change resolves the single largest P0 cluster.

**Files:**
- `apps/mobile/components/today/TodayScrollSectionHeader.tsx`
- `apps/mobile/components/progress/ExpenditureTrendCard.tsx`
- `apps/mobile/components/progress/BodyCompositionTrendCard.tsx`
- `apps/mobile/app/(tabs)/progress.tsx`
- `apps/mobile/components/recipe/RecipeIngredientGrid.tsx`
- `apps/mobile/components/recipe/RecipeMethodSteps.tsx`
- `src/app/components/Settings.tsx`
- `src/app/components/suppr/today-week-sidebar.tsx`
- `src/app/components/suppr/today-scroll-section-header.tsx`
- `apps/mobile/components/settings/SettingsBundleContent.tsx`

### 7. Section-label / page-title authoring fragmentation (no shared component) — P0

Two design decisions — 'uppercase tracked overline' and 'brand serif page title' — each have exactly one canonical CSS class in theme.css, but adoption is a small minority: hundreds of call sites hand-roll near-duplicate Tailwind strings that vary in size, weight, and tracking with no shared component forcing consumption of the canonical class.

**Evidence:** 48 distinct (size, weight, tracking) signatures found for the uppercase-overline role across ~257 instances, vs `.section-label` used at only 18 sites in 8 files — MealPlanner.tsx alone shows both an 11px/bold/0.1em and a 10px/semibold/tracking-wide version in the same file. The ratified `.page-title` (33px/500/-0.012em, ENG-1574/1577) is live in only 2 files (Settings.tsx, ProgressDashboard.tsx) behind the same unramped flag as cluster 4; at least 13 other product h1s remain on distinct pre-existing ad hoc treatments (24-34px, medium/semibold/bold/extrabold). ProgressDashboard.tsx additionally leaves its Suspense-fallback skeleton h1 on the old 28px treatment, unconditional on the flag.

**Root cause:** No lint rule or component requirement forces consumption of `.section-label`/`.page-title` over hand-rolled Tailwind strings, so each screen's author independently re-derived a 'close enough' variant; web additionally has no ratchet at all for this category (mobile's type-scale-mobile ratchet only catches off-ramp fontSize, not on-scale-but-wrong-role authoring).

**Remediation:** Mechanical sweep gated on cluster 6's SectionLabel component: once built, replace the 257+ hand-rolled overline instances and 13+ ad hoc page-title instances with the shared classes; add a new ratchet regex for uppercase+tracking Tailwind strings that aren't `.section-label` to prevent regrowth; also fix DeleteAccountSheet.tsx's use of Tailwind's generic (unremapped) `font-serif` instead of the brand Newsreader token.

**Files:**
- `src/app/components/MealPlanner.tsx`
- `src/app/components/ProgressDashboard.tsx`
- `src/app/components/RecipeDetail.tsx`
- `src/app/components/settings/DeleteAccountSheet.tsx`
- `src/app/components/Profile.tsx`
- `src/app/components/ShoppingList.tsx`
- `src/app/components/HouseholdSettingsPage.tsx`
- `app/checkout/success/page.tsx`
- `src/app/components/DiscoverFeed.tsx`
- `src/app/components/Targets.tsx`

### 8. Trust/confidence chip and badge color fork (web retired palette; rogue hues) — P0

Mobile ran a 'chips census' remediation (commit 9c32d3db, 2026-06-10) replacing retired blue/indigo/slate rgba literals with token-derived Accent.*Soft washes; the web mirrors were never touched despite their own doc comments claiming to describe the identical spec. Separately, a pre-rebrand green and a rogue blue persist as copy-pasted literals in several unrelated files.

**Evidence:** trust-chip.tsx: 6 variant fills all raw rgba, including rgba(76,108,224,0.12) — a saturated blue with zero other consumers in the ratified 6-hue Sloe palette. confidence-chip.tsx:51 hardcodes slate-400 rgba while its own comment claims it reads the `--confidence-neutral` token — it never does. Both pinned in scripts/token-budget.json (6 + 1 hits) confirming this is tracked-but-unfixed debt. Separately: TodayHero.tsx's 'On track' pill uses #56A775 (a pre-2026-06-03-rebrand green, its own comment incorrectly claiming no Accent.successSoft token exists) vs the canonical #5E7C5A, duplicated in web's confetti; HouseholdSettingsPage.tsx uses a third green (#7C8466); SearchResultConfidenceChip.tsx's 'verified' tier uses a raw blue (#588CE4) matching no palette hue.

**Root cause:** The 2026-06-10 chips census was scoped to mobile only and never had a corresponding web follow-up ticket, so the web mirrors' doc comments describe a fix that was applied to the wrong platform.

**Remediation:** Mechanical fix: port the exact mobile token substitution (Accent.successSoft/primarySoft/warningSoft/confidenceNeutralSoft) to trust-chip.tsx and confidence-chip.tsx (8 rgba sites); replace the rogue-blue/green literals with their canonical Accent tokens at the 4 cited sites; re-pin scripts/token-budget.json lower afterward.

**Files:**
- `src/app/components/ui/trust-chip.tsx`
- `src/app/components/ui/confidence-chip.tsx`
- `apps/mobile/components/ui/TrustChip.tsx`
- `apps/mobile/components/ui/ConfidenceChip.tsx`
- `apps/mobile/components/ui/SearchResultConfidenceChip.tsx`
- `apps/mobile/components/today/TodayHero.tsx`
- `src/app/components/TodayAtAGlance.tsx`
- `src/app/components/HouseholdSettingsPage.tsx`
- `src/components/NutritionSourceBadge.tsx`
- `apps/mobile/components/Badge.tsx`

### 9. Mobile card-radius drift (hand-rolled cards never adopted CARD_RADIUS) — P0

SupprCard/CARD_RADIUS (24px, ENG-1497) is a well-designed, internally-consistent primitive, but a large population of pre-existing hand-rolled `colors.card` containers built against the older 2026-05-22 4/6/8/12 lock never migrated to it. The ratchet can't catch this because a 'legal but wrong tier' token reference (e.g. `Radius.md` where `Radius.card` belongs) isn't a raw off-scale literal.

**Evidence:** Card-fill census (198 sampled instances, 96 files): canonical CARD_RADIUS used at only 14 sites (7%) vs 89 legacy pre-Sloe radii (Radius.lg 35 + Radius.md 30 + Radius.xl 20 + Radius.sm 3 + raw 1) — roughly 5:1 unmigrated. Confirmed live: Digest.tsx's loaded-state card (24px) vs its own loading/error states (8px) — a visible corner-radius pop on data load; DigestBlended.tsx (the sibling weekly-recap component for the identical feature) never migrated at all, staying at 8px in every state; cook.tsx's two celebration/summary cards at 6px and 8px; recipe/verify.tsx's 3 cards at 8px/8px/6px; TodayScreen.tsx's `dateNav` at 6px sitting 7 lines from its own file's correct 24px `card` style; LogSheet.tsx/FoodSearchPanel.tsx disagreeing at 12px vs 8px for the same logged-item-summary card one screen apart.

**Root cause:** CARD_RADIUS was introduced on top of an already-large card population without a migration sweep, and check-token-scale.mjs structurally cannot detect a legal-value-wrong-tier token misuse (only raw off-scale literals).

**Remediation:** Mechanical fix: swap `borderRadius: Radius.md/lg/xl` to `CARD_RADIUS`/`Radius.card` at the ~89 legacy sites, prioritizing Digest.tsx/DigestBlended.tsx (visible pop + sibling-component disagreement) first. Add a lint/ratchet rule flagging any `colors.card` fill without `CARD_RADIUS`/`Radius.card`.

**Files:**
- `apps/mobile/components/Digest.tsx`
- `apps/mobile/components/DigestBlended.tsx`
- `apps/mobile/app/cook.tsx`
- `apps/mobile/app/recipe/verify.tsx`
- `apps/mobile/app/(tabs)/_today/TodayScreen.tsx`
- `apps/mobile/components/today/LogSheet.tsx`
- `apps/mobile/components/food-search/FoodSearchPanel.tsx`

### 10. Web retired 16px card tier backlog and same-element radius splits — P1

`rounded-2xl` (16px) was the pre-ENG-1497 card tier; suppr-card.tsx explicitly retired it and the ratchet pins the backlog so it can't grow, but no scheduled migration was ever run — so ~86 occurrences across 53 files remain live, sometimes literally beside a correctly-migrated 24px sibling in the same render tree.

**Evidence:** 86 rounded-2xl/rounded-t-2xl occurrences across 53 files (check:web-radius confirms OK/no-growth, 89 legacy hits per its pin). RecipeDetail.tsx: a SupprCard allergen callout at 24px sits 4 lines above an unconditional `rounded-2xl` Creator Info card (16px) using the identical whiteSlabStyle background — repeated at 2 more sites in the same file, none gated by the recipeDetailV3 flag. ProgressMetricDetail.tsx: 7 card containers all at `rounded-xl` (10px, itself off-scale per cluster 2) instead of 24px. FoodSearchPanel.tsx's legacy `grammarDedup=false` path still wraps results in a 16px card.

**Root cause:** The ratchet correctly prevents growth but was never paired with a scheduled shrink program, so 'tracked debt' has sat static since being pinned.

**Remediation:** Component-extraction + mechanical sweep: replace `rounded-2xl`/ad hoc `bg-card+border` divs with `<SupprCard radius="lg">` or `rounded-card-lg`; prioritize RecipeDetail.tsx (3 instances beside a correct sibling, clearest repro) and consider retiring FoodSearchPanel's legacy `grammarDedup=false` path entirely rather than fixing it, since the true path already supersedes it.

**Files:**
- `src/app/components/ui/suppr-card.tsx`
- `src/app/components/RecipeDetail.tsx`
- `src/app/components/ProgressMetricDetail.tsx`
- `src/app/components/food-search/FoodSearchPanel.tsx`
- `src/app/components/RecipeUpload.tsx`
- `app/dev/recipe-detail-redesign/page.tsx`

### 11. Resting shadow on page-ground cards (ENG-1497 violation) — P1

ENG-1497 (2026-07-10) ruled resting page-ground cards flat + hairline, exempting only hover/pressed/focus elevation — but no CI gate checks for 'shadow class co-occurring with a page-ground card signature,' so pre-ruling shadow usage was never swept and still ships on multiple pricing/targets/upgrade surfaces.

**Evidence:** UpgradePrompt.tsx:39 `rounded-2xl border-2 ... shadow-lg` unconditional (not hover-gated). Same pattern at PromoCodeBlock.tsx:82, PricingHeroCta.tsx:76, Targets.tsx (3 sites, 394/502/562), PricingTiersGrid.tsx (208-209), WhyNumberV3Section.tsx:81 (a tinted nested card — should be flat per the same ruling). Also 1 dead CSS var reference (`--shadow-card` never defined) silently resolving to no-op in OnboardingRevealProjectionChart.tsx.

**Root cause:** No automated gate exists for 'no resting shadow on a page-ground card' on web — check-web-radius only checks radius, check-token-scale only checks color/radius literals — so the shadow half of the ENG-1497 ruling was never enforced the way the radius half was.

**Remediation:** Mechanical fix: drop `shadow-*` classes from the ~11 cited resting-card sites; add a new check (extend check-web-radius.mjs or a new script) flagging `bg-card`/`border-border` combinations co-occurring with an unconditional `shadow-*` class.

**Files:**
- `src/app/components/UpgradePrompt.tsx`
- `src/app/components/Targets.tsx`
- `src/app/components/suppr/WhyNumberV3Section.tsx`
- `app/pricing/PromoCodeBlock.tsx`
- `app/pricing/PricingHeroCta.tsx`
- `app/pricing/PricingTiersGrid.tsx`
- `app/global-error.tsx`
- `app/error.tsx`
- `src/app/components/FeatureErrorBoundary.tsx`

### 12. Off-ramp hero/CTA serif literals bypass Type tokens — P1

Literal `fontSize: 30`/`34` predate Type.display(32)/Type.pageTitle(33) being formalized as canonical hero-size tokens; they're pinned in the mobile type-scale-mobile ratchet as legacy debt (CI-invisible by design), and a separate set of 5 sites misuse serif Type.headline for CTA button labels despite theme.ts's own inline doc explicitly reserving sans Type.button for controls.

**Evidence:** 7 sites at literal fontSize:30 (progress.tsx, loginStyles.tsx, PaywallHero.tsx, DigestStoryCard.tsx, TrajectoryCard.tsx, RecipeDetailHero.tsx, RecipeMethodSteps.tsx), 4 at fontSize:34 (onboarding pace.tsx, GoalPaceSlider.tsx, RecipeTitleBlock.tsx, WhyNumberV3Section.tsx) — all pinned in scripts/type-scale-mobile-budget.json. RecipeDetail's own title renders at two different off-ramp sizes (34 below-hero vs 30 in the hero overlay) for the same semantic element. Separately, 5 sites (TodayFirstMealEmptyState.tsx, TodayAddFoodForm.tsx, TodayEditMealModal.tsx, RootErrorBoundary.tsx, TodayFreshDayLogPill.tsx) set serif Type.headline on button labels, contradicting theme.ts's documented Type.button rule.

**Root cause:** These literals predate the Type ramp's hero-size tokens being formalized; the type-scale-mobile ratchet pins them as legacy debt (correctly stopping growth) but nothing forces active migration, and the CTA-label misuse looks like unreasoned copy-paste drift distinct from a documented intentional serif-CTA exception elsewhere in the code.

**Remediation:** Mechanical fix: replace literal fontSize:30/34 with Type.display/Type.pageTitle spreads at all 11 cited sites; replace Type.headline with Type.button at the 5 CTA sites; re-pin scripts/type-scale-mobile-budget.json lower after each shrink.

**Files:**
- `apps/mobile/app/(tabs)/progress.tsx`
- `apps/mobile/components/login/loginStyles.tsx`
- `apps/mobile/components/paywall/PaywallHero.tsx`
- `apps/mobile/components/recipe/RecipeTitleBlock.tsx`
- `apps/mobile/app/recipe/RecipeDetailHero.tsx`
- `apps/mobile/components/recipe/RecipeMethodSteps.tsx`
- `apps/mobile/components/today/TodayFirstMealEmptyState.tsx`
- `apps/mobile/components/today/TodayAddFoodForm.tsx`
- `apps/mobile/components/today/TodayEditMealModal.tsx`
- `apps/mobile/components/ui/RootErrorBoundary.tsx`

### 13. CTA/button system cross-platform mismatch and missing interaction states — P1

Beyond the shared-primitive padding/size drift (cluster 3), individual CTA implementations diverge in type size across platforms (LogSheet title 24/400 mobile vs 22/500 web; Settings title 24px mobile vs 28px web before the unifying flag ramps) and a population of ad-hoc `<button>` elements bypassing the primitive entirely ship with no `:focus-visible` state, even though sibling ad-hoc buttons in the same codebase prove the pattern is cheap and known.

**Evidence:** LogSheet.tsx:522 (mobile, Type.title 24/400) vs log-sheet.tsx:539 (web, text-[22px] font-medium) despite both files' comments claiming shared 'editorial-heading grammar.' RecipeDetail's web 'Generate an image' CTA bypasses SupprButton entirely, using bg-primary instead of bg-primary-solid — a dark-mode-only color divergence from its mobile counterpart. 12 sampled ad-hoc web buttons (incl. 2 monetization Upgrade CTAs) carry zero focus-visible classes, vs 4 sibling ad-hoc buttons in the same codebase that do (proving the pattern is known, just inconsistently applied). Library.tsx duplicates the same 234-character hand-rolled secondary-button markup twice instead of extracting a shared sub-component.

**Root cause:** Web's SupprButton exposing no size prop (cluster 3) incentivizes call-site-level one-off overrides that then drift independently from mobile; focus-visible coverage was never centralized into the shared primitive so it depends on each author remembering to add it by hand.

**Remediation:** Once cluster 3's size prop lands, sweep the ~12 cited focus-visible gaps (add `focus-visible:ring-2` or route through Button/SupprButton); route RecipeDetail's raw CTA through SupprButton to fix the dark-mode color bug; extract Library.tsx's duplicated secondary-button markup into a shared sub-component.

**Files:**
- `apps/mobile/components/today/LogSheet.tsx`
- `src/app/components/suppr/log-sheet.tsx`
- `apps/mobile/app/settings.tsx`
- `src/app/components/RecipeDetail.tsx`
- `src/app/components/UpgradePrompt.tsx`
- `src/app/components/DayStrip.tsx`
- `src/app/components/Targets.tsx`
- `src/app/components/Library.tsx`
- `src/app/components/RecipeUpload.tsx`

### 14. Screen-frame rhythm fragmentation (gutters, section gaps, spacing) — web ungated — P0

Mobile has an only-shrink spacing ratchet scoped explicitly to itself, with a code comment promising a separate web gate that was never built. As a result, web's page gutter, inter-section gap mechanism, and off-scale spacing literals have zero CI enforcement and have fragmented across the 9 core screens; mobile has a smaller, bounded version of the same split.

**Evidence:** Web page gutter: 40px (`.product-shell`) x7 screens vs 32px (Targets.tsx) x1 vs 24px un-tokenized `px-6` (RecipeDetail.tsx) x1. Web section-gap mechanism: 4 screens use a single `space-y-N` (16-20px, not even uniform among themselves) vs 5 screens (Settings, Progress, Targets, Profile, RecipeDetail) hand-roll per-child `mb-N` that drifts mid-screen (Settings: `mb-8` then `mb-6` back-to-back). 121 off-scale fractional/bracket spacing instances across the 9 web screens, 19 of them exactly the 10px-gap example the design contract itself names as the canonical bug — confirmed with zero CI gate (`check:spacing-scale` is mobile-only per its own scope comment). Mobile gutter split: 24px x8 screens vs 20px x2 (Today/Plan, documented intentional) — but Recipes, the third primary tab, never joined the tighter tier despite being the same screen class.

**Root cause:** The promised web spacing ratchet from check-spacing-scale.mjs's own scope comment was never built, so web spacing debt accumulated with no visibility, unlike mobile's bounded/shrinking equivalent.

**Remediation:** Rule-source fix first: build the promised web spacing ratchet (mirror check-spacing-scale.mjs's regex approach against Tailwind fractional/bracket utilities). Then mechanically migrate the 9 web screens onto `.product-shell`'s single 40px gutter and one container-level `space-y-N` token; decide whether Recipes should join Today/Plan's 20px density tier.

**Files:**
- `src/app/components/Targets.tsx`
- `src/app/components/RecipeDetail.tsx`
- `src/app/components/Settings.tsx`
- `src/app/components/Profile.tsx`
- `src/app/components/MealPlanner.tsx`
- `apps/mobile/constants/layout.ts`
- `apps/mobile/app/(tabs)/_today/TodayScreen.tsx`
- `apps/mobile/app/(tabs)/planner.tsx`
- `scripts/check-spacing-scale.mjs`

### 15. Structural file-size debt (400-line screen budget) on core-loop screens — P0

CLAUDE.md's own named legacy example (a 3,400-line index.tsx) is stale — TodayScreen.tsx has grown to 5,912 lines (+74%) since the rule was written, and planner.tsx to 4,754 lines. The only-shrink ratchets let files re-pin lower but nothing forces active shrinkage, so the largest files keep growing instead of being extracted into `use<Screen>()` hooks per the rule's own prescription.

**Evidence:** 288 distinct files carry at least one pinned ratchet violation across the 5 budgets; 104 files exceed the 400-line screen budget by 73,896 lines combined (avg ~710 lines over per flagged file). planner.tsx (weighted debt 192, highest in the audit) and TodayScreen.tsx (weighted 186) dominate; 10 files are pinned in 4-of-5 budgets simultaneously (compounding-debt/rewrite-candidate set: CreateCustomFoodSheet.tsx, PhotoLogSheet.tsx, progress-metric.tsx, VoiceLogSheet.tsx, DigestBlended.tsx, onboarding pace.tsx, TodayWeekView.tsx, paywall.tsx, creator/[id].tsx, RulerSlider.tsx).

**Root cause:** Only-shrink ratchets prevent regression but provide no forcing function for active remediation, so the largest files keep growing under continued feature work instead of shrinking per the rule's stated intent.

**Remediation:** Component extraction (not mechanical): split planner.tsx and TodayScreen.tsx into `use<Screen>()` hooks and child components per the existing rule, starting with the 10 files pinned in 4-of-5 budgets since fixing structure there also clears their spacing/token/pressable pins in the same pass. Largest effort, lowest visible-consistency-per-unit-work in this audit — schedule opportunistically, not first.

**Files:**
- `apps/mobile/app/(tabs)/planner.tsx`
- `apps/mobile/app/(tabs)/_today/TodayScreen.tsx`
- `src/app/components/RecipeUpload.tsx`
- `apps/mobile/components/CreateCustomFoodSheet.tsx`
- `apps/mobile/components/settings/SettingsBundleContent.tsx`
- `src/app/components/RecipeDetail.tsx`
- `apps/mobile/components/food-search/FoodSearchPanel.tsx`
- `apps/mobile/components/PhotoLogSheet.tsx`
- `apps/mobile/components/BarcodeScannerModal.tsx`
- `src/app/components/MealPlanner.tsx`

## Confirmed code-level defects (full list)

38 findings, adversarially verified (each was independently attacked by a refuter agent reading the actual code before being kept). Grouped by cluster.

### card-radius-drift (6)

- **[P0] Progress-tab week-digest card changes corner radius between loading/error and loaded states**
  - `apps/mobile/components/Digest.tsx:293` (mobile)
  - Measured: Loading state (line 231) and error state (line 263) render the digest card at `borderRadius: Radius.lg` (8px); once data loads, the SAME card (testID="digest", line 290-293) switches to `borderRadius: CARD_RADIUS` (24px).
  - Expected: One radius for one card, in all states — ENG-1497 page-ground grammar is 24 (Radius.card) throughout; the loading/error skeleton corner should match the content it's standing in for.
  - Note: Rendered directly on app/(tabs)/progress.tsx via <Digest/> (line ~2147) — user sees the card's own corner radius jump ~3x on load, a visible pop on a core daily-loop surface.
- **[P0] DigestBlended (weekly-recap) week-digest card uses a different radius than Digest (Progress tab) for the same feature**
  - `apps/mobile/components/DigestBlended.tsx:208` (mobile)
  - Measured: Main card container (testID="digest") renders at `borderRadius: Radius.lg` (8px), consistently across loading (line 104), error (line 136) and loaded (line 208) states.
  - Expected: DigestBlended and Digest render the identical conceptual "week digest" card (one is consumed on weekly-recap.tsx, the other on progress.tsx) and per the 'same element, same treatment' rule should share one radius — Digest's own loaded state already uses the canonical CARD_RADIUS (24).
  - Note: Two sibling components implementing the same feature disagree on radius (8 vs 24) — neither ever reconciled. Also note line 212 `marginBottom: 14` is off the 4/8/12/16/20/24/32/40 spacing scale (separate finding, not scored here).
- **[P1] cook.tsx (Cook session, part of the Recipes/RecipeDetail core loop) never adopted the CARD_RADIUS grammar — 2 card-like containers, 2 different off-canonical radii**
  - `apps/mobile/app/cook.tsx:1198` (mobile)
  - Measured: `lastTimeCard` (line 1193-1205, colors.card fill + border + padding) = `Radius.md` (6px). `doneCard` (line 1297-1306, same fill/border/padding pattern) = `Radius.lg` (8px). Zero uses of CARD_RADIUS/Radius.card anywhere in the file (grep confirms 9 borderRadius declarations, all Radius.full/md/lg/sm — none at 24).
  - Expected: Both are page-ground resting cards (background + border + padding, holding primary content) and should render at Radius.card (24) per ENG-1497, matching every other page-ground card on the Recipes surface.
  - Note: doneCard is the cook-completion celebration surface — a moment of positive reinforcement rendered at the pre-Sloe radius while every other completion/celebration surface in the app (e.g. Today's target-celebration toast, Milestone30DayModal) has been redesigned around the current grammar.
- **[P1] recipe/verify.tsx (recipe-import verify screen) renders 3 card-like containers at 2 off-canonical radii, none matching CARD_RADIUS**
  - `apps/mobile/app/recipe/verify.tsx:745` (mobile)
  - Measured: totalsCard (line 744-748, backgroundColor colors.card) = Radius.lg (8px). ingList (line 756-763) = Radius.lg (8px). expandedSection (line 823-827, backgroundColor colors.card) = Radius.md (6px). Confirmed via grep/read against apps/mobile/constants/theme.ts (Radius.lg=8, Radius.md=6, Radius.card=24).
  - Expected: Radius.card (24) for the page-ground totals/ingredient cards; Radius.xl/INSET_RADIUS (12) if these are meant to read as nested-on-a-card panels — but currently neither tier is used, just the pre-Sloe 8/6 ladder.
  - Note: This is the confirmation screen at the end of the recipe-import wedge (a permanent conversion surface per docs/decisions) — worth prioritizing given its funnel importance.
- **[P1] Today-screen date navigator renders at Radius.md while the very next card style in the same file uses CARD_RADIUS**
  - `apps/mobile/app/(tabs)/_today/TodayScreen.tsx:2909` (mobile)
  - Measured: `dateNav` style (colors.card fill + padding, line 2904-2912) = `borderRadius: Radius.md` (6px). The `card` style defined 6 lines later in the same `StyleSheet.create` block (line 2916-2924) = `borderRadius: CARD_RADIUS` (24px).
  - Expected: If dateNav is meant to read as a card-tier surface (it shares the colors.card fill + padding pattern), it should match its sibling at 24; if it's deliberately chrome/nav rather than a card, it should move off the colors.card token to signal that distinction, per 'same element, same treatment or document why not'.
  - Note: Lowest-severity of the Today findings since dateNav functions more as a nav strip than a content card, but it is directly adjacent in the source to the file's own canonical card style, making the mismatch highly visible to anyone touching the file.
- **[P1] Log-flow reviewed-item card and food-confirm macro-preview card both sit at off-canonical radii**
  - `apps/mobile/components/today/LogSheet.tsx:1460` (mobile)
  - Measured: LogSheet.tsx line 1457-1465 (product-name/brand review card, colors.card + border + padding) = `borderRadius: Radius.xl` (12px). FoodSearchPanel.tsx line 1692-1696 (macro-preview confirm card, same fill/border/padding pattern) = `borderRadius: Radius.lg` (8px).
  - Expected: Both are page-ground content cards inside the Log core-loop flow and should share Radius.card (24) with each other and with every other Log-surface card.
  - Note: Two different radii (12 vs 8) for what is functionally the same kind of card (a single logged/matched item summary) one screen apart in the same flow — companion file: apps/mobile/components/food-search/FoodSearchPanel.tsx:1693.

### radius-scale-token-drift (1)

- **[P0] Web radius token ladder doesn't match the canonical 4/6/8/12/24/full scale — sm/xl render numerically off-grammar for 272 call sites**
  - `src/styles/theme.css:929` (web)
  - Measured: `--radius: 0.375rem` (6px, theme.css:54) drives `--radius-sm: calc(var(--radius) - 4px)` = 2px, `--radius-xl: calc(var(--radius) + 4px)` = 10px (theme.css:929-932). 36 call sites use `rounded-sm` (2px) and 236 use `rounded-xl` (10px) — neither value is in the legal set.
  - Expected: Match mobile's canonical `Radius = {sm:4, md:6, lg:8, xl:12, card:24, full:9999}` (apps/mobile/constants/theme.ts:829-841) exactly, e.g. `--radius: 0.5rem` (8px) base with explicit non-derived sm/md/lg/xl overrides at 4/6/8/12. `check-web-radius.mjs` (ENG-1499) explicitly allowlists these named classes and documents the xl gap in `docs/decisions/2026-07-10-card-grammar-rounder-flat.md:120` ("rounded-xl = 10px chrome until a later slice") with no Linear ticket — a no-silent-deferral violation in its own right.
  - Note: This is a token-definition bug, not a call-site bug: every correctly-token-based rounded-xl/rounded-sm usage in the app is silently off the documented scale.

### same-element-recipedetail-radius-split (1)

- **[P0] RecipeDetail.tsx mixes 24px SupprCard panels and 16px hand-rolled panels on the same screen with the same background style**
  - `src/app/components/RecipeDetail.tsx:2570` (web)
  - Measured: Lines ~2550-2564: `<SupprCard ...>` (allergen callout, resolves to `rounded-[var(--radius-card-lg)]` = 24px). Four lines later, line 2570: `<div className="flex items-center gap-4 p-6 rounded-2xl" style={whiteSlabStyle}>` (Creator Info card, 16px) — same `whiteSlabStyle` white-card-on-cream treatment, different radius. Repeats at lines 3133 and 3264 (also `rounded-2xl` + `whiteSlabStyle`), all three unconditional on the `recipeDetailV3` flag.
  - Expected: All `whiteSlabStyle` card panels should route through `rounded-card-lg` / the SupprCard primitive, matching the allergen-callout card four lines above it.
  - Note: Named core daily-loop surface; the divergent instance sits directly beside a correct sibling in the same render tree — the cleanest possible 'nearest sibling' repro.

### serif-section-heads (8)

- **[P0] Serif Type.title used as a scroll section header on Today ("Activity & energy" / "Hydration & stimulants")**
  - `apps/mobile/components/today/TodayScrollSectionHeader.tsx:40` (mobile)
  - Measured: TodayScrollSectionHeader renders `title` in `{...Type.title}` (Newsreader serif, 24/28/400) — used at apps/mobile/app/(tabs)/_today/TodayScreen.tsx:4604 ("Activity & energy") and :4696 ("Hydration & stimulants"), both literal structural section dividers grouping multiple sibling cards below them.
  - Expected: Design Constitution (2026-07-17, docs/ux/redesign/v3/DESIGN-CONSTITUTION.md L48-51): "structural labels are the quiet tracked-caps overline — everywhere. Serif never labels structure." Should be Role 6 `label` (Inter caps, tracked .1em, 11/700) — i.e. `Type.label`, not `Type.title`.
  - Note: Component doc-comment cites Figma TD1/TD2 frames from before the 2026-07-17 ratification — this is the exact pattern the Constitution names as needing remediation, on the single most-trafficked daily-loop screen.
- **[P0] Serif Type.headline used for Progress §2-§5 card headers (Expenditure / Body composition / Maintenance / Journey)**
  - `apps/mobile/components/progress/ExpenditureTrendCard.tsx:89` (mobile)
  - Measured: 4 confirmed card-identifying headers render in serif Type.headline (17/22/500): ExpenditureTrendCard.tsx:89 ("Expenditure"), BodyCompositionTrendCard.tsx:95 ("Body composition"), apps/mobile/app/(tabs)/progress.tsx:1794 ("Maintenance"), apps/mobile/app/(tabs)/progress.tsx:2013 ("Journey") — identical icon+label card-header pattern each time.
  - Expected: The Constitution's own inconsistency ledger (DESIGN-CONSTITUTION.md L231) names this exact defect: "Serif section-heads on Progress §2–§5 (hero keeps its instrument label)" — flagged for the overline treatment (Type.label), not headline serif.
  - Note: Directly named by the ratified spec as a defect to fix — this census confirms it is still live in shipped code across at least 4 sites on the tab.
- **[P0] Serif Type.title used for the "Ingredients" and "Method" section headers on Recipe Detail**
  - `apps/mobile/components/recipe/RecipeIngredientGrid.tsx:93` (mobile)
  - Measured: RecipeIngredientGrid.tsx:93 renders "Ingredients" in `{...Type.title}` (serif 24/28/400); RecipeMethodSteps.tsx:29 and :83 render "Method" the same way (two render branches, `variant==="v3"` and legacy). Both carry a 2026-06-10 code comment: "section header → Type.title token."
  - Expected: Per the 2026-07-17 label grammar, "Ingredients"/"Method" are structural section heads organizing the recipe content, not dish names/verdict sentences/page titles — they should be Role 6 tracked-caps overlines (`Type.label`), matching the constitution's stated intent for Recipe Detail's own content architecture.
  - Note: The governing comment on both files ("headers census 2026-06-10") predates and is now superseded by the 2026-07-17 ruling — a stale decision baked into the component, not a fresh mistake.
- **[P0] Uppercase overline section labels built as bare <h2>/<h3> inherit Newsreader serif from the global heading rule, violating the label grammar**
  - `src/app/components/suppr/today-week-sidebar.tsx:121` (web)
  - Measured: `<h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Last 7 days</h2>` — no font-family override, so it inherits `h2 { font-family: var(--font-headline) }` from theme.css:1027-1033 and renders in Newsreader serif.
  - Expected: Design Constitution (docs/ux/redesign/v3/DESIGN-CONSTITUTION.md, 2026-07-17): 'structural section labels are 11px tracked-caps overlines everywhere; serif is ONLY for page titles, hero numerals, content nouns, verdict sentences. Serif-as-section-head is a violation.'
  - Note: Confirmed 10 identical instances repo-wide, none defensively add font-sans: suppr/today-apple-health-card.tsx:108 ('Apple Health · Today'), suppr/today-desktop-right-rail.tsx:155 ('This week') and :215 ('Last 7 days'), suppr/apple-health-card.tsx:98, DiscoverFeed.tsx:827 ('Recipe ideas') and :928 ('More ideas'), suppr/log-sheet.tsx:1141 and :1158, app/checkout/success/page.tsx:114. The global h1/h2/h3 base rule is a deliberate 'headline serif' choice (theme.css comment: 'the editorial serif that carries the warm-coaching direction') but nobody has audited which bare headings unintentionally inherit it.
- **[P0] Today's mid-scroll section headers render as 24px serif titles, not the mandated 11px tracked-caps overline — replicated on both platforms**
  - `apps/mobile/components/today/TodayScrollSectionHeader.tsx:40` (both)
  - Measured: Type.title applied to 'Activity & energy' / 'Hydration & stimulants' — Newsreader serif, 24px/28, weight 400, color navPrimary (mobile call sites: apps/mobile/app/(tabs)/_today/TodayScreen.tsx:4605 and :4697). Web mirror is byte-identical: src/app/components/suppr/today-scroll-section-header.tsx:32 renders 'text-2xl font-medium' serif (call sites NutritionTracker.tsx:2181 and :2253); web additionally reuses the same component for a THIRD, web-only structural label — the 'Today's Meals'/'Yesterday's Meals' title (src/app/components/suppr/today-meals-section.tsx:402-406, via mealsSectionTitle in src/lib/nutrition/trackerDate.ts:42).
  - Expected: Design Constitution Rule 1/5 (docs/ux/redesign/v3/DESIGN-CONSTITUTION.md): 'structural labels are the quiet tracked-caps overline... Serif never labels structure.' These are structural groupers (Activity & energy / Hydration & stimulants / Meals), not content nouns, so they should render as the 11px/700/uppercase/tracked label role, matching Type.label — not Type.title.
  - Note: Cross-platform consistent (both wrong the same way) except the web-only Meals title, so this is a systemic rule violation, not a parity bug — 5 instances total (2 native, 3 web).
- **[P0] Web Settings renders all 8 of its section headers as 20px serif headlines; mobile Settings already fixed the identical labels to 11px tracked-caps overlines**
  - `src/app/components/Settings.tsx:927` (web)
  - Measured: 'Your plan' (927), 'Personal' (963), 'Preferences' (1077), 'Connections' (1660), 'Notifications' (1712), 'About' (1780), 'Promo code' (1805), 'Privacy & Security' (1868) — every one is `font-[family-name:var(--font-headline)] text-xl font-medium text-foreground-brand` (20px serif, brand-plum). Mobile's SectionHeading (apps/mobile/components/settings/SettingsBundleContent.tsx:163-186) renders its 12 equivalent section labels (Personal/Membership/People/Goals & targets/Display/Connections/Reminders/Recipes/Account/Legal/Build/Danger zone) at 11px/600/uppercase/0.9-tracking/textSecondary, with an explicit code comment: 'Was Newsreader serif plum 19px... uppercase eyebrow groups more aggressively.'
  - Expected: Same section content, same product, same screen family — should render identically. Mobile already migrated off the exact pattern web still uses; web is stuck on the pre-fix state the mobile comment describes as superseded. Constitution Rule 5 also directly forbids serif-as-section-head.
  - Note: This is a clean regression-style gap, not ambiguity: mobile's own comment documents the fix web never received. 8 instances on one screen.
- **[P1] Serif Type.headline/Type.title repeated as card/section labels across Today (Steps & activity, Planned, Quick add ×2, meal-slot names, hydration card title)**
  - `apps/mobile/components/today/TodayActivityCard.tsx:66` (mobile)
  - Measured: Same as reported, with one path correction: HydrationStimulantsCard.tsx is at apps/mobile/components/HydrationStimulantsCard.tsx (not apps/mobile/components/today/). Verified content: TodayActivityCard.tsx:66 renders "Steps & activity" in Type.headline; TodayPlannedMealsCard.tsx:102 renders "Planned" in Type.title (not headline, but same serif-as-structure family); TodayRecentsRow.tsx:41 and TodayScreen.tsx:5581 both independently render "Quick add" in Type.headline (confirmed duplicated, not shared); TodayMealsSection.tsx:955-957 renders slot names (Breakfast/Lunch/Dinner/Snacks) in Type.headline, with an inline comment explicitly confirming intent ("meal name reads in Newsreader (Type.headline), the loudest thing in the card header"); HydrationStimulantsCard.tsx:133 renders dynamic {title} in Type.headline.
  - Expected: Same Constitution rule as above — all are structural/card-organizing labels, not content nouns, so all should route through `Type.label`, not `Type.headline`/`Type.title`.
  - Note: "Quick add" existing as two independently-styled copies (TodayRecentsRow vs. the inline TodayScreen modal header) is itself a same-element-different-implementation risk even before the serif question — a future Type change to one won't propagate to the other.
- **[P1] Profile screen's group-divider headings ('People', 'Settings', 'Creator tools', 'Legal') are sentence-case bold serif — a third, undocumented section-label treatment**
  - `src/app/components/Profile.tsx:549` (web)
  - Measured: Same pattern confirmed at lines 550 (People), 578 (Settings), 744 (Creator tools), 786 (Legal) — minor line-number drift from claim (549→550) but identical markup: `<h3 className="text-[13px] font-bold text-foreground -tracking-[0.01em] mt-[22px] mb-2.5">`. Comments explicitly label these "sentence-case heading (prototype parity)" confirming deliberate divergence, not accidental.
  - Expected: Same structural-label role (dividing a settings-style list into groups) as the uppercase overlines used elsewhere (e.g. Targets.tsx 'Macros' header, ProgressDashboard.tsx section overlines) — should render identically per the 'same element, same treatment' rule, in Inter sans, uppercase, tracked.
  - Note: Profile is a secondary (not daily-loop) surface, but the divergence is total — size (13px vs 11px), case (sentence vs upper), family (serif vs sans), and tracking (none vs 0.1em) all differ simultaneously from the app's dominant section-label pattern.

### section-label-drift (1)

- **[P0] Uppercase tracked-caps section-label overline is implemented 48 different ways instead of one — same file shows both**
  - `src/app/components/MealPlanner.tsx:1282` (web)
  - Measured: Lines 1282, 1381, 1492, 1537, 1582: `text-[11px] uppercase tracking-[0.1em] font-bold` (11px/bold/0.1em). Lines 2259 and 2332 in the SAME file: `text-[10px] font-semibold uppercase tracking-wide` (10px/semibold/0.025em) — a different size, weight, AND tracking for the same 'meal-type overline' role.
  - Expected: Single `.section-label` treatment (theme.css:1182-1189 — 11px / font-weight 600 / uppercase / letter-spacing 0.1em) used everywhere a structural section overline appears.
  - Note: Repo-wide census of every uppercase+tracking site found 48 distinct (size, weight, tracking) signatures across ~257 instances; `.section-label` itself is used at only 18 sites in 8 files. ProgressDashboard.tsx independently mixes tracking-[0.1em] (correct, lines 1102/1503/1673/2454) with tracking-wider (lines 1827/1848/1868/1888/1993/2001/2019) and tracking-widest (line 2413) — three trackings in one file. RecipeDetail.tsx mixes tracking-[0.08em] (2003, 3464), tracking-[0.1em] (2819), and tracking-wider (3265).

### header-action-button-drift (1)

- **[P0] Plan, Recipes, and Progress each render a different legacy trailing-action-button shape today, live in production (the unifying flag defaults OFF)**
  - `apps/mobile/components/plan/PlanHeaderV3.tsx:154` (both)
  - Measured: Plan legacy `actLegacy`: 38×38, radius 12 (Radius.xl), 1px border + Elevation.cardHairline shadow, bg=card (mobile apps/mobile/components/plan/PlanHeaderV3.tsx:154-166; web src/app/components/plan/PlanHeaderV3.tsx:54 `h-[38px] w-[38px] rounded-xl border border-border bg-card shadow-sm`). Recipes legacy: bare icon, `{padding:6}`, NO background/border/shape at all (apps/mobile/components/tabs/RecipesTabChrome.tsx:33; web src/app/components/suppr/recipes-tab-chrome.tsx:54,64 `p-1.5 rounded-lg` hover-only). Progress legacy: 36×36 circle, 1px border, bg=card/elevated (apps/mobile/app/(tabs)/progress.tsx:1123-1131; web src/app/components/ProgressDashboard.tsx:1091 `h-9 w-9 rounded-full border border-border bg-card`).
  - Expected: Constitution Rule 3 / the ratified contract: 'Icon button: 40px circle, muted fill, ink glyph. There is no white-square, bordered, or shadowed variant. Anywhere.' All three converge on the identical 40px muted-circle treatment ONLY when `primary_screen_chrome_v1` is on — and it is registered DEFAULT-OFF on both platforms (apps/mobile/lib/analytics.ts:797; src/lib/analytics/track.ts:633), so today three adjacent daily-loop tabs each show a visibly different trailing-button treatment.
  - Note: This is the exact 'same element, same treatment' violation the project rules call out, and it is currently live, not a stale screenshot artifact.

### chip-alpha-tailwind-blindspot (2)

- **[P0] Web Plan-tab option-pills still ship the pre-ENG-1521 ad-hoc 10% tint mobile explicitly fixed**
  - `src/app/components/MealPlanner.tsx:1512` (web)
  - Measured: active state = `border-primary/10 bg-primary/10 text-primary-solid` (ad-hoc 10% Tailwind opacity modifier), repeated at L1515 (day-count), L1561 (slot toggle), L1606 (start-date) — inline comments at L1506-1511/1553-1557/1599-1602 explicitly say this 'mirrors the mobile dayBtnActivePrimary (tint + "1A" border + fill)'
  - Expected: apps/mobile/app/(tabs)/planner.tsx:1831-1835 `dayBtnActivePrimary` was migrated in the ENG-1521 pass to `accent.primarySoft` (12% light / 18% dark) — the code comment there reads verbatim: 'primarySoft is the sanctioned Soft step... snapped up from the old ~10% bg-primary/10 parity'. Web's 'mirror' comment is now stale: it describes the pre-fix mobile behaviour, not the current one.
  - Note: Direct, code-documented proof of a cross-platform parity regression on a P0 daily-loop surface (Plan tab length/start/slot-toggle pills) — mobile fixed the exact issue web still has, and web's own comment cites the old, now-wrong mobile behaviour as its justification.
- **[P0] 437 web chip/pill/badge fills use ad-hoc Tailwind slash-opacity instead of the sanctioned Soft/SoftStrong tokens, entirely untracked by the token-scale ratchet**
  - `src/app/components (142 files)` (web)
  - Measured: grep -rE "bg-(primary|success|warning|destructive|muted|muted-foreground)/[0-9]{1,2}\b" src/app/components → 437 line-hits / 142 files, e.g. src/app/components/suppr/today-fasting-pill.tsx:52 (`bg-primary/10 hover:bg-primary/15`), src/app/components/suppr/today-hero-stats.tsx:251 (`bg-success/10`), src/app/components/suppr/upgrade-paywall-dialog.tsx:415,498,514 (`bg-primary/10`, `bg-primary/15` x2), src/app/components/imports/CsvImportPreview.tsx:60 (`bg-primary/10`), src/app/components/imports/NamedTrackerReassuranceStrip.tsx:27 (`bg-primary/15`), src/app/components/suppr/badge.tsx:39,45,48,50,53,55,58 (Badge primitive itself, `bg-warning/10`, `bg-success/10` etc.)
  - Expected: The sanctioned named tokens already exist and are correctly used elsewhere in the same tree (`bg-primary-soft` in filter-chip.tsx, import-detected-chip.tsx; `bg-slot-breakfast-soft` etc. in today-meals-section.tsx) — CSS confirms `--primary-soft: var(--accent-primary-soft) = rgba(91,59,110,0.12)` (theme.css:146,173). Per the UI write-discipline rule, an ad-hoc alpha is 'off-scale by construction' — this is the identical violation the ENG-1521 alpha-concat/withAlpha gate targets on mobile, just expressed via Tailwind's `/NN` syntax on a semantic colour name (which none of check-token-scale.mjs's HEX_RE/TW_RE/RGBA_RE/ALPHA_CONCAT_RE patterns match, since `primary`/`warning`/`success`/`muted` aren't in the TW_HUES palette-name list).
  - Note: Scale alone makes this the highest-leverage finding: it is larger than the entire currently-pinned token-scale debt (690 violations/151 files) and is completely unpinned, so it can grow silently on every new web PR without CI ever flagging it. Recommend extending check-token-scale.mjs with a 5th regex for `bg|text|border-(?:primary|success|warning|destructive|muted...)/\d{1,2}` before triaging remediation.

### trust-confidence-chip-untokenized-web (1)

- **[P0] Web TrustChip's 6 variants and ConfidenceChip render raw rgba() literals from the RETIRED indigo/green palette — mobile fixed the identical issue in the 2026-06-10 chips census**
  - `src/app/components/ui/trust-chip.tsx:50` (web)
  - Measured: All 6 variant fills are untokenized rgba literals: L50 `rgba(98, 179, 90, 0.08)` (usda), L56 `rgba(76, 108, 224, 0.12)` (off-adjusted — blue/indigo), L62 `rgba(224, 168, 56, 0.10)` (estimated), L68 `rgba(140, 131, 120, 0.12)` (manual), L74 `rgba(98, 179, 90, 0.08)` (gluten-high-conf), L80 `rgba(224, 168, 56, 0.10)` (gluten-uncertain); confidence-chip.tsx:51 similarly hardcodes `rgba(148, 163, 184, 0.12)` (cool slate-blue).
  - Expected: apps/mobile/components/ui/TrustChip.tsx:44-84 resolves the same 6 variants via `Accent.successSoft`, `Accent.primarySoft`, `Accent.warningSoft`, `Colors.light.confidenceNeutralSoft` — token-derived from the current Sloe sage/aubergine/clay palette — with the explicit in-code annotation: 'Chips census (2026-06-10): token-derived wash — the rgba literals were the RETIRED green/indigo palette, not the sage/aubergine system.' Web never received this remediation; it is still rendering the exact retired blue/indigo `off-adjusted` fill mobile deliberately moved away from.
  - Note: Pinned as tracked legacy debt in scripts/token-budget.json (trust-chip.tsx: 6, confidence-chip.tsx: 1) so it will not silently grow further, but it is a live, currently-visible defect: every USDA/OFF/estimated/manual/gluten trust chip on web RecipeDetail and food-search surfaces renders off the wrong colour family versus its mobile counterpart.

### gutter-fragmentation (1)

- **[P0] Web core screens use three different page gutters — no single product-shell adoption**
  - `src/app/components/Targets.tsx:357` (web)
  - Measured: Targets.tsx:356 (was cited 357, off by one) `max-w-5xl mx-auto px-pm-5 py-pm-5` = 32px gutter — confirmed verbatim. RecipeDetail.tsx: the `max-w-4xl mx-auto ... px-6` gutter pattern is real but split across nearby lines rather than exactly line 1919: line 1872 `max-w-4xl mx-auto px-6 py-10`, line 1887 `max-w-4xl mx-auto px-6 py-8`, and line 1919 `max-w-4xl mx-auto bg-background-secondary min-h-screen pb-24` (no px on 1919 itself, but it's the same max-w-4xl container inheriting the 24px px-6 gutter from its child/sibling wrappers). Core claim holds: raw un-tokenized `px-6` (24px) is used on RecipeDetail vs `.product-shell`'s 40px and Targets' `px-pm-5` 32px — three distinct gutter values confirmed across the cited files.
  - Expected: One gutter value per platform per the audit brief; all core page-ground screens should sit on `.product-shell` (or its gutter value) the way 7 of 9 already do.
  - Note: RecipeDetail additionally never widens past max-w-4xl on desktop (no xl:max-w-7xl), unlike product-shell — so it's narrower on desktop too, not just gutter-different.

### web-tailwind-fractional-spacing (1)

- **[P0] Web core screens are saturated with off-scale fractional/bracket Tailwind spacing, with zero CI gate covering it**
  - `src/app/components/RecipeDetail.tsx:3502` (web)
  - Measured: 121 total off-scale spacing-utility instances counted across the 9 examined web core screens (grep for m*/p*/gap*/space-*-{[Npx]|N.5} patterns): RecipeDetail.tsx 28, Profile.tsx 24, MealPlanner.tsx 18, ProgressDashboard.tsx 15, Settings.tsx 14, Library.tsx 10, Targets.tsx 7, ShoppingList.tsx 3, NutritionTracker.tsx 2. 19 of these are exactly `-2.5` (10px) — e.g. RecipeDetail.tsx:3502 `gap-2.5`, Settings.tsx:906 `gap-2.5`, Library.tsx:441 `gap-2.5`, ShoppingList.tsx:311 `py-2.5`/`gap-1.5`, Profile.tsx:549/578/744/786 `mt-[22px] mb-2.5` (repeated section-header pattern, 4 identical instances). scripts/check-spacing-scale.mjs header comment (lines ~21-23) states scope is 'apps/mobile/app + apps/mobile/components .tsx only ... web uses the Tailwind spacing scale, gated separately' — but no such web gate exists in scripts/ (only check-type-scale.mjs for font sizes and check-web-radius.mjs for radius were found).
  - Expected: Web spacing should snap to 4/8/12/16/20/24/32/40 the same as mobile (per root CLAUDE.md 'Tokens only' rule naming both theme.css + Tailwind theme as the legal source), and should have an equivalent only-shrink ratchet the way mobile does.
  - Note: The 10px gap (-2.5) is the literal example the design contract itself names as a bug ('An 18px padding or 10px gap is a bug even if it looks fine') — this is not a hypothetical, it is directly instantiated 19 times.

### progress-detail-radius-drift (1)

- **[P1] ProgressMetricDetail card containers render at 10px, not the 24px card corner every other card-grammar surface uses**
  - `src/app/components/ProgressMetricDetail.tsx:183` (web)
  - Measured: 7 card containers (`bg-card` + padding + `cardCls` border toggle) all use `rounded-xl` (10px): lines 183, 224, 254, 258, 277, 303, 321. `cardCls` (line 50-52) only toggles border/transparent vs bordered — it never touches radius.
  - Expected: `rounded-card` / `rounded-card-lg` (24px), matching TrackerSummaryCard.tsx, today-week-view.tsx, macro-card.tsx and every other page-ground card in the app.
  - Note: Named surface in audit scope (Progress); this is a secondary/drill-down screen off the main Progress dashboard (which is clean via progress-hierarchy/*), so P1 not P0.

### retired-radius-tier-2xl (2)

- **[P1] Retired 16px 'rounded-2xl' card tier still live at 86 call sites (53 files) — ratchet holding the line, zero remediation progress**
  - `src/app/components/ui/suppr-card.tsx:79` (web)
  - Measured: 67+ `rounded-2xl`/`rounded-t-2xl` instances confirmed via grep across src/app/components (broader count of 83 plausible depending on scan path/dirs not fully replicated); could not confirm any `rounded-[16px]` instances (finding's claimed 3 not found in this verification pass). Ratchet confirmed live: `npm run check:web-radius` reports OK, 53 pinned files, 89 legacy off-grammar web radii, no growth — consistent with the finding's ~86-count and "zero remediation progress" framing.
  - Expected: Migrate each to `rounded-card` / `rounded-card-lg` (24px, page-ground) per the ratified grammar; the ratchet already blocks new instances, remediation is a scheduled shrink task, not a detection gap.
  - Note: Already tracked/gated (ENG-1499) — this finding quantifies the outstanding backlog for the remediation program rather than reporting an undetected gap.
- **[P1] FoodSearchPanel's grouped-result card sits on the retired 16px tier in the legacy (grammarDedup=false) path**
  - `src/app/components/food-search/FoodSearchPanel.tsx:2326` (web)
  - Measured: `mb-3.5 overflow-hidden rounded-2xl bg-card ${elevated ? "border-0" : "border border-border"}` — only rendered when `grammarDedup` is false; the `grammarDedup=true` path (line 2325) drops the card wrapper entirely in favor of a borderless `divide-y` list, per the code comment at 2315-2321 describing the 2026-06-12 flat-card migration.
  - Expected: `rounded-card-lg` if the card wrapper is kept for the legacy path, or retire the legacy path entirely now that `grammarDedup` supersedes it.
  - Note: Named core surface (FoodSearchPanel) explicitly in scope.

### flat-card-shadow-violation (1)

- **[P1] Resting page-ground cards still carry a shadow after the ENG-1497 flat+hairline ruling**
  - `src/app/components/UpgradePrompt.tsx:39` (web)
  - Measured: `UpgradePrompt.tsx:39`: `rounded-2xl border-2 border-primary/30 bg-primary/10 p-6 shadow-lg` (resting, not hover-gated). Same pattern: `app/pricing/PromoCodeBlock.tsx:82` (`rounded-2xl ... shadow-sm`), `app/pricing/PricingHeroCta.tsx:76` (`rounded-2xl ... shadow-sm`), `src/app/components/Targets.tsx:394,502,562` (`rounded-2xl ... shadow-sm`, 3x), `app/pricing/PricingTiersGrid.tsx:208-209` (`shadow-2xl` featured tier / `shadow-sm` standard tier).
  - Expected: Drop the resting shadow; rely on hairline border + card-vs-ground fill contrast, matching `.card-slab`. (The ENG-1497 doc's own interactive-elevation carve-out only exempts hover/pressed/focus states — none of these are hover-gated.)
  - Note: Compounds with the retired-2xl-tier finding on the same elements — these cards are simultaneously off-radius and off-elevation.

### serif-cta-labels (1)

- **[P1] Serif Type.headline used for CTA button labels, contradicting the ramp's own documented button rule**
  - `apps/mobile/components/today/TodayFirstMealEmptyState.tsx:102` (mobile)
  - Measured: "Log a meal" (TodayFirstMealEmptyState.tsx:102, inside <SupprButton>), "Search" (TodayAddFoodForm.tsx:165, inside <SupprButton>), "Save changes" (TodayEditMealModal.tsx:453, inside <PressableScale>), "Try again" (components/ui/RootErrorBoundary.tsx:131, inside <Pressable>), and the dynamic `{label}` in TodayFreshDayLogPill.tsx:39 (inside <SupprButton>) all set `{...Type.headline}` (serif) as the button's text style.
  - Expected: theme.ts L935-938 documents `Type.button` explicitly for this role: "CTA / button label — Inter SemiBold 16. Sans, NOT the Newsreader serif ramp: serif on a control reads dated; every comparable (Withings/Alma) uses a sans semibold button label." These 5 sites should use `Type.button`.
  - Note: Distinct from the intentional serif-CTA exception documented at create-recipe.tsx:918/Recipe-Detail "Log all" (a stated 52pt primary-submit pattern) — these 5 read as unreasoned copy-paste drift, not a deliberate design call.

### off-ramp-hero-serif (2)

- **[P1] Off-ramp hero-serif fontSize:30 duplicated across 7 unrelated surfaces instead of Type.display(32)**
  - `apps/mobile/app/(tabs)/progress.tsx:1443` (mobile)
  - Measured: Same as claimed, with one path correction: the login headline file is `apps/mobile/components/login/loginStyles.tsx:48` (not `apps/mobile/app/login/loginStyles.tsx`). All 7 sites verified: progress.tsx:1443 (`fontSize: 30` override on `Type.display`), loginStyles.tsx:48, PaywallHero.tsx:149, DigestStoryCard.tsx:171, TrajectoryCard.tsx:121, RecipeDetailHero.tsx:223, RecipeMethodSteps.tsx:90 — all literal `fontSize: 30`, all pinned in scripts/type-scale-mobile-budget.json (progress.tsx:1, loginStyles.tsx:1, PaywallHero.tsx:1, DigestStoryCard.tsx:1, TrajectoryCard.tsx:3, RecipeDetailHero.tsx:1, RecipeMethodSteps.tsx:1), confirming this is real, CI-invisible legacy drift as claimed.
  - Expected: Type.display (32/36/400/-0.4) is the legal ramp role for exactly this visual role; each site should consume the token so a future re-tune of the hero size only needs one edit.
  - Note: Pinned as legacy debt in scripts/type-scale-mobile-budget.json so CI won't flag it again, but it is real, visible drift on Progress and Recipe Detail (both core surfaces).
- **[P1] Off-ramp hero-serif fontSize:34 duplicated across 4 surfaces, and RecipeDetail renders its own title at two different off-ramp sizes**
  - `apps/mobile/components/recipe/RecipeTitleBlock.tsx:86` (mobile)
  - Measured: fontSize:34 (nearest legal 33 = Type.pageTitle) at: onboarding/steps/pace.tsx:215, recap/GoalPaceSlider.tsx:81, recipe/RecipeTitleBlock.tsx:86 (the recipe TITLE itself), today/WhyNumberV3Section.tsx:170. RecipeTitleBlock (34/42/400/-0.4, navPrimary) and RecipeDetailHero's overlay title (30/36/400/-0.4, same finding above) are two different off-ramp sizes for what is the same semantic element — the recipe's name — depending on hero-overlay vs. below-hero render state.
  - Expected: Both should converge on one ramp token (Type.pageTitle 33/38/500 is the closest fit) so the recipe title reads identically regardless of scroll/hero state — "same element, same treatment" per the UI write-discipline rule.

### hand-rolled-fontsize-vs-token (1)

- **[P1] ~1,383 raw numeric fontSize literals vs. ~1,370 Type.* token references — roughly half of all font-size declarations bypass the shared ramp object even when the number is legal**
  - `apps/mobile/constants/theme.ts:909` (mobile)
  - Measured: grep census across apps/mobile/app + apps/mobile/components (*.tsx): 1383 raw `fontSize: <number>` literal declarations vs. 1370 `Type.<role>` references. Only 28 of the 1383 are off-scale (caught by check:type-scale-mobile); the remaining ~1355 happen to land on a legal ramp value (e.g. fontSize:14, 16, 11) but are hand-rolled style objects, not `...Type.body`/`Type.label` spreads — so their paired lineHeight/letterSpacing/fontFamily/fontWeight can silently diverge from the role they coincidentally match on size alone.
  - Expected: The UI write-discipline rule ("Type comes from the ramp — no ad-hoc font sizes") implies consuming the token object, not re-deriving its size in a parallel literal. A gate that only checks the numeric value (as check:type-scale-mobile does) can't catch this class of drift.
  - Note: This is the structural reason the off-ramp census (a) keeps finding new near-miss values over time even with the ratchet in place — the ratchet only stops literals from drifting OFF scale, not from bypassing the token while staying ON scale.

### page-title-drift (1)

- **[P1] ENG-1574's ratified .page-title standard is live in 2 files behind a flag; ProgressDashboard renders two different 'Progress' h1 treatments in the same component**
  - `src/app/components/ProgressDashboard.tsx:2457` (web)
  - Measured: Line 1105 (live content h1): `className={consistencyChrome ? "page-title text-foreground-brand" : "font-[family-name:var(--font-headline)] text-3xl font-medium tracking-tight text-foreground-brand"}`. Line 2457 (Suspense-fallback skeleton h1, same component, inside the `progress-suspense-fallback` block starting ~2447): unconditional `className="font-[family-name:var(--font-headline)] text-3xl font-medium tracking-tight text-foreground-brand"` — never gated on consistencyChrome, so the loading skeleton always shows the pre-ENG-1574 28px title even when the flag is on and the loaded page shows the new 33px page-title.
  - Expected: `.page-title` (theme.css:1094-1100 — 33px / font-weight 500 / letter-spacing -0.012em, comment: 'Standard page-chrome title — ENG-1574/1577') applied to every page's h1 once the flag is enabled, with no unflagged duplicate left on the old size.
  - Note: Only Settings.tsx:872 and ProgressDashboard.tsx:1105 gate on consistencyChrome. At least 13 other product h1s never got a flag branch and stay on assorted ad hoc treatments: ShoppingList.tsx:221 and MealPlanner.tsx:1230 (identical 28px/medium 'text-3xl tracking-tight' — Plan/Shopping never migrated), HouseholdSettingsPage.tsx:862 (28px/semibold/-0.02em), PlanImport.tsx:93 + plan-import/PlanImportReview.tsx:76 (28px/default-weight), RecipeUpload.tsx:1799 (text-3xl/default-weight), Profile.tsx:439/470 (24px/medium), profile/ProfileHubHeader.tsx:41 (28px/BOLD/-0.02em), Targets.tsx:372 (24-28px responsive/BOLD/-0.02em), DiscoverFeed.tsx:447 (24px/EXTRABOLD/-0.03em — the only extrabold page title), library/LibraryDesktopHeader.tsx:33 (24px/medium/-0.02em), RecipeDetail.tsx:2008 (30px/400 inline style) and :2277 (34px inline style).

### serif-authoring-fragmentation (2)

- **[P1] The single design decision 'render this in the brand serif' is reached five different, uncoordinated ways**
  - `src/app/components/RecipeDetail.tsx:2812` (web)
  - Measured: RecipeDetail.tsx uses raw inline fontFamily style at 7 sites (2010, 2280, 2396, 2812, 3041, 3205, 3480) AND the Tailwind arbitrary-value class font-[family-name:var(--font-headline)] at line 3183 in the same file. Repo-wide: ~154 sites use font-[family-name:var(--font-headline)], ~188 sites use bare font-headline utility, and 3 semantic classes (.screen-title/.page-title/.nav-title) exist in theme.css. app/recipe/[id]/page.tsx duplicates the inline-style pattern at lines 285, 329, 395, 448, 469.
  - Expected: One authoring convention (the semantic classes, or at minimum a single Tailwind utility) for applying the brand headline serif, so a future typeface/weight change only requires editing theme.css.
  - Note: app/recipe/[id]/page.tsx is a near-duplicate implementation of RecipeDetail.tsx and independently repeats the same inline-style pattern at lines 285, 329, 395, 448, 469 — meaning any headline-serif change must be hand-applied in at least two parallel files.
- **[P1] Destructive account-deletion confirmation headings use Tailwind's generic font-serif (Georgia/Times), not the brand Newsreader token**
  - `src/app/components/settings/DeleteAccountSheet.tsx:96` (web)
  - Measured: Line 95 (not 96): `<p className="font-serif text-xl text-foreground">{copy.step1.heading}</p>`; line 129 (not 131): `<p className="mt-2 text-center font-serif text-xl text-foreground">{copy.step2.heading}</p>`. Both confirmed verbatim in src/app/components/settings/DeleteAccountSheet.tsx.
  - Expected: `font-[family-name:var(--font-headline)]` or the equivalent semantic class, matching every other headline/verdict-style heading in the app.
  - Note: A third file, CookMode.tsx:1194, has the same `font-serif` (generic) mistake on a chip label inside the core cooking flow reached from RecipeDetail.

### cross-platform-size-mismatch (2)

- **[P1] LogSheet's own title is a different size and weight on each platform**
  - `apps/mobile/components/today/LogSheet.tsx:522` (both)
  - Measured: Mobile: `Type.title` = 24px / lineHeight 28 / weight 400 / -0.3 tracking, color navPrimary. Web: hardcoded `text-[22px] font-medium tracking-tight` = 22px / weight 500 (src/app/components/suppr/log-sheet.tsx:539).
  - Expected: Both files' own comments describe this as 'the same editorial-heading grammar as the Today section headers' — implying intended parity — but the literal values are 24/400 vs 22/500, a genuine cross-platform mismatch on the single most-used sheet in the app.
- **[P1] Settings page title is a different size on each platform before the unifying flag ramps**
  - `apps/mobile/app/settings.tsx:103` (both)
  - Measured: Mobile default (flag off): `Type.title` = 24px. Web default (flag off): `text-3xl` = 28px (src/app/components/Settings.tsx:872; `--text-3xl: 1.75rem` per src/styles/theme.cssःcustom scale). Both converge on 33px (`Type.pageTitle`/`.page-title`) only once `primary_screen_chrome_v1` ramps.
  - Expected: Same screen, same title string ('Settings'), should render at one size on both platforms regardless of flag state — a screen this central shouldn't have a live 24-vs-28px split while waiting on a 0%-rolled-out flag.

### same-badge-different-shape (1)

- **[P1] Same-role 'nutrition source' badge is a full pill on mobile but a 4px rounded-rect on web**
  - `src/components/NutritionSourceBadge.tsx:23` (both)
  - Measured: web className: `rounded px-1.5 py-0.5 text-[10px]` — Tailwind `rounded` = 4px radius (not full), padding 6px/2px, single combined text-[10px] for abbr+label always shown together
  - Expected: apps/mobile/components/NutritionSourceBadge.tsx:45 `borderRadius: Radius.full` (999px, true pill), `paddingHorizontal: Spacing.xs` (4), `paddingVertical: 1`, separate abbr (fontSize 10) / label (fontSize 9) with a `compact` prop that hides the label by default — three measurable divergences (shape, padding, and default verbosity) for a component whose own header comment ('ENG-716... matching web's text-muted-foreground manual badge') claims parity.

### mobile-gutter-split (1)

- **[P1] Mobile screen-frame gutter also splits in two — Today/Plan at 20px vs 8 other core screens at 24px**
  - `apps/mobile/constants/layout.ts:28` (mobile)
  - Measured: Layout.todayScreenPaddingX (layout.ts:28) and Layout.planScreenPaddingX (layout.ts:40) both = Spacing.lg = 20px, consumed at TodayScreen.tsx:2897 and planner.tsx:1605. Every other examined core screen uses Spacing.xl = 24px: library.tsx:557 (Recipes), progress.tsx:1107 (Layout.screenPaddingX), settings.tsx:94 (body), recipe/[id].tsx:1680/1698 (body), paywall.tsx:873, targets.tsx:427/452, profile.tsx:196, shopping.tsx:569 (Layout.screenPaddingX). Distribution: 24px×8, 20px×2.
  - Expected: One gutter per platform, or if Today/Plan's tighter density is a deliberate ratified exception, Recipes should join it — Recipes is the third of the three primary swipeable tabs but sits at the 'secondary screen' 24px value instead.
  - Note: layout.ts:12-16 documents the Today/Plan 20px choice as intentional prototype-density parity, but that rationale was never extended to Recipes, which is the same tier of screen.

## Visual / pixel-level findings

94 findings from reading the actual captured screenshots (`captures/mobile/`, `captures/web/`) against the Design Constitution, several backed by direct RGB pixel sampling.

### Today (mobile + web, incl. dark mode)

Today (mobile native + web desktop/mobile/mobile-dark) audited against the ratified DESIGN-CONSTITUTION.md shell/chrome subset (Rules 0/1/3/5/6/7) plus ENG-1497 card grammar. Capture-coverage caveat: mobile/today-1-top.png, today-2-mid.png and today-3-lower.png are byte-identical (md5 match) — the scroll sequence bottomed out after one scroll, so only two distinct mobile states exist below the hero (the net-energy/hydration content, and the same content mid pull-to-refresh in today-4-bottom). All 8 named files exist and were read. Positive controls found: macro-hue rings (Protein/Carbs/Fat) correctly scope colour to the macro-visualisation exception; the "Under budget" sage dot is correct day-state semantics; the dark-mode ring arc's glow correctly follows Rule 6 ("glow reserved for the instrument"). Set against that, ten rule breaks survive in the shipped surface, clustering into five patterns, several spanning both platforms simultaneously: (1) icon-button containers fracture three ways — native's bell has no container at all, web desktop's bell is the explicitly-banned bordered white-square, and web-mobile's header shows a bare icon sitting directly next to a bordered-square icon in the same row; (2) structural section labels render in serif caps instead of the mandated Inter overline on both platforms — web's "THIS WEEK"/"LAST 7 DAYS" contradict the correctly-styled sans "TODAY" eyebrow four lines above on the same screen, and native's "Hydration & stimulants" is double-labelled in serif (section head + redundant in-card identity repeat); (3) sage/amber/teal appear as decoration at least four times (native's Burned/Maintenance icon tints, native's teal hydration-chip text, web's sage Day-1 icon square) where Rule 4 permits colour only as day-state semantics or inside macro visualisations; (4) a bold-sans card headline on web breaks the sans-600/700-only-in-label/interactive corollary; (5) the persistent user-avatar monogram — present on every single screen — is sans-serif with no frost-ring on both platforms, and the two platforms don't even agree on its fill colour (plum vs dark-olive). Given how many of these are chrome/shell elements the 2026-07-17 ratification specifically covers, the shipped surface has drifted from its own contract in the time since ratification.

- **[P0] Native bell icon has no container at all — a fourth, unlisted variant**
  - Capture: `mobile/today-0-hero.png`
  - Observed: Top-right notification bell renders as a bare black glyph directly on the page ground with a small plum dot badge overlapping it — no circle, square, or any container whatsoever.
  - Rule: Rule 3 — "Icon button: 40px circle, muted fill, ink glyph. There is no white-square, bordered, or shadowed variant. Anywhere."
  - Parity note: Contrasts with both web captures, which wrap the identical bell control in a bordered white rounded-square — three different treatments of one control across native + web.
- **[P0] Web desktop bell icon is the explicitly-banned bordered white-square variant**
  - Capture: `web/today-desktop.png`
  - Observed: The bell sits inside a light rounded-square with a visible 1px hairline border, overlapped by a separate dark circular "1" badge — a square container with a border, not the mandated 40px muted circle.
  - Rule: Rule 3 (same icon-button spec as above)
- **[P0] Two adjacent header icons on web-mobile use two different container treatments**
  - Capture: `web/today-mobile.png`
  - Observed: The header row shows a bare book/library icon (no container) immediately beside the bell icon in its bordered rounded-square — two icon buttons in the same row, same screen, neither matching the other or the spec.
  - Rule: Rule 3 + "same element, same treatment"
- **[P0] Web card section labels render in serif caps, contradicting the correctly-styled eyebrow on the same screen**
  - Capture: `web/today-desktop.png`
  - Observed: "THIS WEEK" and "LAST 7 DAYS" card headers in the right rail are set in a serif face with visible letter serifs (grey, tracked caps) — while the "TODAY" eyebrow directly above the ring, on the same screen, correctly uses sans tracked caps.
  - Rule: Rule 1 amended label grammar ("Serif never labels structure... the overline system is the calm spine of every screen") + Rule 5 label role (Inter, not serif)
  - Parity note: This is exactly the "Progress/Today serif section-heads" defect the constitution's violation census records as fixed in Elevated — still present in the shipped web build.
- **[P0] Native hydration section is double-labelled in serif — section head and redundant in-card identity repeat**
  - Capture: `mobile/today-1-top.png`
  - Observed: "Hydration & stimulants" (the section head, outside the card) and "Hydration" (repeated again inside the card, above the Water row) both render as large ink serif text instead of the 11px tracked-caps grey overline.
  - Rule: Rule 1 amended label grammar + Rule 2 ("in-card overlines label only internal groups... never the card's identity")
- **[P0] Burned/Maintenance icons wear amber and sage as flavour, not day-state**
  - Capture: `mobile/today-1-top.png`
  - Observed: In the "Net energy today" card, the BURNED flame icon is tinted amber/orange and the MAINTENANCE target icon is tinted sage green — neither represents an over/under-budget day-state; both are decorative tints on static stat labels sitting beside a plain-ink fork/knife icon for EATEN.
  - Rule: Rule 4 — "Sage / amber may appear as: Day-state semantics only... Never as: decoration, icons-for-flavour"
- **[P0] Hydration quick-add chips carry an off-palette teal that isn't sanctioned anywhere in Rule 4**
  - Capture: `mobile/today-1-top.png`
  - Observed: The "+100 ml / +250 ml / +500 ml / +750 ml" chip labels sample as teal/blue-grey (~RGB 90,138,153, matching the water-drop icon), not ink — verified by direct pixel sampling of the glyph strokes.
  - Rule: Rule 4 (legal hues are ink/plum, sage/amber day-state, macro hues, destructive red only) + Rule 3 ("All chips... are this chip" — one spec, interactive-role ink text)
- **[P0] The persistent user-avatar monogram breaks Rule 7 on every screen, with a different violation per platform**
  - Capture: `mobile/today-0-hero.png`
  - Observed: The header avatar "G" is sans-serif, solid plum fill, no frost-ring halo — this is the app's persistent top-right chrome element, present on every screen, not just Today.
  - Rule: Rule 7 — "People may use serif initials only with the frost-ring treatment, as a stated placeholder until real photography lands."
  - Parity note: Web's equivalent "ME" household monogram (today-desktop.png, "Cooking for 1" banner) is also sans-serif with no frost-ring, but filled dark-olive instead of plum — same rule break, inconsistent colour cross-platform.
- **[P1] Day-1 streak card tints its icon sage for a motivational nudge, not a day-state**
  - Capture: `web/today-desktop.png`
  - Observed: The "Day 1 — nice start" card's icon sits in a light sage rounded-square with a green flame outline, used for an onboarding/streak congratulation message rather than an over/under-budget state.
  - Rule: Rule 4 decoration ban
- **[P1] Day-1 card headline is bold sans where card headlines must be serif**
  - Capture: `web/today-desktop.png`
  - Observed: "Day 1 — nice start" renders in a bold sans-serif face rather than the Newsreader `content` role (18–22/500) required for card headlines.
  - Rule: Rule 5 corollary — "Sans-600/700 lives only in label and interactive... A bold word anywhere else is a violation."

### Log sheet / Log hub

Read mobile/logsheet.png (the "Add to today" log-hub bottom sheet) at full res plus 5 cropped/pixel-sampled regions (header, search+quick-action tiles, Scan-barcode/Describe/shortcuts, tabs+Recent rows, Daily-progress footer). No web capture was supplied for this surface, so cross-platform parity could not be assessed here — flagged as a gap, not scored. The sheet gets the overline/label grammar right (TODAY'S RECENTS / EARLIER THIS WEEK / DAILY PROGRESS render as correct 11px tracked-caps grey overlines) but fails Rule 8's log-it composition badly: five separate controls front-load two actions (scan, describe) before the user reaches the actual Recents list, which is the surface Rule 8 explicitly designates as the one-tap-relog answer. Pixel-sampling also caught the chip component splitting from its own single ratified spec (fill AND selected-colour both diverge), and the food-row iconography burning two colour-governance-restricted hues (amber, sage) plus the marketing-reserved oat tone as decoration on a core, high-repetition row template — i.e. every food row app-wide inherits this, not just these two instances.

- **[P0] Five controls front two actions before Recents even starts**
  - Capture: `mobile/logsheet.png — full sheet body, top to the 'Recent' tab strip`
  - Observed: Above the 'Recent' tab, the sheet stacks: (1) a barcode-scan glyph embedded in the search field, (2) a 'Scan' quick-action tile, (3) a full-width 'Scan barcode' button repeating the identical action three times; and (1) a 'Describe' quick-action tile plus (2) a separate 'Describe what you ate' expandable row repeating that action twice. A further 'Log Peanut Butter Yo…' shortcut card duplicates the one-tap-relog concept that the 'Today's Recents' list below already implements, rendered in a completely different card shape (icon-left pill vs. icon-tile+name+kcal+plus row).
  - Rule: Rule 8 — 'Log it' moment is defined as FAB → log hub with 'Recents = one-tap re-log' as THE pattern; scan/describe/relog each need one home, not three/two/two. Also breaks 'Same element, same treatment' (the nearest sibling for a relog action is the Recents row, not a bespoke pill).
- **[P0] Selected meal-type chip uses tonal lilac + dark text, not plum fill + white text**
  - Capture: `mobile/logsheet.png — meal-type chip row (Breakfast/Lunch/Dinner/Snacks), 'Snacks' selected`
  - Observed: Pixel-sampled fill of the selected 'Snacks' chip = rgb(228,223,233) — a soft muted lilac — with dark ink text (~rgb(34,27,38)), not a solid fill. This is the same tint value used elsewhere as a generic soft-tonal background (matches the 'Scan barcode' button fill), not a distinct plum-solid selected state.
  - Rule: Rule 3 — Chip spec: 'selected = plum fill, white text.' All chips share one spec; this instance renders selected state as a tonal tint with ink text instead.
- **[P0] Recent-food icon tiles use an oat/amber tan fill + sage-olive icon stroke, not photo or plum-duotone**
  - Capture: `mobile/logsheet.png — 'Bread, naan' and 'Heinz · Heinz Beans Original' rows under Today's Recents / Earlier this week`
  - Observed: Both food-row icon tiles sample at fill rgb(239,228,206) (a warm tan/oat tone) with icon glyph stroke rgb(158,161,133) (olive-sage). Neither food item is represented by a photo or the plum-duotone texture system — instead a generic category glyph (cookie / wheat) sits on a decoratively-tinted tile.
  - Rule: Triple citation: Rule 7 ('Food is photographed … or rendered as the plum-duotone texture system' — a tan+sage glyph tile is neither); Rule 4 (sage 'may appear as: Day-state semantics only' — never as icon-for-flavour decoration); Rule 6 ('oat is reserved for marketing' — this tan reads as oat on a product surface). This is the row template for every food item app-wide, so the blast radius is every recents/search/log row, not just these two.
- **[P0] '+' relog button glyph rendered in restricted amber/terracotta**
  - Capture: `mobile/logsheet.png — circular '+' quick-add control on the 'Bread, naan' and 'Heinz Beans' rows`
  - Observed: Icon stroke samples at rgb(200,121,78), a terracotta/amber hue, on both visible food rows' one-tap-add control.
  - Rule: Rule 4 — amber's only sanctioned meaning is day-state semantics (over/off-track); the colour governance table lists 'decoration, icons-for-flavour' as banned for semantic hues. A generic add-to-log button is not a day-state signal, so amber here is decorative, not semantic — and, like finding 3, this is the shared row template so it recurs on every food row in the product.
- **[P1] Sheet-header close (X) control is a bare glyph, not the 40px muted circle**
  - Capture: `mobile/logsheet.png — top-right 'X' beside the 'Add to today' title`
  - Observed: Pixel scan around the X glyph (orig coords ~x1030–1160, y280–380) shows only the ink glyph stroke rgb(101,92,110) directly on the sheet background rgb(247,246,250) — no circular fill of any kind behind it, at any radius.
  - Rule: Rule 3 — 'Icon button: 40px circle, muted fill, ink glyph. There is no white-square, bordered, or shadowed variant. Anywhere.' A bare/no-fill glyph is a fourth, unlisted variant of the same control-kit slot.
- **[P1] 'Scan barcode' CTA is a bordered+tonal hybrid, not filled or clean tonal**
  - Capture: `mobile/logsheet.png — full-width 'Scan barcode' button beneath the quick-action tile row`
  - Observed: Fill samples at rgb(228,223,233) (the same soft-lilac tint as the mis-rendered selected chip in finding 2) with a visibly darker plum outline stroke framing the pill, plum icon+text on top. This is neither the solid-plum/white-text 'filled' treatment nor a border-free tonal fill.
  - Rule: Rule 3 — buttons are 'one filled CTA per screen … secondary = tonal · tertiary = ghost text'; a tonal fill with an added border stroke is an unlisted fourth button treatment, and if this is meant to be the screen's one filled CTA, it is not rendered as filled (solid ground, inverse text).
- **[P2] Unselected meal-type chips carry no muted fill — hairline outline on bare page background**
  - Capture: `mobile/logsheet.png — 'Breakfast' / 'Lunch' / 'Dinner' chips (unselected)`
  - Observed: Fine horizontal pixel scan across the 'Breakfast' chip body (y=480, x=62–319) returns rgb(247,246,250) throughout — identical to the sheet's page-ground colour — with only a 1–2px darker hairline at the pill's rounded edges (rgb ~239,236,243). There is no distinguishable muted fill inside the pill; it reads as an outlined chip, not a filled one.
  - Rule: Rule 3 — 'Chip: full-radius pill, muted fill … All chips … are this chip' — the spec has one fill-based body, not a hairline-outline variant.

### Plan (mobile + web)

All 5 requested captures existed and were read: mobile/plan-1-top.png, mobile/plan-2-mid.png, web/plan-desktop.png, web/plan-mobile.png, web/planner-legacy-desktop.png.

Cleared check first: planner-legacy-desktop.png is byte-identical to plan-desktop.png (MD5 06f05008e04f1f68af8df92f85da698c for both), and `app/planner/page.tsx` confirms `/planner` is a permanent 308 redirect to `/plan` (ENG-806, resolved 2026-05-31 per its own header comment). So the "two different Plan UIs reachable" P0 risk this surface was specifically checking does NOT materialize — there is exactly one web Plan UI. Flagging this as cleared rather than a finding.

The real damage on this surface is a mobile-vs-web split on the Plan tab's core loop moment (Rule 8's day-verdict hero) plus a systemic Rule 3 icon-button violation that is at least consistent (wrong the same way everywhere) rather than split. Ten findings below, ranked most severe first: (1) icon buttons are white shadowed squares everywhere instead of the mandated 40px muted circle, (2) web desktop has no hero/CTA at all where mobile has a tinted hero + filled "Generate this week" — Rule 8's day-verdict moment is simply absent on desktop, (3) the desktop stat-bar numerals are off-role sans-serif against a screen where every other numeral/title is serif, (4) web-mobile stacks two full Rule-1 header blocks ("Meal plan" then "Your plan") on one screen, plus secondary findings on chip-spec drift, a same-card cross-platform typeface split, card-radius drift, a third control-kit idiom, and outline vs. tonal button drift.

- **[P0] Icon buttons are white shadowed squares, not the 40px muted circle**
  - Capture: `mobile/plan-1-top.png; web/plan-desktop.png; web/plan-mobile.png; web/planner-legacy-desktop.png`
  - Observed: The three header icon buttons (sparkle/generate, sliders/filter, bookmark/save) at top-right of the page header render as white rounded-square tiles (~12-16px corner radius, clearly square-cornered, not full circles) with a visible drop shadow, on a pure white fill. Pixel-sampled fill = rgb(255,255,255) against a rgb(247,246,250) page ground. Identical treatment confirmed on native mobile, web desktop, and web mobile — this is the same wrong component everywhere, not a platform split.
  - Rule: Rule 3: 'Icon button: 40px circle, muted fill, ink glyph. There is no white-square, bordered, or shadowed variant. Anywhere.' This is the exact violation the constitution's own census logged as fixed in Elevated ('Plan/Cook header buttons = white squares w/ border+shadow... → One 40px muted circle everywhere') — the shipped surface has not received that fix.
  - Parity note: Consistent violation across mobile app, web desktop, and web mobile — not a cross-platform split, but a core daily-loop surface (Plan tab header, first paint) rule break repeated in every capture.
- **[P0] Web desktop Plan has no hero at all — Rule 8's day-verdict moment is missing**
  - Capture: `web/plan-desktop.png`
  - Observed: Immediately below the page header, mobile shows a tinted lavender hero card with serif 'Nothing planned yet', a support sentence, a filled plum 'Generate this week' CTA, and a ghost-text secondary action — the one hero + one filled CTA per Rule 1/3. On web desktop, that entire hero is absent; the same vertical position instead holds a plain white hairline-bordered bar showing '0/7 Days planned · 0 Avg cal · 0g Avg protein · 1,856 Daily target' with no tint, no verdict sentence, and no CTA of any kind. Scrolling straight into the day list (Friday 17, Saturday 18...) with dashed add-meal rows; the only filled/CTA-adjacent buttons are 'Plan a batch' / 'Open shopping list' in a sidebar, both outline-styled, not filled.
  - Rule: Rule 8: 'Week is handled → Plan · day verdict hero → Calm verdict sentence + one-tap fix.' Rule 1: 'One hero per screen... the hero is the only element allowed display-scale type or the tinted ground.' Desktop has zero hero elements where mobile has exactly one — a hero-presence cross-platform split, and the loop's core moment (the plan's day-verdict) never renders on desktop at all in this state.
  - Parity note: mobile/plan-1-top.png and web/plan-mobile.png both show the tinted hero + filled CTA; web/plan-desktop.png shows neither for the same empty-week state — desktop and mobile diverge structurally, not just cosmetically.
- **[P0] Desktop stat-bar numerals are sans-serif, breaking the numeral-role system**
  - Capture: `web/plan-desktop.png`
  - Observed: The stat-bar numerals '0/7', '0', '0g', '1,856' are set in a geometric sans-serif face (no serifs on any digit or the '/' and 'g' glyphs), directly below the serif 'Your plan' title and beside serif 'Friday 17' day headings on the same screen. Every numeral role in Rule 5 (display/stat/stat-sm) specifies 'Newsreader, tnum' — serif.
  - Rule: Rule 5: 'every text node maps to exactly one of ten roles... Serif appears only at role sizes' — no numeral role permits a sans-serif face. This is precisely the class of defect Rule 5's amendment was written to close ('every font is a different size, weight, colour — there are no rules or logic').
- **[P0] Web-mobile stacks two full Rule-1 header blocks on one Plan screen**
  - Capture: `web/plan-mobile.png`
  - Observed: Below the 'sloe' wordmark bar, the screen renders 'PLAN' (grey caps eyebrow) + 'Meal plan' (large serif title) as a page-shell header, immediately followed by an underline tab pair ('This week' / 'Shopping'), immediately followed by a SECOND eyebrow+serif-title block: '17-23 JULY' + 'Your plan', with its own icon-button row. Two independent eyebrow-overline + serif-title pairs compete for the top of one screen.
  - Rule: Rule 1: 'One page template... Display type exists nowhere else. If two things look "biggest," the screen is wrong.' Two title blocks is the literal failure case the rule names.
  - Parity note: Native mobile (mobile/plan-1-top.png) and web desktop (web/plan-desktop.png) each show exactly one title block for this surface — the duplication is specific to the web-mobile responsive breakpoint, where the desktop sidebar's 'This week/Shopping' nav item collapses into an inline page header instead of being suppressed, stacking on top of the MealPlanner component's own header.
- **[P1] Two icon-button treatments visible on the same desktop screen**
  - Capture: `web/plan-desktop.png`
  - Observed: The page-header icon buttons (sparkle/sliders/bookmark) are white rounded-squares with a drop shadow, while the 'Batch cook' and 'Shopping list' sidebar-card icons (flame, cart) sit in correctly-muted grey ~48px circles with no shadow — two different icon-button idioms rendered in the same viewport.
  - Rule: 'Same element, same treatment. Before styling a chip/pill/row/header, check how the nearest existing sibling renders it and match exactly.' Combined with Rule 3's single icon-button spec, having both the wrong (square) and correct (circle) variant on one screen shows the drift is inconsistent, not just uniformly wrong.
- **[P1] Filter-chip selected/unselected fills don't match the ratified chip spec**
  - Capture: `mobile/plan-1-top.png (also present, same values, on web/plan-mobile.png)`
  - Observed: In the 'All meals / Breakfast / Lunch / Dinner / Snacks' row, the selected 'All meals' chip pixel-samples to fill rgb(228,223,233) — a light muted lavender — with dark-ink bold text, not plum fill + white text. Unselected chips ('Breakfast' etc.) pixel-sample to fill rgb(255,255,255) — pure white — not a muted fill.
  - Rule: Rule 3: 'Chip: full-radius pill, muted fill, 13px/600, 9×14 padding; selected = plum fill, white text. All chips — quick-add, filters, status — are this chip.' Neither state matches: unselected reads white-not-muted, selected reads lavender-not-plum.
- **[P1] 'Batch cook' quick-action card renders a different typeface on web vs. mobile**
  - Capture: `mobile/plan-2-mid.png vs web/plan-desktop.png`
  - Observed: The identical 'Batch cook' card headline is set in bold sans-serif on native mobile ('Batch cook', no serifs visible on B/a/t/c/h) but in serif Newsreader on web desktop (visible serifs on the same word) for the same card, same copy, same position in the information architecture.
  - Rule: Rule 5 role table + 'Same element, same treatment': a `content`-role headline (18-22/500/Newsreader) should render identically regardless of platform. One platform uses a role-5 serif treatment, the other a sans weight not in any role slot for a card headline of this kind.
  - Parity note: Direct cross-platform grammar split on a component that is otherwise pixel-similar (icon-in-circle, subline, layout) — the typeface is the only variable that changes between platforms.
- **[P1] Web card corner radius runs below the ratified scale and below mobile's hero-card radius**
  - Capture: `web/plan-desktop.png vs mobile/plan-1-top.png`
  - Observed: Pixel-estimated corner radius of the desktop stat-bar and 'Batch cook'/'Shopping list' cards is roughly 16-17px (measuring the arc's pixel span at what this capture's 2880x1800 dimensions imply is ~2x DPR). Mobile's hero card ('Nothing planned yet') measures roughly 22-24px at the same relative comparison. 16-17px is not on the ratified radius scale and sits below the 24px page-ground-card mandate that the mobile card meets.
  - Rule: 'Radius snaps to: 4 / 6 / 8 / 12 / 24 / full' and Rule 2: page-ground cards are 'radius 24.' Card radius should be identical across platforms for equivalent card types; this reads narrower on web.
- **[P2] 'This week / Shopping' renders as a third, unratified selector idiom**
  - Capture: `web/plan-mobile.png`
  - Observed: The 'This week' / 'Shopping' pair renders as underlined text tabs (bold active label + black underline bar vs. grey inactive label with no shape/fill), distinct from both the ratified full-radius pill chip and the segmented-control spec used elsewhere in the product.
  - Rule: Rule 3: 'Segmented control: one spec, used for exclusive 2-5-way switches only.' An underline-tab pattern is a third control paradigm alongside chip and segmented-control, which the 'one control kit' framing doesn't sanction.
- **[P2] Sidebar secondary buttons render bordered-outline instead of tonal**
  - Capture: `web/plan-desktop.png`
  - Observed: 'Plan a batch' and 'Open shopping list' render as white-fill pill buttons with a visible grey border and bold dark text — a bordered/outline treatment — rather than a muted (tonal) fill with no border.
  - Rule: Rule 3: 'Buttons: one filled CTA per screen · secondary = tonal · tertiary = ghost text.' 'Tonal' specifies a muted-fill secondary button, not an outlined one.

### Recipes list (mobile + web)

Audited the Recipes/Cookbook surface across all four requested captures (mobile/recipes-1-top.png, mobile/recipes-2-mid.png, web/recipes-desktop.png, web/recipes-mobile.png — all four existed and were read). Judged against DESIGN-CONSTITUTION.md (v1, 2026-07-17) plus ENG-1497 card grammar. Found 8 rule-anchored violations: 4 P0 (a serif section head where Rule 1 mandates a tracked-caps overline; a Create/Import control that renders as three incompatible variants and genuinely splits mobile vs. desktop web; a selected filter chip using a soft-lavender tint instead of the mandated plum-fill/white-text on every chip row on both platforms; and a food-placeholder texture that samples as oat-toned with a sage-green icon instead of Rule 7's plum-duotone system — 100% of visible recipe imagery, since no real photography exists yet for this recipe), 3 P1 (the same recipe's macro line rendered as plain text in its hero-card appearance vs. multi-hue icon badges with an off-role bolded numeral in its shelf-card appearance; a bookmark toggle that's a fourth icon-button variant present on one card and absent on the recipe's other card; and the complete absence of Rule 10's ambient fit-verdict tag anywhere on the surface), and 1 P2 (a 'Tonight's Pick' status badge using a third, uncatalogued pill treatment, arguably defensible as editorial photo-captioning). Card corner radius and elevation on the recipe tiles themselves looked compliant (flat, ~24px radius, no shadow) — no finding raised there.

- **[P0] Shelf/section head set in serif sentence-case, not the mandated tracked-caps overline**
  - Capture: `mobile/recipes-1-top.png (also present identically in web/recipes-desktop.png)`
  - Observed: Below the filter chips, the recipe-shelf label 'High protein' renders in serif (Newsreader), sentence case, bold, ink-coloured, at roughly the content/stat-sm size band (~20-22px), with a small grey sans caption ('27g+ to close your gap') underneath. It is structuring a section of cards, not naming a dish or a verdict.
  - Rule: Rule 1: 'section labels = 11px tracked-caps grey overlines' and 'Serif section heads = violation... Serif never labels structure; it is reserved for page titles, hero numerals, content nouns (dish names, day names) and verdict sentences.' This rule is in the ratified shell/chrome subset.
  - Parity note: Identical (wrong) treatment on mobile and web desktop — not a cross-platform split, but a systemic break of a ratified rule on a core tab.
- **[P0] Create/Import controls render as three incompatible variants, splitting across platforms**
  - Capture: `mobile/recipes-1-top.png and web/recipes-mobile.png (bare pencil/link glyphs, top-right, no circle or fill of any kind) vs. web/recipes-desktop.png (same two actions as bordered, full-radius pill buttons with icon + 'Create'/'Import' text label, white/transparent fill, hairline border)`
  - Observed: Zoomed crops confirm native-mobile and mobile-web agree with each other (naked ink glyphs floating directly on the page ground, zero container), while desktop web renders the identical pair of actions as outlined pill buttons with text. Neither variant is the spec's 40px muted-fill circle.
  - Rule: Rule 3: 'Icon button: 40px circle, muted fill, ink glyph. There is no white-square, bordered, or shadowed variant. Anywhere.' Plus the cross-platform 'same element, same treatment' check in the brief.
  - Parity note: Genuine desktop-vs-mobile grammar split (mobile-web and native mobile agree; desktop web diverges) — isolates the break to the desktop breakpoint specifically.
- **[P0] Selected filter chip uses a soft lavender tint, not plum-fill/white-text**
  - Capture: `mobile/recipes-1-top.png (both filter rows: type and meal-time), reproduced identically in web/recipes-desktop.png and web/recipes-mobile.png`
  - Observed: Pixel-sampled the selected 'All' chip on both filter rows: fill ≈ rgb(228,223,233) (pale lavender-grey), label text ≈ rgb(59,42,77) — the same dark plum-ink used for the page's serif title, not white. Unselected chips ('Saved', 'Breakfast', etc.) sample as plain white rgb(255,255,255).
  - Rule: Rule 3: 'Chip: full-radius pill, muted fill, 13px/600... selected = plum fill, white text. All chips — quick-add, filters, status — are this chip.'
  - Parity note: Consistent (wrong) across both platforms — pervasive on every filter row shown, not a one-off.
- **[P0] Recipe placeholder texture is oat-toned with a sage icon, not the plum-duotone system**
  - Capture: `mobile/recipes-1-top.png, mobile/recipes-2-mid.png, web/recipes-desktop.png, web/recipes-mobile.png — identical treatment on every recipe tile shown (100% of visible recipe imagery, since no real photography exists yet for this recipe)`
  - Observed: Pixel-sampled the placeholder tile: background ≈ rgb(237,235,229)/rgb(233,230,223) (warm oat/beige), fork-and-knife glyph ≈ rgb(157,162,140) (muted olive/sage-green). No plum hue appears anywhere in the texture or icon.
  - Rule: Rule 7 (ratified): 'Food is photographed... or rendered as the plum-duotone texture system.' The tone sampled is oat, not plum. Secondary cross-reference (Rule 4, not yet ratified): sage is reserved for 'Day-state semantics only,' explicitly 'Never as: decoration, icons-for-flavour' — using it to colour a food-placeholder glyph is the prohibited case verbatim.
  - Parity note: Same incorrect tile appears unchanged across all four captures — systemic, not platform-specific.
- **[P1] The identical recipe's macro line renders two incompatible ways on the same screen**
  - Capture: `mobile/recipes-1-top.png (hero 'Tonight's Pick' card: plain grey text '844 kcal · 37g protein · 75 min', no icons, uniform weight) vs. mobile/recipes-2-mid.png (same recipe re-surfaced in the 'High protein' shelf: four colour-coded icon badges — green flame/'844 kcal', purple dumbbell/bold-black '37g', amber wheat/'54g', pink droplet/'52g' — plus a separate clock-icon '75 min' row)`
  - Observed: Zoomed crop shows '37g' rendered bold and near-black while its sibling numerals ('844 kcal', '54g', '52g') are regular-weight grey — an off-role emphasis on one sibling stat. The icon row itself (multi-hue flame/dumbbell/wheat/droplet) has no counterpart anywhere else on the screen.
  - Rule: Rule 5: 'Sibling stats never differ in colour — state lives in the pill/dot, not the numeral' and 'Sans-600/700 lives only in label and interactive... A bold word anywhere else is a violation' — this is the exact S8 anti-pattern the rule was written to kill. The icon row also doesn't match the one sanctioned coloured-numeral register (the 12/600/macro-hue 'macro token' strip under Rule 4/5), so it's an uncatalogued fourth macro-display component.
- **[P1] Card bookmark toggle is a white-filled circle, a fourth icon-button variant, and the affordance is inconsistently present**
  - Capture: `mobile/recipes-2-mid.png (white circle, solid plum bookmark glyph, top-right of the 'High protein' shelf card) vs. mobile/recipes-1-top.png (the 'Tonight's Pick' hero card, same recipe, carries no bookmark/save control at all)`
  - Observed: Zoomed crop shows a solid rgb(255,255,255)-ish white circle containing a filled plum bookmark icon — not the muted-fill/ink-glyph spec. The hero card slot for the identical recipe has no equivalent control anywhere on its face.
  - Rule: Rule 3: 'There is no white-square, bordered, or shadowed variant. Anywhere' (a white-fill circle is the same species of deviation); 'same element, same treatment' — the same recipe gets a save affordance in one card slot and none in the other.
- **[P1] No recipe card wears the Rule 10 ambient fit-verdict tag**
  - Capture: `mobile/recipes-1-top.png, mobile/recipes-2-mid.png, web/recipes-desktop.png, web/recipes-mobile.png`
  - Observed: Both visible cards (hero 'Tonight's Pick' and the 'High protein' shelf card) show only the 'FROM YOUR COOKBOOK' provenance overline, serif title, and macro line. No sage 'Fits your day' / 'Fits a dinner this week' tag appears on either.
  - Rule: Rule 10: 'Every recipe surface wears a calm fit verdict derived from live targets — the sage tag on cookbook cards, Discover shelves, and the decision module.'
  - Parity note: Rule 10 is not in the ratified subset, and the constitution's own open-items list already flags fit-derivation on shelf cards as unfinished — this reads as the same tracked gap extending to cookbook-grid cards, not a fresh regression.
- **[P2] 'TONIGHT'S PICK' status badge is a third pill treatment outside the chip spec**
  - Capture: `mobile/recipes-1-top.png and web/recipes-desktop.png (identical treatment both places)`
  - Observed: The badge overlaid on the hero image is a dark/near-black filled pill with white, tracked, all-caps text — distinct in fill, case, and tracking from both the muted-fill and plum-fill chip states used elsewhere on the same screen.
  - Rule: Rule 3: 'All chips — quick-add, filters, status — are this chip' — status pills are explicitly supposed to share the one chip spec.
  - Parity note: Arguably defensible as an editorial photo-caption convention under Rule 0 ('Editorial' grammar recedes chrome on food surfaces), which is why this is scored lower than the other chip finding.

### Recipe detail

Audited mobile recipe-detail via 3 captures (recipe-detail-1-top.png, -2-mid.png, -3-lower.png). The requested web captures (web/recipe-detail-desktop.png, web/recipe-detail-mobile.png) do not exist in docs/audits/2026-07-17-design-sweep/captures/web/ — only recipes-desktop.png and recipes-mobile.png (the list/grid surface) are present, so no web recipe-detail render exists to check cross-platform parity against; this is a gap in the capture set, not a pass. On mobile alone this is the single worst-scoring surface found: it reproduces the exact anti-pattern the constitution names by name (letter monograms as food, Rule 7), puts a bare percentage on the fit tag despite Rule 10 explicitly banning percentages on food, and stacks three filled plum CTAs simultaneously visible on one scroll (hero "Generate an image", trust-card "Verify ingredients", sticky "Log") against the one-filled-CTA law. The Rule 10 trust-card promise (per-serving macros + confidence + fit tag, in one card) is not delivered — this recipe shows only a bare "nutrition needs review" state with no macros, no confidence readout, and no fit tag co-location.

- **[P0] Letter monograms represent food ingredients — the rule's named anti-pattern, verbatim**
  - Capture: `mobile/recipe-detail-2-mid.png`
  - Observed: In the 4x2 ingredient grid, 7 of 8 tiles (Smoked Streaky Bacon 'S', Onion Finely Chopped 'O', Celery Stick 'C', Carrot Grated 'C', Garlic Cloves 'G', Beef Mince 'G', Tomato Purée 'T') render as a single serif capital letter in sage/olive ink centered on a flat oat-cream rounded-square tile. Only the first tile (Olive Oil) carries an actual photo. Confirmed by pixel crop: the 'S' and 'O' tiles are bare glyphs on #EDE3D6-ish tint, no photography, no duotone texture.
  - Rule: Rule 7 — 'Food is photographed... or rendered as the plum-duotone texture system. Letter monograms never represent food.'
- **[P0] Fit tag shows a bare percentage, the exact thing Rule 10 bans**
  - Capture: `mobile/recipe-detail-1-top.png`
  - Observed: The full-width green tag reads '✓ Fits your day' on the left and '≈ 30%' right-aligned in the same bar, directly under the recipe title.
  - Rule: Rule 10 — 'Fit language is one calm register everywhere: "Fits" — never scores, grades, or percentages on food itself.'
- **[P0] Three filled plum CTAs simultaneously live on one screen**
  - Capture: `mobile/recipe-detail-1-top.png`
  - Observed: Three distinct solid-plum filled pill buttons are all present on this single scroll: 'Generate an image' (RGB ~59,42,77) at the hero/content boundary, 'Verify ingredients' (same fill) inside the trust card, and the sticky 'Log' button in the bottom bar. Recipe-detail is not a listed conversion surface (paywall/onboarding) and has no FAB.
  - Rule: Rule 3 — 'Buttons: one filled CTA per screen (conversion surfaces excepted) · secondary = tonal · tertiary = ghost text.'
- **[P0] Two tinted card grounds stacked on one screen; the second uses oat, which is reserved for marketing**
  - Capture: `mobile/recipe-detail-1-top.png`
  - Observed: The hero zone (texture ground) is the screen's one legal tint. Directly below it, the 'Imported from Angela Boggiano — nutrition needs review' card sits on a warm oat/tan fill measured at RGB(236,226,217) — distinct from the cool plum-white page ground (#F7F6FA) and from any macro/day-state token — making it a second tinted card on the same screen.
  - Rule: Rule 2 — 'At most one tinted hero card per screen'; Rule 6 — 'oat is reserved for marketing... warmth enters through food photography and its editorial grade, not beige shell or empty-state surfaces.'
- **[P1] Bookmark icon button breaks the uniform 40px muted-circle spec with a solid sage fill**
  - Capture: `mobile/recipe-detail-1-top.png`
  - Observed: Top-right icon row: back-chevron, share, and overflow ('...') all sample as neutral muted grey (RGB ~183,183,180, translucent scrim-grey). The bookmark button between them samples as solid sage-green (RGB 131,165,126) with a matching darker-sage glyph — a different fill color from its three siblings in the same row.
  - Rule: Rule 3 — 'Icon button: 40px circle, muted fill, ink glyph. There is no white-square, bordered, or shadowed variant. Anywhere.' (implicitly no semantically-tinted variant either — all icon buttons are one spec); Rule 4 — sage 'may appear as: Day-state semantics only... Never as: decoration'.
- **[P1] 'Fits your day' tag is a full-bleed banner, not the one chip spec**
  - Capture: `mobile/recipe-detail-1-top.png`
  - Observed: The tag spans edge-to-edge (no side inset matching the cards below it), with modest ~16-20px corner rounding (not a full-radius stadium pill) and a saturated dark-green fill (RGB 70,96,70) at roughly 16-18px bold white text — none of which matches the chip spec's pill radius, muted fill, or 13px/600 type at 9x14 padding.
  - Rule: Rule 3 — 'Chip: full-radius pill, muted fill, 13px/600, 9×14 padding... All chips — quick-add, filters, status — are this chip.'
- **[P1] Hero 'no photo yet' texture uses sage-on-taupe, not the plum-duotone system**
  - Capture: `mobile/recipe-detail-1-top.png`
  - Observed: The hero placeholder (behind 'Generate an image') is a warm grey-taupe gradient (sampled RGB ~145-196 grey-brown) with faint ring decorations and a centered utensil glyph sampled at olive/sage (RGB ~130,135,110 range, visibly green-grey, not plum). No plum hue appears anywhere in the texture.
  - Rule: Rule 7 — food with no photo renders as 'the plum-duotone texture system'; Rule 4 — sage restricted to day-state semantics, never decoration.
- **[P2] Source attribution renders far outside any type role — oversized, bold, underlined sans where a caption is specified**
  - Capture: `mobile/recipe-detail-3-lower.png`
  - Observed: Under the 'SOURCE' overline (correctly 11px tracked caps), 'Angela Boggiano' renders as a large bold underlined ink hyperlink — visibly close to 2x the cap-height of the SOURCE label above it (pixel sampling put the SOURCE glyph band at ~23px and the name's glyph band at ~26-31px including descender, at a materially heavier weight) — clearly past the 11px label ceiling and the 13-15px interactive ceiling, and not matching the 12px caption role that Rule 10 assigns to provenance text ('From your cookbook').
  - Rule: Rule 5 — every text node maps to one of ten roles; 'Sans-600/700 lives only in label and interactive'; Rule 10 — provenance renders at caption weight.
- **[P2] Trust card never delivers the Rule 10 payload: no per-serving macros, no confidence readout, no co-located fit tag, and a one-off amber square icon**
  - Capture: `mobile/recipe-detail-1-top.png`
  - Observed: The card states only 'Imported from Angela Boggiano — nutrition needs review' and 'We couldn't read reliable macros from this source' with a single 'Verify ingredients' CTA. No per-serving macro numbers, no 'Weighed from N ingredients · confidence' line, and no fit tag inside the card (fit tag instead lives in its own banner above) appear anywhere across all 3 captures. The card's leading icon is a rounded-square amber-filled glyph (not the 40px muted circle spec used elsewhere), a shape/fill combination that appears nowhere else on the screen.
  - Rule: Rule 10 — 'Capture ends in a trust card — every import resolves to per-serving macros + "Weighed from N ingredients · confidence" + the fit tag + one action'; Rule 3 — one icon spec.

### Progress (mobile + web)

Audited the Progress surface (flag-OFF legacy, progress_hierarchy_v1 default-off) across mobile/progress-1-top.png, -2-mid.png, -3-lower.png, web/progress-desktop.png, and web/progress-desktop-dark.png. web/progress-mobile.png could not be used for parity — it captured the logged-out "Cook what you love" auth gate, not the Progress screen, so mobile-web breakpoint compliance is unverified (this matches the constitution's own "still open" list item: mobile-web breakpoint against the ink shell). Two of eight findings (the WEIGHT card's tinted-vs-flat split and its nested-card treatment) sit squarely in the empty-state chart slot that Rule 8 assigns to the trajectory hero (dots-on-line + goal band); ENG-1525 (BUILT, validated 2026-07-17, still default-OFF) is understood to replace this hero entirely, so those two findings should be treated as "current shipping state to be superseded," not new build work, unless the flag stays off past its ramp window. The remaining six findings — a 3-way icon-button chrome split, sibling-numeral colour chaos on the Energy Balance card (reproduced in both light and dark theme), decorative/off-palette icon colour-coding in the Apple Health list, a bold-sans row numeral beside a correctly-serif sibling, and a web-only Household section with no mobile counterpart — are independent of the ENG-1525 gate and reproduce exactly the "every font/colour is different" (S8) failure mode the constitution was written to prevent.

- **[P0] Icon button renders as three different unauthorized chrome variants**
  - Capture: `mobile/progress-1-top.png; web/progress-desktop.png`
  - Observed: Mobile: the top-right header icon (scale glyph) is a pure-white circle, RGB(255,255,255) sampled at centre, with a ~2px hairline ring against the page-ground RGB(247,246,250) — no muted fill. Web, same page: the notification bell is a rounded SQUARE (visible bevelled corners, not a circle) with a hairline border; directly below it the calendar/date-range button is a true circle but again pure white with its own soft bordered ring. Three distinct treatments, none matching the spec, two of them on one screen simultaneously.
  - Rule: Rule 3 — "Icon button: 40px circle, muted fill, ink glyph. There is no white-square, bordered, or shadowed variant. Anywhere."
- **[P0] Sibling stat numerals differ in colour on the Energy Balance equation**
  - Capture: `web/progress-desktop.png; web/progress-desktop-dark.png`
  - Observed: ENERGY BALANCE · 7-DAY AVERAGE row "393 − 1,778 = −1,385": pixel-sampled numeral colours are three different hues in the same row — AVG INTAKE "393" = ink RGB(34,27,38); MAINTENANCE "1,778" = sage-green RGB(70,96,70); DEFICIT/DAY "-1,385" = plum RGB(59,42,77). Identical pattern reproduces in dark theme: 393 = near-white ink RGB(236,232,240), 1,778 = sage RGB(131,165,126), -1,385 = lighter plum RGB(126,92,146).
  - Rule: Rule 5 corollary — "Numeral colour is ink except the one display element... Colouring one stat green beside ink siblings is the exact chaos S8 was faulted for"; "Sibling stats never differ in colour — state lives in the pill/dot, not the numeral."
- **[P0] WEIGHT card is a tinted hero on iOS but a flat white card on web**
  - Capture: `mobile/progress-1-top.png; web/progress-desktop.png`
  - Observed: The identical empty-state WEIGHT card (same copy, same "Log your first weigh-in" CTA, same 13–19 Jul range) has an outer fill of RGB(230,225,235) — a lavender tint distinct from every surrounding white card — on mobile, versus RGB(255,255,255), matching all other page-ground cards, on web.
  - Rule: Rule 2 — "At most one tinted hero card per screen" (a card that is the screen's only tint on one platform and untinted on the other is a cross-platform grammar split).
  - Parity note: This card occupies Progress's Rule 8 hero slot (trajectory) in its empty state. ENG-1525 (progress_hierarchy_v1, shipped but default-OFF) is understood to replace this hero — confirm scope before opening standalone remediation so work isn't duplicated.
- **[P1] Nested well inside the WEIGHT card is a bordered card-in-card, not flat**
  - Capture: `mobile/progress-1-top.png; web/progress-desktop.png`
  - Observed: On both platforms, the icon + CTA inside the WEIGHT card sits inside a second rounded rectangle with its own fill (mobile: RGB(241,240,244), visibly distinct from the parent's RGB(230,225,235) tint and from page-ground RGB(247,246,250) — three tones stacked on one card), plus a stray horizontal divider rendered beneath the button with no content below it.
  - Rule: Rule 2 — "Nested cards: flat, borderless"; Rule 6 — "no mixed elevation on a surface."
  - Parity note: Same empty-state component ENG-1525 is expected to replace; verify the redesign's hero doesn't reintroduce this nested-well pattern.
- **[P1] Weekly adherence dashes don't carry day-state colour**
  - Capture: `mobile/progress-1-top.png`
  - Observed: Card copy reads "2 of 7 days on target — log a few more days for your weekly average," but all 7 daily dash marks in the mini-chart are the identical amber RGB(201,137,44); none render sage/on-track for the 2 days the copy itself says are on-target.
  - Rule: Rule 4 — "Sage / amber = Day-state semantics only (under/over, on/off-track)" — colour is applied uniformly rather than encoding the stated per-day state.
- **[P1] Apple Health row icons use decorative / off-palette colour-coding**
  - Capture: `mobile/progress-3-lower.png`
  - Observed: In the APPLE HEALTH list, "Active energy" renders its flame glyph in amber RGB(146,88,18) on a tan circle, and "Resting burn" renders its heart-pulse glyph in rose/pink RGB(178,93,122) on a pale-pink circle — a hue with no place in the 5-hue palette at all. Sibling rows "Steps" and "Weight" in the same list correctly use neutral ink-grey icon circles.
  - Rule: Rule 4 table — sage/amber "Never as: decoration, icons-for-flavour"; pink appears in no row of the hue-governance table (ink/plum, sage/amber, macro hues, destructive red are the only legal hues).
- **[P1] Weight value renders bold sans instead of serif**
  - Capture: `mobile/progress-3-lower.png`
  - Observed: The "54.4 kg" value in the Apple Health list is set in a bold sans-serif face (geometric single-story digits, no serifs, visibly heavier than 500 weight), while the sibling card-headline numeral "27.2%" (Body Fat, two cards above, confirmed serif Newsreader-style digits on close crop) correctly follows the numeral role.
  - Rule: Rule 5 — "Serif tabular numerals — row 15-17"; role table roles 2/3 mandate Newsreader; corollary "Sans-600/700 lives only in label and interactive... A bold word anywhere else is a violation."
- **[P2] HOUSEHOLD member-switcher exists on web, absent from mobile**
  - Capture: `web/progress-desktop.png; mobile/progress-1-top.png`
  - Observed: Web inserts a full "HOUSEHOLD" card ("All 1" pill + "ME Member" avatar-pill + a "Manage" link) directly beneath the page title, before the D/W/M/6M/Y control. The mobile capture goes straight from the title to the segmented control at every scroll position captured, with no equivalent section.
  - Rule: Same-element-same-treatment expectation across platforms for one surface — a structural section present on one platform and missing on the other for the identical screen.

### Settings / Targets / Profile / Notifications / Shopping

Settings cluster (mobile: settings-1-top, settings-2-mid, targets, profile; web: profile-desktop) audited against the Constitution. Two of the five requested web captures — web/settings-desktop.png and web/targets-desktop.png — are NOT the settings/targets screens: both files are byte-identical (90,530 bytes) to each other and render the pre-auth "Continue with Apple / Continue with email" modal, indicating the capture session was logged out when those two shots were taken. Web/library-desktop.png shares the same file size, so it is very likely affected too, though it wasn't in scope here. Only web/profile-desktop.png is a genuine in-app capture, so Settings-list and Daily-targets could only be audited on mobile; web parity for those two screens is unverified and should be re-captured before this audit is treated as complete. Within what could be audited, the cluster reads as the least disciplined chrome surface seen: the page-title role renders at two different sizes/weights inside one 3-screen flow, structural section labels flip between the correct overline and two different wrong treatments (bold sans, serif) on the same screens that get the overline right elsewhere, a macro icon breaks the colour-governance table, a header action button uses a 4th, off-spec shape, and the web chrome's icon buttons are a directly-named anti-pattern (bordered square + shadowed rounded-square) that mobile itself avoids — a real cross-platform grammar split on the identical control.

- **[P0] Web chrome icon buttons are the explicitly banned bordered/shadowed variants**
  - Capture: `web/profile-desktop.png`
  - Observed: Top-left sidebar-collapse control (next to the 'sloe' wordmark) is a rounded-square with a visible 1px grey border, not a circle. Top-right notification bell is a rounded-square with a soft drop-shadow and light-grey fill, also not a circle. Pixel crop confirms both are square/rounded-rect containers, ~36-40px box but not circular. Mobile's own settings-list row icons (settings-2-mid.png: Daily targets/Dashboard widgets/Week starts on/etc.) correctly render as 40px muted-fill circles with no border or shadow — so this is a real split between platforms on the identical 'icon button' component, not just a within-screen inconsistency.
  - Rule: Rule 3: 'Icon button: 40px circle, muted fill, ink glyph. There is no white-square, bordered, or shadowed variant. Anywhere.'
  - Parity note: Mobile settings-cluster icon buttons (40px muted circles) are compliant; the violation is web-only chrome, making this a genuine cross-platform grammar split rather than a shared mistake.
- **[P1] Sibling stat-card numerals differ in colour (Streak numeral coloured, Recipe numeral ink)**
  - Capture: `mobile/settings-1-top.png`
  - Observed: The two side-by-side stat cards below the 'Sloe Pro' row: the '1' over 'Recipe' renders in ink/plum, the '1' over 'Streak' renders in sage/green. Same card size, same position, same numeral role, different numeral colour on the exact sibling-stat pair the constitution names as the canonical failure case.
  - Rule: Rule 5, stat role: 'ink, always... Sibling stats never differ in colour — state lives in the pill/dot, not the numeral.' Explicitly reiterated as the corollary: 'Colouring one stat green beside ink siblings is the exact chaos S8 was faulted for.'
- **[P1] Page-title role renders at two conflicting size/weight specs inside one 3-screen flow**
  - Capture: `mobile/settings-1-top.png, mobile/targets.png, mobile/profile.png`
  - Observed: Cropped and measured cap-height of each serif page title at the same crop scale: 'Settings' ≈ 58px cap-height at a medium weight; 'Profile' ≈ 54px cap-height at the same medium weight; 'Daily targets' ≈ 76px cap-height at a visibly heavier (bold) weight — noticeably larger and bolder than its own siblings one tap away in the same navigation stack.
  - Rule: Rule 5, title role: 'Newsreader, 33, 500' — one spec for all page titles. Rule 1: the 33px serif title template applies uniformly to 'Plan, Recipes, Progress, Settings, and comparable utility screens.'
- **[P1] Structural section labels use two different wrong treatments on screens that get the label right elsewhere**
  - Capture: `mobile/targets.png, mobile/profile.png, web/profile-desktop.png`
  - Observed: targets.png: 'Macros' renders bold dark sans, sentence-case, ~28-32px — directly beside 'DAILY CALORIE TARGET', 'MAINTENANCE', 'PROTEIN' and 'CARBS' on the same screen, which correctly use the 11px tracked-caps grey overline. profile.png and profile-desktop.png (both platforms, identical): 'Milestones' and 'Saved recipes' render as serif, sentence-case, ~20px card headings instead of the overline.
  - Rule: Rule 1: 'structural labels are the quiet tracked-caps overline... everywhere... Serif never labels structure.' Rule 5, label role: 'ALL structural labels — section heads, in-card overlines... One variant only.' The constitution's own violation census names this exact pattern ('Progress sections titled by in-card overlines; Today/Cook by serif heads') as fixed elsewhere in Elevated — it persists unfixed in the shipped settings cluster on both platforms.
  - Parity note: The serif-heading violation is identically present on mobile and web (not a platform split), so it reflects a shared component, not divergent per-platform builds.
- **[P1] 'Edit' header button is a 4th, off-spec control shape**
  - Capture: `mobile/targets.png`
  - Observed: Top-right of the 'Daily targets' header: a white rounded-rectangle box (measured corner radius well short of a full pill relative to its own height — not the 'PRO' badge's true pill radius seen elsewhere in the same cluster) containing plain 'Edit' text. This matches none of the three sanctioned shapes: not a 40px icon circle, not a full-radius chip/pill, not bare ghost text (compare 'Manage' and 'Recalculate' elsewhere in this same cluster, both bare bold-plum text with no container).
  - Rule: Rule 3 control kit (icon button / chip / button tiers are exhaustive — 'no white-square, bordered, or shadowed variant. Anywhere'). Constitution's violation census: 'Plan/Cook header buttons = white squares w/ border+shadow... One 40px muted circle everywhere' — the same anti-pattern family, unfixed here.
- **[P1] Carbs icon uses a macro hue as an icon tint, banned by the colour table**
  - Capture: `mobile/targets.png`
  - Observed: Macros section: the Protein card's dumbbell icon is neutral ink. The Carbs card's wheat icon (and the small leading dot on its mini progress bar) is rendered amber/gold — a macro hue applied to a card-header icon, not inside a macro ring/bar visualisation.
  - Rule: Rule 4 colour table: macro hues 'May appear as: Inside macro visualisations only' / 'Never as: section accents, icon tints.'
- **[P1] User-monogram avatars skip the mandated frost-ring treatment, and the fill colour itself drifts cross-platform**
  - Capture: `mobile/settings-1-top.png, web/profile-desktop.png`
  - Observed: Mobile 'G' avatar and web 'P' / sidebar 'GR' avatars are all plain solid-fill plum circles with a white serif letter — no ring/border of any kind. Pixel-sampled fill colour also differs measurably between platforms for the same component: mobile avatar center ≈ RGB(59,42,77), web avatar center ≈ RGB(106,75,122) — a visibly lighter, more desaturated plum on web.
  - Rule: Rule 7: 'People may use serif initials only with the frost-ring treatment, as a stated placeholder until real photography lands.'
  - Parity note: Frost-ring omission is consistent (wrong the same way) on both platforms; the fill-colour sampling shows an additional, separate cross-platform shade drift on top of that.
- **[P2] Status chip casing differs cross-platform: 'PRO' (mobile) vs 'Pro' (web)**
  - Capture: `mobile/profile.png, web/profile-desktop.png`
  - Observed: Same pill (muted lavender fill, dark ink text, same position on the 'Your profile' card): mobile renders the label in all-caps 'PRO'; web renders it in title-case 'Pro'.
  - Rule: Same element, same treatment — one chip spec (Rule 3) implies one text-casing spec for the identical status badge.
- **[P2] Streak-flame leading icon has no circle container, unlike every row icon on the Settings list in the same cluster**
  - Capture: `mobile/settings-2-mid.png (compare), mobile/profile.png, web/profile-desktop.png`
  - Observed: settings-2-mid.png: every row icon (flame for Daily targets/Deficit summary, grid for Dashboard widgets, calendar for Week starts on, etc.) sits inside a 40px muted-fill circle. On the Profile card's '1-day streak' row (both platforms), the flame glyph is bare — no circle, no muted fill — directly adjacent in the same navigation cluster.
  - Rule: Rule 3: one icon-button/icon-token spec ('Same element, same treatment' ruling: 'Before styling a chip/pill/row/header, check how the nearest existing sibling renders it and match exactly — or document why this one is deliberately different.')
  - Parity note: This one is at least self-consistent across mobile and web (bare flame both places), so it is a within-cluster split, not a platform split.

### Secondary surfaces (Discover, Library, Coach, Paywall)

Audited 5 mobile captures (shopping, notifications, discover, library, coach) and 4 web captures (library-desktop, notifications-desktop, discover-desktop, shopping-desktop) against DESIGN-CONSTITUTION.md + ENG-1497 card grammar. All 9 files existed. Two capture caveats: web/library-desktop.png rendered an auth/login modal, not the Library page, so Library could only be inferred from sidebar labels visible in the other web captures; mobile/coach.png stuck on a loading spinner below the header, so only its header chrome was auditable. Net: secondary surfaces show a genuinely fragmented page-header template (eyebrow presence, title size, and back-nav placement all vary screen-to-screen on mobile), a real cross-platform split in how the Cook/Recipes area is structured and titled, an identical (cross-platform-consistent) chip-spec violation on Discover's filter row, an undocumented 4th "bordered-white" button treatment used for utility actions on both platforms, icon buttons that are bare glyphs or rounded squares instead of the mandated 40px muted circle, decorative (non-plum, non-semantic) creator-avatar hues, and a likely Rule 7 gap where web's placeholder recipe tiles are flat colour blocks where mobile correctly uses the plum-duotone texture.

- **[P0] Cook/Recipes area has two incompatible header structures across platforms**
  - Capture: `mobile/discover.png, mobile/library.png, web/discover-desktop.png (sidebar also visible in web/notifications-desktop.png, web/shopping-desktop.png)`
  - Observed: Mobile: 'Cookbook' and 'Discover' are underline sub-tabs sharing ONE page header — 'COOK' eyebrow overline (11px caps grey) + serif title 'Your kitchen' + right-slot pencil/link icons. Web: 'Library' and 'Discover' are two separate flat sidebar nav items (no shared parent), and the web Discover page's own header is just a bare serif 'Discover' title with no eyebrow overline at all — a different title string, a different information architecture, and a missing template element for the same feature area.
  - Rule: Rule 1 (eyebrow overline + serif title 33px is the page template) and the same-element-same-treatment requirement across platforms for the same surface
  - Parity note: Structural IA split, not just a styling drift — mobile nests Library+Discover under one screen/header, web treats them as independent top-level pages.
- **[P0] Shopping-list empty-state CTA renders as a ghost link on mobile, a bordered box button on web**
  - Capture: `mobile/shopping.png, web/shopping-desktop.png`
  - Observed: Mobile's single action under the identical empty-state copy ('Your shopping list builds itself...') is plain plum-ink text 'Go to plan →' with no box, border, or fill (ghost-text). Web's equivalent action, 'Start planning', is a rectangular button with a visible plum hairline border and a modest ~8-12px corner radius — not full-pill, not text-only.
  - Rule: Rule 3 (button vocabulary: filled CTA / tonal secondary / ghost tertiary — a bordered rounded-rect box matches none of the three) plus same-element-same-treatment across platforms
- **[P1] Icon buttons violate the 40px-muted-circle spec three different ways**
  - Capture: `mobile/library.png (header pencil/link icons; recipe-card bookmark badge), web/discover-desktop.png + web/notifications-desktop.png + web/shopping-desktop.png (top-right bell nav icon, present identically on all three), web/notifications-desktop.png (inline plum bell beside title)`
  - Observed: Mobile Cook-header action icons (pencil, link) are bare glyphs with no container at all — no circle, no fill. The recipe-card bookmark badge is a WHITE circle with a visible drop shadow. On web, the persistent top-right notification-bell nav icon (identical on every web capture) and the plum bell icon beside 'Notifications' both sit in rounded-SQUARE containers, not circles.
  - Rule: Rule 3 — "Icon button: 40px circle, muted fill, ink glyph. There is no white-square, bordered, or shadowed variant. Anywhere."
- **[P1] Mobile secondary-screen titles drift off the 33px title role and the eyebrow is inconsistently present**
  - Capture: `mobile/shopping.png, mobile/notifications.png, mobile/library.png, mobile/coach.png`
  - Observed: Pixel-measured glyph cap-heights of the page title: 'Shopping list' S ≈52px, 'Notifications' N ≈49px, 'Your kitchen' Y ≈49px, vs 'Your coach' Y ≈38px (~25-30% smaller) — Coach's title is also the only one of the four laid out inline after a leading back-chevron rather than standing alone on its own line. Separately, only the Cook header carries the 'COOK' eyebrow overline; Shopping list and Notifications have no eyebrow above their titles at all.
  - Rule: Rule 1 (page template) and Rule 5 (`title` role = one fixed 33px size, ink, Newsreader — a treatment not in the role table does not exist)
- **[P1] Discover filter chips use the wrong fill for both states, identically on mobile and web**
  - Capture: `mobile/discover.png, web/discover-desktop.png`
  - Observed: Pixel-sampled fills on the 'Following / All / Trending / Quick 30 …' chip row: unselected chips = pure white (255,255,255) on both platforms, not a muted fill. Selected chip ('All') = pale lavender (228,223,233) with dark-plum text, not solid plum fill with white text (reference plum sampled elsewhere in-app: (59,42,77)).
  - Rule: Rule 3 — chip spec: "full-radius pill, muted fill, 13px/600; selected = plum fill, white text"
  - Parity note: Values match exactly between mobile and web — a consistent systemic violation, not a platform split.
- **[P1] Utility actions (Mark all read / Clear / Start planning) use an undocumented 4th button style, in two different radii**
  - Capture: `mobile/notifications.png ('Mark all read'), web/notifications-desktop.png ('Mark all read', 'Clear'), web/shopping-desktop.png ('Start planning')`
  - Observed: All four buttons render as white/near-white fill with a visible hairline border. This matches none of Rule 3's three tiers: not the filled CTA (dark plum fill + white text, correctly seen on Discover's 'View recipe' button in the same web capture), not tonal secondary (muted fill), not ghost tertiary (text-only, no border). Two different corner radii are used for this same undocumented style — full-pill on the Notifications buttons vs ~8-12px rounded-rect on Shopping's button.
  - Rule: Rule 3 button vocabulary (filled / tonal / ghost — no fourth outline tier exists)
- **[P1] Creator-rail avatar colours are decorative and drift outside the plum family**
  - Capture: `web/discover-desktop.png (creator rail: Marcus Chen, Aisha Khan, Theo Blake, Sofia Romano, Priya Patel)`
  - Observed: Pixel-sampled avatar fills: Sofia Romano (74,54,97) and Priya Patel (70,49,79) sit in the cool ink+plum family (blue channel ≥ red). Aisha Khan (156,71,99) and Theo Blake (138,90,118) are warm rose/berry hues where red clearly exceeds blue — outside the plum family — with no visible state meaning behind the per-person colour choice.
  - Rule: Rule 4 — colour governance: only the ink+plum family may appear as chrome/decoration; any hue outside it must carry semantic meaning (day-state or macro-viz) or it doesn't appear
- **[P1] Placeholder recipe art is the correct plum-duotone texture on mobile but flat solid colour on web**
  - Capture: `mobile/library.png ('Easy classic lasagne' duotone cards), web/discover-desktop.png ('Quick weeknight' tiles)`
  - Observed: Mobile's Cookbook/Discover recipe cards without real photography render the sanctioned plum-duotone texture (cream/olive ground, dot pattern, fork-and-knife glyph). Web's 'Quick weeknight' tiles for the equivalent placeholder slot are flat solid-colour rectangles (dark plum, mauve, burgundy — matching the '15/30/20 min' pill colours per tile) with no texture and no photography visible.
  - Rule: Rule 7 — "Food is photographed... or rendered as the plum-duotone texture system... Letter monograms never represent food" (flat colour block is neither sanctioned treatment)
  - Parity note: Flagged with moderate confidence: could reflect unloaded imagery at capture time rather than a shipped treatment, but the per-tile colour-coding (matching each duration pill) suggests a deliberate flat-fill design rather than a loading skeleton.

### Conversion (Landing, Pricing, Onboarding, Login)

All 5 requested captures existed and were read at full resolution with pixel-level crops for corner-radius, fill-colour, and glyph-height verification where the visual read alone was ambiguous (mobile/paywall.png, web/pricing-desktop.png, web/landing-desktop.png, web/login-mobile.png, web/onboarding-mobile.png). The conversion surface is the most permissive cluster under the constitution (multi-filled-CTA exception applies), so the strongest findings are not 'too many filled buttons' but: (1) a literal retired-clay CTA fill inside the landing page's embedded recipe-detail screenshot; (2) an ungoverned icon-button spec — four different close/back treatments across just these five images; (3) the primary filled-CTA shape itself splitting between full-pill (mobile app, web landing/marketing) and rounded-rect (the actual web /pricing page); (4) the app-onboarding vs web-login first-run screen flipping between Nocturne-dark and plum-white-light for identical wordmark/copy; and (5) the pricing page independently re-presenting the Free/Pro decision three times over with escalating numeral scale, sage used decoratively (discount badge, checkmarks) rather than for day-state semantics, and two different non-compliant 'page-ground card' fills (shadowed white vs muted flat grey) coexisting on one page. Net read: the conversion funnel is where the constitution's per-surface rules (icon buttons, CTA shape, card grammar, colour governance) are least enforced, and it's also the one place the mobile app and the web marketing/pricing surfaces visibly diverge from each other, not just from the rulebook.

- **[P0] "Start Cooking" CTA is filled with retired clay, not plum**
  - Capture: `web/landing-desktop.png`
  - Observed: Mid-page, 'THE SLOE DIFFERENCE' section, the embedded phone mockup shows the live recipe-detail screen for 'Three Cheese Fusilli with Pink Peppercorns.' Its primary action pill 'Start Cooking' is filled with a terracotta/rust orange — sampled RGB (196,124,82) / #C47C52 — sitting directly beside three neutral muted-grey pills ('+ Log', 'Ask', 'Edit'). This is precisely the clay-on-neutral pattern the constitution calls out by name.
  - Rule: Rule 4 — Colour governance: '~~Clay~~ RETIRED (Grace, 2026-07-17) — monetisation wears plum/frost … Never: anywhere; clay-on-plum was the tell.'
- **[P0] Icon/dismiss buttons render in four incompatible treatments across the funnel**
  - Capture: `mobile/paywall.png`
  - Observed: Four distinct 'circle icon button' treatments appear across the captures for the same close/back/share control family: (1) mobile/paywall.png top-right close = solid WHITE-filled circle + ink X (zoomed crop confirms flat white fill, no muted tint); (2) web/login-mobile.png top-right close = bare ink X glyph with no circle/fill at all; (3) web/landing-desktop.png recipe-detail phone mockup, top bar = translucent dark-scrim circles + WHITE glyphs for back-arrow/bookmark/share; (4) web/landing-desktop.png 'Sloe Difference' bullet icons = the one compliant instance, muted-lavender circle + ink glyph. None of the first three match the spec, and they don't match each other either.
  - Rule: Rule 3 — One control kit: 'Icon button: 40px circle, muted fill, ink glyph. There is no white-square, bordered, or shadowed variant. Anywhere.'
  - Parity note: Cross-surface split: the same dismiss/back role renders four different ways across mobile app, web login, and web marketing — not just a mobile-vs-web split but an intra-web split too.
- **[P0] Primary filled CTA shape splits between full-pill and rounded-rect**
  - Capture: `web/pricing-desktop.png`
  - Observed: The top compact pricing card's 'Subscribe' button (pixel-measured: button height ~70-80px orig, corner radius ~18-20px — far short of the ~35-40px radius a true pill would need at that height) renders as a rounded RECTANGLE, not a pill. This contradicts the primary-CTA shape used everywhere else: web/landing-desktop.png hero 'Get the app' and pricing-teaser 'Get started' buttons are full pills (fully rounded ends), and mobile/paywall.png 'Open the App Store' is also a full pill.
  - Rule: Rule 3 — One control kit (one filled-CTA spec, applied consistently) combined with the 'same element, same treatment' requirement.
  - Parity note: The actual /pricing page is the outlier against both the mobile app and the rest of the marketing site.
- **[P0] Onboarding welcome and web login render the identical first-run moment in opposite grounds**
  - Capture: `web/onboarding-mobile.png`
  - Observed: web/onboarding-mobile.png (app first-run) and web/login-mobile.png (web mobile-web login) both show the identical wordmark 'sloe' and identical tagline 'Cook what you love. Still reach your goals.' as the entry moment before auth. onboarding-mobile.png renders this on a full Nocturne dark-ink ground with a white serif wordmark and white filled 'Get started' pill; login-mobile.png renders the same content on the light cool plum-white ground (#F7F6FA-class) with dark-ink serif wordmark and a black 'Continue with Apple' pill. Same copy, same purpose, opposite palette.
  - Rule: Rule 6 — Ground & depth: light ground is cool plum-white, dark is Nocturne — these are deliberate distinct modes, not an arbitrary per-surface choice for the same moment; also the surface brief's 'landing vs app: same brand voice/palette?' check.
  - Parity note: This is the exact first-impression screen a user hits twice (app vs web) with no shared visual identity beyond the wordmark and copy.
- **[P1] Pricing page repeats the plan/price module three times with escalating numeral scale**
  - Capture: `web/pricing-desktop.png`
  - Observed: One scrolling page carries three separate presentations of the same Free/Pro decision: (1) a compact card near the top with a Monthly/Annual segmented control + '£7.99/month' + 'Subscribe'; (2) a FREE/PRO feature-comparison table with a plum-tinted PRO column running its full height; (3) a second Monthly/Annual segmented control under a 'BILLING' label, followed by full Pro-vs-Free comparison cards repeating '£7.99/month' and '£0 forever'. Pixel-measured glyph bounding-box height of '£7.99' is 40px in module (1) vs 53px in module (3) — the identical price rendered ~33% larger the second time, i.e. a second, bigger 'biggest thing' on the same screen.
  - Rule: Rule 1 — One page template: 'One hero per screen... If two things look "biggest," the screen is wrong,' plus Rule 5's one-numeral-scale-per-role discipline.
- **[P1] "Upgrade to Pro" and "Continue for free" are visually identical buttons**
  - Capture: `web/pricing-desktop.png`
  - Observed: In the bottom Pro/Free comparison-card module, the paid-conversion CTA 'Upgrade to Pro' and the no-conversion CTA 'Continue for free' both render as the same plain white/outline button (hairline border, no fill) — zoomed crops of each are pixel-identical in treatment. Meanwhile the page's other CTA for the same upgrade action ('Subscribe', top card) is filled solid plum. The recommended action gets no visual priority in this module.
  - Rule: Rule 3 — 'one filled CTA per screen (conversion surfaces excepted) · secondary = tonal · tertiary = ghost' — the paid action should be the filled CTA, not tied stylistically to the free/decline action.
- **[P1] Sage/green used as decoration on pricing, not day-state semantics**
  - Capture: `web/pricing-desktop.png`
  - Observed: Three sites on this single page use the sage/green hue outside its licensed context: (a) the 'Save 37%' annual-discount pill appears twice (top segmented control and the 'BILLING' segmented control below) with green text (~RGB 70,96,70) on a near-white tinted pill; (b) the FREE/PRO feature-comparison table's inclusion checkmarks are green; (c) the bottom Pro/Free comparison cards' checklist checkmarks are also green. None of these are day-state (under/over, on/off-track) — they are a promo badge and feature-inclusion marks.
  - Rule: Rule 4 — Colour governance: 'Sage/amber → Day-state semantics only … Never as: decoration, icons-for-flavour.'
- **[P1] Page-ground cards on paywall/pricing use shadow + muted-grey fill instead of white/hairline/flat**
  - Capture: `mobile/paywall.png`
  - Observed: The four benefit cards ('Unlimited saves', 'Macro fitting', 'AI coach', 'Cloud sync') sit directly on the page ground and use a flat muted fill measured at ~RGB(241,240,244)/#F1F0F4 — darker than the page background itself (~#F7F6FA) — with no hairline border (pixel-level edge scan shows a plain anti-aliased blend, no distinct stroke colour). The identical card style repeats on web/pricing-desktop.png and web/landing-desktop.png. Separately, web/pricing-desktop.png's top compact pricing card and its bottom Pro/Free comparison cards are WHITE but carry a visible soft drop-shadow (confirmed via corner-pixel crop) rather than being flat. That's two different non-compliant page-ground treatments on one surface family.
  - Rule: Rule 2 / ENG-1497 card grammar: 'Page-ground cards: white, hairline, radius 24, flat.'
  - Parity note: Same two wrong treatments recur identically on both mobile app and web, so it isn't a mobile-vs-web split, but it is systemic across every conversion surface captured.
- **[P2] "Most popular" highlight mechanism differs between landing teaser and the actual pricing page**
  - Capture: `web/landing-desktop.png`
  - Observed: web/landing-desktop.png's pricing-teaser 'Pro' card is highlighted purely with a heavier dark border (visibly thicker/darker stroke than the 'Free' card's light hairline) — no banner. web/pricing-desktop.png's bottom 'Pro' card is highlighted with a full-width solid plum 'Most popular' banner strip across the card top, a different mechanism entirely for the same 'this is the recommended plan' signal.
  - Rule: 'Same element, same treatment' — before styling a card/chip/row, match the nearest existing sibling exactly or document why it's deliberately different (no documentation exists here).

### Whole-product coherence pass

Audited against DESIGN-CONSTITUTION.md v1 + ENG-1497 card grammar, using the 12 named captures (mobile/today-0-hero, plan-1-top, recipes-1-top, progress-1-top, settings-1-top, paywall, logsheet; web/today-desktop, plan-desktop, recipes-desktop, progress-desktop, landing-desktop) plus web/profile-desktop as a substitute after web/settings-desktop.png resolved to the logged-out auth screen, not Settings — that capture couldn't be judged as Settings and is flagged as a data-quality gap rather than a design finding.

Method note: several findings are backed by pixel-level measurement (RGB sampling and bounding-box heights via PIL), not visual impression alone — reported inline as evidence.

WHOLE-PRODUCT COHERENCE PASS (7 questions):

1. Page-title treatments: at least THREE distinct patterns where the constitution wants one — (a) eyebrow-overline + 33px serif title (Plan, Recipes, Progress, both platforms — the compliant pattern), (b) title with no eyebrow at all (Settings mobile, Profile web), (c) Today's day-name, which carries an eyebrow but renders the title itself off-ladder (measured, see findings). Even within pattern (a), the "same" title role measures two different pixel heights across screens (Plan vs Progress).

2. Section-label treatments: effectively ONE — the 11px tracked-caps grey overline is used consistently for every structural label sampled (TODAY, 17-23 JULY, YOUR TRENDS, COOK, PERSONAL, MEMBERSHIP, THIS WEEK, WEIGHT, GOAL/EATEN/BONUS, BREAKFAST/LUNCH/DINNER/SNACKS). This is the one part of the system that reads as genuinely unified — worth protecting, not touching, in any remediation.

3. Card treatments: FOUR where the legal grammar allows three — page-ground white/hairline/radius-24/flat (Progress, Settings, Profile, web Today hero); one tinted hero card per screen (Plan's "Nothing planned", Progress's "Weight" — both correctly singular per screen); nested flat light-fill (Paywall's four feature tiles); plus an uncatalogued fourth, a dashed-border "empty slot" row (Plan's Add-meal rows, both platforms) that matches none of the three tiers. Compounding this, the same hero content is card-wrapped on web and card-less on mobile (Today) — the card grammar isn't just over-tiered, it's applied inconsistently to identical content.

4. Chip specs: TWO where there should be one — the day-selector pill (F 17) correctly renders plum-fill/white-text everywhere sampled, but the filter/status chip (All meals, All, Snacks) consistently renders muted-lavender-fill/dark-text instead, on both platforms. The correct spec demonstrably exists in the codebase (the day pill proves it) — it just isn't reaching the chip component filters and log-sheet actually use.

5. Palette coherence: ink/plum dominates as intended (majority of chrome, text, controls). Sage is used correctly for day-state semantics (Under-budget indicator, streak dots, milestone checks) but ALSO leaks into decorative use as the recipe-photo-placeholder fork/spoon icon and rings — a direct Rule 4 breach ("never as decoration, icons-for-flavour"). Amber is correct inside the Carbs macro ring but also appears as a flat, non-semantic series colour across all seven of Progress's daily bars. Macro-hue tokens (plum/amber/rose for P/C/F) are consistent across mobile and web. Clay does not appear anywhere sampled (retirement holding). No stray hues found in chrome itself.

6. Does web read as the same product as mobile? Mostly, but with real cracks. The wordmark, ring hero, section-label grammar, and macro-hue registers all read as one product. The cracks: Today's hero card presence/absence (item 3), Plan's differing information architecture (mobile = one selected day via horizontal pill-strip + meal-type filter chips; web = all seven days stacked vertically with day headers, no filter chips in the same fold — same tab, two different browsing models), and the icon-button shape, which is genuinely worse WITHIN mobile alone (naked bell/pencil/link/close-X, a bordered circle on Progress, a shadowed squircle on Plan — four treatments in one app) than it is between platforms (web is at least internally consistent, always a pale squircle).

7. The one unifying move: consolidate icon-button and chip into two real shared components — one `IconButton` (40px, muted fill, no border/shadow/square escape hatch) and one `Chip` with a working selected-plum/white-text variant — and force every screen on both platforms to import them rather than hand-rolling markup per screen. This single change would resolve the two P0 control-kit findings outright (icon-button-fragmentation, chip-selected-state), remove two of the P2 tile/badge proliferation findings as a side effect, and is the highest-leverage fix because every other coherence gap found here (label unity aside) traces back to the same root cause: no single source of truth for "selected" or "icon container," so each screen reinvents both.

Overall: the label/overline system is the one genuine success story. Everything downstream of "container" and "selected state" — cards, chips, icon buttons — has drifted into 2-4 live variants per element, on both platforms, including within mobile alone.

- **[P0] Icon button spec has fractured into four-plus live treatments, none the ratified circle**
  - Capture: `mobile/plan-1-top.png`
  - Observed: Zoomed pixel crops: Plan header's sparkle/sliders/bookmark buttons are white rounded-square (squircle) tiles with a visible drop shadow. Today's bell and Recipes' pencil/link icons are bare glyphs with no circular container at all. Progress's scale icon is a white circle with a visible hairline ring border. Log-sheet's close X is a bare glyph. Web's global bell (sampled on web/today-desktop.png) is a pale squircle. None of these is the ratified 40px muted-fill circle with no white-square/bordered/shadowed variant — and this fragmentation exists within mobile alone, not just across platforms.
  - Rule: Rule 3 — icon button: 40px circle, muted fill, ink glyph; no white-square, bordered, or shadowed variant, anywhere
  - Parity note: Worse than a platform split: mobile doesn't agree with itself across Today/Plan/Progress/Recipes/Logsheet.
- **[P0] Selected chip state renders muted-lavender-fill/dark-text, never the mandated plum-fill/white-text**
  - Capture: `mobile/plan-1-top.png`
  - Observed: RGB-sampled fills: Plan's selected 'All meals' chip and Recipes' selected 'All' filters (both rows, mobile and web/recipes-desktop.png) and the Log-sheet's selected 'Snacks' meal-type chip all render a soft lavender-grey fill (~RGB 228,223,233 on the logsheet sample) with dark ink text — never solid plum with white text. The day-selector pill ('F 17') on these same screens correctly renders plum-fill/white-text, proving the correct spec exists in the component library but isn't reaching the filter/status chip.
  - Rule: Rule 3 — chip: selected = plum fill, white text; all chips (quick-add, filters, status) are this one chip
  - Parity note: Confirmed identical on web/recipes-desktop.png — cross-platform, not a mobile-only bug.
- **[P0] Today's hero zone is a bordered white card on web, card-less on mobile**
  - Capture: `web/today-desktop.png`
  - Observed: Pixel sampling: mobile's ring/Under-budget/Goal-Eaten-Bonus/verdict block reads RGB(247,246,250) throughout, identical to the surrounding page ground — no card. The same content block on web samples RGB(255,255,255) inside its bounds against RGB(247,246,250) page ground just outside it, with a visibly rounded, hairline-edged boundary — a genuine white page-ground card wraps identical hero content that mobile leaves un-carded.
  - Rule: Rule 2 / ENG-1497 card grammar — one treatment per hero zone
  - Parity note: Cross-platform grammar split on the single highest-traffic screen (Rule 8's 'where do I stand' loop moment).
- **[P0] Recipe-photo placeholder uses a sage/olive duotone, not the mandated plum duotone, and sage renders decoratively**
  - Capture: `mobile/recipes-1-top.png`
  - Observed: Zoomed crop of the 'Tonight's pick' and 'High protein' tiles shows a cream/oat field, grey-tan ellipse rings, and an olive/sage fork-and-spoon glyph — never plum-toned. Identical texture reappears on web/recipes-desktop.png's hero tile and web/profile-desktop.png's 'Saved recipes' tile.
  - Rule: Rule 7 — food is photographed or rendered as the plum-duotone texture, never another hue; Rule 4 — sage is day-state semantics only, never decoration or icons-for-flavour
  - Parity note: Same wrong-hue texture confirmed on both platforms across three separate surfaces (Recipes library x2, Profile saved-recipes).
- **[P0] Page-title treatment: at least three distinct patterns where the constitution wants one**
  - Capture: `(cross)`
  - Observed: (a) eyebrow-overline + 33px serif title — Plan, Recipes, Progress, both platforms. (b) title with no eyebrow at all — Settings (mobile), Profile (web, the Settings sub-page). (c) Today's day-name, which carries an eyebrow ('TODAY') but renders the title itself off-ladder (see today-daytitle-overscale). Even within pattern (a) the 'same' 33px title role measures two different pixel heights across screens (see title-role-size-drift).
  - Rule: Rule 1 — one page template
- **[P0] Web vs mobile: the three biggest coherence splits**
  - Capture: `(cross)`
  - Observed: 1) Today's hero renders as a white card on web, card-less on mobile (identical content, different grammar). 2) Plan's information architecture differs structurally: mobile shows one selected day via a horizontal pill-strip plus meal-type filter chips; web shows all seven days stacked vertically with day headers and no filter chips in the same fold — same tab, two different browsing models, not just a token mismatch. 3) The icon-button shape differs by surface even within one platform, but web is at least internally consistent (bell renders as a pale squircle everywhere sampled) while mobile is not (naked glyphs, a shadowed squircle, and a bordered circle all appear on different mobile screens) — mobile's own internal inconsistency is now the bigger problem than the mobile-vs-web gap.
  - Rule: (cross-platform coherence)
- **[P1] Avatar monogram treatment splits across platform (serif+dark-plum vs sans+lighter-plum), neither has the required frost-ring**
  - Capture: `mobile/settings-1-top.png`
  - Observed: Mobile's 'G' avatar: serif glyph on a solid dark-plum circle, no ring. Web's 'P' avatar (web/profile-desktop.png): bold sans-serif glyph on a visibly lighter mauve-plum circle, no ring. Same UI element (signed-in user's initial), two different letterform families and two different plum shades, and neither carries the frost-ring the constitution requires.
  - Rule: Rule 7 — people may use serif initials only with the frost-ring treatment
- **[P1] Utility-screen template missing its mandatory eyebrow overline**
  - Capture: `mobile/settings-1-top.png`
  - Observed: Settings (mobile) and its web equivalent (web/profile-desktop.png, reached via '< Settings') render only a serif title (plus a back chevron on mobile), with no 11px tracked-caps overline above it. Every other screen sampled (Plan, Recipes, Progress, both platforms) carries one ('17-23 JULY', 'COOK', 'YOUR TRENDS').
  - Rule: Rule 1 — the eyebrow-overline + 33px-title template explicitly names Settings as a screen it applies to
- **[P1] Today's day-name serif renders close to hero scale, not the title role**
  - Capture: `mobile/today-0-hero.png`
  - Observed: Pixel bounding-box heights measured on the same 1206px-wide/3x capture: 'Friday' = 105px tall. Calibration from the same batch: 'Your plan' (Plan's title role) = 81px, 'Progress' (Progress's title role) = 68px, and the ring's hero numeral '1,719' = 125px. Friday is 30-55% taller than the two confirmed title-role instances and only ~16% shorter than the display-role hero numeral itself — reproduced identically on web/today-desktop.png.
  - Rule: Rule 1 — display-scale type exists nowhere else on a screen but the hero; Rule 5 — serif appears only at defined role sizes (33 title / 46 display), nothing in between
- **[P1] Same title role renders at two different pixel sizes across screens**
  - Capture: `mobile/plan-1-top.png`
  - Observed: 'Your plan' bounding-box height = 81px vs 'Progress' bounding-box height = 68px, both measured in the same capture batch, both nominally the 33px title role, both set in Newsreader with comparable ascender/descender letters (Y+p/y vs P+g). A roughly 19% size gap between two instances of the same declared role.
  - Rule: Rule 5 — every text node maps to exactly one role; a treatment not in the table does not exist
- **[P1] Marketing ground matches the product's cool plum-white instead of using its reserved warm oat**
  - Capture: `web/landing-desktop.png`
  - Observed: Pixel-sampled background at hero and mid-page reads RGB(247,246,250/251) — identical to the product shell's #F7F6FA cool ground used on Today/Plan/Recipes/Progress, with no warm shift.
  - Rule: Rule 6 — cool plum-white is the product ground; oat is reserved for marketing
- **[P1] Palette check: sage and amber both leak outside their day-state lane**
  - Capture: `(cross)`
  - Observed: Sage renders correctly as day-state semantics (Under-budget indicator on Today, streak dots and milestone checkmarks on Settings/Profile) but also decoratively as the recipe-placeholder fork/spoon icon and rings. Amber renders correctly inside the Carbs macro ring but also as a flat, non-semantic series colour across all seven of Progress's daily-calorie bars regardless of each day's actual status. Ink/plum otherwise dominates as intended; clay does not appear anywhere sampled; macro-hue tokens are consistent across platforms.
  - Rule: Rule 4 — colour means something or it doesn't appear
- **[P2] Log-sheet quick actions use a fifth, uncatalogued icon-tile shape**
  - Capture: `mobile/logsheet.png`
  - Observed: Scan/Photo/Voice/Describe/Quick-add render as rounded-square icon+12px-label tiles, distinct from the 40px icon-button circle, the pill chip, and the 64px rail circle used elsewhere for creators/cuisines.
  - Rule: Rule 3 — one control kit (icon button / chip / segmented control / rail); no additional undocumented tile shape
- **[P2] 'TONIGHT'S PICK' badge is a third, uncatalogued small-label treatment**
  - Capture: `mobile/recipes-1-top.png`
  - Observed: A solid charcoal/near-black pill with white tracked-caps text overlays the recipe hero photo, matching neither the chip spec (muted fill / plum-selected) nor the label spec (grey tracked-caps, no fill) used for every other section or status marker in the set.
  - Rule: Rule 3 / Rule 5 — one chip spec, one label spec
- **[P2] Empty meal-slot rows use a dashed-border container outside the ratified card grammar**
  - Capture: `mobile/plan-1-top.png`
  - Observed: 'Add breakfast/lunch/dinner/snacks' rows render with a dashed 1px border and no fill on both mobile and web/plan-desktop.png — a fourth container idiom alongside the three ratified tiers (page-ground / nested / sheet).
  - Rule: Card grammar (ENG-1497) — page-ground/nested/sheet are the only three tiers
- **[P2] web/settings-desktop.png capture does not show Settings**
  - Capture: `web/settings-desktop.png`
  - Observed: The named capture renders the logged-out 'Cook what you love / Still reach your goals' auth screen, not the Settings surface — Settings could not be audited from this file; web/profile-desktop.png was used as a substitute for the Settings-adjacent findings above.
  - Rule: (capture/process gap, not a design rule)

## Method notes / gaps

- Code census ran 12 forensic passes (cards-mobile, cards-web, type-mobile, type-web, section-headers, chips-pills, screen-frame, cta-buttons, color-elevation, ratchet-debt, docs-drift, parity-components) → adversarial verify (refuter agents reading actual code) → cluster synthesis.
- Visual audit read the captured screenshots in `captures/mobile/` and `captures/web/` (26 + 22 PNGs, core daily-loop + secondary + conversion surfaces, light + dark, desktop + mobile-web) against `docs/ux/redesign/v3/DESIGN-CONSTITUTION.md` + ENG-1497 card grammar, several findings backed by direct pixel RGB sampling.
- One capture data-quality gap: `web/settings-desktop.png` resolved to the logged-out auth screen rather than Settings; `web/profile-desktop.png` was substituted. Re-capture Settings desktop authed before acting on any Settings-specific visual finding.
- 105 code-level findings from the census remain **unverified** (adversarial verify only ran the top 40 by design) — treat cluster diagnoses above as the reliable signal; the raw unverified list is in `raw-code-census-output.json` → `allFindings` if deeper digging is wanted on a specific cluster.
