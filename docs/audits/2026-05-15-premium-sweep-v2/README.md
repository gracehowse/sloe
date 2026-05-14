# Premium-bar audit sweep v2 — index

**Sweep start:** 2026-05-15
**Operating plan:** `/Users/graceturner/.claude/plans/scope-is-the-entire-replicated-shore.md`
**Predecessor retro:** `docs/decisions/2026-05-14-premium-audit-sweep-retro.md`

## Why this sweep

The 2026-05-12 sweep shipped 226 items. 4 reverted in one sitting after sim
testing. The next sweep covers every surface in the app, grounded in
captured pixels, with hard gates so the four-revert pattern can't recur.

## The four rules (non-negotiable)

1. **Subtractive-first.** Default to removing, not adding.
2. **Visual-validate per item before `[x]`.** Sim eyeballs against prior state.
3. **First-impression priority order.** P0 cold-open > P1 daily-use > P2 detail.
4. **Two-revert tripwire.** Pause the bucket; mini-retro; re-examine.

## File map

| File | Purpose |
|---|---|
| `README.md` | This file |
| `defended-choices.md` | Canonical DC1–DC15 reference. Pre-prompt to premium-auditor at every bucket run. |
| `capture-env.md` | Canonical sim state (fixture user, flag set, time-of-day, device sim) |
| `P0-proposal.md` | Cold-open surfaces (~25): landing, paywall, login, signup, all onboarding, Today first-render |
| `P1-proposal.md` | Daily-use surfaces (~55): Today logged, Plan, Cook, Recipe Detail, food search, log/edit sheets |
| `P2-proposal.md` | Detail/settings surfaces (~70): Settings, Profile, Targets, Household, Health Sync, legal pages, minor sheets |
| `P0-auditor-report.md` | premium-auditor output for P0 (S1) |
| `P1-auditor-report.md` | premium-auditor output for P1 (S4) |
| `P2-auditor-report.md` | premium-auditor output for P2 (S6) |
| `captures/{P0,P1,P2}/before/` | Pre-implementation pixel captures per bucket |
| `captures/{P0,P1,P2}/after/` | Post-implementation pixel captures per item |

## Session sequence

- **S0 (in progress):** scaffolding, DC reference, capture-env doc, empty proposal templates, light-mode Playwright spec, one-shot triage capture
- **S1:** P0 capture + audit
- **S2:** P0 proposal + Grace red-line
- **S3:** P0 per-item implementation
- **S4:** P1 capture + audit + proposal
- **S5:** P1 per-item implementation
- **S6:** P2 end-to-end

## Gates (Grace closes each)

- **G1 Capture-OK** — spot-check 5 captures look correct
- **G2 Audit-OK** — read auditor report; flag wrong comparable / missed DC
- **G3 Proposal-OK** — red-line table; every NEW row must justify what it duplicates/weakens
- **G4 Item-OK (per row)** — eyeball before/after pair
- **G5 Bucket-OK** — holistic feel check

## Closing artefacts (produced at end of sweep)

- `docs/decisions/2026-05-<end>-premium-sweep-v2-close.md`
- `docs/decisions/2026-05-<end>-premium-sweep-v2-retro.md`
- Notion Decisions log row + Linear rollup comment

## Operating notes

- Branch: S0 lands on `claude/audit-doc-sync-2026-05-14`; sweep proper cuts `claude/premium-sweep-v2`.
- Commit format per implemented item: `feat(<area>): premium-sweep-v2 item P<n>-#<row> — <subject>`. Body embeds before/after path pair.
- Feature flag every visual/structural change: `premium-sweep-v2-<bucket>-<row>`. 100% for 2 weeks before gate removal.
- `npm run ci` before every push.
