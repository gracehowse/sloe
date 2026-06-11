# Persona session — instagram-recipe-saver — 2026-06-11

- **Surface(s):** mobile (Path A — iOS sim)
- **Account:** gracehowse+recipesaver@outlook.com
- **Seeded:** yes — `scripts/seed-persona.mts --persona instagram-recipe-saver --reset` (12 logged days, 9 library recipes, 4 weigh-ins, goal=maintain / target 2,050)
- **Auth path:** A (set `apps/mobile/.env` E2E creds, restarted Metro 8082, relaunched — landed straight on Today as the persona)

## Goals attempted

1. **"Get an Instagram recipe into the app and see macros."** — **ABANDONED / FAILED.** Link import failed for two distinct live recipe URLs (allrecipes, budgetbytes) with "We couldn't reach that page." This is the persona's headline value. → **ENG-1055 (P1)**.
2. **"Turn my saved recipes into a plan for the week."** — **PASS (with a Pro gate).** Plan tab → "Plan from: My library (9)" generates a balanced, on-target day (2,060 / 2,050 kcal, all macros on track, real photos). But **3-day and 7-day plans are Pro-locked** — free users get only a 1-day plan, in slight tension with the "Plan your week" header.
3. **"Cook a saved recipe and have it log itself."** — **PARTIAL.** Recipe detail has **Cook Mode** and a **Log** button, but logging is a separate manual tap (cook → then Log), not an automatic "it logged itself." Reasonable, but not the fully-automatic loop the persona imagines.
4. **"Browse my library and find something."** — **PASS.** 9 recipes, category filters, search, real food thumbnails on the grid. Recipe detail shows source attribution ("via Instagram Reel"), a "✓ Fits your day · ≈25%" plan-fit chip, macros, and an honest allergen hedge.
5. **"Casually check I'm roughly on track this week."** — **PASS.** Today opened "Under budget / On track" (2,036 / 2,050), no guilt copy for the loose-logging days.
6. **"Is this the app I keep my recipes in?"** — **Lean NO, for now.** The library, plan loop, and on-track glance are genuinely good and joyful (no diet-shame). But the persona came for **one thing** — paste a Reel/link → recipe appears — and it failed on the first two tries. For this cohort that single failure outweighs the rest until import is reliable.

**Task success:** 4/6 PASS (2 + 4 + 5 + the loop), 1 partial (3), **1 hard fail on the headline goal (1)**.

## Findings

### Finding 01 — recipe link-import fails for popular recipe sites ("We couldn't reach that page")
- **Journey:** Goal 1 (the viral magic moment)
- **Screen:** Recipes → ＋ → Paste a link → Import
- **Expected:** paste a link from "any recipe site" (the screen's promise) → recipe + macros.
- **Happened:** allrecipes and budgetbytes URLs both failed at ~6–8s with "We couldn't reach that page." App→backend works (semantic error returned); the **backend scraper's outbound fetch fails**. No Supabase edge functions exist, so the scraper is on the Vercel/Next API. Likely datacenter-IP bot-blocking (would affect prod too) and/or egress/config.
- **Severity:** P1 (P0 if the Reel/TikTok path is also affected — untested, see gap)
- **Trust-impact:** yes
- **Screenshots:** 06/07/15-sm.png
- **Linear:** **ENG-1055** (new, persona-feedback). Related: ENG-670 (parse-rate gate), ENG-1037 (import fetch path).

## Observations (noted, not filed — low confidence / by-design)

- **Recipe-detail hero image was a placeholder glyph** for "Crispy gochujang tofu bowl" even though its grid thumbnail (and the generated plan's meals) had real photos. For a visual-first persona this is a turn-off, but it appeared on one recipe only and the grid/plan photos load fine — likely a single seeded-recipe hero-image quirk, not systemic. Worth a spot-check, not filed.
- **No "Add to plan" from the recipe detail.** Planning is generative (from "My library"), not "place this specific recipe on Tuesday." The loop works, but a user looking at one saved recipe can't pin it to a day without generating a whole plan. Model choice; P3 discoverability at most.
- **Filtered-empty edge:** applying the "Dessert" filter (0 matches) shows "No saved recipes yet" — slightly wrong when the library has 9 recipes but none in that category. Minor, surfaced via a mis-tap.
- **Import progress UI shows ✓ on all three steps (Extracting/Matching/Calculating) before failing** — optimistic checkmarks. Folded into ENG-1055.

## Linear
- **Filed new:** ENG-1055 (P1, import failure), tagged `persona-feedback`.

## Honest gaps
- **Could not test the persona's actual primary path** — an Instagram Reel / TikTok link — for lack of a guaranteed-live Reel URL (a fabricated one would 404 and mislead). Finding 01 covers the web-link path only; the Reel/TikTok extraction pipeline is untested this session. If it shares the outbound-fetch failure, ENG-1055 is P0.
- **Plan source ambiguity:** after selecting "My library," the generated meals (Bibimbap, Katsu Bowl, etc.) didn't obviously match the 9 saves — couldn't confirm whether the radio selection registered or it fell back to "Library & discovery." The loop produced a valid plan either way.
- **Web parity unchecked** this session (iOS-primary).
</content>
