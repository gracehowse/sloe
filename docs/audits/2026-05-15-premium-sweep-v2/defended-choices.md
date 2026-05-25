# Defended Choices — canonical reference for premium-bar sweep v2

**Pre-prompt to `premium-auditor` at every bucket run.** This file lists the
15 Defended Choices anchored from the 2026-05-12 audit. Each carries: load-
bearing differentiator (the bet), allowed borrows (interaction details that
strengthen without erasing), forbidden borrows (structural collapses that
would erase the bet).

The 2026-05-14 reverts included **two DC erasures** the original audit
missed: F40 erased DC10's calorie-ring 3-state colour rule by collapsing
macro arcs to amber-warm-tint when over-budget; the hero kcal fraction+chip
eroded DC1's ring spine load-bearing read by duplicating the centre value.
Both should have been flagged at proposal review and weren't. This file
exists to make that flagging mechanical.

## How the auditor uses this

1. Read this file before proposing any change to a listed surface.
2. If a proposed change touches a DC, the proposal row's `DC# touched`
   column must include an explicit non-violation statement.
3. If the proposed change matches a *forbidden borrow* pattern for that
   DC, the auditor MUST refuse to propose it.
4. Allowed borrows are pre-approved interaction details — the auditor
   may propose them freely if the proposal doc shows the surface needs
   polish in that area.

---

## DC1 — Multi-ring calorie + macros spine (Today hero)

**Surfaces:** `apps/mobile/components/charts/CalorieRing.tsx`,
`src/app/components/suppr/daily-ring.tsx`

**Load-bearing bet:** 4 nested macro arcs around a calorie centre.
Encoding the **full macro story in the spine** is bolder than every
comparable's "calorie isolated from macros" pattern. Apple Watch's three
nested activity rings prove nested-ring ambient information works.

**Allowed borrows (interaction details):**
- Apple Watch Move ring 200ms ease-out fill animation when meal logged
- Cal AI count-up animation on hero kcal (400ms cubic ease, tabular-nums)
- MacroFactor tabular-nums on every changing number
- Withings light haptic on data update (mobile only)
- Animate macro arcs in as data lands on first log of day

**Forbidden borrows (structural collapses):**
- **Single-arc collapse.** Do not reduce to one ring with macros elsewhere.
- **Hero kcal duplication.** Do not add a static fraction/chip row that
  repeats the value already inside the ring centre (this was the DC1
  erosion reverted on 2026-05-14).
- **Collapse macro arcs to a single warning hue when over-budget**
  (this was F40, reverted 2026-05-14 — see DC10).

---

## DC2 — "What to eat next" 3% fit chip (Today north-star moment)

**Surfaces:** `apps/mobile/components/today/NorthStarBlock.tsx`,
`src/app/components/suppr/north-star-block.tsx`

**Load-bearing bet:** Proactively answers "what should I eat next" with
a single recipe filtered to within 3% of remaining macros. Competitors
can't easily copy — it requires macro spine + recipe library + per-
recipe fit computation working together. The **3% fit chip itself is the
moat**.

**Allowed borrows:**
- Cal AI 64×64 hero recipe image on the card
- Recime multi-line title with line-clamp at 2 (never mid-word ellipsis)
- MacroFactor tappable "Why this recommendation?" disclosure
- Cal AI soft 200ms fade-up on first paint

**Forbidden borrows:**
- **List of candidates instead of single recipe** on partial-day state
  (single-recipe focus is the bet — competing-options drown the moment).
- **Removing the fit % chip** in favour of "Recommended for you" framing.

---

## DC3 — Eat Again card (Today re-log shortcut)

**Surfaces:** `apps/mobile/components/today/TodayEatAgainBanner.tsx`,
`apps/mobile/components/today/TodayEatAgainScroller.tsx`,
`src/app/components/suppr/today-eat-again-banner.tsx`

**Load-bearing bet:** Surface yesterday's meal at the same slot for
one-tap re-log on Today. Better than MFP's "go to history" navigation —
real quality-of-life win.

**Allowed borrows:**
- MacroFactor stacked 2-3 candidates as horizontal scroller (optional)
- Recime recipe-card layout polish when image present

**Forbidden borrows:**
- **Replacing one-tap LOG with multi-step modal** — the speed is the bet.
- **Burying the card below the fold** — it's a Today-hero element.

---

## DC4 — Trust chips on paywall

**Surfaces:** `apps/mobile/app/paywall.tsx`,
`app/pricing/PaywallTrustStrip.tsx`,
`src/lib/landing/paywallTrust.ts`

**Load-bearing bet:** Three explicit guarantees (Cancel anytime · 7-day
refund · Price never changes mid-trial). Directly counters MFP's mid-
trial price-hike trickery. MFP refugees read these and feel relief.

**Allowed borrows:**
- Calm "No price hikes ever" as a fourth chip (if Grace commits long-term)
- Stripe Checkout adjacent placement of guarantees and price

**Forbidden borrows:**
- **Generic "Trusted by N users" social proof.** The specificity is the
  bet — falsifiable specifics, not vibes.
- **Dropping a chip** to "clean up" the strip.

---

## DC5 — Sparse-state weight chart (1-point / 2-point)

**Surfaces:** `apps/mobile/components/progress/WeightChart.tsx`,
`src/app/components/ProgressDashboard.tsx`

**Load-bearing bet:** 1-point shows 28pt weight + "One weigh-in logged"
+ "Add two more to see a trend line" + CTA. 2-point shows solid line +
caption. Both refuse to pretend a trend exists with insufficient data —
better than Withings' floating-dot confusion.

**Allowed borrows:**
- Withings solid line between 2 points (already adopted)

**Forbidden borrows:**
- **Trend-line-from-1-point** (would teach false confidence).
- **Hiding the chart entirely until 7 points** (the sparse-state copy
  IS the moment).

---

## DC6 — Weight-skip path in onboarding

**Surfaces:** `apps/mobile/components/onboarding/steps/weight.tsx`,
`src/app/components/onboarding/steps/weight.tsx`,
`apps/mobile/components/onboarding/steps/reveal.tsx`,
`src/app/components/onboarding/steps/reveal.tsx`

**Load-bearing bet:** "Prefer not to enter" → skipped state → "Actually,
I'll enter it" rollback → `weightSkipped: true` propagates to Reveal's
calibrate-copy fallback. Diversity-inclusion-correct (opt-in, no shame,
real downstream consequence). MacroFactor requires weight.

**Allowed borrows:**
- Withings soft animated illustration on calibrate-copy fallback

**Forbidden borrows:**
- **Requiring weight to advance** (MacroFactor pattern — explicitly
  rejected).
- **Removing the rollback affordance** ("Actually, I'll enter it").

---

## DC7 — Sex step inclusive helper expander

**Surfaces:** `apps/mobile/components/onboarding/steps/sex.tsx`,
`src/app/components/onboarding/steps/sex.tsx`

**Load-bearing bet:** "Which one should I choose?" expander covering
trans / non-binary / GNC users; names the actual math behind
"Prefer not to say" (~166 kcal midpoint). Better than Apple Health's
medical-speak version.

**Allowed borrows:**
- None — already above the bar.

**Forbidden borrows:**
- **Replacing helper expander with a tooltip / info icon** (less
  affordance).
- **Removing the "Prefer not to say" option.**
- **Adding a "gender identity" radio that conflates sex-at-birth with
  identity** (legal/inclusion regression).

---

## DC8 — Streak as calm pip, gated to ≥ 2 days

**Surfaces:** `apps/mobile/components/today/TodayDateHeader.tsx`,
`src/app/components/suppr/today-date-header.tsx`

**Load-bearing bet:** Muted pale-blue background + small flame glyph
(calm pip treatment), gated to `streakDays ≥ 2`. Better than Duolingo's
shouted flame AND better than apps showing "0-day streak" gibberish to
fresh users.

**Allowed borrows:**
- Headspace streak-protected shield glyph on freeze-protected day
- Duolingo-style supportive (not punitive) reset-day copy when streak
  breaks

**Forbidden borrows:**
- **Removing the ≥ 2 gate** (the gate is the bet — no nonsense for
  fresh users).
- **Loud flame / shouting treatment** (would erase the calm voice
  DC12 reinforces).
- **Adding streak loss penalty animations** (anti-DC12 voice).

---

## DC9 — Reset modal soft/hard split

**Surfaces:** `apps/mobile/app/profile.tsx` reset flow,
`src/app/components/suppr/destructive-confirm-dialog.tsx`

**Load-bearing bet:** Two-path split: "Reset targets" (keeps log) vs
"Erase everything" (nukes). Acknowledges the real user state
"I want to start my targets fresh but keep my log" that competitors'
binary "reset all" patterns don't.

**Allowed borrows:**
- Linear bullet ✓/✗ breakdown inside the dialog
- Apple "Type RESET to confirm" gate on Erase Everything path

**Forbidden borrows:**
- **Collapsing to a single "reset" action.**
- **Removing the amber warning-circle + refresh icon** (correct trust
  signal — bare-text dialog reads as casual).

---

## DC10 — Calorie ring 3-state colour rule

**Surfaces:** `apps/mobile/components/charts/CalorieRing.tsx`,
`src/app/components/suppr/daily-ring.tsx`,
plus any element that uses the calorie ring colour mapping

**Load-bearing bet:** 3-state mapping (empty = gradient / under =
success-green / over = destructive-red) on the calorie ring ONLY.
Macros/sodium use amber for over-budget. Destructive red is reserved
for the one place "stop" is the right signal.

**Allowed borrows:**
- None on the rule — apply consistently.

**Forbidden borrows:**
- **Warm-tint or amber-shift the macro inner arcs when over-budget**
  (this was F40, reverted 2026-05-14 — collapses the multi-colour ring
  language).
- **Extending destructive red beyond the calorie ring** (would dilute
  the "one place 'stop' applies" rule).
- **Replacing the empty-state gradient with a flat colour** (gradient
  signals "calibrating", flat colour signals "data").

**Pinned memory:** `feedback_calorie_ring_colour_mapping.md`.

---

## DC11 — Adaptive TDEE in Free tier

**Surfaces:** `apps/mobile/app/targets.tsx`,
`src/app/components/onboarding/steps/reveal.tsx`,
`src/lib/adaptiveTdee.ts`

**Load-bearing bet:** Adaptive TDEE re-calibration from logged intake
in **Free tier**, with `MIN_LOGGING_DAYS` / `MIN_WEIGH_INS` thresholds.
MacroFactor charges $11.99/mo for the same capability.

**Allowed borrows:**
- MacroFactor TDEE trajectory mini-chart on Targets surface
- Tap-to-expand TDEE explainer on Reveal

**Forbidden borrows:**
- **Moving Adaptive TDEE behind paywall** (the Free-tier inclusion IS
  the bet).
- **Hiding the calibration window status** (users need to see "we're
  learning").

---

## DC12 — "Eat well, without overthinking it" calm voice

**Surfaces:** Cross-cutting — landing, onboarding, Today, paywall,
profile, microcopy everywhere. Particularly:
`apps/mobile/components/onboarding/steps/welcome.tsx`,
`apps/mobile/components/progress/LogWeightSheet.tsx`,
`src/lib/nutrition/digest.ts` digestStory variants

**Load-bearing bet:** Anti-shaming, anti-toxic-gamification voice. The
exact reason MFP refugees would switch. Cal AI's "Lose weight with AI"
shouting would erase this positioning advantage.

**Allowed borrows:**
- Headspace supportive moment-of-truth microcopy at high-emotion
  surfaces (post-weigh-in, missed-day)
- Linear direct/functional microcopy at low-emotion surfaces
  (settings, errors)

**Forbidden borrows:**
- **Cal AI shouty growth copy** ("LOSE 10 POUNDS IN 30 DAYS").
- **Punitive streak-loss / missed-day / over-budget copy**
  (anti-shaming is the bet).
- **Aspirational body-shaming hero imagery** on landing/onboarding.

**Clarified 2026-05-25:** "anti-toxic-gamification" forbids the *punitive*
kind (streaks-you-can-break, decay, points-as-pressure, rewards,
leaderboards, missed-day shame copy) — it does **not** forbid shame-free,
reward-only delight. Celebration moments, haptics, interactivity, and
achievements that only ever reward (no decay, no break-penalty) are
**permitted and wanted** (Grace, premium/wow-moments direction). The test:
*does the mechanic punish a missed day?* See
`docs/decisions/2026-05-25-noom-delight-vs-gamification-line.md` and epic
ENG-725. Calm = non-manipulative + shame-free, not flat/joyless.

---

## DC13 — Recipe import from social-video paste-link

**Surfaces:** Recipe import flow on mobile + web, share-extension path

**Load-bearing bet:** Multi-source paste-link (TikTok / Instagram /
YouTube / Web) with USDA-match trust stamp. Strategically distinct from
Recime/Paprika's schema.org expectation — different capability for the
viral-growth bet, not weaker.

**Allowed borrows:**
- Recime real-time skeleton during parse (image + title as they land)
- Recime per-ingredient confidence bar on verify step
- Notion / Linear / Things 3 clipboard-URL auto-detect
- Cal AI narrated parse status

**Forbidden borrows:**
- **Removing non-schema.org source support** to "simplify" import.
- **Replacing USDA-match trust stamp** with a vibe-only "verified"
  badge (specificity is part of the trust bet).

---

## DC14 — Profile dark mode (outlined coloured tiles + amber safety-floor)

**Surfaces:** `apps/mobile/app/profile.tsx` dark-mode rendering,
`apps/mobile/app/targets.tsx` (safety-floor warning)

**Load-bearing bet:** Outlined coloured macro tiles (green / blue /
amber / pink) on near-black canvas + amber safety-floor warning chip
("Below 1,200 kcal. This is under the safety floor we recommend for
adults — consider raising your target"). Strongest dark surface in the
app.

**Allowed borrows:**
- None on the safety-floor pattern itself.
- Replication of the outlined-tile + amber-warning pattern to other
  dark cards (Settings, Membership) is encouraged.

**Forbidden borrows:**
- **Filling the macro tile interiors with solid colour** (outlined IS
  the treatment).
- **Removing the safety-floor warning** to "simplify" Targets.
- **Environment-dependent warning logic** — the warning must render
  consistently in light and dark.

---

## DC15 — UK/EU VAT-inclusive pricing posture

**Surfaces:** `app/pricing/page.tsx`,
`app/pricing/PricingTiersGrid.tsx`,
`src/lib/landing/paywallTrust.ts`

**Load-bearing bet:** VAT-inclusive commitment for UK/EU surfaces.
Compliance + trust signal — most US-headquartered competitors get this
wrong.

**Allowed borrows:**
- Stripe inline VAT line directly under the price digit
- GoCardless region-detection banner for explicit currency switch
- Manual currency switch (£ / € / $) chip row

**Forbidden borrows:**
- **VAT-exclusive display on UK/EU** (compliance regression).
- **Hiding VAT inclusion below the fold** (visible viewport is the P0
  compliance gap).

---

## How to read this file at proposal review (G3)

For every proposal row in `P0/P1/P2-proposal.md`:

1. **Is the surface listed against any DC?** Grep this file for the
   surface path.
2. **If yes, what's the DC's bet?** Read the *Load-bearing bet* line.
3. **Is the proposed change in *Allowed borrows*?** Approve.
4. **Is the proposed change in *Forbidden borrows*?** Reject.
5. **Is the proposed change unlisted but adjacent to the bet?** Require
   an explicit non-violation statement in the proposal row's
   `DC# touched` column. Approve only if the statement is concrete.

This is the mechanical check. The auditor's "selective borrow" rule
runs at audit time; G3 runs this DC check at proposal review time.
Both gates must pass.
