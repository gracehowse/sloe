# Platemate Documentation

Single source of truth for the Platemate product, codebase, and operations.

## Documentation Index

### Product
- [Product Overview](product/overview.md) — what Platemate is, who it's for, feature map

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
- [Testing Overview](testing/overview.md) — test stack, coverage, gaps, CI pipeline

### Security
- [Auth & Security](security/auth.md) — auth methods, RLS policies, API security, data protection

### Operations
- [Scripts & Admin](operations/scripts.md) — maintenance scripts, debugging, approved sources

### Planning (Legacy)
- [Product Roadmap](product-roadmap.md)
- [Competitive Principles](competitive-principles.md)
- [Best-in-Class Plan](best-in-class-plan.md)

## Rules

1. Documentation reflects reality, not intention
2. Updated immediately when code changes
3. No feature is complete without documentation
4. Link instead of duplicating
5. Separate audiences clearly (User / Developer / Internal)

## Keeping Docs Updated

When making any code change:
1. Check which docs are affected
2. Update the relevant section
3. Verify cross-references still hold
4. Run: `find docs -name "*.md"` to see all doc files
