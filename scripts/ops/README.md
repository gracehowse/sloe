# scripts/ops/

One-shot ops scripts with zero current repo references, quarantined here
pending confirmation they're safe to delete (ENG-1366).

Each of these was grepped across the entire tracked repo (`package.json`,
GitHub workflows, other scripts, docs) with zero hits beyond this note before
being moved here. They are not wired into `npm run ci`, any workflow, or any
other script. They're kept (not deleted) because Grace hasn't confirmed the
one-shot operations they performed are done for good — see
`docs/planning/2026-07-05-tech-debt-audit.md` (item 19) for the source audit.

- `apply-eng-backlog-migrations.sh`
- `backfill-cuisine-and-dietary-flags.ts`
- `backfill-generic-micros.ts`
- `gen-landing-devices.mjs`
- `mark-gate1-done.mjs`
- `migrate-mobile-fontsize-12-15.mjs`
- `setup-gate0-verify-user.mts`
- `validate-agents.mjs`
