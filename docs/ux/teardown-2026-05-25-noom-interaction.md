# Noom interaction teardown — 2026-05-25

**Scope:** Noom's *interaction and feel* layer — typography, palette, motion, onboarding pacing, empty states, and its gamification economy — benchmarked against Suppr's live surfaces. The question this teardown answers: **which of Noom's delight do we borrow, and where exactly is the line we will not cross?**

**Author intent:** this is a senior-design teardown, not a feature-copy list. Noom is ~6× Suppr's price (£94.99 / 2 months ≈ £47.50/mo after a 1-week trial, vs Suppr's £7.99/mo) and it *feels* expensive — calm, editorial, dimensional. We want that feel. We do **not** want the retention machinery it's bolted to, because that machinery is the exact thing MFP refugees are fleeing.

**Calibration (Grace, this session):**
- Serif: *"let the teardown propose."*
- Gamification: *"reconsider light gamification."*
- Depth: *"full interaction teardown → issues."*

**Companion decision:** [`docs/decisions/2026-05-25-noom-delight-vs-gamification-line.md`](../decisions/2026-05-25-noom-delight-vs-gamification-line.md) — the binding gate rule and the streak ruling. Read it alongside this.

**Update (2026-05-25, same day):** Grace raised the gamification ceiling from "one-off confetti only" to **shame-free achievements** (celebration + milestones + achievements + additive progress that only reward, never punish). The gate rule below is unchanged. Premium/wow work now lives as epic **ENG-725** (child issues ENG-719→728), folded into the full-sweep action plan.

---

## TL;DR

Noom's delight is **separable** from its gamification economy at the code and design layer. We borrow the first bucket and refuse the second, governed by one gate:

> **Does the mechanic have a state the user can be punished for not maintaining?**
> Yes → it's economy → refuse. No → it's delight → safe to borrow.

Confetti has no memory; a streak-with-decay does. That single test decides every item below.

**Borrow (delight):** editorial serif on display headings (scoped), progressive text reveal in onboarding, celebration moments + shame-free achievements, per-meal completion feel, calm structured empty states, one hand-drawn human touch on a permission sheet.
**Refuse (economy):** streaks-with-decay, "best week", Seeds/points, rewards/gift-cards, leaderboards.
**Leave alone:** the existing calm streak pip (DC8) — already the right answer; do not extend or remove.

---

## The gate rule (spine of this teardown)

Noom *bundles* delight with economy for business reasons — Seeds drive DAU, DAU drives the upsell surface. That's a business choice, not a design dependency. The two layers come apart cleanly:

- **Delight** decorates an event that already happened. It has no memory, no ledger, no debt. Skip a day and you lose nothing because nothing is being tallied against you.
- **Economy** creates a persistent ledger you can fall behind on. Its emotional engine is *loss-aversion* — it works precisely because a missed day **costs** you. That cost is the product.

Every Noom borrow gets run through the gate before it ships. This is the same discipline as the `defended-choices.md` forbidden-borrows list, just mechanised into one question.

---

## Element-by-element teardown

Format: **Keep from live / Adopt from Noom / Refuse** — each tagged delight (safe) or economy (refuse), each with a concrete verdict.

### A. Typography — editorial serif display headings
- **Noom:** serif on *display type only* ("Explore expert guidance", "Eat healthier", italic flourishes "And we're off", "a more rewarding Noom"). Sans for all body/UI. This is what creates the calm magazine feel.
- **Suppr live (verified):** zero serif anywhere. Commit #311 (`94fb5b7b`, 2026-05-24) stripped serif from landing, sidebar, mobile wordmark, deleted the `--font-serif` token, the mobile serif `Type` scale, Georgia, and all `serifTitle`/`serifDisplay` usages. The [color-direction doc:40](color-direction-noom-lifesum-2026-05.md#L40) says editorial serif belongs on *recipe/detail section titles only; Today stays sans for scan speed* — but that intent was **never wired**, before or after #311.
- **Verdict — ADOPT (selective).** #311 was correct to remove serif from chrome (wordmark/sidebar/UI/Today). It over-reached only by deleting the token entirely, leaving the documented-but-unbuilt editorial use with nothing to build on. Re-introduce a real editorial serif (e.g. Fraunces — not the `ui-serif`/Georgia fallback) as a scoped token, applied **only** to: recipe-detail display titles, recipe/editorial section headings, and the landing hero headline. **Never** wordmark, sidebar, tab chrome, or Today (Today stays sans — scan speed beats editorial there, and both the doc and the prototype-vs-live divergence already settled this).
- **Tag:** delight. Safe.

### B. Palette — soft, warm, low-saturation
- **Noom:** pastel card tints (butter yellow, sage, dusty pink), cream / dark-navy grounds. Calm, not clinical.
- **Suppr live:** **already here.** The 2026-05-19 colour direction shipped cream `#f6f3ee` ground, leaf-green success, golden-amber warning, warm-ink chrome `#1c1916`. Suppr is already calm-warm and editorial — this is a place we *meet or beat* Noom, not trail it.
- **Verdict — KEEP (already done).** Considered and **deferred:** pastel per-slot/per-category *card tints*. Real clutter risk against the "Today screen has no editor" finding from the [daily-loop teardown](teardown-2026-04-28-daily-loop.md); not worth an issue now.
- **Tag:** delight. Safe (and largely banked).

### C. Progressive text reveal / word carousels
- **Noom:** flashes part-one then part-two of a sentence — a pacing device that makes onboarding feel like a conversation, not a form.
- **Suppr live:** absent. Onboarding reveals each step fully formed.
- **Verdict — ADOPT (onboarding only, restrained).** Word/clause-staggered reveal on a *few* key onboarding beats only (welcome, plan-ready, the "you're set" moment) — not every screen. Must respect `prefers-reduced-motion` / `useReduceMotion()`. Restraint is the whole point: over-applied, it's friction; on 2–3 beats, it's warmth.
- **Tag:** delight. Safe.

### D. Motion, haptics, confetti, dimensional icons
- **Noom:** confetti on the "we're off" moment; glossy 3D lightning bolt; animated empty states; a hand-drawn red arrow scribbled onto the Apple Health permission sheet (a lovely human touch).
- **Suppr live:** ring number tweens on log + light haptic on all six meal-add paths (shipped 2026-04-28). No milestone confetti. Flat lucide icons (a *defended* sharp choice). No hand-drawn touches.
- **Verdicts:**
  - **Milestone confetti → ADOPT (one-off, single trigger).** Fire on the **north-star moment**: the first time the "what to eat next" suggestion is accepted and logged. One-shot, dismissible, no running counter behind it. Product-lead's tighter single-trigger recommendation over a trigger-list — keeps confetti from sprawling into Cal-AI-style shouting. Behind flag; respects reduce-motion.
  - **Per-meal completion feel → DONE (ENG-722).** Haptic shipped 2026-04-28; the subtle log-confirm checkmark micro-animation shipped behind `log_confirm_check_v1` (default-ON) — a calm sage check that scale-fades over the Today ring on every successful log, so the core loop *lands* visually as well as in the hand. Reduce-motion → no check; flag off → the old no-animation path (kill switch). Web = CSS keyframe (`.log-confirm-check` in `theme.css`), mobile = Reanimated (`LogConfirmCheck`). Both fire on the single durable-commit funnel — the meal-count rising edge (web) / the `confirmLog` funnel ref (mobile) — so nothing scatters per meal-add path.
  - **3D glossy icons → REFUSE.** Suppr's flat lucide vocabulary is sharper and is a defended choice. Borrowing Noom's dimensional icons would be the conformity trap — copying a comparable's *structural* choice that erases a differentiator.
  - **Hand-drawn human touch → ADOPT (one place, low priority).** A single hand-drawn pointer/scribble on the notification or health-permission sheet. Charming, cheap, distinctive. One surface only — don't make it a system.
- **Tag:** delight. Safe.

### E. Calm empty states
- **Noom:** "Start tracking" pills sitting on dotted baselines; animated empty states that feel intentional, not broken.
- **Suppr live:** functional but plain. #311 already nudged one empty state toward "calm centered column, sans headline, ghost link."
- **Verdict — ADOPT.** Structured dotted-baseline empty states on the surfaces a new user hits cold: Discover (near-empty for new users — already a sweep finding), Plan (no plan yet), weight chart (no weigh-ins). Calm and inviting, never punitive, never a guilt nudge.
- **Tag:** delight. Safe.

### F. Gamification economy — streaks / Seeds / rewards
- **Noom:** daily streaks, Seeds (a points currency), gift-card Rewards redeemed with Seeds.
- **Suppr live:** a single calm streak **pip** (DC8) — passive, gated to ≥2 days, no decay, no reset ceremony, no break-penalty animation, no notification. Rated AT BAR / BETTER THAN BAR by the 2026-05-15 premium audit. No points. No rewards.
- **Verdict — REFUSE the economy; KEEP the pip.** This is the wedge. MFP's April-2026 redesign *added* streaks and that is part of what's driving the exodus we're trying to capture; importing Noom's economy would torch the sharpest line in the positioning ("tracking that doesn't shame you"). The existing pip survives the gate **only because** it was engineered to defeat its own loss-aversion engine — it stays exactly as-is. Do not extend it toward decay/"best week" (that moves the line backwards); do not remove it (it's a live differentiator vs MFP's broken "0-day streak").
- **Tag:** economy. **Refuse.** (Pip is the sole permitted counter.)

### G. Pricing posture (intel, not a borrow)
- **Noom:** ~£47.50/mo after a 1-week trial. Suppr: £7.99/mo.
- **Use:** reinforces the wedge — *calm + premium feel, honest cheap price*. Feeds landing/monetisation copy ("the calm, premium tracker — at a tenth of Noom's price"), not a teardown issue. Hand to monetisation-architect + copy-reviewer when the landing lead message (sweep decision D-07) is settled.

### H. nouri (secondary reference)
- A second calm reference Grace added — minimal, near-serif, Oura/Whoop-fuelled. Its **aesthetic** folds into buckets A/B/E above. Its **wearable-integration** angle is a separate thread (HealthKit/wearable import) and is explicitly *out of scope* for this teardown — log it as its own opportunity, don't entangle it here.

---

## Proposed issues → Linear

All visual/structural → ship behind `isFeatureEnabled` flag, HTML prototype (web + mobile, iPhone frame) before production code, `prefers-reduced-motion` respected, before/after captures on web **and** mobile. None are launch-blockers (the viral-hook and VAT items already own that lane); all live under **Surface polish**.

| # | Issue | Surface / project | Effort | Priority |
|---|---|---|---|---|
| 1 | Re-introduce scoped editorial serif token (recipe/detail display headings + landing hero only; never chrome/Today) | Landing + Marketing / Recipes tab | M | P2 |
| 2 | Progressive text reveal on 2–3 key onboarding beats (reduce-motion safe) | Onboarding + Auth | M | P2 |
| 3 | One-off milestone confetti on north-star accept (single trigger, no counter) | Today tab | S–M | P2 |
| 4 | Log-confirm checkmark micro-animation (haptic already shipped) — **SHIPPED** ENG-722 (flag `log_confirm_check_v1`, default-ON) | Today tab | S | P3 |
| 5 | Calm structured (dotted-baseline) empty states — Discover / Plan / weight chart | Surface polish (multi) | M | P3 |
| 6 | One hand-drawn human touch on a permission sheet | Onboarding + Auth | S | P3 |

**Refused / not issues (recorded so they're not relitigated):** streaks-with-decay, "best week", Seeds/points, rewards/gift-cards, leaderboards, 3D glossy icons, pastel per-slot card tints (deferred — clutter risk).

---

## Verified against captured Noom/nouri frames (2026-05-25)

The 16 reference screenshots (Downloads, resized into `/tmp/noom-resized/`) were read directly. Frame-by-frame, they confirm and sharpen the prose teardown:

- **Serif is a Noom signature, not generic (element A).** Confirmed on three display headings with *italic flourishes*: "Introducing a more *rewarding* Noom", "Let's get *started*", "And we're *off*". Body/UI is sans throughout. The nouri frames, by contrast, are **all bold sans with an orange accent** — so editorial serif is specifically Noom's calm-premium lever, and adopting it (scoped) is a differentiator, not a me-too.
- **Milestone confetti confirmed (element D).** "And we're *off* — Let's build healthy habits together!" on a dark navy ground with scattered gold confetti — a one-off onboarding celebration. This is exactly the model for ENG-721 (our analog trigger = north-star accept).
- **Hand-drawn human touch confirmed (element D).** A red hand-drawn looping arrow points at "Turn On All" on the literal Apple Health permission sheet ("Track your activity automatically", serif heading). ENG-724 is precisely targeted.
- **Dotted-baseline empty states confirmed (element E).** Noom's Health tab shows "Calories → Start tracking" and "Weight → Start tracking" as pills sitting on dashed baselines, with serif section headings (Calories / Lessons / Weight) over sans body. ENG-723 is precisely targeted.
- **The refused economy confirmed (element F).** The "1 day streak" screen (glossy 3D lightning, M–S dot row, *"Complete a healthy habit in Noom each day to keep your streak going"*, "I'm committed" CTA) and the Streaks/Seeds/Rewards (Amazon + Starbucks gift-card) card are the exact loss-aversion machinery the gate rejects. The streak copy *"keep your streak going"* is the punitive-counter tell in plain sight.
- **Pricing confirmed (element G):** Apple Pay sheet shows "1-week free trial → £94.99 every 2 months". ~6× Suppr.
- **Pastel card tints (deferred) — nuance.** Noom's "Success kit" content library uses butter/sage/dusty-pink category card tints *well* — but on a browse/library surface, not on its dense daily screen. Stays deferred for Suppr's Today (clutter risk holds), but it's a more defensible borrow on Discover/library if revisited.

Still capture-gated on the **Suppr** side before each issue moves to design (HTML prototype, gate G3.5): current Suppr onboarding flow (ENG-720), recipe-detail + landing hero (ENG-719), and the current Discover/Plan/weight-chart empty states (ENG-723) — so the "after" prototypes match real "before" frames.
