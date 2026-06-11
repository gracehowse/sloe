# Persona session — mfp-refugee-power-logger — 2026-06-11

- **Surface(s):** mobile (Path A — iOS sim, primary surface)
- **Account:** gracehowse+mfprefugee@outlook.com (allowlisted +tag test account)
- **Seeded:** yes — `node --import tsx scripts/seed-persona.mts --persona mfp-refugee-power-logger --email gracehowse+mfprefugee@outlook.com --reset` (21 full days, 9 weigh-ins, 4 library recipes, profile goal=cut / activity=moderate / target 1,850, onboarded)
- **Auth path:** A (E2E silent sign-in seam). Note: the sim had a prior account (Grace) signed in; the seam only fires when `!data.session`, so I signed out via Settings first, then cold-relaunched → seam signed in as the persona. `apps/mobile/.env` was written with the E2E creds and Metro 8082 restarted to inline them.

## Goals attempted

1. **"Log everything as fast as MFP."** — **Completed (positive).** Recents log in **2 taps** (FAB → recent item), instant Today update, sheet auto-dismiss — faster than MFP's 3-tap quick-add. Search logs in **4 taps + a scroll** (FAB → type → result → scroll → "Use this") — parity with MFP. Results carry **Verified/Estimated** badges and per-serving P/C/F.
2. **"Do the day's numbers add up (4/4/9)?"** — **Completed (PASS).** Day total: P140·C188·F63 → 560+752+567 = **1,879** vs **1,876** shown (3 kcal gram-rounding). Closes. Per-food entries (e.g. verified banana 105 kcal vs 4/4/9≈116) differ by the fibre/net-carb effect, which the detail screen discloses explicitly (Fibre 3.1g) — defensible, USDA-consistent, not a bug.
3. **"Is the maintenance/TDEE estimate one I'd trust?"** — **Completed (PASS, strong).** Maintenance **1,963 kcal, high confidence**. My sedentary-floor check (Mifflin BMR 1,436 × 1.2 = **1,723**) → 1,963 sits *above* the floor and below moderate (×1.55 = 2,226) — exactly right for adaptive. The Week Digest even states **"maintenance landed at 1,963 kcal this week (formula said 1,723)"**, openly disclosing the formula floor it computed for me. Directly answers the persona's #1 trust fear.
4. **"Last two weeks at a glance — on track to lose?"** — **Completed (PASS, with the Finding-01 wart).** Month graph shows a net-down undulating trend; RATE −0.1 kg/wk, DEFICIT −38 (week) / −84 (month), all internally consistent → yes, slowly losing. But the weight-card **headline** delta misleads (Finding 01).
5. **"Re-log a frequent meal without re-entering ingredients."** — **Completed (PASS).** "Today's recents" logs a remembered meal in 1 tap; Library tab shows the 4 seeded recipes with macros; a "Saved meals" tab exists in the log sheet.
6. **"Would I delete MyFitnessPal for good?"** — **Answered: lean YES, with caveats.** Free barcode scanner (the exact feature MFP paywalled and drove the persona out), faster recents logging, honest "estimate, not a promise" framing, and a transparent, defensible maintenance number win it. The two Progress-projection inconsistencies (Findings 01 & 02) would make a numbers-obsessed user hesitate to trust the *forecasts* — but not enough to return to the app they left over a paywall.

**Task success:** 6/6 attempted; 5/6 fully completed PASS; Goal 6 answered. 2 P1 trust findings, 1 P3.

## Findings

### Finding 01 — weight-card headline "↗ 0.2 kg this week" (amber) contradicts the card's own −0.1 kg/wk rate

- **Journey:** Goal 4 (two weeks at a glance / on track to lose)
- **Screen:** Progress → Weight card (W and M periods)
- **What I expected:** on a week where I lost weight, the headline shouldn't tell me I'm *up* — and the "Trend" view should smooth scale noise.
- **What happened:** headline reads **"↗ 0.2 kg this week"** with an up-arrow in **amber/warning** colour, while directly below: START 71.9 → CURRENT 71.7 (a 0.2 kg **loss**), **RATE −0.1 kg/wk**, DEFICIT −38. 0.2 kg is sub-daily water noise. The **Trend/Scale toggle does not change the headline delta** — byte-identical in both modes (17b vs 18b), so "Trend" never shows a smoothed weekly delta.
- **Severity guess:** P1 major
- **Screenshot:** apps/mobile/screenshots/personas/mfp-refugee-power-logger/2026-06-11/17b-weight-delta-crop.png, 18b-scale-delta.png
- **Trust-impact:** yes
- **Linear:** commented on **ENG-1039** (already filed today — "calcGoalTimeline weekly rate is a raw two-point delta", same noise class as ENG-1026). Not a duplicate; added user-facing evidence.

### Finding 02 — two different "last 7 days averaged" kcal values on one Progress screen (1,894 vs 1,872)

- **Journey:** Goal 3/4 (trust the projections)
- **Screen:** Progress → Projected-Weight card + Journey card (adjacent)
- **What I expected:** two cards both saying "last 7 days averaged X" must show the same X.
- **What happened:** Projected Weight = "last 7 days averaged **1,894** kcal/day" → 71.2 kg in ~5 weeks; Journey = "last 7 days averaged **1,872** kcal/day, deficit 91" → 71.2 kg in ~5 weeks. 22 kcal apart, same wording, same conclusion. Projected card's 1,894 (~69 deficit) doesn't reconcile to 5 weeks (≈8). **Verified post-cold-reload** (not a cache artifact of my mid-session log).
- **Severity guess:** P1 major
- **Screenshot:** apps/mobile/screenshots/personas/mfp-refugee-power-logger/2026-06-11/22a-projected.png, 22b-journey.png, 26c-journey-7day.png
- **Trust-impact:** yes
- **Linear:** **ENG-1053** (new, persona-feedback).

### Finding 03 — search-result detail opens with the primary "Use this" CTA below the fold

- **Journey:** Goal 1 (log as fast as MFP)
- **Screen:** ＋ → Log a meal → search → result → food-detail sheet
- **What I expected:** for a verified single food at default serving, the log action is immediately visible (MFP pins its add-check).
- **What happened:** detail sheet opens showing serving size + servings + full nutrition + "if you log this"; **"Use this" is below the fold**, needs a scroll. Adds avoidable friction to every search-logged food.
- **Severity guess:** P3 polish
- **Screenshot:** apps/mobile/screenshots/personas/mfp-refugee-power-logger/2026-06-11/13-banana-detail.png (CTA absent on open), 14-banana-logbtn.png (after scroll)
- **Trust-impact:** no
- **Linear:** **ENG-1054** (new, persona-feedback).

## What worked well (no findings — worth keeping)

- **Free barcode scanner** front-and-centre in the log sheet — the exact feature MFP paywalled. Biggest single win for this cohort.
- **2-tap recents logging** beats MFP; instant Today update on log.
- **Verified vs Estimated** badges on every search result + per-serving macros — exactly the trust posture the persona wants (low-confidence flagged).
- **Day-total macro arithmetic closes** (4/4/9); per-food fibre disclosed so net-carb calories are explainable.
- **Maintenance transparency:** "1,963 this week (formula said 1,723)", "high confidence", and "an estimate, not a promise" framing throughout the projection cards. This is best-in-class honesty and directly defuses the persona's headline trust fear.

## Linear

- **Commented:** ENG-1039 (Finding 01 user-facing evidence).
- **Filed new:** ENG-1053 (P1, Finding 02), ENG-1054 (P3, Finding 03). Both tagged `persona-feedback`.
- Created the `persona-feedback` team label (was missing).

## Honest gaps

- **Apple Sign In flow not exercised** — Path A bypasses it by design; sign-in journey findings are out of scope for this run.
- **Web parity not checked this session** — ran iOS-primary only. Findings 01–03 are likely dual-platform (Progress projections + log sheet exist on web); web confirmation is a follow-up. ENG-1039 already notes "both platforms" for the rate bug.
- **idb `describe-all` coordinate drift** (known WDA issue on iOS 26.5) made tap-targeting unreliable after scrolling; worked around by relaunching to reset the coordinate frame and computing taps from the screenshot framebuffer (402×874 pt, 3× scale). Slowed the session but did not block any goal.
- **I mutated the seeded day** by logging one "Apple & peanut butter" (188 kcal) to test quick-log speed (today went 1,876 → 2,064), then closed the final `--reset` over it. The test log was created from a `PERSONA:`-tagged recent, so it inherited the tag and the `--reset` (which deletes `nutrition_entries WHERE recipe_title LIKE 'PERSONA:%'`) removed it before re-inserting the clean 84. **Account confirmed clean — no stray rows, no duplication.** I did *not* log the banana (closed the sheet).
- **One non-default dev-flag override** observed on the Settings dev panel: `brand_frost_secondary` set to **On** while all others are Auto. Dev-only surface, not a user finding — flagging in case it was left on unintentionally.

## Environment cleanup performed

- Re-ran the seed with `--reset` to restore the persona's clean 21-day shape (removing my test log).
- Removed `apps/mobile/.env` (the E2E persona-auth seam) and restarted Metro 8082 so the dev client no longer auto-signs-in as the persona on Grace's next launch. (The app will land on the login screen; Grace re-auths via Apple as normal.)
</content>
</invoke>
