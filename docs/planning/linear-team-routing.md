# Linear team routing — quick reference

**Decision:** [2026-06-18-linear-team-routing-by-executability.md](../decisions/2026-06-18-linear-team-routing-by-executability.md)

## One-line rule

| Acceptance criteria | Team |
|---------------------|------|
| Merged to `main` | **Engineering** (`ENG`) |
| Grace clicks vendor UI / counsel / filming / outreach | **Growth** (`GROW`) |

## Engineering (`ENG`) — will produce a PR

- Features, bugs, polish, tests, repo docs
- CI, scripts, verify-production-env, migrations **in repo** (Grace runs `supabase db push` for committed SQL)
- Legal/compliance **UI + copy in code** (counsel approves; gate with `needs/decision` until then)
- Product decisions: parent issue on ENG with `needs/decision` → child issues with `ready-for-agent` after Grace resolves

## Growth (`GROW`) — Grace-only; no PR

- Filings (DMCA, incorporation, trademark counsel)
- Dashboard toggles: Supabase, Sentry, Vercel env UI, RevenueCat, App Store Connect, PostHog alerts
- Creator outreach, filming, content calendar posts
- Counsel, CPA, immigration calls
- Beta recruitment, ratings campaigns, manual metric gates (run batch → read PostHog)

## Labels

| Label | Meaning |
|-------|---------|
| `grace-only` | On GROW; agents do not implement |
| `needs/decision` | ENG; blocked on Grace product/legal call |
| `ready-for-agent` | ENG; queued for Cursor/Codex pickup |

## Agent filters

```
team:Engineering label:ready-for-agent delegate:Cursor   # Cursor pickup
team:Engineering label:ready-for-agent label:agent/codex  # Codex pickup
team:Growth label:grace-only                              # Grace weekly review — not agents
```

## When unsure

1. Can an agent open a PR that satisfies every AC? → **ENG**
2. Does any AC require Grace's credentials in a vendor console? → **GROW** (or split: ENG for code, GROW for dashboard step)
3. Mixed ticket? → Split into GROW parent (human gate) + ENG child (implementation)

## ID remap

Linear renumbers identifiers when issues change team. See the migration table in the decision doc for the 2026-06-18 bulk move.
