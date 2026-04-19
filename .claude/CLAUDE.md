# Project Rules

This is one product across web and mobile.

## Non-negotiable rules
- Web and mobile must stay in sync at all times
- No feature is complete without:
  - implementation
  - testing
  - documentation
  - cross-platform review
- Documentation must be updated immediately after every meaningful change
- Tests must be updated immediately after every meaningful change
- Prefer correctness over speed
- Prefer real, validated functionality over mocked or partial functionality
- If nutrition / ingredient matching is uncertain, do not guess
- Use count-to-weight normalisation where reasonable
- Ask for clarification only when uncertainty materially affects nutrition accuracy
- **Never apply Supabase migrations via MCP `apply_migration` for files committed to `supabase/migrations/`.** MCP rewrites `schema_migrations.version` to wall-clock NOW(), causing drift from file timestamps (which are sometimes deliberately future-dated for monotonic ordering). Stage the SQL file and ask Grace to run `supabase db push --linked`. Same forbidance applies to Dashboard "Save as migration".

## Quality bar
- Best-in-class UX
- Production-ready logic
- Strong state handling
- Clear user journeys
- No accidental divergence between platforms

## Required workflow
For any meaningful feature, fix, or change:
1. Audit affected area
2. Plan change
3. Implement
4. Check web/mobile parity
5. Update tests
6. Update documentation
7. Re-audit or run release gate if appropriate

## Nutrition-specific rules
For ingredient matching:
- parse ingredient
- detect count vs weight vs household measure
- infer sensible edible weight where safe
- generate multiple candidate matches
- validate nutrition plausibility
- reject low-confidence matches
- only ask for clarification when uncertainty materially affects nutrition

## Git commits

**One-time per clone:** strip tool footers from commit messages (e.g. `Made-with: Cursor`):

```bash
git config core.hooksPath scripts/git-hooks
```

Hooks live under `scripts/git-hooks/` (see `prepare-commit-msg`). New machines need the same `core.hooksPath` setting.