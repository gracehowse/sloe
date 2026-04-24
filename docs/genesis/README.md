# Genesis — documentation system specification

**Purpose:** Define how Suppr documentation scales into a company-wide knowledge base (“Genesis”) while staying **accurate**, **navigable**, and **audience-aware**. This file is the **spec**; the **body of knowledge** already lives under `docs/` (see [INDEX.md](./INDEX.md)).

**Audience:** Product, engineering, design, QA, operations — anyone who writes or consumes internal docs.

---

## 1. Documentation structure (canonical tree)

Genesis does **not** introduce a parallel wiki. It **names and governs** the existing layout:

| Genesis layer | Repo location |
|----------------|---------------|
| Product | `docs/product/`, `docs/product-roadmap.md`, `docs/competitive-principles.md` |
| User | `docs/user/` |
| User journeys | `docs/journeys/` |
| Technical | `docs/technical/` |
| API | `docs/api/` |
| Data & schema | `docs/data/` |
| UX / UI | `docs/ux/` |
| Testing | `docs/testing/`, `docs/mobile_qa_uat_test_plan.md`, `docs/qa/` |
| Security | `docs/security/` |
| Operations / internal | `docs/operations/`, `docs/deployment/`, `docs/planning/` |
| Decisions (non-negotiable “why”) | `docs/decisions/` |
| Integrations | `docs/integrations/` |

**Rule:** New topical docs **slot into an existing folder** unless a *new* top-level area is agreed (then update this README + [DOCUMENTATION_HUB.md](../DOCUMENTATION_HUB.md) + [docs/README.md](../README.md)).

---

## 2. Task completion gate (non-negotiable)

Before completing any task:

1. **Identify** all documentation impacted — at minimum consider: [product/](../product/), [user/](../user/), [journeys/](../journeys/), [technical/](../technical/), [api/](../api/), [data/](../data/), [ux/](../ux/), [testing/](../testing/) and [qa/](../qa/), [security/](../security/), [operations/](../operations/), [decisions/](../decisions/), plus [DOCUMENTATION_HUB.md](../DOCUMENTATION_HUB.md) for user-visible or contract-changing ships.

2. **Update** each affected surface: product behaviour, technical architecture and components, user how-tos, journeys (entry → action → result), API contracts, data models and analytics catalog, and testing documentation (plans, coverage notes, Maestro or CI intent where this repo records them).

3. **Create** documentation when none exists for that concern; add discoverability via [INDEX.md](./INDEX.md), [docs/README.md](../README.md), or the hub.

4. **Validate:** remove outdated information; confirm flows and contracts match the implementation (routes, guards, copy, payloads).

5. **Testing (when behaviour or contracts change):** Identify all **features** and code paths affected. Update or create tests for user flows, UI interactions, APIs, data changes, and edge cases — see [Testing system — task completion gate](../testing/SYSTEM.md#task-completion-gate-non-negotiable). Validate that expected behaviour is explicit in tests or `TC-` cases and that **new logic is covered**.

6. **Incomplete without tests:** A **feature** is not complete if it ships with no automated test, Maestro flow, or signed-off manual case (per [testing/SYSTEM.md](../testing/SYSTEM.md)).

**A task is not complete until documentation is updated** (steps 1–4). **Behaviour- or contract-changing work is not complete until the testing gate is satisfied** (steps 5–6). Prefer the **same PR** for code, docs, and tests whenever practical.

---

## 3. Initial corpus vs “generate everything”

**Reality:** A single automated pass cannot truthfully document the whole monorepo without drift.

**Genesis approach:**

1. **Treat as already started** — `docs/technical/components.md`, `docs/api/endpoints.md`, `docs/data/schema.md`, and journey files are the authoritative technical surfaces.
2. **Backfill by domain** when a feature ships: touch the **smallest set** of files (usually journey + schema and/or API + hub row).
3. **Never** duplicate tables from `schema.md` in product copy — **link**.

---

## 4. Linking & naming

- **Link, don’t repeat** — one canonical table (e.g. analytics events) lives in `docs/data/schema.md`; elsewhere say “see schema §…”.
- **Stable headings** — use sentence case H2/H3 so deep links and search stay predictable.
- **File names** — `kebab-case.md`; prefer `topic-area.md` over `notes2.md`.
- **Cross-refs** — relative links from `docs/` (`../data/schema.md`).

---

## 5. Change detection & “automatic” updates

**Non-negotiable intent:** docs update **with** the code change in the **same PR** when behaviour changes.

**Achievable today (human + process):**

- PR / ship checklist: “Which `docs/` paths did this touch?” (See §2.)
- Use the **docs-keeper** / executor agent pattern from Cursor skills for large sweeps.
- **DOCUMENTATION_HUB** “Recently shipped” row for material releases (existing practice).

**Not claimed without tooling:**

- Fully automated inference of “this diff ⇒ these doc paragraphs” (would need custom CI + AST/indexing). Genesis **reserves** that for a future phase; until then, **enforcement is reviewer + checklist**.

---

## 6. Quality bar (every doc)

Each substantive doc should have, in order:

1. **Title + one-line purpose**
2. **Audience** badge: `(User)` | `(Developer)` | `(Internal)`
3. **Scope** — what is in / out
4. **Body** — structured sections; **WHY** where non-obvious
5. **Examples** — request/response, screenshot description, or flow when it reduces ambiguity
6. **Edge cases / limits** — especially nutrition, health sync, billing
7. **Related documents** — 2–5 links

---

## 7. Validation (before merge)

After §2 steps 4–6, author / reviewer also asks:

- [ ] **Missing?** New surface documented in journey or component index?
- [ ] **Outdated?** Removed code / routes scrubbed from API + endpoints?
- [ ] **Duplicated?** Consolidated into one canonical section?
- [ ] **Consistent?** Same terms as `schema.md` / `events.ts` / UI copy?
- [ ] **Tests?** For behaviour/API/UI changes: [testing gate](../testing/SYSTEM.md#task-completion-gate-non-negotiable) satisfied (new or updated tests, or approved manual `TC-`)?

---

## 8. Continuous operation

- **Same PR as code** for behaviour changes — no “docs ticket later”.
- **Hub row** for user-visible ship (maintain [DOCUMENTATION_HUB.md](../DOCUMENTATION_HUB.md)).
- **Decisions** — if the change reverses or constrains product behaviour, add or update `docs/decisions/…`.

---

## 9. Relation to other “sources of truth”

| Artifact | Role |
|----------|------|
| [`DOCUMENTATION_HUB.md`](../DOCUMENTATION_HUB.md) | Product hub + ship log + doc rules summary |
| [`docs/README.md`](../README.md) | Human-friendly index into `docs/` |
| [`src/lib/landing/content.ts`](../../src/lib/landing/content.ts) | Public marketing SSOT (pricing, roadmap buckets) — must match code + tests |
| Code + tests | Ground truth for behaviour |
| `docs/decisions/` | Ground truth for **intent** and trade-offs |

---

## Related documents

- [INDEX.md](./INDEX.md) — quick map of folders to audiences
- [DOCUMENTATION_HUB.md](../DOCUMENTATION_HUB.md)
- [docs/README.md](../README.md)
- [Testing system specification](../testing/SYSTEM.md)
- [Product roadmap (phased)](../product-roadmap.md)
