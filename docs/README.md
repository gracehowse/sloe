# Suppr Documentation

Single source of truth for the Suppr product, codebase, and operations.

### Documentation system (Genesis)

Structured rules for how this tree scales and stays accurate: [genesis/README.md](genesis/README.md). Quick folder → audience map: [genesis/INDEX.md](genesis/INDEX.md). Product hub + ship log: [DOCUMENTATION_HUB.md](DOCUMENTATION_HUB.md). **Contributors:** [../CONTRIBUTING.md](../CONTRIBUTING.md) (lint, migrations, types, worklists).

## Documentation Index

### Product
- [Product Overview](product/overview.md) — what Suppr is, who it's for, feature map
- [Web / mobile parity scope](product/web-mobile-parity-scope.md) — intentional differences + cross-platform completion gate

### User Guides
- [Getting Started](user/getting-started.md) — onboarding, first recipe import, daily usage

### User Journeys
- [Import a Recipe](journeys/import-recipe.md) — URL → parsed recipe → saved to library
- [Verify Ingredients](journeys/verify-ingredients.md) — ingredient-level nutrition correction
- [Meal Planning](journeys/meal-planning.md) — generate → review → swap → log → shop
- [Food Tracking](journeys/food-tracking.md) — daily/weekly diary with meal slots

### Technical
- [Architecture](technical/architecture.md) — system diagram, tech stack, data flow, dependencies
- [Component Reference](technical/components.md) — all web and mobile components and screens

### API
- [Endpoints](api/endpoints.md) — all API routes with request/response examples

### Data & Schema
- [Database Schema](data/schema.md) — tables, relationships, RLS, stored procedures, migrations

### UX/UI
- [Design Patterns](ux/patterns.md) — colours, spacing, interaction patterns, empty states

### Testing
- [Testing system specification](testing/SYSTEM.md) — priorities, human case format, tiers, role/API/DB expectations, honesty bar
- [Testing Overview](testing/overview.md) — test stack, coverage, gaps, CI pipeline
- [Test plan / inventory](testing/test-plan.md) — tracked tests and gaps
- [Screen test matrix](qa/SCREEN_TEST_MATRIX.md) — mobile screens ↔ Maestro ↔ manual `TC-` ids

### Security
- [Auth & Security](security/auth.md) — auth methods, RLS policies, API security, data protection

### Operations
- [Scripts & Admin](operations/scripts.md) — maintenance scripts, debugging, approved sources

### Planning (Legacy)
- [Consolidated audit TODOs (2026-04-24)](planning/consolidated-audit-todos-2026-04-24.md) — docs + testing + parity backlog from audits
- [Product Roadmap](product-roadmap.md)
- [Competitive Principles](competitive-principles.md)
- [Best-in-Class Plan](best-in-class-plan.md)

## Rules

1. Documentation reflects reality, not intention
2. Updated immediately when code changes
3. No feature is complete without documentation
4. **Task completion (docs):** before closing a change, identify impacted docs; update product, technical, user, journeys, API, data, and testing docs; add new files when needed; validate accuracy and flow parity with code. See [genesis/README.md §2](genesis/README.md#2-task-completion-gate-non-negotiable). Work is not complete until docs are updated.
5. **Task completion (tests):** for behaviour or contract changes, identify affected features; add or update tests (flows, UI, APIs, data, edges); validate expectations and new logic coverage. A feature without tests is incomplete. See [testing/SYSTEM.md — task completion gate](testing/SYSTEM.md#task-completion-gate-non-negotiable). Work is not complete until tests exist and are updated.
6. Link instead of duplicating
7. Separate audiences clearly (User / Developer / Internal)

## Keeping Docs Updated

When making any code change, follow the [documentation completion gate](genesis/README.md#2-task-completion-gate-non-negotiable). For behaviour or contract changes, also follow the [testing completion gate](testing/SYSTEM.md#task-completion-gate-non-negotiable). In short:
1. Map the change to every affected path under `docs/`
2. Update or create the relevant files (including journeys, API, data, testing *documentation*)
3. Add or update **automated or signed-off manual tests** for the same change when it affects features, APIs, or UI
4. Verify cross-references and that flows match code
5. Optionally run: `find docs -name "*.md"` to discover files you may have missed
