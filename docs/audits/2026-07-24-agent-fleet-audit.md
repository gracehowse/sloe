# Agent fleet audit — 2026-07-24

**Scope:** all 37 files in `.claude/agents/` (9,384 lines), judged as Claude Code
subagent prompts rather than as product docs.

**Method:** five independent read-only reviewers over four clusters (design,
engineering, product/market, governance) plus a mechanical drift sweep. Every claim
below was verified against the codebase at `f504539f`.

**Verdict:** **every one of the 37 agents carried at least one false assertion about
this codebase.** None was clean. Roster cut to 10; a drift ratchet added so the
failure mode cannot recur silently.

---

## Root cause

Agent prompts were the only artifacts in this repo not covered by a ratchet.

Every other surface — spacing, tokens, type, radius, pressable feedback, Storybook,
copy voice, nutrition claims, screen budget — has an only-shrink gate that reads
truth from source at runtime. `check:token-scale` reads the legal scale out of
`theme.ts`, so it cannot drift. The agent prompts *transcribed* the same truth into
prose, so they always would.

The result was a **decision cache with no invalidation.** Each ratified decision got
copy-pasted into N prompts; when the decision changed, the code moved and the prompts
didn't. The roster was last meaningfully edited 2026-05-31; 24 of 36 files hadn't
been touched since 2026-05-09/10.

---

## Verified contradictions

| # | Prompt asserted | Reality |
|---|---|---|
| 1 | reject nutrition matches `< 0.70` | `MIN_ACCEPT_CONFIDENCE` in `verifyConfidencePolicy.ts`; its header records 0.70 as **proposed and rejected** — it over-rejects staples (salmon, canned tomatoes, brown rice, whole milk) |
| 2 | radius ladder excludes the card corner | `Radius.card` exists in `theme.ts` (ENG-1497) — flagged every card in the app |
| 3 | three *mutually incompatible* radius ladders across three agents | none matched `theme.ts` |
| 4 | spacing ladder omits the dense step | `Spacing.dense` (ENG-1012) — flagged every legal dense row |
| 5 | page-ground cards = soft lift | flat + hairline; superseded **six times** since (`2026-07-10-card-grammar-rounder-flat.md`) |
| 6 | "Secondary → outline" | `SupprButton.tsx` ships `"primary" \| "ghost"` — outline deleted 2026-06-12 |
| 7 | dark-first, `#0a0a0f` | `theme.ts` is light-first Warm Oat, changed 2026-07-24 |
| 8 | mobile tabs end in "More" | `_layout.tsx` renders "Progress" |
| 9 | over-budget calorie ring = red | amber product-wide (ENG-1296) — the retirement was *because* red reads as diet-culture guilt |
| 10 | billing period intentionally diverges — "do NOT re-flag" | unified to monthly (ENG-698). A **gag order on a retired decision** |
| 11 | `meal_logged`, `subscription_started`, `landing_viewed`, `signup_completed`, `plan_built`, `paywall_plan_selected` | none exist in `events.ts`; real names differ. `first_log` is a user property, not an event |
| 12 | Cal AI is an independent competitor | acquired by MyFitnessPal (closed Dec 2025), App-Store-pulled Apr 2026 (ENG-1112) |
| 13 | "mirror to Notion in the same turn" | discontinued 2026-06-28. `release-gate` **blocked shipping** on it |
| 14 | product is "Suppr" at `suppr.app` | product is **Sloe** at **`getsloe.com`** — 121 dead-brand sites |

---

## Structural defects

- **37 dead absolute paths.** Every agent's mandatory STEP ZERO pointed at
  `/Users/graceturner/Suppr-1/…`, a machine that doesn't exist. The shared context
  file had never once been read since the repo move. Every "so agents stop
  rediscovering context" guarantee was void.
- **The routing graph was decorative.** No agent holds the `Agent` tool, so every
  `Routes to` / `Receives from` block — and both orchestrators entirely — was
  non-executable prose. `product-lead` instructed itself to "record it in
  `product-memory`" while holding read-only tools.
- **Tool grants contradicted mandates.** The ground-truth auditor had to classify
  features as *Broken* ("wired but produces wrong behaviour") with no `Bash`. Four of
  six design agents were told to fetch web references with no `WebFetch`. The
  competitor agent was told to research the market with no web access at all — and no
  pointer to the 3,600+ lines of competitor research already in `docs/`.
- **`premium-auditor` instructed itself to ask Grace for screenshots**, which root
  `CLAUDE.md` forbids twice.
- **13 of 19 CI ratchets were invisible to all 37 agents.** `check:copy-voice` and
  `check:nutrition-claims` — deterministic gates for two agents' entire jobs — were
  referenced by none. Storybook/Chromatic, a non-negotiable since 2026-07-22,
  appeared nowhere.
- **~15 cited authorities don't exist** (`feedback_conformity_trap`,
  `feedback_root_cause_class_of_bug`, `project_ios_only_no_android`, …). Invented
  citation weight.
- **49% of the corpus was scaffold** (4,414 of 9,384 lines): `OUTPUT FORMAT`,
  `HANDOFFS`, `RULES`, `ANTI-PATTERNS`, `FINAL CHECK` and friends, largely restating
  each other. The maintenance cost proved itself — one path change needed 37 edits,
  so it never happened.
- **~2,820 tokens of agent descriptions** loaded into every parent context on every
  turn, 22% of it in three files.

---

## What changed

**Roster: 37 → 10.** `product-review` (merge of repo-auditor + product-lead +
customer-lens), `design` (merge of ui-critic + ui-product-designer + design-director
+ visual-qa), `nutrition-engine`, `legal-reviewer`, `inclusive-design` (rebuilt from
diversity-inclusion), `data-integrity`, `security-reviewer`, `sync-enforcer`,
`executor`, `planner`.

**Judged calls worth recording:**
- `data-integrity` and `security-reviewer` stay **separate** despite sharing files.
  Different threat models — entropy vs adversary — and both are required sign-offs
  with high blast radius. Consolidation should delete redundancy, not merge the two
  highest-stakes lenses.
- `legal-reviewer` is **not** captured by tooling. `check:nutrition-claims` is a
  banned-phrase list covering the crudest health claims only. Privacy, consent,
  billing disclosure, VAT, DMCA, data rights and import/copyright posture are wholly
  ungated — and ENG-1599 is an open launch-blocker in exactly that last area.
- `diversity-inclusion` was **rebuilt, not deleted**. Its concerns are real and
  ungated; its file was 319 lines naming zero repo files, with a failure mode
  ("request the rendered surface") its tool grant made unsatisfiable. Accessibility
  is the single largest uncovered risk in the roster: no a11y gate exists, web has
  unused axe tooling in `tests/e2e/utils/a11y.ts`, mobile has none.
- The lenses assuming a user base (`user-sentiment`, `feature-scout`,
  `growth-strategist`, `analytics-engineer`, `production-readiness`,
  `competitor-intelligence`) were cut against the documented **N=1** reality. They
  ask questions this product cannot yet answer, and answered them anyway.

**New gate: `npm run check:agent-drift`** (`scripts/check-agent-drift.mjs`, in
`npm run ci`). Four detectors, chosen to be precise rather than broad — a noisy gate
on prose gets muted, and a muted gate is how this happened:

1. absolute paths → fail
2. repo paths and `npm run` scripts that don't resolve → fail
3. a numeric list of 3+ values on a line naming a design scale → fail (the
   transcription detector — this is the one that kills the bug class)
4. missing or >90-day-old `last-reviewed:` frontmatter → fail

On the pre-consolidation corpus it reported **100 findings across 37 files**,
independently reproducing the five-reviewer audit in under a second.

---

## Round 2 — craft parity with the Anthropic plugin skills

Benchmarked the consolidated roster against `/design:design-critique` (the shipped
Anthropic design plugin skill). Four craft gaps were real:

| Gap | Before | Fix |
|---|---|---|
| No user-invocable entry point | 10 agents, **0 typeable** — agents are model-dispatched | Two skills in `.claude/skills/` |
| No input contract | **0 of 10** had one | `## WHAT I NEED FROM YOU` in all 10 |
| Output described, not templated | prose descriptions | literal fenced ```markdown skeletons with `[placeholders]` |
| Purely adversarial | **1 of 10** mentioned strengths | a "what's working / don't undo" section in all 10 |

The third and fourth matter beyond consistency: a skeleton produces far more uniform
output than a description, and **an agent that only reports problems will invent
them** — "nothing above P2 here" is now an explicitly valid result.

**New skills.** `/sloe-design-critique <surface>` runs the design ratchets, captures
real pixels, dispatches `design` + `inclusive-design`. `/sloe-ship-check [scope]` is
where the deleted `release-gate` agent went — deliberately, as a workflow rather than
a prompt, because its checklist rotted into blocking releases on the discontinued
Notion mirror. A workflow re-reads the live gates every run; a prompt remembers what
they used to be.

**Review craft is defined once** in `_project-context.md` — one severity ladder
(BLOCK/P0–P3 + confidence), report-what-works, stage matching (exploration /
refinement / pre-ship), graceful degradation. Agents reference it. `inclusive-design`'s
own 20-line local ladder was deleted in favour of it — the same DRY discipline as the
PRIME RULE, applied to review method instead of token values.

**The gate now covers skills too**, and has tests. Staleness stays agents-only (they
are model-dispatched and rot unseen; skills are user-invoked, so a human notices);
every other detector applies to both. `scanText()` was extracted as a pure detector
with injected `pathExists`, matching the convention in
`tests/unit/checkPressableFeedback.test.ts`. **19 tests** in
`tests/unit/checkAgentDrift.test.ts` cover each detector plus its false-positive
cases. A fifth detector — dead agent references — was added after two subagents
writing this very roster each shipped a draft routing to a deleted agent.

**Final shape:** 10 agents (169–306 lines), 4 skills, 1 shared context. Agent
descriptions total ~445 tokens per turn, down from ~2,820.

## Open items

- The old agents are deleted, not archived. Git history holds them; restoring one is
  discouraged — write it fresh against the current codebase instead.
- No Linear issue was filed for this work; it was a direct request. If the roster
  needs further tuning, that belongs under **Platform foundations → Operations**.
