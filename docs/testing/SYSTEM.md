# Testing system specification

**Purpose:** Define how Suppr is tested so behaviour stays **provable**, **traceable**, and **updated with the product** — without pretending that passing automation alone equals “zero risk in production.”

**Audience:** QA, engineers, release owners.

**Related:** [overview.md](./overview.md) (stack + CI), [test-plan.md](./test-plan.md) (inventory + gaps), [../qa/SCREEN_TEST_MATRIX.md](../qa/SCREEN_TEST_MATRIX.md) (screen ↔ Maestro ↔ manual cases), [../genesis/README.md](../genesis/README.md#2-task-completion-gate-non-negotiable) (documentation + testing completion gates).

---

## Task completion gate (non-negotiable)

Before completing any task that touches **product behaviour, APIs, persistence, or UI**:

1. **Identify** all **features** and code paths affected (not only the file you edited first).

2. **Update or create tests** for the change — at least where it matters for regressions:
   - **User flows** — Maestro (`apps/mobile/.maestro/`), Playwright (`tests/e2e/`), or manual `TC-…` rows in [SCREEN_TEST_MATRIX.md](../qa/SCREEN_TEST_MATRIX.md) with a named owner for release.
   - **UI interactions** — component tests (e.g. Vitest + RTL / RNTL) where logic is non-trivial; Maestro for cross-screen flows.
   - **APIs** — route integration tests under `tests/integration/` (or equivalent) for new/changed `app/api/**` contracts, including auth and error codes.
   - **Data changes** — tests that assert RLS-safe mutations, migrations, or client helpers when schema or policies move.
   - **Edge cases** — empty, max, boundary, and failure paths alongside the happy path.

3. **Validate** that **expected behaviour is clearly defined** (assertions, snapshot of allowed UI, or written expected results in a `TC-` case) and that **all new logic** introduced by the change is covered by at least one test or an explicitly approved manual case.

4. **If a feature has no tests** (no unit/integration/E2E and no signed-off manual case) → **the feature is incomplete**; the task is not done.

**A task is NOT complete until tests exist and are updated** for the surfaces this change affects. Prefer the **same PR** as the code when CI/runtime allows.

---

## Non-negotiable rules

1. **No feature is complete without tests** — at least one of: automated test (unit / integration / contract / E2E), Maestro flow, or an explicit **manual** case ID in the screen matrix with a release sign-off owner.
2. **Tests reflect real user behaviour** — prefer flows that mirror journeys in `docs/journeys/`; avoid asserting implementation details that users never see.
3. **Exact expectations** — every case states observable outcomes (UI copy, navigation, persisted state, API status), not “it works.”
4. **Happy + unhappy paths** — invalid input, auth failures, empty states, and network/server errors are first-class, not afterthoughts.
5. **Tests change with the product** — any PR that changes behaviour updates or adds tests **in the same PR** when feasible; Maestro YAML and `SCREEN_TEST_MATRIX` stay in sync with routes and `testID`s.
6. **Code existence ≠ correctness** — coverage is measured by **meaningful assertions**, not line hits alone.
7. **Exhaustiveness is a direction** — the matrix and inventories are **living backlogs**; “100% of every button” is a **goal** tracked via matrix + gaps, not a single-ship claim.

### Honest boundary

> “If all tests pass, the app is safe for production”

That bar is **not** met today: web E2E is a **small** Playwright set; mobile relies heavily on **Vitest + Maestro manifest checks** in CI, while **full Maestro** runs on developer machines / release pipelines; many surfaces are **manual-only** (see matrix). This document defines how to **move toward** stronger assurance without overstating current coverage.

---

## Part 1 — Understanding the system (inventory)

Use these artefacts together; none is complete alone.

| Layer | Where it lives |
|--------|----------------|
| **Screens & routes (mobile)** | `apps/mobile/app/`, [SCREEN_TEST_MATRIX.md](../qa/SCREEN_TEST_MATRIX.md), [apps/mobile/.maestro/README.md](../../apps/mobile/.maestro/README.md) |
| **Screens & routes (web)** | `app/`, `src/app/components/`, [technical/components.md](../technical/components.md) |
| **Journeys (intent)** | `docs/journeys/*.md` |
| **API contracts** | `app/api/**/route.ts`, [api/endpoints.md](../api/endpoints.md) (keep aligned) |
| **Data & RLS** | `supabase/`, [data/schema.md](../data/schema.md) |
| **Roles / tiers** | Product + schema + paywall routes; test accounts in [mobile_qa_uat_test_plan.md](../mobile_qa_uat_test_plan.md) |
| **Automated unit / integration (web)** | `tests/unit/`, `tests/integration/` — inventory in [test-plan.md](./test-plan.md) |
| **Automated unit (mobile)** | `apps/mobile/tests/unit/` |
| **Device E2E (mobile)** | `apps/mobile/.maestro/*.yaml`, `config.yaml` suite list |
| **Browser E2E (web)** | `tests/e2e/*.spec.ts` |

When adding a surface: **update the matrix** (or test-plan) in the same change as code.

---

## Part 2 — Human-style test case template

Use this for **manual** cases, **Maestro** planning, and **ticket reproduction**. For automated tests, map the same fields into `describe` / `it` names and comments.

### Test case

| Field | Description |
|--------|-------------|
| **Test ID** | Stable id, e.g. `TC-TODAY-03` (see matrix convention) |
| **Area** | Module or screen (`Today`, `Paywall`, `Health sync`, …) |
| **Priority** | `P0` release blocker / `P1` core loop / `P2` secondary / `P3` edge |
| **User type / role** | e.g. signed-out, Free, Base, Pro, household member |
| **Preconditions** | Account state, data seeded, feature flags, OS (simulator vs device) |

#### Steps (human style)

Numbered, present tense, one user action per line — e.g.

1. I open the Today tab.
2. I tap “Quick add”.
3. I choose the Usual meals tab.

#### Expected results

Bullet list of **observable** outcomes — e.g.

- I see the usual-meal list (or empty state copy).
- Tapping a row logs items into the active slot.
- Totals update without a full app restart.

#### Edge cases (call out explicitly)

- Empty inputs, max lengths, timezone boundaries, first-run vs returning user.

#### Failure conditions

What **must not** happen (crashes, silent data loss, wrong tier access, PII leak).

---

## Part 3 — Scenario classes (every important flow)

For each **feature-level** flow, maintain coverage across:

| Class | Examples |
|--------|-----------|
| **Happy path** | Default inputs, successful save, successful API 200 |
| **Edge cases** | Empty lists, boundary dates, max servings, duplicate names |
| **Negative cases** | Invalid forms, wrong password, quota exceeded |
| **Error handling** | 4xx/5xx, timeout, offline (where applicable) |
| **State transitions** | Logged out → logged in; Free → paywall; fast start → stop |

Encode what you can in **Vitest** (pure logic, clients with mocks), **Playwright** (web critical path), **Maestro** (mobile UI). Record the rest as **manual TC-** rows in the matrix.

---

## Part 4 — Click-by-click coverage

**Goal:** For each primary control (button, link, sheet primary action, destructive confirm), there is either:

- a **Maestro** assertion or flow step, or  
- a **manual** `TC-…` row with preconditions and expected UI, or  
- a **unit/integration** test if the “click” is thin glue around a pure function.

If behaviour is **ambiguous** (copy vs product intent), **flag in the matrix** or open a decision doc — do not invent expectations in tests alone.

---

## Part 5 — Role and permission testing

For **each role** (anonymous, authenticated Free/Base/Pro, household member vs owner):

| Check | Method |
|--------|--------|
| Visible UI | Maestro / Playwright / manual |
| Allowed actions | API integration tests with session + RLS; mobile/web UI gates |
| **Bypass attempts** | Direct `fetch` / Supabase client with wrong `user_id`, deep links to gated routes, tier-gated API without token |

Document findings in [security/auth.md](../security/auth.md) when routes or RLS change.

---

## Part 6 — Database validation

For mutations that must be **atomic** or **RLS-safe**:

- Prefer **integration tests** with a mocked or test Supabase client (see patterns in `tests/` and `apps/mobile/tests/`).
- For migrations: follow [supabase-rls-checklist.md](../supabase-rls-checklist.md) and extend **schema** docs when columns/policies ship.

Assertions should cover: **correct row shape**, **no orphan children**, **idempotent retries** where product requires them.

---

## Part 7 — API testing

Per route (see [api/endpoints.md](../api/endpoints.md)):

| Must test | Notes |
|-----------|--------|
| Valid body / query | Golden JSON shapes |
| Malformed input | 400 / 422 as designed |
| **Unauthorised** | Missing or wrong Bearer; wrong cron secret for server routes |
| Wrong state | e.g. tier gate on voice-log |

Implementation: **route integration tests** under `tests/integration/` + security table in `security/auth.md`.

---

## Part 8 — Regression protection (always-on)

These flows **must** stay green in CI or release checklist:

| Flow | Current primary defence |
|------|-------------------------|
| Auth + public shell (web) | Playwright `auth-and-public`, `authenticated-views` |
| Core nutrition / planning logic | Large Vitest corpus under `tests/unit/` |
| Mobile compile + unit + Maestro manifest | CI `mobile` job: lint, tsc, unit tests, `test:e2e:verify-suite` |
| Tier / paywall critical paths | Mix of unit + Maestro (`08_voice_log`, `19_paywall` manual) |
| Onboarding | Often **manual** / long Maestro — run before major release |

When a production incident occurs, add a **regression test** (automated or `TC-` + Maestro) before closing the incident.

---

## Part 9 — Test execution tiers

| Tier | Intent | Suppr today |
|------|--------|----------------|
| **Smoke** | “Build is not broken” | Root `npm test` + mobile `npm test`; CI runs these |
| **Critical path** | Must pass before merge / release | CI web + mobile jobs; Maestro `config.yaml` suite on demand |
| **Full regression** | Broad coverage | Full Maestro suite locally + full Vitest + Playwright; manual matrix pass for release candidate |
| **Exploratory** | Break creatively | Time-boxed; log bugs with `TC-` references; feed new automated cases. Optional chaos / ad-hoc playbook lives next to E2E docs in [`tests/e2e/EXPLORATORY_QA.md`](../../tests/e2e/EXPLORATORY_QA.md) when you formalize a session — not an automated gate. |

**Commands (reference):**

- Web: `npm test`, `npm run test:e2e`, `npm run typecheck`
- Mobile belt: `npm run mobile:verify` (from repo root), `npm run mobile:test:e2e` (full Maestro — needs simulator + Metro)

---

## Part 10 — Change detection

When code changes:

1. **Identify** affected screens, APIs, and roles (use Part 1 table).
2. **Update** Vitest / Playwright / Maestro / manual matrix rows.
3. **Add** tests for new branches or states.
4. **Remove** obsolete steps (renamed buttons, removed routes).

Same PR as the feature when possible — matches Genesis §2 and the [task completion gate](#task-completion-gate-non-negotiable) above.

---

## Part 11 — Machine-readable test metadata (optional)

For tickets and YAML headers:

```text
ID: TC-PLANNER-02
Area: Meal planner
Priority: P1
Automation: apps/mobile/.maestro/03_meal_plan.yaml (partial)
```

---

## Part 12 — Validation checklist (release / major PR)

- [ ] Every **changed** journey has a matching **test or TC row** update.
- [ ] **SCREEN_TEST_MATRIX** Maestro column matches `config.yaml` and real routes.
- [ ] **API** changes have integration or contract coverage **or** explicit “manual only” with owner.
- [ ] **Tier / auth** changes have negative tests (wrong user, missing session).
- [ ] No **false confidence**: document known gaps in [test-plan.md](./test-plan.md) § gaps until closed.

---

## Related documents

- [Testing overview](./overview.md)
- [Test plan / inventory](./test-plan.md)
- [Screen ↔ Maestro matrix](../qa/SCREEN_TEST_MATRIX.md)
- [Mobile QA UAT plan](../mobile_qa_uat_test_plan.md)
- [E2E README](../../tests/e2e/README.md) (web)
- [Maestro README](../../apps/mobile/.maestro/README.md) (mobile)
