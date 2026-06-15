# Persona session — watch-athlete — 2026-06-14

- **Surface(s):** web (Path C), mobile-web viewport (390×844)
- **Account:** gracehowse+watchathlete@outlook.com (user_id `9ad767c9-…`)
- **Seeded:** yes — `node --import tsx scripts/seed-persona.mts --persona watch-athlete --email gracehowse+watchathlete@outlook.com --reset` (21 full days / 84 journal entries / 10 weigh-ins / 5 library recipes / target 2,900 kcal / goal=maintain / activity=active)
- **Auth path:** C (web email auth). Two unblocks required — see Honest gaps.

## Goals attempted

1. **"Does my target go up on a training day, down on a rest day?"** — **Abandoned/Fail (on web).** The Today target is a static **2,900** with **Bonus 0**; the methodology base is sedentary (see Finding 01), so the only activity lever is a connected-watch bonus, which is unavailable on web (profile: "Apple Health activity on iOS. Not available on web."). Could not be exercised on web; iOS HealthKit response untested (honest gap).
2. **"What does the app think my maintenance is, and does it line up with my watch?"** — **Completed, failed the trust test.** Maintenance shows **2,169 kcal/day (formula estimate)** — far below the ~2,900 the user demonstrably maintains at (flat weight, 21 days). Finding 01.
3. **"Log a big training-day intake; confirm the ring reflects the extra burn."** — **Partial.** The ring correctly reflects eaten (2,749) vs goal (2,900), but "extra burn" never enters: Bonus 0, no source connected. The ring is honest but cannot reflect training because no activity is captured.
4. **"Understand how maintenance is calculated — formula, my data, or my watch?"** — **Completed.** The "How this works" breakdown IS inspectable and names inputs (BMR, multiplier, surplus) — a genuine positive. But it exposes the wrong inputs (sedentary multiplier; surplus framing). Findings 01 + 02.
5. **"Find high-protein recipes for a 190 g protein day."** — **Completed/Pass.** Recipes has a working **"High protein"** filter returning 42–64 g protein recipes; the persona's Library holds 5 genuine high-protein meal-prep recipes (harissa chicken 48 g, overnight oats 32 g, cottage-cheese pasta 30 g, …).
6. **"Is this app respecting my training, or is it a generic calculator?"** — **Verdict: leans generic.** Because activity level "Active" doesn't raise the maintenance base (sedentary 1.2), and a maintain-goal intake is mislabeled as a weight-gain surplus, the data-literate watch-athlete would conclude the app ignores their training. The honest "connect a source" empty state and the inspectable methodology are the redeeming features.

## Findings

### Finding 01 — Maintenance uses Sedentary 1.2 despite activity level "Active"

- **Journey:** Goals 2 & 4 (maintenance + methodology)
- **Screen:** Progress → Maintenance card → "How this works"
- **What I expected:** Active 5×/week athlete (level set to "Active", "Adjust goal for activity" ON), flat weight 21 days at ~2,900 → maintenance ≈ 2,800–3,100 and certainly not sedentary.
- **What happened:** Maintenance = **2,169** via BMR 1,808 **× Sedentary 1.2**. The "Active" Settings control and the card's "from your stats and activity level" copy are both contradicted by the sedentary multiplier.
- **Severity guess:** P1 major
- **Screenshot:** apps/mobile/screenshots/personas/watch-athlete/2026-06-14/05-maintenance-how.png
- **Trust-impact:** yes

### Finding 02 — Maintain-goal target framed as a +731 kcal surplus / 0.66 kg-wk gain

- **Journey:** Goals 2 & 4
- **Screen:** Progress → Maintenance card → "How this works"
- **What I expected:** goal=maintain + flat weight → the app treats ~2,900 as maintenance, not a surplus.
- **What happened:** Breakdown reads "+ your plan surplus 731 kcal = Calorie goal 2,900" and "Projected weekly gain ~0.66 kg." A maintaining user is told they're in a 0.66 kg/week gain surplus — false against their own 21-day flat weight. Root cause is Finding 01 (sedentary base makes true-maintenance intake look like a surplus).
- **Severity guess:** P1 major
- **Screenshot:** apps/mobile/screenshots/personas/watch-athlete/2026-06-14/05-maintenance-how.png
- **Trust-impact:** yes

### Finding 03 — Adaptive maintenance never engages despite met thresholds

- **Journey:** Goal 4
- **Screen:** Progress → Maintenance card
- **What I expected:** 21 days logged + 10 weigh-ins should unlock adaptive (MacroFactor-grade expectation), which would correct 2,169 → ~2,900.
- **What happened:** Still "FORMULA ESTIMATE." Counters below read **Weigh-ins 10/7** and **Logging days 21/21** — both bars full — yet copy says adaptive "will activate once enough data accumulates." Full counters contradict the "not enough data" copy; no adaptive value or ETA shown.
- **Severity guess:** P1 major
- **Screenshot:** apps/mobile/screenshots/personas/watch-athlete/2026-06-14/05-maintenance-how.png
- **Trust-impact:** yes

### Finding 04 — Calorie target cannot respond to activity on web (observation, not filed)

- **Journey:** Goals 1 & 3
- **Screen:** Today → calorie card (Bonus 0) + Activity & energy ("Steps —, Active energy —")
- **What I expected:** target moves with training.
- **What happened:** Today shows an **honest** empty state — "Active calories appear here once a source is connected (Settings → Connections)" — and Bonus 0. This is the *correct* trust posture (no fabricated burn). But on web there is no connection path ("Apple Health activity on iOS. Not available on web."), so Goal 1 is structurally unreachable on web. Not a defect — by-design iOS-led; folded into the report rather than filed. The deeper issue (activity doesn't enter the *base* either) is captured in Finding 01.
- **Severity guess:** P3 / by design
- **Screenshot:** apps/mobile/screenshots/personas/watch-athlete/2026-06-14/02-today-full.png
- **Trust-impact:** no (the empty state is honest)

## Linear

- **Filed:** [ENG-1188](https://linear.app/suppr/issue/ENG-1188) (Findings 01+02 — sedentary multiplier + surplus framing, P1), [ENG-1189](https://linear.app/suppr/issue/ENG-1189) (Finding 03 — adaptive never engages, P1). Both labelled `persona-feedback`.
- **Commented:** ENG-1185 (persona test-harness unblock) — root-caused the "lands on landing not /today" symptom as a `127.0.0.1` vs `localhost` cookie-host mismatch between `auth.setup.ts` and `web-drive.mjs`, plus the persona-account password gap; documented the `WEB_DRIVE_BASE_URL=http://127.0.0.1:3000` workaround and permanent-fix options.
- **Not filed (deliberate):** Finding 04 (by-design web/iOS parity). Date-strip renders hundreds of day buttons (markup smell) — noted here, not persona-relevant enough to file.

## Honest gaps

- **iOS Path A not run.** Metro `/status` on :8082 was unresponsive this session, so the iOS-primary surface was not exercised. The activity-response goals (1 & 3) and any HealthKit-driven maintenance behaviour are therefore untested — these can only be honestly judged on a device/sim with real HealthKit samples (the seeder does not fabricate `activity_burn_by_day` / `workouts_by_day`).
- **Persona account password was wrong.** `gracehowse+watchathlete@outlook.com` existed + was email-confirmed but its password was not the documented `TestPass123!`. I reset it via the Supabase admin API (service role) on this allowlisted test account so Path C could proceed. Other persona accounts likely share this gap — see ENG-1185 comment.
- **Auth-state host mismatch.** Web Path C only worked after pointing web-drive at `127.0.0.1` (see ENG-1185). Default invocation silently renders the unauthed landing page.
- **Whether the sedentary base is intentional** (formula base + watch bonus, to avoid double-counting) vs a bug is unresolved from the UI alone — flagged at confidence 6/10 in ENG-1188 with both interpretations and a reconcile recommendation. No code was read (persona rules).
