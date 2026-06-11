# Synthetic-user persona testing framework

**Status:** Phase 1 (roster + seeding + runner protocol). Owner: testing.
**What it is:** goal-driven exploratory testing by agents that act as different
*kinds of user*, using the app in real time and logging structured feedback.
**What it is NOT:** scripted end-to-end testing. Maestro (mobile) and Playwright
(web) already cover known happy/sad paths step-by-step. This framework exists to
discover the *unscripted* — the friction a real human hits when they pursue a
goal their own way, that no one wrote a test for.

## Why this exists

Scripted E2E asserts "the button I expect is where I expect it." It cannot tell
you that a first-time user couldn't *find* the button, that a recipe-saver
abandoned because the import took two taps too many, or that the maintenance
number looked untrustworthy to someone who logs sloppily. Those are the failures
that lose the MFP-refugee cohort and tank the App Store rating — and they only
surface when you watch someone *try to do a thing*, not *follow a script*.

Each persona is a believable user with:
- a backstory and trust-sensitivities (what would make them distrust the app),
- a seeded data history that matches their behaviour,
- 4–6 **session goals** phrased as human intentions, not test steps,
- behavioural traits that change *how* they use the app (taps fast vs reads
  everything; abandons on friction).

A persona-session agent receives the [RUNNER.md](./RUNNER.md) prompt, signs in
as the seeded account, pursues the goals as that human would, and files
structured findings.

## The roster

| Persona | One line | Seeded shape | Grounded in |
|---|---|---|---|
| [mfp-refugee-power-logger](./mfp-refugee-power-logger.md) | Ex-MFP power user, disciplined, switched after the paywall | 21 full days, 9 weigh-ins, clean deficit | viral-plan MFP-refugee cohort |
| [instagram-recipe-saver](./instagram-recipe-saver.md) | Saves cooking Reels, came for the import magic moment | 14 loose days, 9 library recipes | viral-plan lead bet (recipe import) |
| [lazy-partial-logger](./lazy-partial-logger.md) | Logs breakfast, forgets the rest | 28 days incl. 7 partial + 3 empty | the real series that dragged adaptive TDEE to 1,314 |
| [watch-athlete](./watch-athlete.md) | Apple Watch, trains 5×/week, high variable burn | 21 full days, 10 weigh-ins, high target | TDEE methodology survey (wearable cohort) |
| [cold-start-newcomer](./cold-start-newcomer.md) | Brand-new account, no history, not onboarded | empty | first-impression / onboarding-completion KPI |

Each file is the **input** a persona-session agent reads. The roster is
deliberately small and high-contrast — five users who stress five different
surfaces (complete-diary trust, recipe→plan loop, sparse-data trust, activity
responsiveness, empty-state).

## How a session runs (the loop)

1. **Seed** the persona onto a test account
   (`scripts/seed-persona.mts` — see below).
2. **Run** a persona-session agent with the [RUNNER.md](./RUNNER.md) prompt +
   the persona file inline.
3. The agent **signs in**, pursues each session goal as the human would,
   narrates its inner monologue, and on friction records a structured finding
   immediately (schema in RUNNER.md).
4. **Close out:** dedupe findings against open Linear issues, file genuinely-new
   ones tagged `persona-feedback`, and append a session report to
   `docs/testing/personas/sessions/<date>-<persona>.md`.

## Seeding an account

```bash
node --import tsx scripts/seed-persona.mts \
  --persona <name> --email gracehowse+<tag>@outlook.com [--reset] [--dry-run]
```

- `--persona` — one of the five roster names.
- `--email` — a TEST account on the hard allowlist. **The seeder refuses any
  account not matching `gracehowse+<tag>@outlook.com` or the dedicated test
  accounts, and explicitly forbids the two real daily-driver accounts**
  (`gracehowse@outlook.com` bare, `gracemturner@hotmail.co.uk`). It aborts
  before opening any database connection.
- `--reset` — wipe ONLY this account's persona-tagged rows first (every delete
  is scoped by `user_id`). Idempotent: re-running with `--reset` re-creates a
  clean history.
- `--dry-run` — print the exact plan, write nothing.

Every seeded row is tagged with the `PERSONA:` prefix in its free-text field, so
synthetic data is visually distinguishable from real data and `--reset` can find
it precisely.

The safety guard and the row-shaping are unit-tested in
`tests/unit/personaSeed.test.ts`; the pure logic lives in
`scripts/_lib/personaSeed.ts` (the `.mts` entry is a thin Supabase shell).

## Authentication on the simulator — the reality

Read the **"Authenticating a persona session"** section of
[RUNNER.md](./RUNNER.md) before running. Short version: production mobile auth is
Apple Sign In (no email/password form), so a persona can't just "log in" through
the UI on the sim. There are three honest paths — the mobile E2E silent-sign-in
seam, the already-signed-in sim account, and web via `scripts/web-drive.mjs`.
RUNNER.md documents each and which findings each path can and can't produce.

## Relationship to the rest of the testing system

This is **additive** — it sits on top of Maestro (mobile E2E), Playwright (web
E2E), and Storybook (component/screen), never replacing them. See
[`docs/testing/overview.md`](../overview.md) and
[`docs/testing/SYSTEM.md`](../SYSTEM.md) for where each layer fits.

## Provenance

The personas are grounded in real docs, not invented:
- `docs/growth/tiktok-instagram-viral-plan.md` — the MFP-refugee tailwind, the
  recipe-import lead bet, the onboarding-completion KPI.
- `docs/ux/research/2026-06-10-adaptive-tdee-review.md` — the lazy-logger's
  partial-day pattern is the *actual* 28-day series that read 1,314.
- `docs/ux/research/2026-06-10-tdee-methodology-survey.md` — the watch-athlete /
  wearable-energy cohort.
