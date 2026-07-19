# Product Overview

Suppr is a macro-tracker platform with recipe import, meal planning, and
nutrition correctness as differentiators — this doc is the **map** of what it
is and how its parts fit together. It does not describe individual features;
it tells you which journey doc does.

**Audience:** `(Internal)` — Product, Design, Engineering, and every
specialist agent. Read this first, then follow a link.

## Scope

- **In scope:** what Suppr is and who it's for; platform status; the
  canonical list of **product loops** (the repeatable journeys a user
  actually takes, end to end) with why each one exists and where to read the
  full flow; a **feature-area index** mapping the product's functional
  surfaces to their primary journey doc(s).
- **Out of scope — go to the linked doc instead:** individual feature
  behaviour, screen-by-screen UX, API contracts, data schema, analytics event
  names, nutrition-approximation rules. **This file must never grow a feature
  description.** If a loop's shape changes, update its journey doc first;
  only touch the one-line summary and link here if the loop itself changed
  shape (a new step, a new entry point, a loop merging/splitting).

---

## What is Suppr?

Suppr is a **macro-tracker spine** — Today's log is the canonical home
surface, and recipes, meal planning, and nutrition verification exist to
serve it, not the other way round (this ordering is a locked strategic
decision, not an accident of build order). A user imports a recipe from
wherever they found it — a shared Instagram/TikTok link, a blog URL, a
cookbook photo, or written from scratch — Suppr verifies every ingredient
against a real nutrition-source cascade (USDA FoodData Central → Open Food
Facts → FatSecret, with confidence always visible and low-confidence matches
flagged rather than silently filled), then that recipe can be planned,
shopped for, cooked, and logged against the user's own macro targets.

The product ships as **one product across web and mobile** (see
[`web-mobile-parity-scope.md`](./web-mobile-parity-scope.md) for the parity
contract and the documented, intentional platform divergences).

## Who is it for?

Health-conscious home cooks who want accurate nutrition data for the recipes
they actually cook — not generic database entries. Primary personas:

- **Macro trackers** — people counting protein/carbs/fat for fitness goals.
  Right now this includes a specific, high-value capture cohort: refugees
  from mass-market trackers (MyFitnessPal chief among them) driven out by
  feature removals and paywalling — see
  [`competitive-principles.md`](../competitive-principles.md) for the
  canonical competitor set this product is positioned against.
- **Meal preppers** — people who plan weekly meals in advance and batch cook.
- **Recipe collectors** — people who save recipes from food blogs and social
  media and want them in one place with real nutrition data attached.

## Platforms

| Platform | Technology | Status |
|----------|-----------|--------|
| Web | Next.js 15 (App Router) | Production |
| iOS | Expo / React Native | TestFlight (pre-launch, currently with a single solo tester) |
| Android | Expo / React Native | **Not built.** The Android config in the repo is a vestigial Expo template — iOS is the only mobile target that ships. Do not treat an Android gap as a bug. |

---

## Product loops

A "loop" here is a complete, repeatable journey a user actually takes —
usually starting from a specific entry point and ending back on Today,
Progress, or another loop. Loops are the right unit for a map like this one
because features don't stand alone: a recipe import is only valuable because
it feeds Plan and Today; a paywall gate is only reachable because a real
feature limit was hit. Every loop below links to the journey doc that owns
its full entry → action → result narrative; where a loop diverges
meaningfully between web and mobile, that's called out inline (the full
parity ledger is [`web-mobile-parity-scope.md`](./web-mobile-parity-scope.md)).

### 1. Onboarding → First Log (Activation Loop)
The front door, and the loop the product's activation metric is built
around — whether a new user reaches their first logged meal. **Entry:** a
fresh install (web shows the landing page's "Get started"; most mobile
installs currently land on login first, with targets revealed only after
sign-in). **Why:** a user who never reaches a first log rarely returns.
**What happens:** Welcome → questionnaire (goal, body stats, activity, pace
with a safety-floor soft-warn, diet) → computed calorie/macro targets are
revealed → account creation → optional data bridges (manual targets, Apple
Health, notifications, recipe-URL import) → a guided first log → Today, with
a seeded library and a built first week.
**Parity:** web reveals targets before signup by default; mobile currently
shows them only after sign-in. This is a genuine platform difference we
haven't reconciled yet, not a deliberate design choice.
→ [`onboarding-to-first-log.md`](../journeys/onboarding-to-first-log.md)

### 2. Import → Verify → Save → Cook/Log (Recipe Capture Loop)
The founder's headline viral wedge — "I saved this recipe on TikTok, watch
what happens" — and the primary route new recipes enter the macro spine.
**Entry:** iOS share sheet, a `suppr://` deep link, clipboard auto-detect,
manual URL paste, or a photo/cookbook capture. **Why:** recipes only earn
trust if their nutrition is real, so every import routes through the same
verification pipeline before it can touch a macro target. **What happens:**
the source is parsed, every ingredient is matched and confidence-scored, the
user reviews/corrects low-confidence rows, saves to Library, then cooks
(Cook Mode) or logs straight to Today.
**Parity:** the caption-only social-import method required for legal
compliance is built but not yet switched on in production — both platforms
still fall back to a server-fetch method that legal review flagged as a
concern. This remains unresolved: real caption-only import isn't live yet,
and the underlying legal question hasn't been settled.
→ [`import-recipe.md`](../journeys/import-recipe.md),
[`verify-ingredients.md`](../journeys/verify-ingredients.md) (siblings:
[`create-recipe.md`](../journeys/create-recipe.md) for from-scratch recipes,
[`import-cookbook.md`](../journeys/import-cookbook.md) for the PDF batch
path)

### 3. Plan the Week → Shop → Cook (Meal Planning Loop)
The third leg of the core loop — recipes serve the macro spine by getting
fitted to it. **Entry:** the Plan tab, choosing a recipe pool (library /
library+Discover / Discover only). **Why:** "build a week that hits my
targets" is a distinct job from "log what I ate today." **What happens:**
generate (a macro-fitted algorithm samples the pool against real profile
targets) → adjust (lock favourite meals, swap/move individual meals, set a
calorie floor) → generate a shopping list that stays in sync as the plan
changes → shop (check off in-aisle, live-shared for households) → cook (Cook
Mode / Batch Cook) → log servings back to Today.
**Parity:** mobile lets you remove a meal from the plan and syncs the change
to the shopping list; web's meal-edit surface only supports swapping, so
that shared removal path never fires there. This is a known, longstanding
platform difference, not a new gap.
→ [`meal-planning.md`](../journeys/meal-planning.md),
[`shopping-list.md`](../journeys/shopping-list.md)

### 4. Discover → Save → Cook (Browse & Build Library Loop)
The browse-first path into the recipe system, for a user with no library yet
or looking for inspiration. **Entry:** the Recipes tab, which defaults to
Library — an empty library auto-redirects to Discover so day-one users never
see a blank cookbook. **Why:** Discover has to "feel alive" or import users
have no reason to return. **What happens:** browse curated + community
recipes → Recipe Detail (macro strip, "fits your day" verdict, ingredient
grid) → save to Library or a named collection → Cook Mode.
**Next:** saved recipes feed the Plan pool and the What to Eat Next
suggestion.
→ [`discover-and-library.md`](../journeys/discover-and-library.md)

### 5. Daily Logging Loop (Log a Meal)
The highest-frequency, most load-bearing loop in the product. **Entry:**
Today's centred Log button (mobile) / FAB (web mobile-web), or a meal slot's
add-food row. **Why:** this single canonical Log sheet replaced 8+ legacy
per-meal entry points — one sheet, not per-meal pop-ups, is a locked
strategic decision. **What happens:** search-first typeahead (custom foods →
history → favourites → USDA → OFF) or scan/voice/photo → pick a portion →
commit to a meal slot → Today's ring and macro tiles update.
**Next:** feeds the Weekly Review loop via the background adaptive-TDEE
refresh.
→ [`food-tracking.md`](../journeys/food-tracking.md),
[`log-sheet.md`](../journeys/log-sheet.md)

### 6. What to Eat Next (North-Star / Coach Loop)
The differentiating moment — "what should I eat next to hit my remaining
macros" is the question the product is meant to answer better than any
competitor (locked strategic decision). **Entry:** the always-on North Star
block on Today, or the Coach chip → the full `/coach` screen. **Why:** it
turns the tracker into something closer to a coach without ever inventing a
number. **What happens:** Today's block always has a suggestion drawn from
the user's own saved library; `/coach` (on by default) adds a grounded,
number-safe day narrative and 3 bounded Q&A chips — never open-ended chat.
**Next:** tap a suggestion → Recipe Detail → log or cook, closing the loop
back into Daily Logging.
→ [`what-to-eat-next.md`](../journeys/what-to-eat-next.md)

### 7. AI-Assisted Logging & Trust Loop (barcode / voice / photo)
The Cal-AI-style "log by photo/voice" pattern, done the trust-first way.
**Entry:** the scan/voice/photo icons in the Log sheet, or a Today shortcut.
**Why:** every path routes through the same ingredient-verification and
plausibility pipeline as a manual log, so nothing is invented — low-
confidence results are surfaced, never silently guessed. That's a trust
commitment the product doesn't compromise on. **What happens:** scan a
barcode, speak a meal, or snap a photo → review AI-estimated items
(confidence dots, amber low-confidence flags, an explicit "Log anyway") →
commit, with the source tagged (AI voice / AI photo / barcode).
**Next:** free/Base tiers hit an in-context paywall before completing most
AI paths — see the Monetisation loop below.
→ [`log-sheet.md`](../journeys/log-sheet.md),
[`food-tracking.md`](../journeys/food-tracking.md)

### 8. Weekly Review & Adaptive Re-Target Loop (Progress)
MacroFactor-style adaptive TDEE — targets re-tune from the user's own real
intake + weight data, not a fixed formula, once enough clean days
accumulate. **Entry:** the Progress tab, or a tz-aware weekly-recap push
(mobile). **Why:** a fixed formula is wrong for most bodies; learning from
real logs beats guessing, but a single forgotten dinner must not drag the
number down (hence the completeness gating in the adaptive engine). **What
happens:** a week of logging feeds the adaptive-TDEE engine → a weekly
check-in surfaces the formula-vs-adaptive delta and a suggested new target →
accepting flows a new target back into Today's ring.
→ [`progress.md`](../journeys/progress.md)

### 9. Weight → Trajectory → Goal Loop
**Entry:** the inline weight-log sheet on Progress, or Apple Health sync
(mobile). **Why:** weight is the single most consequential read on Progress,
and it directly feeds the maintenance/adaptive-TDEE math used across Today,
Progress, and Coach — get this wrong and every number downstream is wrong.
**What happens:** log a weigh-in → see a trend and a projected goal date
(direction-aware tone — never shame-coded for a gain goal) → that weight
signal feeds the same maintenance/adaptive-TDEE calculation, updating the
calorie target shown on Today and Targets.
→ [`progress.md`](../journeys/progress.md)

### 10. Household Sharing Loop
"Households see what's on the table, not what's on the scale" — a granular
sharing boundary so a meal-planning household can coordinate without
exposing weight, targets, or nutrition logs to each other. **Entry:**
Settings → Household row, or the Plan/Shopping HouseholdBar "Manage."
**What happens:** invite members → configure a sharing preset or the 7×4
day-by-slot grid → Plan and Shopping surfaces reflect the shared scope live,
with per-member check attribution in Shopping.
→ [`household-sharing.md`](../journeys/household-sharing.md) (setup,
presets/grid, privacy boundary),
[`settings-and-control.md`](../journeys/settings-and-control.md) §7
Connections (entry point), [`shopping-list.md`](../journeys/shopping-list.md)
(household-aware shopping), and
[`2026-05-01-household-netflix-model-v1-schema.md`](../decisions/2026-05-01-household-netflix-model-v1-schema.md)
for the shipped schema

### 11. Monetisation / Paywall Loop
**Entry:** any server-enforced gate (AI voice/photo logging, a multi-day
plan, photo/cookbook import, the 10-recipe save cap). **Why:** every "Pro
feature" claim has to be enforced on the backend, not just in the UI —
early paywalls that only lived client-side could be bypassed, which cost
real revenue, so backend enforcement is now a hard rule. **What happens:**
an in-context, factual paywall explains the specific gated feature →
checkout on the platform-appropriate rail (Stripe web / RevenueCat mobile
IAP) → a provider webhook — never the client — reconciles the entitlement
into the single subscription-status field the whole product reads from, so
Pro access is consistent everywhere.
**Parity:** Stripe vs IAP billing rails are an intentional, documented
divergence; entitlements always reconcile to the same field.
→ [`monetisation-and-paywall.md`](../journeys/monetisation-and-paywall.md)

### 12. Creator & Social Loop
**Entry:** a recipe byline, or the Discover "Top creators" rail. **Why:**
the social/follow plane around Discover, plus the legal attribution and
takedown machinery every imported third-party recipe carries. **What
happens:** follow a creator → see more of their recipes in the Following
feed; separately, any imported (non-first-party) recipe carries a source
card, a link back to the original, and a report/DMCA path.
**Known limitation:** the creator plane you see today is seeded with
launch-partner personas rather than real creators — there's no live publish
path yet for an actual creator to post their own recipes. Treat it as an
early preview of the feature, not a finished one.
→ [`creator-platform.md`](../journeys/creator-platform.md)

### 13. Cross-Device Entry Loop (Shortcuts, Widgets, Deep Links)
Power-user entry points that skip the app UI entirely. **Entry:** a Siri
Shortcut / Action Button / Focus automation firing a `suppr://` URL. **Why:**
there's no native voice-command integration yet, so shortcuts work by
opening a URL rather than through a "Hey Siri" voice command.
**What happens:** the shortcut triggers log-water, start-fast, or
open-today-remaining → the app applies the mutation and lands on Today,
exactly as if logged in-app.
**Parity:** mobile-only, since it depends on iOS deep links. The
Home/Lock-screen widget shown in marketing hasn't shipped yet — it's a
planned feature, not something users can add today.
→ [`shortcuts-and-widgets.md`](../journeys/shortcuts-and-widgets.md)

### 14. Marketing → Signup Loop (top of funnel)
**Entry:** the public landing page, `/pricing`, `/roadmap`, `/whats-new`, or
a referral link (`/g/<code>`). **Why:** converts a visitor's trust/pricing
intent into the Onboarding → First Log loop; every public marketing claim
reads from one shared source of copy, so marketing text can't drift from
the product. **What happens:** browse trust/pricing surfaces → optionally
redeem a referral code (stored locally, redeemed server-side only after a
real session exists) → "Get started" into onboarding.
→ [`marketing-to-signup.md`](../journeys/marketing-to-signup.md),
[`landing-maintenance.md`](./landing-maintenance.md)
(copy-maintenance mechanics, not the journey narrative), and continuing into
[`onboarding-to-first-log.md`](../journeys/onboarding-to-first-log.md)

### 15. Settings & Control Loop (the trust/control plane)
Not a linear funnel — the control plane every other loop reads from.
**Entry:** Today's header avatar → Settings (not a bottom tab). **Why:** a
user who can't find or trust their own targets won't trust Today's numbers;
can't-export or can't-delete is a churn risk. **What happens:** edit
targets/body stats, preferences, connections, notifications, or membership;
exercise data control (export, refresh-plan, erase-everything, delete
account — all type-to-confirm gated).
**Next:** changes here flow back into Today, Plan, Progress, and Coach
automatically — for example, editing your targets updates what Today shows
the next time you open it.
→ [`settings-and-control.md`](../journeys/settings-and-control.md)

---

## Feature areas

A second index into the same journey docs, organised by functional surface
rather than by user loop — useful when you know *what* you're touching
(e.g. "the Shopping List") rather than *which journey* it sits inside.

| Feature area | Covers | Primary journey doc(s) |
|---|---|---|
| Onboarding & Auth | Welcome → questionnaire → reveal → signup → data bridges → completion; login/auth chooser, magic link, password reset, the onboarding entry gate | [`onboarding-to-first-log.md`](../journeys/onboarding-to-first-log.md) |
| Recipe Capture & Import | URL / social-share / cookbook-photo / manual entry, ingredient verification | [`import-recipe.md`](../journeys/import-recipe.md), [`verify-ingredients.md`](../journeys/verify-ingredients.md), [`create-recipe.md`](../journeys/create-recipe.md), [`import-cookbook.md`](../journeys/import-cookbook.md) |
| Recipe Library, Discovery & Cooking | Library ↔ Discover sub-tabs, Recipe Detail, Cook Mode, Batch Cook, recipe collections, creator profile page | [`discover-and-library.md`](../journeys/discover-and-library.md) |
| Nutrition & Macro/Calorie Calculation | TDEE engine, maintenance resolution, adaptive TDEE, measured (Apple Health) TDEE, macro/meal nutrition detail, "why this number" | [`how-your-calorie-target-works.md`](../user/how-your-calorie-target-works.md), [`nutrition-approximation-policy.md`](./nutrition-approximation-policy.md), [`food-tracking.md`](../journeys/food-tracking.md#viewing-full-meal-nutrition) (the per-meal/per-slot nutrition-detail screen — "Viewing full meal nutrition") |
| Meal Planning | Generate/adjust a macro-fitted plan, per-meal lock, distribute-around-anchor, templates, leftovers, plan import | [`meal-planning.md`](../journeys/meal-planning.md) |
| Food Tracking / Diary | Today (the canonical macro spine), the Log sheet, Quick Add / usual meals, hydration & stimulants, week view, weekly check-in | [`food-tracking.md`](../journeys/food-tracking.md), [`log-sheet.md`](../journeys/log-sheet.md) |
| Progress & Insights | Weight card / trajectory, weekly recap, adaptive-TDEE review, streak freezes, body composition | [`progress.md`](../journeys/progress.md) |
| Shopping List | Generate/sync from plan, single-recipe add, household-shared list + attribution, pantry staples | [`shopping-list.md`](../journeys/shopping-list.md) |
| AI Coach | The `/coach` destination — grounded day narrative, ranked "what to eat next," bounded Ask chips; the inline Today coach line | [`what-to-eat-next.md`](../journeys/what-to-eat-next.md) |
| Creator Platform & Import Legal | Creator profiles, follow graph, import attribution/disclaimer, DMCA takedown, report-recipe | [`creator-platform.md`](../journeys/creator-platform.md) |
| Settings, Household, Profile & Notifications | Settings hub + search, `/profile` + `/targets` editing, household sharing entry + full setup/config/privacy, Apple Health connection entry, reminders, danger zone | [`settings-and-control.md`](../journeys/settings-and-control.md), [`household-sharing.md`](../journeys/household-sharing.md) |
| Monetisation & Billing | Checkout (Stripe / RevenueCat), webhooks, entitlement reconciliation, subscription management, promo codes, tier gates | [`monetisation-and-paywall.md`](../journeys/monetisation-and-paywall.md) |
| Widgets, Shortcuts & Marketing | Siri Shortcuts / deep links, widget snapshot (native widget deferred), public marketing/legal pages, top-of-funnel landing/pricing/roadmap/referral | [`shortcuts-and-widgets.md`](../journeys/shortcuts-and-widgets.md), [`marketing-to-signup.md`](../journeys/marketing-to-signup.md), [`landing-maintenance.md`](./landing-maintenance.md) |

---

## Edge cases / limits

- **This doc has no feature detail on purpose.** If you're looking for "how
  does X actually behave," the answer is never here — it's in the linked
  journey doc. Feature-level detail that creeps back into this file should
  move to the appropriate journey doc instead.
- **Health Sync is the one area still under-documented.** Only its Settings
  entry point is written up (in `settings-and-control.md` §7) — the sync
  mechanics themselves don't yet have a journey doc. See
  [`docs/journeys/README.md`](../journeys/README.md) for full documentation
  coverage.
- **Dated, point-in-time docs under `docs/journeys/*-2026-04-27.md` (and
  `onboarding-final-step-2026-04-27.md`) are historical snapshots, not
  current sources of truth** — several describe steps or layouts that have
  since been cut or superseded (e.g. the removed onboarding recipe-picker
  terminal step). The undated journey docs linked throughout this file
  (`onboarding-to-first-log.md`, `progress.md`, `what-to-eat-next.md`, etc.)
  are the current, maintained versions — prefer those.
- **The product is mid-rebrand from "Suppr" to "Sloe"**
  ([`2026-05-11-rebrand-and-entity-direction.md`](../decisions/2026-05-11-rebrand-and-entity-direction.md)).
  This repo, most internal docs, and this file itself still use the Suppr
  name; newer UI copy, design-system docs, and some public-facing surfaces
  already read "Sloe." Don't treat a "Sloe" reference elsewhere in the docs
  as an error.
- **iOS-only.** No Android bug is a real bug against a shipping target — see
  the Platforms table above.

---

## Related documents

- [Web / mobile parity & navigation scope](./web-mobile-parity-scope.md) —
  the full parity ledger; every "Parity:" note above traces back to this doc.
- [User journeys index](../journeys/README.md) — the full list of journey
  docs with their automated-test coverage.
- [Technical architecture](../technical/architecture.md)
- [API reference](../api/endpoints.md)
- [Data schema](../data/schema.md)
