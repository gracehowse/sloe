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
- **4 tabs** in mobile (Today / Plan / Recipes / More — Profile collapsed into More)
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

## Cross-platform parity rules

**Default:** web and mobile must match in feature presence, flow shape, naming, microcopy, event names, states.

**Documented intentional divergences (do NOT flag as drift):**
- **Pricing default billing period** — web `/pricing` defaults monthly (cold-traffic anchor); mobile paywall defaults annual (trial SKU + paywall conversion surface). Both surfaces show both options.
- **Move-meal** — `MoveMealSheet.tsx` exists on mobile only. Web `/planner` has no equivalent. Deferred, not drift.
- **Recipe Go Public** — `GoPublicDialog` exists on web only. Mobile is import-only by design.
- **Onboarding Welcome copy** — web "Join the Suppr Club" vs mobile prototype copy. Carve-out logged 2026-04-21.

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

## How agents should reference this file

- Read this file at the start of any review or execution that touches user-visible product surfaces, copy, design, parity, pricing, or competitor framing.
- When a fact here is wrong or outdated, **edit this file** rather than drifting silently in your own output.
- When your specialist work generates a project-wide rule (e.g. a new intentional divergence, a new override), propose adding it here.
