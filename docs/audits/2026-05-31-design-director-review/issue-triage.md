# Design-Director Review — full issue triage (2026-05-31)

Source: design-director workflow over 188 captures. Raw: findings-raw.json

Total issues: 57

## [P0] Notifications sub-page crashes — renders an error boundary, not the screen
- **Group:** Settings hub + every s  **Surface:** Notifications (notifications-s00 redbox 
- **Fix:** Stabilise the realtime subscription: either remove loadInbox from the effect deps and call the latest via a ref, or build+subscribe the channel exactly once per userId (deps [userId] only) so .on() is

## [P0] Three different brand marks across the product — grey ring (in-app), black S (auth), blue square (design-system law)
- **Group:** Web app — desktop view  **Surface:** web-desktop-authed-today (sidebar), web-
- **Fix:** Pick ONE canonical mark and one token. Resolve the dev-primitives contradiction (blue-square vs ring) with a decision, collapse SupprPlateMark/SupprLogoMark/SupprMark to a single component, and use it

## [P0] Authed mobile-web product never rendered — wall is ~40% holes
- **Group:** Web app — mobile-web v  **Surface:** web-mobile-authed-{today,progress,profil
- **Fix:** Fix the visual-audit-authed Playwright fixture so the storageState/auth cookie actually authenticates before navigating, then re-run npm run test:e2e:visual and re-capture all authed-* mobile-web rout

## [P1] Commit CTA colour is not unified across the logging flow — green in PortionSheet, blue everywhere else
- **Group:** Today + logging  **Surface:** ix-34-portion-sheet / ix-35-portion-shee
- **Fix:** Repaint the PortionSheet 'Use this' CTA to Accent.primary (blue) to match Save changes and the slot selectors. Reserve Accent.success strictly for the calorie-ring state and macro hues. One primary co

## [P1] Long-press meal menu is a raw iOS system action sheet inside an otherwise fully-custom sheet world
- **Group:** Today + logging  **Surface:** ix-50-entry-longpress-alert
- **Fix:** Replace the native action sheet with a branded bottom sheet matching the Edit-entry sheet language (cream surface, blue accent, Accent.destructive for Delete, the same grabber + corner radius). This a

## [P1] Recipe-detail commit actions fire no haptic — silent Log all / Log / Start Cooking
- **Group:** Recipes  **Surface:** Recipe detail (ix-41, ix-42) — recipe/[i
- **Fix:** Wire PressableScale's haptic prop into the recipe-detail CTAs: 'confirm' on Log / portion-chip / servings steps, 'success' on Log all (whole-recipe commit). Web analog: 200ms colour-pulse + check-morp

## [P1] Two depth models inside one feature group (bordered cards vs shadowed cards)
- **Group:** Recipes  **Surface:** Library cards (library-s00) vs recipe-de
- **Fix:** Adopt ONE soft elevation token (~6-8% black, larger radius, no border) and apply it to both the photo cards and the detail cards; delete the hairline borders and drop the 0.22 shadow to the soft token

## [P1] 'Fits your day' win-moment is rendered as flat metadata, not a payoff
- **Group:** Recipes  **Surface:** Recipe detail (ix-41)
- **Fix:** Promote the fit verdict to a tinted, weighted chip; scale tint/colour with fit quality (strong fit = saturated success green + brief glow + success haptic on resolve). Mirror on web with a colour-puls

## [P1] Plan tab body uses hairline-border-as-shadow while its own modals use real elevation — two depth models in one flow
- **Group:** Plan + meal-plan + mov  **Surface:** ix-70-plan-tab.png (tab body) vs ix-73-m
- **Fix:** Adopt one elevation model at the card/row component level: replace borderWidth:1 with a soft ~6-8% shadow matching the Move-meal sheet's calibre, drop the decorative borders. The better model already 

## [P1] Empty-week state reads as a broken skeleton, not an invitation
- **Group:** Plan + meal-plan + mov  **Surface:** planner-s00.png / planner-s01.png / plan
- **Fix:** Redesign the empty week as an invitation: one confident primary 'Generate my week' moment with colour pull, suppress the negative-delta pills when the plan is empty (a deficit against nothing is noise

## [P1] Detail-screen cards are flat hairline-bordered while the parent Progress tab cards have real soft elevation — depth model breaks on tap-through
- **Group:** Progress + weight trac  **Surface:** metric-calories-s00/s01, metric-protein-
- **Fix:** Apply ONE elevation model across the whole group: the Progress tab's soft 8–10% shadow (no hairline border) on every card in progress-metric.tsx and burn-detail.tsx. Delete the borderWidth:1 borders t

## [P1] Metric-detail header is a shouty saturated-blue ALL-CAPS letter-spaced banner that exists nowhere else in Suppr
- **Group:** Progress + weight trac  **Surface:** metric-calories-s00 ('CALORIES THIS WEEK
- **Fix:** Replace with Suppr's actual title voice: near-black (colors.text) sentence-case at the Progress-tab title weight, left-aligned under the back chevron — e.g. 'Calories this week' / 'Protein consistency

## [P1] Win moments across the entire group are dead — no haptic, no celebratory colour/motion on the app's biggest progress payoffs
- **Group:** Progress + weight trac  **Surface:** ix-57-log-weight-sheet (Save weight), me
- **Fix:** Wire the existing PressableScale 'success' haptic + a 200ms number/colour pulse to: weight Save (ix-57), hitting a streak milestone, and a day crossing 'on target' on the protein detail. On web, mirro

## [P1] Two sibling nutrition-detail screens run on two different header systems + icon sets
- **Group:** Macro / nutrition deta  **Surface:** macro-detail (PushScreenHeader / lucide 
- **Fix:** Migrate meal-nutrition.tsx onto PushScreenHeader (it already exists and macro-detail already uses it). Drop the native stack header for the non-slot-aggregate branch, set headerShown:false, render Pus

## [P1] Primary CTA is tinted the full saturated macro colour, breaking the app-wide action-colour rule
- **Group:** Macro / nutrition deta  **Surface:** macro-detail empty state — macro-fat-s00
- **Fix:** In macro-detail.tsx change the empty-state Pressable backgroundColor from config.color to Accent.primary. Keep the macro colour where it belongs and reads premium: the value pill (config.color + '20' 

## [P1] Depth model is flat across the entire group — Elevation.card is a zeroed no-op
- **Group:** Settings hub + every s  **Surface:** Every card on Settings hub, Profile, Tar
- **Fix:** Introduce a single soft-elevation token (e.g. shadowOpacity ~0.06-0.08, radius ~12, offset y4, no border) and apply it to the card primitive used across the group; delete hairline borders that were st

## [P1] Dev marker leaks into a user-facing Settings row
- **Group:** Settings hub + every s  **Surface:** Settings hub Build section (settings-s03
- **Fix:** Resolve the build number at build time (real number, not '?') and strip the MARKER token from any release build's version string. Owner: executor. Pure string fix, no flag needed.

## [P1] Error boundary is off-palette, off-token, and off-brand — the lowest-craft surface in the product
- **Group:** Fasting, paywall, erro  **Surface:** Mobile error boundary (STATE-error-bound
- **Fix:** Rebuild on the token system: warm Suppr surface (Colors.dark.* or, better, match the light warm-ink world the rest of the flow uses), warm-ink text tokens, Radius.* not hardcoded 12, the Suppr mark, a

## [P1] One card material — replace hairline-border-as-shadow with a single soft elevation model
- **Group:** Fasting, paywall, erro  **Surface:** Fasting, what's-new, paywall cards (ix-6
- **Fix:** Define one card elevation token (soft ~8% shadow, no border) and apply it to the shared card surface so all three screens inherit it. design-system-enforcer encodes; flag-gate the rollout.

## [P1] Marketing/legal/recipe surfaces hardcode violet (×99) instead of the blue --primary
- **Group:** Web app — desktop view  **Surface:** web-desktop-privacy, web-desktop-terms, 
- **Fix:** Replace the raw text-violet-* utilities in TrustPageLayout/TrustPageHeader (and pricing's non-gradient violet) with the --primary token. One component change moves all six legal/trust pages. Owner: de

## [P1] No designed win-moment on web — ring close, target hit, list completion all land flat
- **Group:** Web app — desktop view  **Surface:** web-desktop-authed-today (calorie ring +
- **Fix:** Design one web win-moment system: ring-close colour pulse + 200ms count-up tween on macro/calorie numbers on log; a completion celebration on shopping-list 100%. Mirror the mobile success-haptic decis

## [P1] Brand mark is two different colours one tap apart (and the brand-spec page documents the wrong one)
- **Group:** Web app — mobile-web v  **Surface:** web-mobile-landing.png (blue tile) vs we
- **Fix:** Repoint .lp-brand .lp-mk and .lp-ws-brand .lp-mk to var(--brand-mark-bg)/var(--brand-mark-ring) (or use the SupprLogoMark component), and rewrite the dev-primitives caption to the black-on-cream / whi

## [P1] Three competing brand gradients on the cold-open paywall
- **Group:** Web app — mobile-web v  **Surface:** web-mobile-pricing.png
- **Fix:** Define ONE brand-gradient token (the declared #588CE4->#DF5EBC pair) and apply it to the hero, the popular-tier ribbon, and the primary checkout button. Delete the from-violet-600/to-indigo-600 hardco

## [P2] Search-results screen drops the card/elevation language to a flat hairline list — reads as a generic tracker
- **Group:** Today + logging  **Surface:** ix-33-search-results
- **Fix:** Unify the two filter/tab languages into one segmented-control component, give search rows the same soft-elevation card treatment as the rest of the flow (see depth fix below), and make the confidence/

## [P2] No depth model — every card on Today and in the logging flow is a flat fill with a hairline border doing a shadow's job
- **Group:** Today + logging  **Surface:** today-2026-05-15-s00 through s02, ix-30,
- **Fix:** Introduce ONE soft elevation token (e.g. shadowOpacity ~0.06, radius ~12, y-offset ~4, no border) and apply it to every resting card across Today + the logging sheets; delete the hairline borders that

## [P2] The win-moment is dead — hitting target / logging produces no celebration, and over-budget red has no motion
- **Group:** Today + logging  **Surface:** today-2026-05-28-s00 (red ring), today-2
- **Fix:** (1) Animate the ring fill + a number count-up on log; (2) fire a PressableScale 'confirm' haptic on every commit CTA (Use this / Save changes / Log usual) and a 'success' haptic + colour pulse the fir

## [P2] Edit-recipe sheet + yield dialog look imported from a different design system
- **Group:** Recipes  **Surface:** Edit recipe (ix-54), Yield editor (ix-65
- **Fix:** Build one tokenised form-field + modal primitive (warm card surface, soft elevation, blurred scrim) and reuse it for edit sheet, yield dialog and the create-recipe wizard. Owner: ui-product-designer +

## [P2] Discover renders the same data in two unreconciled layouts with two palettes
- **Group:** Recipes  **Surface:** Discover (discover-s00..s02 photo cards 
- **Fix:** Pick one Discover layout (or add an explicit, designed density toggle) and carry the coloured macro chip into both. Owner: ui-product-designer; design-system-enforcer to make the macro chip a single s

## [P2] 'Saved' bookmark uses three different colours/treatments across one tap-depth
- **Group:** Recipes  **Surface:** Library cards (library-s00, library-s02)
- **Fix:** One saved-state token + one badge component everywhere (recommend the success-green saved fill, with a light selection haptic + scale-bounce on toggle). Owner: design-system-enforcer; executor sweep.

## [P2] Secondary-text token sits at/below 4.5:1 across the detail body
- **Group:** Recipes  **Surface:** Recipe detail macro sub-labels 'of 101/6
- **Fix:** Darken the secondary-text token to clear 4.5:1 on the warm canvas and re-run the contrast audit (tests/e2e/verify/contrast-audit.spec.ts model) across every recipe surface. Owner: design-system-enforc

## [P2] COVERAGE GAP — cook mode, create-recipe, individual ingredient + ingredient-info-alert never rendered
- **Group:** Recipes  **Surface:** ix-75/ix-76 (cook mode), create-recipe-s
- **Fix:** Re-run the tour with deterministic navigation into cook mode, the create-recipe wizard, an individual ingredient row, and the ingredient-info alert, then re-review those four surfaces before the whole

## [P2] The 'Hits your targets 0 of 7' headline — the tab's emotional core — is rendered as inert flat text
- **Group:** Plan + meal-plan + mov  **Surface:** ix-70-plan-tab.png
- **Fix:** Give the headline a state-aware treatment: calm amber/progress framing when off-target, a success-green colour pulse + (mobile) success haptic when the week hits 7/7. Mirror the colour pulse on web /p

## [P2] Move-meal commit and Plan-generate have no win-moment payoff (no success haptic, no settle/reveal motion)
- **Group:** Plan + meal-plan + mov  **Surface:** ix-73-move-day-picker.png (move commit) 
- **Fix:** Add a success/confirm haptic on move-commit and on plan-generate, plus a settle animation (meal lands in its new slot) and a staggered row reveal on generate. Provide the web motion/colour analog on /

## [P2] Capture-tour failure: 5 of 13 Plan-group captures are the recipe-404 page, and web /planner is uncovered
- **Group:** Plan + meal-plan + mov  **Surface:** ix-70-plan.png, ix-71-move-after-longpre
- **Fix:** Fix the tour's move-meal navigation step (it's hitting a stale/invalid recipe deep-link → 404) and add a web /planner pass to the visual sweep so cross-platform parity can actually be judged. Mark web

## [P2] Weight-tracker stack is a third visual register — brighter blue, solid primary button, chip fills — that doesn't match the muted Progress hero
- **Group:** Progress + weight trac  **Surface:** weight-tracker-s00/s01, ix-55-weight-tra
- **Fix:** Reconcile to one blue and one chart language: use the Progress-hero muted chart blue and callout style on Weight & Trends; make the segmented control + import-depth chips match whatever chip pattern P

## [P2] Protein's identity colour is the same hex as the app's primary blue, so the protein detail has no colour of its own
- **Group:** Progress + weight trac  **Surface:** metric-protein-s00 (97g avg, 116g/104g d
- **Fix:** This is a deliberate 8-slot collapse so may be defended — but on the protein DETAIL screen specifically, differentiate the data from the chrome: keep the header in the new calm near-black voice (per t

## [P2] The over-target frame leads the whole tab with red while the actual story is positive maintenance — emotional-pull mismatch
- **Group:** Progress + weight trac  **Surface:** progress-s00 (red 154% ring + 'Over targ
- **Fix:** Keep the ring colour (carve-out). But rebalance the hero so the positive narrative leads and the over-target is contextual, not the headline — e.g. lead with the maintenance/confidence story and demot

## [P2] Most-tapped recovery CTAs use plain Pressables — no PressableScale, no haptic, opacity-only press
- **Group:** Macro / nutrition deta  **Surface:** macro-detail 'Log a meal' + meal-nutriti
- **Fix:** Replace these raw Pressables with PressableScale haptic="confirm" (CTA) / haptic="selection" (recovery). On web, wire the equivalent 150-200ms confirming micro-animation on the same buttons so the pre

## [P2] Flat, stock empty/error states with no depth, default icon, and a generation-old corner radius
- **Group:** Macro / nutrition deta  **Surface:** all four macro-*-s00 empty states + meal
- **Fix:** Give the empty/error states a soft-elevated anchor tile (the macro colour at low alpha as a tint, a lucide glyph, generous rounding) instead of floating centered text. Revisit the radius scale toward 

## [P2] Hardcoded Tailwind red breaks the token system
- **Group:** Settings hub + every s  **Surface:** Notifications error text (notifications.
- **Fix:** Replace '#f87171' with the semantic destructive token (colors.destructive / Accent equivalent). Owner: design-system-enforcer / executor. No flag.

## [P2] Header + section-label languages drift within one group
- **Group:** Settings hub + every s  **Surface:** Nutrition Sources one-off header (more-s
- **Fix:** Standardise on one header (left chevron + bold screen title) and one section-label style (Title Case grey caption — the dominant, calmer choice). Retire the 'INFO' eyebrow + '< Back' text on Nutrition

## [P2] Win-moments are silent — no haptic/colour celebration on connect or save
- **Group:** Settings hub + every s  **Surface:** Health Sync connect (health-sync-s00/s01
- **Fix:** Wire PressableScale haptic='success' + animate the row to the green 'Connected' state on Health connect; haptic='confirm' on every save commit; haptic='selection' + colour-fill on weekly-plan cell tog

## [P2] Three corner radii across four surfaces, one of them off-token
- **Group:** Fasting, paywall, erro  **Surface:** Paywall card r:18, fasting/whats-new car
- **Fix:** Pick one card radius token (extend the scale if 16/18 is the intended card value) and route all four call-sites through it. No hardcoded radii.

## [P2] What's-new is the dead delight surface — a changelog advertising polish it doesn't have
- **Group:** Fasting, paywall, erro  **Surface:** What's-new (dl-whats-new / tour-16-whats
- **Fix:** Add a staggered fade/slide-in to the section list on appearance; mirror the same reveal on the web changelog (web-desktop-whats-new.png is also a static list). Owner: ui-product-designer, with sync-en

## [P2] Win-moments land via haptic+colour but have no motion celebration
- **Group:** Fasting, paywall, erro  **Surface:** Fasting complete + paywall purchase-succ
- **Fix:** Add a one-shot completion animation: ring-fill + duration count-up on fast complete; a brief success flourish before the purchase-confirm Alert. Provide CSS analogs on web (mobile decisions apply to w

## [P2] Pricing carries two unrelated 'brand' gradients on one page
- **Group:** Web app — desktop view  **Surface:** web-desktop-pricing
- **Fix:** Align the Pro ribbon + CheckoutButton gradient to the canonical #588CE4→#DF5EBC brand gradient (or to --primary), removing the violet→indigo one-off. Owner: design-system-enforcer / ui-product-designe

## [P2] Brand mark + auth wordmark render at low fidelity / bare 'S' on first-impression surfaces
- **Group:** Web app — desktop view  **Surface:** web-desktop-login, web-desktop-signup, w
- **Fix:** Bring the canonical mark (once resolved in P0) and a hint of the brand world (the warm canvas is already there; add the resolved mark + a touch of the brand gradient or a recipe-photo motif) to the au

## [P2] Calorie ring — the home-screen hero — renders as a flat thin stroke
- **Group:** Web app — desktop view  **Surface:** web-desktop-authed-today
- **Fix:** Give the ring material: a subtle gradient stroke or inner shadow so it reads as a dial, and carry the 3-state colour mapping (gradient/green/red, per carve-out) onto a crafted surface rather than a ha

## [P2] Sign-up primary CTA reads as broken/disabled on first load
- **Group:** Web app — mobile-web v  **Surface:** web-mobile-signup.png
- **Fix:** Make the disabled state read as clearly-waiting (e.g. neutral/ghost with a 'Tick to agree' helper) rather than a faded version of the brand blue, so the enabled transition is a visible reward. Owner: 

## [P2] Cookie-consent strip crops the hero CTA on cold-open marketing
- **Group:** Web app — mobile-web v  **Surface:** web-mobile-landing.png, web-mobile-prici
- **Fix:** Apply the same lift-above logic to the public hero CTA, or render the consent strip as a slimmer top-anchored or corner toast on marketing routes so it never overlaps the primary CTA. Owner: ui-produc

## [P3] Inline 'Log usual' / 'Save as a meal' affordances use three different visual treatments on one screen
- **Group:** Today + logging  **Surface:** today-2026-05-15-s00 (amber 'Log usual' 
- **Fix:** Define ONE quick-action chip component (single tint = primarySoft blue, consistent radius, consistent dismiss affordance) and use it for every inline meal shortcut. Owner: design-system-enforcer + ui-

## [P3] Image-fallback + error states break the warm identity
- **Group:** Recipes  **Surface:** Shrimp Rice Paper Rolls fallback (librar
- **Fix:** Design a branded no-image placeholder (warm canvas + tinted macro-coloured glyph, not muddy brown) and bring the error boundary onto the warm-canvas identity with a recovery illustration. Owner: ui-pr

## [P3] Empty meal-row thumbnail renders as a blank pale-blue square
- **Group:** Plan + meal-plan + mov  **Surface:** ix-70-plan-tab.png (Homemade Cream Chees
- **Fix:** Use a branded fallback tile (slot-tinted glyph on a tinted ground, reusing the existing slot-tint system) instead of an empty colour block. Owner: executor / visual-qa.

## [P3] Two captures are mislabeled and there is NO weight metric-detail screen — coverage gap, not a render bug
- **Group:** Progress + weight trac  **Surface:** metric-weight-s00, metric-weight-s01 (bo
- **Fix:** No code fix required for the mislabel itself — flag to the harness owner that the tour manifest names a weight metric-detail that doesn't exist. Separately, decide intentionally: should tapping the we

## [P3] Loading and surface idioms diverge within and across the two screens
- **Group:** Macro / nutrition deta  **Surface:** macro-detail ('Loading...' text) vs meal
- **Fix:** Standardise on one loading idiom (skeleton that previews the macro-detail list / meal card shape) shared by both screens, and align the error surface to the same card/tint language as the data state. 

## [P3] Capture harness produced 3 phantom error-boundary fall-throughs
- **Group:** Fasting, paywall, erro  **Surface:** fasting-s00.png, paywall-s00.png, whats-
- **Fix:** Hard-fail the screenshot tour when a captured frame matches the error-boundary hash, so s00 phantoms never enter a review set. Owner: executor (harness). Not a product-design defect.

## [P3] Onboarding hero is flatter and uses a different brand-colour treatment than the pricing hero
- **Group:** Web app — mobile-web v  **Surface:** web-mobile-onboarding.png vs web-mobile-
- **Fix:** Unify on one hero-gradient language and bring the onboarding CTA up to the elevated/gradient treatment of pricing. Owner: ui-product-designer. (Onboarding Welcome COPY divergence stays an intentional 
