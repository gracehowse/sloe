# Persona session — instagram-recipe-saver — 2026-06-14

- **Surface(s):** web (Path C) — primary; mobile Path A blocked
- **Account (viewed):** `gracehowse+recipesaver@outlook.com` — canonical; `.env.persona` → `PERSONA_INSTAGRAM_RECIPE_SAVER_EMAIL`
- **Account (seed command — wrong):** `gracehowse+instagram-recipe-saver@outlook.com` — not in auth; seed was a no-op
- **Seeded:** attempted — `node --import tsx scripts/seed-persona.mts --persona instagram-recipe-saver --email gracehowse+instagram-recipe-saver@outlook.com --reset` (wrong `--email`; should have used `recipesaver` tag)
- **Auth path:** C (web via `scripts/web-drive.mjs`, Playwright auth state — likely stale / wrong account vs seed)

## Goals attempted

1. **Get a recipe from Instagram into the app and see macros** — abandoned, infrastructure blocker
2. **Turn saved recipes into a weekly plan** — not reached
3. **Cook one saved recipe and have it log itself** — not reached
4. **Browse library and find something to fit available macros** — not reached
5. **Check if roughly on track this week** — partial, found contradictory data
6. **Decide if keeping the app for recipe saving** — not reached

## Findings

### Finding 1 — Seeded logging data not visible on Today screen

- **Journey:** Goal 5 (checking status this week)
- **Screen:** Today
- **What I expected:** Seeded account has 14 days of loose logging. When I land on Today, the week-strip should show logged days and EATEN calories should reflect the history (not 0).
- **What happened:** Screen shows "Fresh start" indicator with EATEN: 0, BONUS: 0. Yet the week-strip displays logged days (green dots visible on Mon–Fri and Sun, June 9–13). The 14 seeded days of data are not reflected in the calorie totals.
- **Severity guess:** P1 major — Data integrity issue. Seeded persona's history should load; if it doesn't, the entire test is invalid.
- **Screenshot:** apps/mobile/screenshots/personas/instagram-recipe-saver/2026-06-14/01-today-start.png
- **Trust-impact:** yes — Seeing "Fresh start" + 0 eaten while logging history is visible would make the persona distrust data tracking.

### Finding 2 — "Fresh start" label conflicts with visible logged days

- **Journey:** Goal 5 (checking weekly status)
- **Screen:** Today / week-strip view
- **What I expected:** Either "Fresh start" (no history) or logged data (dots + eaten calories). Not both simultaneously.
- **What happened:** Screen shows "Fresh start" indicator coexisting with a week-strip displaying 5+ logged days (green dots visible). Contradictory signals about logging history.
- **Severity guess:** P1 major — Confusing UI. The persona sees contradictory state indicators about whether they've logged anything.
- **Screenshot:** apps/mobile/screenshots/personas/instagram-recipe-saver/2026-06-14/01-today-start.png
- **Trust-impact:** yes — Contradictory states undermine confidence in the app's data model.

## Linear

**New issues filed:**
- ENG-1181: [persona: instagram-recipe-saver] Seeded logging data not visible on Today
- ENG-1182: [persona: instagram-recipe-saver] Fresh start label conflicts with visible logged days on Today

**Existing issues commented on:** none (no dupes found)

## Honest gaps

**Web infrastructure blocker:** Dev server (Next.js) became unstable mid-session. `scripts/web-drive.mjs` uses Playwright to automate browser interaction. Multiple launches crashed the dev server; the underlying Turbopack process died after 1–2 screenshot captures. The dev server required multiple force-restarts. This prevented testing:
- Goals 1–4 (recipe import workflow, plan-building, cook-and-log loop, library browsing) — all require navigating beyond the Today screen, which requires stable web-drive execution.
- Goal 6 (deciding to keep using the app) — depends on successful completion of Goals 1–5.

**Mobile Path A unblock needed:** Per RUNNER.md, full-fidelity mobile testing requires per-persona Supabase auth credentials (password for `gracehowse+instagram-recipe-saver@outlook.com`). Currently not provisioned; Grace must set up via Supabase dashboard or share in a `.env.persona` file so the seed script can set a known password. Until then, mobile persona runs are gated on Grace spinning up the account.

**Data seeding validation:** The findings below (data not visible on screen) may indicate a seeding issue (credentials mismatch, wrong account), or a display/loading bug. Cannot confirm which without being able to navigate to other screens (Recipes, Plan) to verify the data exists in the app.

---

## Resolution (2026-06-14 — DB verified, **false alarms**)

**Root cause:** Test-harness defect, not product bugs. The session seeded
`gracehowse+instagram-recipe-saver@outlook.com` (persona-slug-derived email) while
Path C auth + the canonical persona account is
`gracehowse+recipesaver@outlook.com` (`.env.persona`). Combined with a stale /
wrong web auth fixture, the run **viewed one account and seeded another**.

**Supabase auth + `nutrition_entries` (production DB):**

| Email | In auth? | Journal shape |
|---|---|---|
| `gracehowse+instagram-recipe-saver@outlook.com` | **No** | — (seed targeted a ghost) |
| `gracehowse+recipesaver@outlook.com` | **Yes** | 39 entries, May 29 → Jun 11; **zero on Jun 14 (today)** |

**ENG-1181 — CLOSED (not a bug):** EATEN 0 on Jun 14 is correct — nothing logged
today on the account that was actually viewed. Week-strip dots through Jun 11 reflect
prior history. No "missing seed" on product.

**ENG-1182 — CLOSED (not a bug):** **Fresh start** + EATEN 0 + week-strip history
dots is the **designed empty-today-with-history** state (same pattern Grace sees on
her real account). "Fresh start" applies to *today's* diary; dots show *past* days.
Not contradictory.

**Harness fixes (prevent recurrence):**

1. Always take `--email` from `.env.persona` (`PERSONA_*_EMAIL`), never
   `gracehowse+<persona-slug>@outlook.com` — slugs can differ from plus-tags
   (`instagram-recipe-saver` → `recipesaver`).
2. Regenerate Playwright storage state for the same email immediately before Path C
   runs (`auth.setup.ts` with matching `E2E_EMAIL` / password).
3. Cancel or mark **ENG-1181** / **ENG-1182** in Linear as *invalid — harness*;
   do **not** treat as P1 launch blockers.
