---
name: sloe-ship-check
description: Pre-ship gate for Sloe — runs the real CI ratchets, checks parity, tests, stories and docs, routes the risk-specific sign-off lenses, and returns a decisive ship / hold / conditional call. Use before opening a PR, merging, or cutting a TestFlight build.
---

# /sloe-ship-check

The last look before something ships. Answers one question decisively: **is this
ready, and if not, what exactly is stopping it?**

This replaces the old `release-gate` agent, deliberately. That agent carried a
hand-maintained checklist which rotted — by the time it was audited it was **blocking
releases on a Notion mirror that had been discontinued a month earlier**. A checklist
belongs in a workflow that reads the *live* gates every time it runs, not in a prompt
that remembers what the gates used to be.

## Usage

```
/sloe-ship-check [scope]
```

Examples: `/sloe-ship-check` (current branch vs main), `/sloe-ship-check the share
links feature`, `/sloe-ship-check before TestFlight`.

## What I need from you

- **Scope** — a branch, a PR, a feature, or "everything on this branch". Defaults to
  the current branch diffed against `origin/main`.
- **Destination** — PR, merge to main, or TestFlight build. The bar differs.
- **Known exceptions** *(optional)* — anything you've already decided to ship with.

## How this runs

**1. Establish what actually changed.** Don't trust the description.

```bash
git fetch origin main && git diff --stat origin/main...HEAD && git status --porcelain
```

Classify the diff: web surfaces, mobile surfaces, shared logic, migrations, API
routes, copy, config. **That classification decides which lenses run** — everything
below is conditional on it, so nothing runs for the sake of running.

**2. Run the real gates.** Never assert a green run you did not observe.

```bash
npm run ci
```

If the change is single-platform, scope it first per `CLAUDE.md` (mobile-only →
`mobile:lint` + `mobile:typecheck` + `mobile:test`; web-only → `typecheck` + `lint` +
`test`), then run full `ci` once before the final push. CPU contention flakes
timing-sensitive tests — a timeout-flavoured mass failure is usually a flake, so
re-run clean before reporting it as real.

**3. Check the non-negotiables that gates don't cover.**

| Check | How |
|---|---|
| Tests updated + meaningful | Do they fail if you revert the change? Assertion-free smoke doesn't count. |
| **Storybook stories** in the same PR | `npm run check:storybook-coverage` — visual `.tsx` needs a sibling story or a skip row |
| Docs updated | Every meaningful change; decisions land in `docs/decisions/` |
| **Web ↔ mobile parity** | Dispatch `sync-enforcer` if both platforms have the surface |
| Visual validation | Before/after captures on **both** platforms — capture them via the sim/web skills, never ask Grace |
| Feature flag | Visual/structural change gated per `CLAUDE.md`? |
| No silent deferrals | Any new `TODO` / "for now" without a Linear reference is a fail |
| PR hygiene | `gh pr list --state open` — cap is 8. Rebased on `origin/main`? |

**4. Route the risk-specific lenses — only the ones the diff earns.**

| If the diff touches | Dispatch |
|---|---|
| auth, RLS, secrets, webhooks, PII, billing | `security-reviewer` |
| schema, migrations, persistence, shared state | `data-integrity` |
| ingredient matching, confidence, portions, nutrition maths | `nutrition-engine` |
| user-facing copy, pricing, consent, claims, import posture | `legal-reviewer` |
| body, identity, imagery, or any interactive control | `inclusive-design` |
| UI surfaces | `design` (CENSUS mode) |
| behaviour a user touches | `product-review` |

Run them concurrently. **Migrations never go through MCP `apply_migration`** — stage
the SQL and ask Grace to run `supabase db push --linked`.

**5. Call it.** Ship / Hold / Conditional — and commit to one. A list of concerns
with no verdict is not a gate.

## Output

```markdown
## Ship check: [scope] → [destination]

**Verdict: SHIP / HOLD / CONDITIONAL**
[One sentence. If conditional, the exact conditions.]

### What changed
[Classification of the diff — surfaces, logic, migrations. File count.]

### Gates
| Gate | Result |
|---|---|
| `npm run ci` | [observed result — never assume] |
| [any scoped runs] | [result] |

### Non-negotiables
| Check | Status | Note |
|---|---|---|
| Tests meaningful | [✓ / ✗ / n/a] | [why] |
| Storybook stories | [✓ / ✗ / n/a] | |
| Docs | [✓ / ✗ / n/a] | |
| Parity | [✓ / ✗ / n/a] | |
| Visual validation | [✓ / ✗ / n/a] | [captures taken] |
| Flag-gated | [✓ / ✗ / n/a] | |
| No silent deferrals | [✓ / ✗] | |

### Lens findings
[Only lenses the diff earned. Per finding: severity from the context file's ladder,
confidence, owner.]

### Blocking
1. [What must change before this ships, and why]

### Shipping with
[Known, accepted risk — stated plainly so it's a decision, not an oversight.]

### Not checked
[What you could not verify and why. Be explicit — an unchecked item is not a pass.]
```

## Notes

- **Report failures faithfully.** If `npm run ci` fails, say so and paste the output.
  Never describe a run you didn't complete. A gate that reports optimistically is
  worse than no gate.
- **"Not checked" is not "passed."** List every gap.
- **Be decisive at this stage.** Pre-ship is BLOCK/P0 only plus anything that costs
  trust — don't bury the call under P2 craft debt.
- Do not commit, push, or merge as part of this check unless Grace asks in the same
  conversation.
