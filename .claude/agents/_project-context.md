# Sloe — Shared Agent Context

**Audience:** every agent in `.claude/agents/`. Read this file as step zero of any
review or execution.

**last-reviewed:** 2026-07-24

---

## THE PRIME RULE — read values, never restate them

This file, and every agent file, is **forbidden from stating a value that lives in
code.** Name the file; read it at runtime.

A prompt that copies the radius ladder out of the theme is wrong the moment someone
adds a token — and three agents stayed wrong for two months, with three mutually
incompatible ladders between them, before the 2026-07-24 audit caught it. A prompt
that says "read `Radius` from `apps/mobile/constants/theme.ts`" can never drift.

| You need | Read it from |
|---|---|
| Spacing / radius / type ramp / colour tokens (mobile) | `apps/mobile/constants/theme.ts` |
| Colour tokens (web) | `src/styles/theme.css` |
| Button variants | `apps/mobile/components/ui/SupprButton.tsx` |
| Nutrition confidence floors | `src/lib/nutrition/verifyConfidencePolicy.ts` |
| AI free-text logging buckets | `src/lib/nutrition/aiLogging.ts` |
| Event taxonomy | `src/lib/analytics/events.ts` |
| Mobile tab labels | `apps/mobile/app/(tabs)/_layout.tsx` |
| Landing / pricing claims | `src/lib/landing/content.ts` |
| Type roles | `docs/ux/redesign/v3/DESIGN-CONSTITUTION.md` (Rule 5) |

Enforced by `npm run check:agent-drift` — an agent file containing a hardcoded
value that also exists in `theme.ts`, or citing a path/script that doesn't
resolve, fails CI.

---

## What Sloe is

A recipe + nutrition platform shipping as **one product across web and mobile**.

- **Brand name: Sloe.** Domain **`getsloe.com`**. (Renamed 2026-06-09, commit
  `19bbff72`. Internal identifiers — package name `suppr`, `@suppr/*` scope,
  bundle `com.supprclub.supprapp`, expo slug/scheme — deliberately unchanged;
  renaming them is churn. **User-facing copy and agent output say Sloe.**)
- Web: Next.js 15 App Router. Mobile: Expo / React Native, **iOS-only** via
  TestFlight (Android config is vestigial — never flag it as a parity gap).
- Canonical onboarding at `/onboarding`; `/onboarding-v2` is a back-compat redirect.

The product is a **macro-tracker spine** with recipes, planning, and nutrition
correctness as differentiators.

---

## Strategic direction (locked 2026-04-27)

- **4 mobile tabs** — read the labels from `apps/mobile/app/(tabs)/_layout.tsx`.
  File names and testIDs intentionally differ from labels (the Progress tab keeps
  testID `tab-you` for Maestro stability) — not drift.
- **Free + Pro** only. No third tier.
- **Today is the home and the spine**; everything else branches off it.
- **"What to eat next"** is the north-star moment.
- **Single Log sheet** for all logging.
- **Macro-tracker first**, recipes/planning second.

---

## Canonical competitor set

Read `docs/competitor-set-and-mfp-exodus-2026-05-03.md` — it is the single source
of truth and explicitly says "do not restate divergently." Do not restate the set
here or in your own file.

Two facts agents kept getting wrong, both settled under ENG-1112 (2026-06-20):
- **Cal AI is not an independent competitor.** MyFitnessPal acquired it (closed
  Dec 2025); it was pulled from the App Store Apr 2026. Treat it as part of the
  MFP profile.
- The **MFP-exodus capture window** is time-boxed in that doc. Check its stated
  status before asserting the exodus is live — it is not permanent context.

Deeper offline corpus, unwired until now — use it before claiming you lack data:
`docs/competitor-intelligence-report.md`, `docs/competitor_feature_catalog_scout.md`,
`docs/competitor_feature_catalog_sentiment.md`,
`docs/research/2026-06-08-competitor-teardown-summary.md`.

---

## Trust posture — non-negotiable

- **Nutrition is always estimated.** "Estimated", "approximate" — never absolute.
- **Health claims are forbidden.** Sloe is a tool, not a clinician. Partially
  gated by `npm run check:nutrition-claims` (a banned-phrase list — it catches the
  crude cases only; judgment still required).
- **Confidence is visible.** Low-confidence matches are flagged, never silently
  filled. The mechanism is flag-and-review, not a blocking prompt — see Nutrition.
- **Pricing is region-aware.** UK/EU consumer VAT applies from £1/€1; prices
  VAT-inclusive on those surfaces.

---

## Design craft contract

Falsifiable checks, censused before any verdict. Adopted 2026-06-09 because
impressionistic reviews kept passing surfaces Grace then faulted.

**The canonical scales live in `apps/mobile/constants/theme.ts`. Read them.** Do not
restate them in a finding — cite the token name and the file.

- **Census before verdict.** A tier/quality verdict requires a value-level census
  first (file:line from code, or capture + measured px), listing every off-scale
  instance with confidence + severity. Coverage is the reviewing agent's job;
  filtering happens at aggregation, never at detection. A verdict without the
  census is invalid.
- **Verdict-grade capture walls** must include scrolled states, key sheets/modals,
  dark mode, and a populated account. Top-of-screen captures of a sparse account do
  not support a verdict.
- **Near-duplicate rule.** The same element rendered two subtly-different ways is
  always a finding: make them identical, or make them deliberately different and
  documented. "Multiple styles fighting" is the canonical Sloe failure mode.
- **Interaction-state completeness.** Every interactive element ships pressed
  (mobile, `PressableScale` with correct haptic weight) / hover + `:focus-visible` +
  active (web), plus disabled, plus loading on async commits. Silent success and
  silent failure are findings, not polish.
- **Write-time discipline.** Prevention beats review — see "UI write discipline" in
  root `CLAUDE.md`. Review sweeps catch residue; they are not the system.

**Calibration — the editorial-warm convergence.** Cream + serif + warm-accent is now
the default look of AI-generated UI. The look alone no longer reads premium. Premium
is earned in layers a template can't fake: photography, ring/data-viz craft, motion,
haptics, measured spacing rhythm. Never accept "cream + serif present, therefore
premium."

**Decisions are challengeable (Grace's standing mandate, 2026-06-10).** A documented
decision suppresses **re-filing the same settled finding** — it does not suppress a
**new, evidence-backed challenge**, including to Grace's own decisions. A challenge
must be named and evidenced, and routed to Grace as a decision item. Never silently
implement against a decision; never silently respect one the evidence now undermines.
Locked components stay locked pending her call — challenging is flagging, not
rebuilding.

---

## Review craft — how every reviewing agent reports

Defined once here; agents reference it and never redefine it.

### Severity — one ladder, product-wide

| | Meaning |
|---|---|
| **BLOCK** | Do not ship. Data loss, security exposure, legal exposure, a false nutrition number reaching a user, or a broken core flow. |
| **P0** | Ship-blocking for this change. Breaks the surface's own purpose. |
| **P1** | Costs trust or comprehension. Silent failure, an expectation mismatch a normal person hits, a parity break a user would notice. |
| **P2** | Craft debt. Off-ladder value, near-duplicate treatment, missing non-critical state. |
| **P3** | Nit. Worth recording, not worth blocking on. |

Attach **confidence** (`high` / `med` / `low`) to any finding you could not fully
verify. A `low`-confidence finding is still worth filing — say what would settle it.

### Report what is working, not only what is broken

Every review names **what to preserve** before what to fix. Two reasons, and the
second matters more:

1. Grace needs to know what not to break — a wall of failures with no signal about
   what's load-bearing is how good work gets refactored away.
2. **An agent that only reports problems will invent them.** If your honest read is
   that a surface is strong, say so and file fewer findings. Volume is not rigour.
   "Nothing above P2 here" is a valid, valuable result.

### Match the stage

Ask what stage the work is at, or infer it and say which you assumed.

- **Exploration** — judge the direction and the concept. Do not file P2 craft debt on
  a sketch; it wastes the round.
- **Refinement** — full craft rigour, censuses, states, edges.
- **Pre-ship** — BLOCK/P0 only, plus anything that costs trust. Be decisive: name the
  ship/hold call rather than handing back a list.

### Degrade gracefully

Say what you could not check and why, rather than working around it silently. If a
connector you'd use is unavailable — Linear, PostHog, a design-reference MCP, the
simulator — name it, state what it would have told you, and mark the affected
findings `low` confidence. Never present an inference as a verified result, and never
fabricate a number you could not measure.

---

## The canonical prototype

**`docs/ux/redesign/v3/Sloe-App.html` is canonical** (Grace, 2026-06-24), with type
law in `docs/ux/redesign/v3/DESIGN-CONSTITUTION.md`. Conformance runs under ENG-1247.

**The Figma is dead as a source of truth.** `docs/ux/redesign/figma-*` is historical
record only — do not file Figma-conformance work.

`docs/ux/claude-design-bundles/` is **historical**. It encodes a dark-first,
Inter-only, blue/magenta system the product has left behind. Do not audit against it.

---

## Enforcement gates — what is already automated

`npm run ci` runs these. **Before filing a finding a gate already covers, run the
gate.** A hand census that contradicts a ratchet is a bug in the census.

| Gate | Covers |
|---|---|
| `check:spacing-scale` / `check:web-spacing-scale` | off-scale spacing (mobile / web) |
| `check:token-scale` | raw hexes, `rgb()` literals, Tailwind palette classes, off-scale radius, alpha concats, web accent slash-opacity |
| `check:web-radius` | web `rounded-[Npx]` brackets |
| `check:type-scale` / `check:type-scale-mobile` | off-ramp type (web / mobile) |
| `check:pressable-feedback` | raw feedbackless `<Pressable>` |
| `check:anatomy` | container chrome declared outside owner dirs |
| `check:storybook-coverage` | missing sibling stories |
| `check:copy-voice` | copy voice discipline (no "!", no praise, no vendor) |
| `check:nutrition-claims` | absolute health/nutrition claims |
| `check:screen-budget` | files over 400 lines |
| `check:jsx-text-node`, `check:date-key`, `check:mobile-shared-imports`, `check:migrations:static`, `check:posthog-proxy`, `check:redesign-foundation-touch`, `check:today-captures` | as named |
| `check:agent-drift` | **this file and every agent file** |

Most are **only-shrink ratchets**: legacy offenders are pinned in
`scripts/*-budget.json` and may only decrease. Re-pin a legitimately-shrunk file
with the matching `:write` script.

**Not gated — these need human/agent judgment:** accessibility (no a11y gate exists;
web has `tests/e2e/utils/a11y.ts` + axe, mobile has none), legal posture beyond the
banned-phrase list, flow/naming parity, nutrition domain correctness, product
judgment.

---

## Storybook + Chromatic — non-negotiable (2026-07-22)

Every visual `.tsx` under `src/app/components/**` and `apps/mobile/components/**`
ships a sibling `*.stories.tsx` **in the same PR**. Skips require a row in
`scripts/storybook-coverage-skips.json`. Changing a component's look or states means
updating its stories in the same change. Inventory:
`docs/design/2026-07-22-storybook-coverage-matrix.md`.

---

## Cross-platform parity

**Default:** web and mobile match in feature presence, flow shape, naming,
microcopy, event names, states.

**Documented intentional divergences — do NOT flag as drift:**
- Onboarding step count (web N/13 vs mobile N/12 — mobile refresh-plan step)
- iOS-only build target (Android config vestigial)
- Stripe (web) vs IAP (mobile) rails; entitlements reconcile in `profiles.user_tier`
- Apple Health / Apple Sign-In — mobile-native; web has manual equivalents
- Today dark surface tone differs by platform (platform-native depth)
- **Apple Sign-In button colours** — black fill + white logo are Apple HIG
  brand-mandated (`apps/mobile/components/onboarding/steps/signup.tsx`,
  `apps/mobile/app/login.tsx`). Deliberate literal-hex carve-out (ENG-1013); do not
  migrate to tokens or re-file in colour censuses.

**Suppressions live here and only here.** If a finding should not be re-filed, it
belongs in this list — never as a "do NOT re-flag" clause inside an agent file. Three
such clauses went stale in place and became enforced blindness; one edit here retires
a suppression everywhere.

**Retired suppressions (these are now live findings again):** billing-period default
divergence (unified monthly, ENG-698); move-meal (ENG-699); Recipe Go Public
(ENG-700); onboarding Welcome copy (ENG-697); Discover IA (ENG-695). The calorie-ring
red carve-out is retired — over-budget is amber product-wide (ENG-1296, 2026-07-01);
**do not re-enforce red in any conformance pass.**

---

## Voice & communication

- **Plain English.** No internal jargon, flag IDs without context, or T-numbers.
- **One recommendation + one tradeoff** for exploratory questions.
- **Never offer quick/temp fixes as options.** Propose the correct fix, name its cost.
- **No diet-culture shaming, no toxic gamification.** Body-neutral, adult tone.
- **Past days = past tense; current data = present tense.**

---

## Workflow non-negotiables (from `CLAUDE.md`)

- Web ↔ mobile stay in sync at all times.
- No feature complete without implementation + tests + **Storybook stories** + docs +
  cross-platform review.
- Cap of 8 open PRs. Rebase before every push. Run `npm run ci` before push.
- Visual validation is mandatory: before/after captures on web AND mobile.
- Never apply Supabase migrations via MCP `apply_migration` for tracked files — stage
  the SQL and ask Grace to run `supabase db push --linked`.
- **Notion mirroring is discontinued (2026-06-28).** Do not mirror anything to Notion.
  Repo + Linear are canonical. Any instruction to "mirror to Notion" is void.
- **No silent deferrals.** A deferral is a fix now, a Linear issue referenced in the
  comment, or an explicit "intentionally <reason> — not a gap". Never a bare TODO.

---

## Solo-founder reality

Grace is the only TestFlight tester until she says otherwise. Scope cohort thinking
to **N=1**: don't over-engineer for users who don't exist yet, don't pitch
hypothetical Android bugs, and treat Grace's lived behaviour as ground truth over
synthetic personas.

This bounds several lenses: retention cohorts, sentiment mining, and scale-readiness
questions are mostly **not** answerable today. Say so rather than fabricating numbers.

---

## Seeing the product — you must capture, never ask

**Never ask Grace to paste or drag screenshots.** Drive it yourself and Read the PNG.

- **iOS simulator:** load the **`suppr-ios-sim-testing`** skill.
- **Web / mobile-web:** load the **`suppr-web-testing`** skill (`scripts/web-drive.mjs`;
  probes `127.0.0.1:3000`, not `localhost`).
- Mobile capture tour: `npm run test:screens:tour` — **only exists in
  `apps/mobile/package.json`**, so run it from `apps/mobile/`.
- Existing capture walls: `docs/ux/captures/`, `apps/mobile/screenshots/baseline/`,
  `apps/mobile/screenshots/agent/`.

Do not claim a visual pass from the ARIA tree or from code alone.

---

## Repo map

- `app/` — Next.js web app. Landing at `app/(landing)/`; product pages under
  `app/account`, `app/pricing`, `app/roadmap`, `app/onboarding`, `app/recipe`,
  `app/checkout`, `app/help`, `app/dmca`, `app/privacy`, `app/terms`, `app/licences`.
- `apps/mobile/` — Expo / RN. Tabs at `apps/mobile/app/(tabs)/`; stack screens at
  `apps/mobile/app/`.
- `src/` — shared web library code.
- `src/lib/nutrition/` — 100+ modules, the engine of the product.
- `src/lib/analytics/` — `events.ts` (taxonomy), `track.ts`, `serverTrack.ts`,
  `firstLog.ts`. Mobile equivalent is `apps/mobile/lib/analytics.ts` (a file).
- `src/lib/landing/content.ts` — SSOT for all landing/pricing/roadmap claims;
  pinned by `tests/unit/landingParity.test.tsx` (must not be silenced).
- `supabase/migrations/` — tracked SQL; apply via `supabase db push --linked`.
- `tests/` — web Vitest (`tests/unit/`) + Playwright e2e (`tests/e2e/`).
  Web unit config is `vitest.unit.config.ts` (`vitest.config.ts` is Storybook).
- `apps/mobile/tests/` — mobile Vitest. `apps/mobile/.maestro/` — mobile e2e.
- `docs/decisions/YYYY-MM-DD-<slug>.md` — every meaningful decision. **Check here
  first** before resolving a question; write a new file when one lands.
- Generated, never hand-edit: `src/lib/supabase/database.types.ts` +
  `apps/mobile/lib/database.types.ts` (`npm run db:types`).

**Tech:** Next.js 15 / TypeScript strict / Tailwind / shadcn-style primitives;
Expo + expo-router + lucide-react-native + RevenueCat; Supabase (Postgres, Auth, RLS,
Edge Functions); Vitest + Playwright + Maestro; Vercel + TestFlight; Sentry
(`instrumentation-client.ts`, `sentry.edge.config.ts`, `sentry.server.config.ts`);
PostHog (project "Sloe", id 389168 — a PostHog MCP is connected and queryable).

**Integrations:** Supabase, Stripe (web billing), RevenueCat (iOS billing),
FatSecret + OpenFoodFacts + USDA (food data), Sentry, PostHog, Resend (email),
App Store Connect (TestFlight feedback). For each, enforce: webhook signature
verification, idempotency on billing/nutrition writes, bounded retries with jitter,
response schema validation, graceful degradation on critical paths.

---

## Linear

Linear is the canonical task list. Full workflow: `docs/planning/linear-agent-workflow.md`.

- **Claude directs and reviews; Cursor + Codex implement and QA.** QA findings triage
  through Claude — never Cursor↔Codex directly.
- **assignee** = accountable human (Grace). **delegate** = Cursor or Codex only.
  **Claude is labels-only (`agent/claude`) and is never a delegate.**
- Branch `agent/<agent>/<linear-id>-short-name`. PR open → move ticket to **In Review**.
- Closing issues or moving state may require a project **state** update
  (`save_project`) and **status update posts** (`save_status_update`). Don't post
  empty updates.
- Initiative/project inventory lives in `CLAUDE.md` — read it there, don't restate it.

---

## How agents use this file

- Read it at the start of any review or execution touching product surfaces, copy,
  design, parity, pricing, nutrition, or competitor framing.
- **When a fact here is wrong, edit this file** rather than drifting in your own
  output — and never copy a fact from here into your own agent file. Duplication is
  how the 2026-07-24 audit found eleven contradictions.
- When your work generates a project-wide rule or suppression, add it here.
