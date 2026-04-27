# Decision log: keep the `app/` vs `src/app/` split, document the convention (P2-21, 2026-04-25)

**Date:** 2026-04-25
**Status:** Resolved — keep the split, document the convention
**Trigger:** P2-21 in [Opus 4.7 codebase review](./2026-04-25-opus47-codebase-review.md). Audit §4.1 flagged the dual-tree as "accidental complexity" and recommended either consolidation OR explicit documentation with a CONTRIBUTING.md rule.

---

## Decision

**Keep the split. Document the convention in CONTRIBUTING.md.**

Three options were on the table:

1. **Consolidate everything under `app/`** — move `src/lib/`, `src/types/`, `src/context/`, `src/app/components/` into `app/lib/`, `app/types/`, etc. Update `tsconfig.json` paths. Update every `@/*` import.
2. **Consolidate everything under `src/`** — move `app/page.tsx`, `app/api/`, etc., to `src/app/`. Update Next.js config.
3. **Document the convention** — leave the file tree alone; add a "Web app structure" section to `CONTRIBUTING.md` so the maintainer model is explicit.

We chose **#3**.

## Rationale

The audit's concern was real: a developer landing on the codebase fresh sees two trees and assumes one is half-finished. Documentation is the cheapest possible fix that addresses the actual concern (cognitive overhead) without paying for either consolidation option.

Why not consolidate now:
- **Touch surface.** Either #1 or #2 would update every import in the project. The diff would be ~hundreds of files. Pre-launch is the wrong time for a tree-wide path rewrite.
- **No correctness benefit.** The split doesn't cause a single bug today. Routes are routes; components are components; the build pipeline doesn't care.
- **Mobile imports.** `apps/mobile/lib/*` imports from `../../../src/lib/*` via relative paths. Consolidation would change those paths too — another pile of touched files.
- **Conventions over rewrites.** Established projects routinely have idiosyncratic structures (Next.js itself shipped two different conventional layouts in its history). Documenting the local convention is normal; rewriting the tree to match an external aesthetic is the rare case.

What documentation does NOT solve: a future maintainer who genuinely doesn't read `CONTRIBUTING.md` will still wonder. That's a tractable problem (the README links to CONTRIBUTING; PR review catches conventions violations); it's not solvable by file-tree manipulation in any case.

## Alternatives considered

- **Option #1 (consolidate under `app/`).** Rejected per above. Net cost > net benefit.
- **Option #2 (consolidate under `src/`).** Rejected for the same reason; also Next.js documentation conventions favour `app/` at the root.
- **Add an ESLint rule that enforces "no components under `app/`" and "no routes under `src/app/`".** Considered. Out of scope for this iteration (writing a custom rule + integrating with the existing flat config is its own diff). The convention is enforced at PR review until / unless a violation pattern emerges.

## Implementation

- `CONTRIBUTING.md` — new "Web app structure: `app/` vs `src/app/`" section with the four-bucket model (routes / components / shared logic / shared types), explicit "when you add a new file" guide, and "never" list.
- `docs/decisions/2026-04-25-app-src-app-split.md` — this doc.

No code changes.

## Platforms affected

- **Web / Mobile / Supabase:** none.
- **Developer onboarding:** clearer mental model. The "two trees" question is now a documented decision, not a confusing accident.

## Verification

- CONTRIBUTING.md still parses as valid Markdown (manual scan).
- Cross-reference from the audit's §4.1 entry: confirmed the doc + this decision close the loop.

## Related artefacts

- [Opus 4.7 codebase review §4.1](../audits/2026-04-25-opus47-codebase-review.md#41-the-app-vs-srcapp-split)
- [`CONTRIBUTING.md`](../../CONTRIBUTING.md) — Web app structure section

## Revisit when

- A second non-Grace developer joins long-term — confirm the documented convention reads cleanly to them; iterate the language if it doesn't.
- The Next.js team deprecates the App Router or recommends a new conventional layout. Re-evaluate.
- A genuinely simpler tree shape becomes available with negligible touch surface (e.g. a codemod tool ships that updates all imports cleanly). At that point #1 or #2 is on the table.
