# Suppr — Shared Project Context

**Audience:** every specialist agent in `.claude/agents/`. Read this file as step zero of any review or execution. It exists so agents stop rediscovering the same hard-won context per turn.

**Status:** living document. When a fact below changes, update it in one place — never duplicate context into individual agent files.

---

## What Suppr is

A recipe + nutrition platform shipping as **one product across web and mobile**:
- Web app: `suppr.app` (authenticated product), `suppr.club` (marketing/landing where applicable)
- Mobile app: iOS-only via TestFlight (Android config is vestigial Expo template, never built)
- Single canonical onboarding lives at `/onboarding`; `/onboarding-v2` is a thin redirect kept for backwards compat (rename completed 2026-04-30)

The product is a **macro-tracker spine** with recipes, planning, and nutrition correctness as differentiators.

---

## Strategic direction (locked 2026-04-27)

17 ratified decisions; the load-bearing ones every agent must respect:
- **4 tabs** in mobile (Today / Plan / Recipes / Progress — Profile/Settings collapsed into Progress; canonical label is "Progress", testID stays `tab-you` for Maestro)
- **Free + Pro** (no third tier)
- **Canonical Today** is the home and the spine; everything else is a branch off it
- **"What to eat next"** is the north-star moment — the question the product answers better than any competitor
- **Single Log sheet** for all logging (not per-meal pop-ups)
- **Macro-tracker first**, recipes/planning second — recipes serve the macro spine, not the other way round

Detail: `project_strategic_direction_2026-04-27.md` in user memory.

---

## Canonical competitor set (use these — never substitute generics)

Eight named competitors, in three groups:

**Mass-market trackers (the exodus targets):**
- **MyFitnessPal** — mass exodus 2026-05-03 driven by feature removals + paywalling. **This is the priority capture moment.** Refugees are the highest-value cohort right now.
- **Lose It!**
- **Cronometer** (power users)
- **MacroFactor** (premium tracker tier)

**AI-image trackers (the noisy newcomers):**
- **Cal AI** — calorie-from-photo flagship; high-marketing, accuracy-questionable

**Recipe + planning side:**
- **Paprika** (paid recipe manager)
- **Recime**
- **Honeydew**

**Rule:** if your output references "tracking apps in general" without naming at least three of these by behaviour, you have failed. The canonical 8 is the answer to "who are we competing against today?"

Multi-category context (creator, discovery, monetisation patterns) still applies for `competitor-intelligence` — but the 8 above are the always-on baseline.

---

## Trust posture — non-negotiable

- **Nutrition is always estimated.** "Estimated", "based on", "approximate" — never absolute. No "this meal contains X calories." Always "estimated X kcal."
- **Health claims are forbidden.** Suppr is a tool, not a clinician. No prescriptive language ("eat this to feel better", "lose 5kg in a month").
- **Confidence is visible.** Low-confidence nutrition matches must be flagged or rejected. Never silently fill numbers.
- **Pricing is region-aware.** Currency, tax, disclosure all vary by region. Single-currency hardcoded pricing (£ today on some surfaces) is a bug vs intent.
- **UK/EU consumer VAT applies from £1/€1** regardless of Cayman entity status. Prices on UK/EU surfaces must be VAT-inclusive. Stripe Tax in inclusive mode until consumer-VAT registration resolves.

---

## Calorie ring colour mapping (overrides prototype)

The Claude Design prototype says "destructive red is for errors only — over-budget = amber." For the **calorie ring specifically**, that rule is overridden:

| State | Colour |
|---|---|
| Empty / not yet logged today | gradient (brand) |
| Logged + under budget | success green (`--success` token) |
| Logged + over budget | destructive red (`--destructive` token) |

Both mobile and web use this mapping. **Other over-budget signals (macros, sodium, etc.) still use amber** per the prototype. The carve-out is the calorie ring only.

---

## Screen file size limit

Screen-level files (`app/(tabs)/*.tsx`, `app/*.tsx` on mobile; page-level components on web) must stay under **400 lines**. When a screen file approaches this limit:

1. Extract hooks into a co-located `use<Screen>.ts` (composition root pattern — see ENG-619 for the canonical example).
2. Extract sub-sections into `components/<screen>/` with one component per file.
3. Keep the screen file as a thin composition shell: imports, layout, data wiring.

Files over 400 lines signal that state, layout, and logic are tangled. The limit is enforced by convention (no lint rule yet — see ENG-119 for the type-ladder lint precedent).

---

## Prototype carryover rules

The Claude Design bundles at `docs/ux/claude-design-bundles/{prototype,onboarding}` are the **design language reference**. Not a mandate.

- **Reference, not mandate.** Mix and match. Where live is stronger, keep live. Adopt selectively.
- **Three-bucket audit format** for any prototype-driven redesign:
  - **Keep from live** — items the live screen has that the prototype doesn't (per item: Keep or Remove, with rationale)
  - **Adopt from prototype** — items the prototype has that live doesn't (per item: Adopt as-is / Adopt with modifications / Skip, with rationale)
  - **Swap in place** — items present on both (per item: which version wins, with rationale)
- **Icons must be exact.** Use `lucide-react-native` on mobile; cross-reference the bundle before substituting an SF Symbol.
- **Tokens flip project-wide** (carryover rules — these are NOT screen-level decisions): macro colour map, over-budget = amber (except calorie ring above), sodium = orange (never destructive), background tone, sidebar 248, ring track = `var(--ring-bg)`.
- **No hardcoded Tailwind hexes** (`#ef4444`, `#f87171`, etc.) — use semantic tokens.

---

## Design craft contract (adopted 2026-06-09)

Method adopted from the logic behind the Claude Design prototypes (the system
prompt that generated `docs/ux/claude-design-bundles/` — public reconstruction:
github.com/Trystan-SA/claude-design-system-prompt). Adopted because the fleet's
impressionistic reviews repeatedly passed surfaces Grace then faulted for
spacing and consistency. Falsifiable checks, censused before any verdict,
enforced at write time as well as review time.

### Canonical scales — the only legal values

- **Spacing:** 4 / 8 / 16 / 20 / 24 / 32 / 40 (`Spacing`,
  `apps/mobile/constants/theme.ts`; same rhythm on web). An 18px padding or
  10px gap is a bug even if it "looks fine".
- **Radius:** 4 / 6 / 8 / 12 / full (`Radius` — 2026-05-22 lock; bigger reads
  "kids' tablet").
- **Type:** the `Type` ramp on mobile (programmatic gate pending ENG-1002);
  type-scale-gated classes on web (25-snap gate, green).
- **Colour:** every value traces to a semantic token (`theme.ts` /
  `src/styles/theme.css`). A literal hex in a component is a finding.
- **Elevation:** one-card treatment — page-ground = soft lift, nested = flat
  (`docs/decisions/2026-06-09-one-card-treatment-soft-elevation.md`).

### Census before verdict (review-time rule)

A review may only issue a tier/quality verdict AFTER producing value-level
censuses — spacing, colour, radius, type — listing **every** off-scale /
off-token instance (file:line from code, or capture + measured px). Report
every violation including uncertain and low-severity ones, each with
confidence + severity. **Coverage is the reviewing agent's job; filtering
happens at aggregation — never at detection.** A tier verdict without the
census attached is invalid.

Verdict-grade capture walls must include scrolled states, key sheets/modals,
dark mode, and a populated account. Top-of-screen captures of a sparse account
do not support a verdict (this exact gap produced a disputed "Premium" call on
2026-06-09).

### Near-duplicate rule (consistency)

The same element rendered two subtly-different ways — chips, pills, rows,
section headers, dividers, icon sizes, radii, card paddings — is always a
finding: **either make them identical or make them deliberately different and
documented.** "Multiple styles fighting" is the canonical Suppr failure mode;
hunt it explicitly, screen-by-screen pairs included.

### Interaction-state completeness

Every interactive element ships its full state set:

- **Mobile:** pressed (`PressableScale` with the correct `haptic` weight),
  disabled, loading on async commits (disable + progress — no double-submit).
- **Web:** hover, `:focus-visible` (never remove the ring without replacement),
  active, disabled, loading.

Silent success and silent failure after a user action are findings, not polish.

### Write-time discipline

Prevention beats review: whoever writes UI code (Claude or Cursor) follows the
scales and token rule at write time — see "UI write discipline" in root
`CLAUDE.md` and `apps/mobile/CLAUDE.md`. Review sweeps catch the residue; they
are not the system.

### Calibration note — the editorial-warm convergence

Cream + serif + warm-accent editorial is now the default look of AI-generated
UI (the Claude Design prompt itself flags the `#F4F1EA`-family + serif-display
+ terracotta combination as today's purple-gradient). Sloe keeps the direction
— committed, documented, and native to food — but the look alone no longer
reads premium. Premium is earned in the layers a template can't fake:
photography, ring/data-viz craft, motion, haptics, measured spacing rhythm.
Judge those hardest; never accept "cream + serif present, therefore premium."

---

## Cross-platform parity rules

**Default:** web and mobile must match in feature presence, flow shape, naming, microcopy, event names, states.

**Documented intentional divergences (do NOT flag as drift):**
- **Onboarding step count** — web N/13 vs mobile N/12 (mobile refresh-plan step). Intentional.
- **iOS-only build target** — Android config is vestigial; not a parity gap.
- **Calorie-ring colour map** — empty=gradient, under=success green, over=destructive red (other over-budget signals stay amber).
- **Stripe (web) vs IAP (mobile)** billing rails — entitlements reconcile in `profiles.user_tier`.
- **Apple Health / Apple Sign-In** — mobile-first/native; web has manual equivalents.
- **Today dark surface tone** — mobile `#0a0a0f` vs web `#101014` (platform-native depth).

**RETIRED 2026-05-25 (now converging to parity — no longer carve-outs):** pricing default → unify monthly (ENG-698); move-meal → web `/planner` (ENG-699); Recipe Go Public → mobile (ENG-700); onboarding Welcome copy → fresh pass (ENG-697); Discover IA → converge to web layout (ENG-695). See `docs/decisions/2026-05-25-sweep-parity-ia-pricing-resolutions.md`.

**Implication:** every meaningful UI decision Grace makes on mobile must land on the equivalent web surface in the same commit, *unless* the change is on the documented carve-out list above.

---

## Voice & communication rules

**For agent output, copy, microcopy, and chat replies:**

- **Plain English.** No internal jargon (T-numbers, "infra", "harness", flag IDs without context). Translate dense specialist output before handing it back.
- **One recommendation + one tradeoff** is the default response shape for exploratory questions.
- **Never offer quick/temp fixes as options.** Propose the long-term fix directly, name its cost, ship it.
- **Prefer most correct over quickest.** When presenting cheap-vs-correct paths, recommend the correct one explicitly.
- **No diet-culture shaming, no toxic gamification.** Body-neutral, supportive, adult tone.
- **Past days = past tense; current/live data = present tense.** "You ate 1,800 kcal yesterday" / "You're at 1,200 kcal today."

---

## Workflow non-negotiables (from `CLAUDE.md`)

- Web ↔ mobile must stay in sync at all times.
- No feature is complete without: implementation + tests + docs + cross-platform review.
- Cap of 3 open PRs in flight. Rebase before push every push. Run `npm run ci` before push.
- Visual validation is mandatory: before/after screenshots on web AND mobile attached to the PR. Verify visuals BEFORE commit + push.
- Never apply Supabase migrations via MCP `apply_migration` for tracked files. Use `supabase db push --linked`.
- Notion mirroring: when a feature ships, a decision is resolved, or roadmap state changes, mirror to Notion in the same turn.

---

## Solo-tester reality

Grace is the only TestFlight tester until she says otherwise. Scope cohort thinking to **N=1**:
- Don't over-engineer for "users" who don't exist yet.
- Don't pitch hypothetical Android bugs as real bugs (no Android target).
- Treat Grace's lived behaviour as the ground-truth signal — not synthetic personas.

---

## Repo map (Suppr-native reference for every agent)

### Top-level
- `app/` — Next.js 15 web app (App Router). Public landing under `app/(landing)/`; product pages under `app/account`, `app/pricing`, `app/roadmap`, `app/onboarding`, `app/recipe`, `app/checkout`, `app/help`, `app/dmca`, `app/privacy`, `app/licences`.
- `apps/mobile/` — Expo / React Native. Tab routes at `apps/mobile/app/(tabs)/`. Stack screens (cook, paywall, fasting, create-recipe, etc.) at `apps/mobile/app/`.
- `src/` — shared web library code (everything imported by the web app)
- `supabase/migrations/` — 113+ tracked SQL migrations (apply via `supabase db push --linked`, never via MCP `apply_migration`)
- `tests/` — web Vitest (`tests/unit/`) + Playwright e2e (`tests/e2e/`)
- `apps/mobile/__tests__/` — mobile Vitest
- `apps/mobile/.maestro/` — mobile e2e (Maestro)
- `docs/` — product, decisions, journeys, integrations, api, design, planning
- `scripts/` — CLI tooling (CI checks, e2e preflight, RevenueCat smoke, TestFlight feedback fetch, migration drift)

### Canonical web surfaces
- `app/page.tsx` + `app/(landing)/LandingPage.tsx` — public `/`
- `app/pricing/page.tsx` — public `/pricing`
- `app/roadmap/page.tsx` — public `/roadmap`
- `app/onboarding/` — canonical onboarding (rename completed 2026-04-30); `/onboarding-v2` is a thin redirect kept for backwards compat

### Canonical mobile surfaces
- `apps/mobile/app/(tabs)/index.tsx` — Today
- `apps/mobile/app/(tabs)/planner.tsx` — Plan
- `apps/mobile/app/(tabs)/library.tsx` — Recipes
- `apps/mobile/app/(tabs)/progress.tsx` — Progress (the 4th bottom tab, label "Progress"; Profile/Settings collapsed in). `more.tsx` also exists as a secondary route, not the bottom-tab label.

(User-facing tab labels per the 2026-05-19 IA: **Today / Plan / Recipes / Progress**. File names and labels intentionally differ — e.g. the Progress tab keeps testID `tab-you` for Maestro stability — don't flag this as drift.)

### Landing SSOT
- `src/lib/landing/content.ts` — single source of truth for all landing/pricing/roadmap claims. Re-exports algorithm constants (`adaptiveTdee.ts` thresholds, `FREE_SAVE_LIMIT`, etc.) so marketing copy never hardcodes numbers.
- `src/lib/landing/nutritionSources.ts` — `NUTRITION_SOURCES` declaration (mobile-importable, no `@/` aliases)
- `tests/unit/landingParity.test.tsx` — pins rendered marketing copy against the SSOT; **must not be silenced**
- `docs/product/landing-maintenance.md` — maintenance guide

### Nutrition spine
- `src/lib/nutrition/` — 100+ modules; the engine of the product. Notable:
  - `verifyIngredients.ts` — ingredient verification pipeline core
  - `adaptiveTdee.ts` — TDEE thresholds (`MIN_LOGGING_DAYS`, `MIN_WEIGH_INS`)
  - `measureToGrams.ts` — count-to-weight normalisation
  - `verifyConfidencePolicy.ts` — confidence scoring policy
  - `mealPlanAlgo.ts` — plan-tab algorithm
  - `northStarSuggestion.ts` — "what to eat next" suggestion logic
  - `recipeFitPercent.ts` — recipe fit scoring
  - `digest.ts` / `digestStory.ts` / `weeklyRecap.ts` — progress narratives
- `apps/mobile/lib/nutrition/` mirrors / re-uses these where mobile is RN-native

### Analytics
- `src/lib/analytics/events.ts` — canonical event taxonomy (web)
- `src/lib/analytics/track.ts` — client emit wrapper
- `src/lib/analytics/serverTrack.ts` — server emit wrapper
- `src/lib/analytics/firstLog.ts` — first-log activation tracking
- PostHog is the analytics backend (Project: "Default project", id 389168, org "Suppr")

### Generated types (DO NOT hand-edit)
- `src/lib/supabase/database.types.ts` — generated via `npm run db:types` and copied to `apps/mobile/lib/database.types.ts`. Both files must stay in sync; `db:types` script handles the copy.

---

## Tech stack & build

- **Web:** Next.js 15 (App Router, Turbopack dev, React Server Components), TypeScript strict, Tailwind, shadcn/ui-style primitives in `src/components/`
- **Mobile:** Expo SDK / React Native, expo-router file-based routing, lucide-react-native icons, RevenueCat SDK
- **Data:** Supabase (Postgres + Auth + RLS + Edge Functions). Project id `fnfgxsignmuepshbebrl` (production)
- **Testing:** Vitest (web + mobile), Playwright (web e2e), Maestro (mobile e2e)
- **Lint/format:** ESLint flat config (`eslint.config.mjs`), `--max-warnings 500` ratchet
- **CI:** `npm run ci` = `verify-production-env + typecheck + lint + test + build + mobile lint/typecheck/test/e2e:verify-suite`
- **Pre-push hook:** typecheck + lint + migration static check (`scripts/git-hooks/`)
- **Hosting:** Vercel (web), TestFlight (iOS)
- **Error monitoring:** Sentry (web client/edge/server: `sentry.client.config.ts` etc.)

---

## Third-party integrations (current footprint)

| Service | Use | Where |
|---|---|---|
| **Supabase** | Auth, Postgres, RLS, Edge Functions | `src/lib/supabase/`, `apps/mobile/lib/supabase.ts`, `supabase/` |
| **Stripe** | Web subscriptions | `app/checkout/`, `app/api/stripe/`, `src/lib/stripe/` |
| **RevenueCat** | iOS subscriptions (App Store billing) | `apps/mobile/lib/revenuecat/`, `scripts/test-revenuecat-replay.mjs` |
| **FatSecret** | Branded foods + autocomplete | `src/lib/nutrition/fatsecret*`, `scripts/backfill-fatsecret-premier.mjs` |
| **OpenFoodFacts** | Branded foods (ODbL — see `docs/decisions/2026-04-19-off-odbl-architecture.md`) | nutrition pipeline |
| **USDA** | Generic foods | `src/lib/nutrition/usdaNormalize.ts` |
| **Sentry** | Error monitoring | `sentry.*.config.ts` |
| **PostHog** | Product analytics | `src/lib/analytics/`, mobile equivalents |
| **Resend** | Transactional email (likely — verify before claiming) | `src/lib/email/` |
| **App Store Connect** | TestFlight feedback fetch | `scripts/fetch-testflight-feedback.mjs` |

For each integration, agents must enforce: signature verification on webhooks, idempotency on writes that affect billing or nutrition state, retries with bounded backoff + jitter, schema validation on responses, fallback or graceful degradation on critical-path integrations.

---

## Pricing posture (current)

- **Free + Pro** tier structure (locked 2026-04-27 strategic direction — no third tier)
- Pricing copy in `src/lib/landing/content.ts` (`PRICING_TIERS`)
- Web `/pricing` + mobile paywall both default **monthly** (unified 2026-05-25, ENG-698; pricing-default-divergence doc RETIRED — verify IAP trial SKU)
- Region-aware required: currency, tax, disclosure all vary
- UK/EU consumer VAT applies from £1/€1 — prices VAT-inclusive on those surfaces; Stripe Tax in inclusive mode
- Web billing → Stripe direct; mobile billing → RevenueCat / App Store
- Documented decision logs:
  - `docs/decisions/2026-04-19-pricing-v1.md`
  - `docs/decisions/2026-04-19-pricing-default-billing-period-divergence.md`
  - `docs/decisions/2026-04-19-renewal-disclosure-rewrite.md`
  - `docs/decisions/2026-04-19-shopping-list-tier-gating.md`
  - `docs/decisions/2026-04-19-voice-logging-pro-only-server-enforced.md`
  - `docs/decisions/2026-04-19-billing-architecture-pattern-a.md`

---

## Event taxonomy (canonical conventions)

- **Naming:** `snake_case`, `verb_object` (e.g. `recipe_imported`, `paywall_viewed`, `meal_logged`)
- **Same name on web and mobile.** No platform suffixes.
- Activation events live in `src/lib/analytics/firstLog.ts` (first-log moment is the activation north-star)
- Privacy class is mandatory per event (PII / non-PII / sensitive). Never put raw PII in event properties.
- Recipe import / nutrition calculation events carry `confidence_bucket`, never raw confidence floats
- See `src/lib/analytics/events.ts` for the full taxonomy

---

## Decisions log

Every meaningful product decision lives in `docs/decisions/YYYY-MM-DD-<slug>.md`. Agents resolving a question should:
- check `docs/decisions/` first to see if it's already settled
- when a new decision lands, write `docs/decisions/<today>-<slug>.md` AND mirror to Notion (per CLAUDE.md mirror rules)

---

## How agents should reference this file

- Read this file at the start of any review or execution that touches user-visible product surfaces, copy, design, parity, pricing, or competitor framing.
- When a fact here is wrong or outdated, **edit this file** rather than drifting silently in your own output.
- When your specialist work generates a project-wide rule (e.g. a new intentional divergence, a new override), propose adding it here.
