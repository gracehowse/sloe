# Reel-import parse-rate gate (GROW-61 / GROW-62)

**What this measures:** the recipe-import success gate — the north-star metric
for the "import a recipe from a TikTok/Reel" viral wedge. GROW-62 is the gate
itself: **≥90% usable imports on 100 random TikTok food Reels.** GROW-61 is the
instrument that lets us produce that number honestly.

This doc describes the three metrics, how to run the harness, which one is the
launch gate, and why the achievable ceiling is bounded by the legal
caption-only posture until the flag-off caption-text path ships.

Owner of the real 100-URL gate run: **founder / growth** (URL sourcing).
Instrument: this repo.

---

## Why the old instrument couldn't produce a trustworthy number

The 2026-07-01 recipe-import audit found the measurement was broken, not just
missing:

- **FM-4 — the success event was web-only.** `recipe_imported` fired on web
  (`src/app/components/RecipeUpload.tsx`) and **nowhere in mobile** — the
  primary surface. You couldn't measure import success where most imports
  happen.
- **FM-5 — the harness scored the wrong signal.** Offline it checked
  `platform !== "other" && caption length >= 40` and called that a "pass rate".
  `--live` POSTed a `captionText` the `/api/recipe-import` route **ignores**,
  then treated any `res.ok` as a pass — so a zero-macro shell (an import that
  returned a recipe object with no usable calories) scored as a **success**.

GROW-61 fixes the instrument only. It does **not** touch the parser, the 0.55
confidence floor (`verifyIngredients.ts`), or the legal caption-only posture —
those are out of scope and risky.

---

## The three metrics

Every import result is scored three ways and all three are reported. Scoring is
pure and unit-tested (`scripts/lib/reelImportScore.mjs`,
`tests/unit/reelImportScore.test.ts`).

| Metric | Predicate | What it tells you |
|---|---|---|
| **Definition A — recipe-object-returned** (vanity) | `ok && ingredients.length > 0` | An import "worked" in the loosest sense. Says nothing about whether the macros are usable. |
| **Definition B — strict success** (**the launch gate**) | `ok` AND `ingredients.length > 0` AND per-serving `calories > 0` AND `ingredient_match_rate >= THRESHOLD` (default **0.7**) | A **usable macro-tracked recipe** — real macro spine, most of the plate matched to a real nutrition source. This is GROW-62. |
| **Caption-present rate** | route returned a recipe object at all (proxy: `ok && ingredients > 0`) | How many input URLs even yielded extractable recipe text — the **structural ceiling**. Tells you how much of the gap is the legal posture vs the parser. |

**`ingredient_match_rate`** = fraction of ingredient rows that matched a
**structured nutrition catalog** (USDA / OFF / FatSecret / Edamam) **with real
macros** (`calories > 0`), over total rows. This is the same
`isStructuredSource` predicate the persist layer uses for
`recipe_ingredients.is_verified` — so the analytics event, the harness, and the
stored data all agree on what "verified" means. Rows sourced `Unverified` /
`Estimated` / null (below the confidence floor, or LLM extracts) do **not**
count.

**Definition B is the gate.** Definition A is reported so the vanity/real gap is
visible; caption-present is reported so the founder can see how much of any
shortfall is fixable by the parser vs bounded by the legal posture.

---

## The event side (macro_complete + ingredient_match_rate)

Both platforms now emit the `recipe_imported` PostHog event with two quality
props, derived from the route result by the shared
`importQualityProps` (`src/lib/recipes/importQualitySignal.ts`):

- `macro_complete: boolean` — true iff per-serving `calories > 0` (a usable
  macro spine; false for the FM-2 zero-macro shell).
- `ingredient_match_rate: number` (0..1) — as above.

Call sites:

- **Mobile** — `apps/mobile/app/import-shared.tsx`, fired when the import review
  renders a result (all import paths land through `applyImportedRecipeResult`).
  Carries `platform`.
- **Web** — `src/app/components/RecipeUpload.tsx`, fired on the URL/social
  import form-apply, now carrying the same props derived from the full result.
  (The web photo-OCR **text-extract** flow emits `recipe_imported` with
  `source: "image"` but **without** quality props — it extracts text into the
  editor and has no per-ingredient macros to score. Not a gap; there is nothing
  to match there.)

Event schema: `src/lib/analytics/events.ts` (`recipe_imported`).

Once this ships, PostHog can compute the gate directly from production traffic:
`% of recipe_imported where macro_complete AND ingredient_match_rate >= 0.7`.
The harness below is the pre-production / controlled equivalent.

---

## Running the harness

`scripts/benchmark-tiktok-import.mjs`. Takes a URL list via `--urls`. A tiny
runnable seed fixture ships at `scripts/fixtures/reel-import-seed-urls.txt`
(3–5 real-shaped TikTok food-Reel URLs). **Do not** hardcode the 100 gate URLs
into the repo — the real run points `--urls` at a founder-sourced file.

### Offline URL-shape precheck (no server, no auth)

```bash
node scripts/benchmark-tiktok-import.mjs --urls scripts/fixtures/reel-import-seed-urls.txt
```

Checks URL shape only. **This is NOT a success rate** (the audit's relabel — the
old version dressed this up as a pass rate). Exit 0 iff every URL is a
well-formed social URL.

### Live gate measurement (the real GROW-62 run)

Needs a running dev server and a **valid bearer token** — the
`/api/recipe-import` route rejects unauthenticated requests (401) and
rate-limits **20 imports/min**.

```bash
npm run dev
# a Supabase session JWT for a test account (see below):
export BENCHMARK_BEARER=<jwt>
node scripts/benchmark-tiktok-import.mjs --live \
  --urls <100-random-food-reels.txt> \
  --base-url http://localhost:3000
```

Flags:

- `--live` — POST `{ url }` only (the ignored `captionText` from the old
  version is dropped).
- `--match-threshold <n>` — Definition-B match floor (default `0.7`).
- `--gate <pct>` — Definition-B exit gate (default `90`). Exit 0 iff the
  Definition-B rate meets it.
- `--throttle-ms <ms>` — delay between requests to stay under the 20/min limit
  (default `3200`, ≈18.75/min).
- `--out <file>` — JSON report path (defaults under
  `docs/testflight-feedback/`).

Output: a summary block (A / B / caption-present with counts + percentages) and
a per-URL breakdown (which of A/B each URL hit, its match rate, and the failure
reason when B failed).

### Getting a bearer token

A Supabase session access-token (JWT) for a **test account** — never a real
user, never a prod-data account. Use the data-rich test account
(`gracehowse+test@outlook.com`) or a throwaway `…@example.com` signup. Grab the
`access_token` from the session (browser dev tools → the Supabase auth storage,
or a scripted `signInWithPassword`).

---

## The 90% ceiling is caption-present-bound

Definition B can only pass on URLs where the route got extractable recipe text
in the first place. Under the current **legal caption-only posture**
(`docs/decisions/2026-04-30-ig-tt-recipe-import-legal-posture.md` and the ENG-857
web/blog scrape posture), a Reel with no usable caption text yields no
ingredients — so it can never reach Definition B no matter how good the parser
is.

That means **the achievable Definition-B ceiling is bounded by the
caption-present rate** until the flag-off caption-text path ships. Report all
three metrics together so a Definition-B shortfall is correctly attributed:

- Low **caption-present** → the ceiling is structural (legal posture / no
  extractable text), not a parser miss.
- High caption-present but low **Definition B** → the parser / matcher is the
  gap, and is the thing to improve.

Do not "fix" a low number by loosening the gate or the confidence floor — that
reintroduces the zero-macro-shell-scores-as-success bug the audit called out.

---

## Related

- Event schema: `src/lib/analytics/events.ts` (`recipe_imported`).
- Shared derivation: `src/lib/recipes/importQualitySignal.ts`.
- Harness scorer (pure, tested): `scripts/lib/reelImportScore.mjs`.
- Tests: `tests/unit/importQualitySignal.test.ts`,
  `tests/unit/reelImportScore.test.ts`,
  `apps/mobile/tests/unit/importQualitySignalParity.test.ts`.
- Legacy caption smoke fixtures (superseded by the URL-based harness):
  `docs/testflight-feedback/tiktok-import-benchmark/`.
