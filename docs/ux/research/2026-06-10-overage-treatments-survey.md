# Over-budget treatments across the category — evidence-graded survey

**Date:** 2026-06-10 (late session, after the seven ring rounds)
**Question:** how does every relevant app render the OVER-BUDGET state on its daily
calorie/energy visual (ring, bar, dial)?
**Why this exists:** a prior quick survey got MyFitnessPal WRONG ("ring fills, number
goes red"); Grace's correction — MFP marks the over portion with a **diagonal hatch /
striped segment**. The standard from here: every per-app claim carries evidence (a
Mobbin screen link, an App Store screenshot URL, a help-doc quote) or an explicit
**COULD NOT VERIFY** tag. No vibes.

**Method:** Mobbin MCP screen search (pixels read directly from returned screenshots),
iTunes lookup API + App Store page scrape → raw `mzstatic` screenshot downloads (pixels
read), first-party help docs/blogs via web search, repo archaeology for the
founder-attested MFP claim. Confidence ladder: **verified-pixels** (I read the actual
screenshot) > **first-party doc** (vendor's own help/blog text) > **secondhand**
(third-party description) > **COULD NOT VERIFY**.

---

## Evidence table

| App | Main daily visual | What changes when over target | Evidence | Confidence |
|---|---|---|---|---|
| **MyFitnessPal** | Three coexisting surfaces: (1) NEW Today home — horizontal calorie **bar** ("963 cal / 2,930 · 1,967 left"); (2) classic Premium dashboard — segmented **donut**, centre "806 Remaining"; (3) diary header — arithmetic strip `Goal − Food + Exercise = Remaining` | **Founder-attested:** the over portion of the progress visual renders as a **diagonal hatch / striped segment** ("MFP does a /////// line for the over part" — Grace, active MFP user, 2026-06-10). Corroborated by Suppr's own pre-Sloe ring code (2026-05-24, commit `94fb5b7b`), which implemented a 45°, 6px-period destructive-stripe `overHash` Pattern with the in-code comment *"mfp used to make it a hashed colour like this"* — note **"used to"**: current-version vs legacy not pinned by any public screenshot found tonight. Secondarily (secondhand): the Remaining number flips negative and **turns red** in the diary; MFP's 2024 premium "Progress Bar" **caps at 100%** ("the Progress Bar itself will never exceed 100%" — Progress Bar FAQ, via search snippet; article itself 403s) | Mobbin: [classic ring dashboard](https://mobbin.com/screens/158afb6e-bb6a-4691-9e11-4fd56f6902c2), [new Today bar](https://mobbin.com/screens/32b82d20-deb0-493f-a643-c170d9e46b8b), [dark dashboard](https://mobbin.com/screens/fa5def3b-6ab8-44e4-b535-d59000a48a06), [diary header](https://mobbin.com/screens/91bb25b0-efdf-421a-a03b-6ccb359617d2) · [App Store shot (current Today bar)](https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/21/1d/7a/211d7ada-4868-64be-54c1-a2d92c528551/MFP_iOS_6.5_Screen_1.png/392x696bb.jpg) · [Progress Bar FAQ](https://support.myfitnesspal.com/hc/en-us/articles/21330878903181-Progress-Bar-FAQ) · repo: `git show 94fb5b7b` (overHash) | Baseline: **verified-pixels**. Hatch: **founder-attested eyewitness** (treated as current; no public screenshot of the over-state found — Mobbin holds no MFP over-day capture). Red-negative number: secondhand |
| **Lose It!** | "Budget" card: circular **gauge**, centre = delta + verdict word — "**118 Under**" in **green**; Food / Exercise numbers flank it | Centre verdict word flips to "**Over**" (symmetric grammar — the under-state IS the verdict pattern, pixel-verified); colour reportedly flips red ("when you go over the calorie limit of the day, the app marks it as red") | [App Store shot — gauge + "118 Under" green](https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/0a/b7/a8/0ab7a8fe-582c-3a29-2997-0b73489ca78f/SC-2.jpg/392x696bb.jpg) · red-when-over: [third-party review](https://www.itscheatdayeveryday.com/about-me/the-lose-it-app-and-counting-calories-to-lose-weight/) (page no longer shows it on fetch — weak) | Under-state grammar: **verified-pixels**. Over-state: **secondhand**; exact over pixels **COULD NOT VERIFY** (not on Mobbin; marketing never shows failure) |
| **Cronometer** | Diary-header "circles" (Consumed / Burned / **Remaining** donut); Energy Summary has Target mode | Target mode flips to showing "**how far over your target you are**" (first-party blog). Support docs describe **red** = exceeded maximum threshold on target bars; the red-on-over claim for the energy circle itself could not be quoted directly (help centre is Cloudflare-walled) | [Cronometer blog — Energy Summary explained](https://cronometer.com/blog/cronometers-energy-summary/) (fetched, quoted) · [Mobile Energy Summary help article](https://support.cronometer.com/hc/en-us/articles/30300963266452-Mobile-Energy-Summary) (403 on fetch) | Structure/centre-flip: **first-party doc**. Red colour: **secondhand** |
| **MacroFactor** | Dashboard half-**ring** with Consumed/Remaining toggle; Nutrition & Targets mini-bars | **NOTHING — doctrinally.** "You won't see a warning on the screen shaming you for exceeding your calorie target… MacroFactor doesn't turn any numbers red (and we all know that on the user interface of a nutrition app, red means 'bad') when you exceed a particular target." Mobbin pixels confirm: "1002 of 809" (24% over) rendered with zero alarm styling | [Philosophy doc (fetched, quoted)](https://macrofactor.com/macrofactors-algorithms-and-core-philosophy/) · Mobbin: [1002 of 809, no alarm](https://mobbin.com/screens/dcab9c97-1282-4e5c-9321-04a4178b8846), [half-ring dashboard](https://mobbin.com/screens/6fa1ba1e-263f-4153-a82c-5dbc3dfd1cac) | **Verified-pixels + first-party doc** — the strongest-documented "nothing" in the category |
| **Cal AI** | Big "**Calories left**" number + black ring; macro mini-rings ("129g Protein left" etc.) | **Macros (verified):** label flips to "**45g Protein over**" and the mini-ring **caps at a full circle** in its identity colour — no red flip, no texture. **Calorie headline:** widely reported to go negative ("-N Calories left") but no pixel evidence found | [App Store shot — "45g Protein over", full mini-ring](https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/66/dd/5c/66dd5cab-7622-7caf-84c1-5fc5c16f5b39/28f8bc10-b990-4c88-be57-5003ba5d6483_SS1Small__U00281_U0029.png/392x696bb.png) · Mobbin: [home ring baseline](https://mobbin.com/screens/db75399f-1659-4e09-ba4f-926d12503319) | Macro over-state: **verified-pixels**. Calorie-ring over-state: **COULD NOT VERIFY** |
| **Lifesum** | Header **ring**, centre "N KCAL LEFT" | Centre flips to "**161 KCAL OVER**" / "**273 KCAL OVER**"; ring stays its normal white and **caps at full**; in the dark-green variant a small **gold tick segment at 12 o'clock** marks the over point. No red anywhere — fully calm | Mobbin: ["161 KCAL OVER" + gold tick](https://mobbin.com/screens/2b6433d3-b655-40b4-a9ab-9197331346b5), ["273 KCAL OVER"](https://mobbin.com/screens/f83bc9d1-ad58-4821-9d63-3941e2520488), [baseline "KCAL LEFT"](https://mobbin.com/screens/56b3c526-5816-4760-bab0-5665acd0da37) | **Verified-pixels** (two independent over-state captures — the best over-state evidence in the whole survey) |
| **Yazio** | Semicircular **gauge** "401 Remaining" (Today card); blue summary card ring "884 Remaining" | **Colour shift**: first-party help — **red = exceeded your calorie goal**, green = under; tolerance band: the summary stays **green if you exceed by ≤2%** | Mobbin: [gauge baseline](https://mobbin.com/screens/5090bdec-34c7-4872-9931-d825286d9bfd) · [App Store shot — "884 Remaining"](https://is1-ssl.mzstatic.com/image/thumb/PurpleSource221/v4/dd/1b/ed/dd1bed03-d11e-5e69-88b3-10c1b502e14e/a7eafd49-8d54-4ebe-a5d3-3cd7fe40f0d4_0_APP_IPHONE_55_0.jpg/392x696bb.jpg) · [help: "What do the red and green colors in the Diary mean?"](https://help.yazio.com/hc/en-us/articles/360002407218) (Cloudflare-walled on direct fetch; content via search index) | Baseline: **verified-pixels**. Over = red + 2% grace: **first-party doc** (pixels not captured) |
| **Fastic** | Primary daily visual is the **fasting countdown ring** ("REMAINING 12:32:02"); calories are a secondary counter (flame number in the header) | Calorie over-state: nothing found in marketing, Mobbin, or docs | [App Store shot — fasting ring is the hero](https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/45/41/27/454127f7-f718-7008-54fb-bfd7edb7d8b0/02.jpg/392x696bb.jpg) | Baseline: **verified-pixels**. Over-state: **COULD NOT VERIFY** |
| **Noom** | Thin horizontal "**Calories: 804 AVAILABLE**" bar with position chip + "GOOD" end-label; green/yellow/orange food-category bars below | Over-state of the budget bar: nothing found in Noom's support docs or any screenshot source | Mobbin: [budget bar + category bars](https://mobbin.com/screens/e4c075aa-2d31-488e-93a7-02d5f4bc8dda), [category detail](https://mobbin.com/screens/c9f66942-62d5-47fe-8b42-f2dee970efb5) · [Noom support search](https://www.noom.com/support/faqs/question-topics/food-logging/) (no over-state article) | Baseline: **verified-pixels**. Over-state: **COULD NOT VERIFY** |
| **Bevel** | Semicircular **dial**, centre "1.193kcal left", grey arc, "0 … 1.892" endpoints labelled | Over-state: nothing found anywhere | Mobbin: [calorie dial](https://mobbin.com/screens/6dd973a1-a672-4835-b491-cd8ea5325054), [goal ring](https://mobbin.com/screens/0ff75dae-9bfb-4487-9d4c-c63f68357a35) | Baseline: **verified-pixels**. Over-state: **COULD NOT VERIFY** |
| **Alma** | "**Alma Score**" 0–100 coaching ring + nutrition-target mini-rings (colour-coded amber/green per target); grammar is score/coaching, not budget-verdict | Over-eating presumably moves the score rather than flipping a budget state; no explicit over treatment found | [App Store shot — score + target rings](https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/f0/77/cb/f077cb0b-d35b-00a1-07dd-72af80c545f7/1.png/392x696bb.jpg) | Baseline: **verified-pixels**. Over-state: **COULD NOT VERIFY** |
| **FoodNoms** | Food Log "Goals" row of **mini-rings** per target ("Calories 575 left", "Carbs 29 over"…) | Label **text flips to "N over"**; the over ring renders as a **closed full circle in its identity colour** (blue carbs stay blue) — no red flip, no texture | [App Store shot — "Carbs 29 over", full blue ring](https://is1-ssl.mzstatic.com/image/thumb/PurpleSource221/v4/c6/1f/35/c61f351c-f3a0-c4a3-f31a-bf6c7c66fa6a/iPhone_1.png/392x696bb.jpg) | **Verified-pixels** (over-state shown in the vendor's own marketing) |
| **Calory** | Big **dot-fill circle** (dots accumulate as you log) + "Calories / Remaining: 748 · 721 · 46%"; week strip of day-dots above | Week strip shows one day's dot in **red** (reads as an over/exceeded day marker — under days render plain). Main-circle over treatment not shown | [App Store shot — dot circle + red week-day dot](https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/55/c0/9b/55c09b0d-df67-9d5f-a338-0e6362997941/01.jpg/392x696bb.jpg) | Week-dot red: **verified-pixels** (interpretation inferred). Main-circle over-state: **COULD NOT VERIFY** |
| **Apple Fitness** *(contrast case — activity, not food)* | **Move ring** (red), Exercise, Stand | Ring **keeps going past 100% and overlaps itself — a second lap**. "**An overlapping ring means you exceeded your goal.**" Over = achievement; the wrap is a victory lap | [Apple support — Track daily activity (fetched, quoted)](https://support.apple.com/guide/watch/track-daily-activity-apd3bf6d85a6/watchos) · Mobbin: [Move ring day view](https://mobbin.com/screens/8bb7df7c-f241-4ef6-a8e6-2f5091fb841b) | **First-party doc + verified-pixels baseline** |
| **WeightWatchers** | Points **ring**, centre "**8 Points left**", flanked by "30 Weeklies" / "15 Used" | **Budget cascade**: daily overage drains the **Weeklies** pool rather than flipping the daily visual to a failure state ("weekly points are a safety net… they don't kick in until you've exhausted your Daily Points"). Pixel over-state of the ring itself not captured | [App Store shot — "8 Points left" ring + Weeklies](https://is1-ssl.mzstatic.com/image/thumb/PurpleSource221/v4/ad/e5/ab/ade5abec-87db-9c3f-0d3b-0ac44c58b565/Slide_2_U002c_My_Day.png/392x696bb.png) · [WW — What are Points](https://www.weightwatchers.com/us/blog/weight-loss-diet/what-are-points) · [WW — How Rollovers Work](https://www.weightwatchers.com/nz/blog/weight-loss/how-rollovers-work-ww-program) | Baseline: **verified-pixels**. Cascade semantics: **first-party doc**. Ring over-pixels: **COULD NOT VERIFY** |
| **Fitbit** *(bonus — surfaced during search)* | "Cal in vs. out" weekly **bars**; donut macros | Legend includes a dedicated **"Over" category in pink/magenta** — over days get their own bar colour | Mobbin: [Cal in vs. out legend with pink "Over"](https://mobbin.com/screens/e21ef69e-ebe4-41b0-ba7b-5b72397a4b0b) | **Verified-pixels** (legend; an actual pink over-bar day not captured) |

---

## Treatment taxonomy — counts

Buckets are the *primary* over-budget treatment per app. Food/nutrition apps n=15
surveyed; 10 yielded at least partial evidence. Several apps layer two treatments
(noted).

| Bucket | Apps | Count |
|---|---|---|
| **(a) Number/text flip only** (verdict moves to the label/centre, visual stays calm) | Cronometer (centre flips to over-amount), Cal AI macros + FoodNoms (text "N over" — layered with (b)) | 1 pure, 3 incl. layered |
| **(b) Visual caps at full + centre/label verdict** | **Lifesum** (white ring caps, "N KCAL OVER" + gold tick), **Lose It!** (gauge + verdict word, layered with (d)), **FoodNoms** (full identity-colour ring), **Cal AI** macros (full ring), MFP 2024 Progress Bar (caps at 100%) | **5 — the modal food-category treatment** |
| **(c) Hatched/textured over-segment** | **MyFitnessPal** (founder-attested; Suppr's own pre-Sloe ring copied it) | 1 — unique to the category leader |
| **(d) Colour-shift** | **Yazio** (red, with ≤2% green grace band), Lose It! (red, secondhand), Cronometer (red, secondhand), Fitbit (pink "Over" bars) | 4 (2 with pixel/first-party evidence) |
| **(e) Second lap / wrap** | **Apple Fitness only** — activity semantics | 1 — **zero food apps**. Confirms commit `b3ced7ad`: the wrap is an activity-ring idiom |
| **(f) Nothing (doctrinal)** | **MacroFactor** ("doesn't turn any numbers red… no warning") | 1 |
| **Special: budget cascade** | **WeightWatchers** (overage drains Weeklies; daily visual never "fails") | 1 |
| **COULD NOT VERIFY over-state at all** | Noom, Fastic, Bevel, Alma, Calory (main circle), Cal AI (calorie headline) | 6 |

## Semantics note — two grammars, one hard line

**Food-budget grammar:** over = a *fact to report*, with the category trending toward
de-dramatisation — MacroFactor's doctrinal nothing, Lifesum's calm white "KCAL OVER",
WW's cascade that makes "over" structurally impossible until Weeklies run dry, Yazio's
2% grace band, FoodNoms/Cal AI keeping identity colours. The shaming-red of the
2010s-MFP era survives (Yazio, Lose It!, Cronometer) but every post-2020 entrant
verified tonight avoids it.

**Activity grammar:** over = *achievement*. Apple's overlapping lap is a victory lap and
is the ONLY verified second-lap in the survey. No food app draws one — exceeding a
food budget is never a triumph, so borrowing the wrap imports the wrong semantics.
This is why seven rounds of lap treatments on the Suppr ring "never read right"
(commit `b3ced7ad`), and the survey confirms it empirically.

---

## Suppr fit — assessment of the current live treatment

**Current live state** (commit `407bf645`): plum ring caps at full + **45° light-stripe
hash on the overage segment** (from 12 o'clock, spanning the amount past goal), with
the centre verdict grammar ("N OVER" / always-Bonus stat, commits `e3075ec1`/`971ae53b`).
Constraints already burned through tonight: contrasting-colour lap (blob — rejected),
gradient lap (still blob — rejected), same-colour lap + shadow (too quiet, then off —
rejected), pure full ring (rejected — "not what MFP does").

**Honest read against the survey:**

1. **The hash is taxonomy bucket (b) + (c) layered** — ring caps at full (the modal
   category treatment, 5 apps) with a texture marker on the over-span (MFP's grammar,
   the category leader and Suppr's primary refugee source). It is the only treatment in
   the option space that is simultaneously category-conventional in structure and
   MFP-native in detail.
2. **Evidence strength is the weak spot.** The hatch claim rests on Grace's eyewitness
   account (active MFP user, tonight) + Suppr's own 2026-05-24 code comment — which
   says MFP "**used to**" hash. No public screenshot of MFP's over-state was findable
   (Mobbin has no over-day MFP capture; marketing never shows failure; help docs 403).
   If current MFP has dropped the hatch, Suppr is cloning a *legacy* MFP cue — still
   natively legible to long-time MFP users (arguably more so), but worth one
   30-second check in Grace's own MFP app before treating "current" as settled.
3. **Does any verified treatment beat it?** The strongest verified alternative is
   **Lifesum's** calm cap + centre verdict (+ tiny 12-o'clock tick) — quieter, fully
   in-system, two verified-pixel captures. But it is exactly the "pure full ring"
   Grace already rejected for losing the at-a-glance over signal, and its tick is so
   subtle it needs the centre text to carry everything. **Yazio's red shift** is the
   loudest verified treatment but conflicts with Suppr's permission-not-restriction
   positioning, the plum system, and Grace's rejection of colour-based laps.
   **MacroFactor's nothing** is principled but abandons the MFP-refugee legibility bet
   entirely. Nothing verified tonight strictly dominates the hash.

### Recommendation — FOR GRACE'S CALL, not implemented

**Keep the live treatment** (plum cap-at-full + 45° light-stripe hash + centre verdict).
It is the only option that satisfies all of tonight's rejected-constraint set, matches
the category-modal structure (cap at full), and speaks the incumbent's dialect to the
exact audience Suppr is courting — in Sloe material rather than MFP red. One cheap
de-risk: Grace eyeballs current MFP's over-state once (her own account) to pin
"current vs legacy" on the hatch; either answer is survivable, but the doc should
record which it is.

**Alternative A — Lifesum grammar (cap + centre verdict only, delete the hash).**
The quietest category-conventional option; two verified-pixel captures prove it works
at scale. Cost: loses the at-a-glance over signal on the ring itself (centre text
becomes the only carrier), and re-opens the "pure full ring" Grace already rejected
tonight. Pick this only if the hash reads as noise on device over a week of real use.

**Alternative B — hash + amber severity tint** (per the 2026-04 prototype carryover
"over-budget = amber" rule): the stripes render in a warm amber over plum instead of
light-on-plum. Adds a severity channel the pure-texture version lacks. Cost:
reintroduces a second colour into the ring — the exact "blob" failure mode of rounds
1–2 — plus amber-on-plum contrast risk in dark mode, and it desaturates the clean
"MFP grammar in Sloe material" story. Pick this only if real over-days prove the
light-stripe hash too subtle at a glance.

---

*Survey artefacts: raw screenshots cached at `/tmp/overage-survey/` (session-local,
not committed). Mobbin links are canonical screen URLs and stable. App Store
`mzstatic` URLs are version-pinned and may rot when vendors refresh listings — the
descriptions in the table are written to stand without the image.*

---

## DECISION — Grace, 2026-06-10

"Remove the hash; over is just a full circle. They can see they are over
by the words OVER." → Alternative A (the Lifesum/modal grammar): ring
caps at full in plum, centre verdict + chip carry the overage. Hash
removed from the Skia layer; web already matched. The `--ring-overage-*`
web tokens can now be removed (code-quality sweep).
