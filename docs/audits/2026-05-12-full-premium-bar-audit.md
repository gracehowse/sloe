---
date: 2026-05-12
author: premium-auditor (sub-agent fan-out, main-thread synthesis)
method: Pixel-grounded — Maestro + Playwright captures + TestFlight beta feedback. Per-feature judgement against named best-in-class comparables. Code consulted only to verify documented carve-outs and testID anchors.
scope: 13 groups — A. Landing & marketing / B. Onboarding / C. Auth & account / D. Mobile Today / E. Mobile Plan / F. Mobile Recipes / G. Mobile More-Settings-Profile / H. Mobile Progress (live-branch focus) / I. Paywall / J. Mobile stack screens / K. Web product surfaces / L. Mobile web / M. Cross-cutting
screenshot_sources:
  - apps/mobile/screenshots/latest/ (247 PNGs — light + dark, web desktop + mobile-web, mobile native)
  - docs/testflight-feedback/data/screenshots/ (201 JPGs from real beta users, 183 batch dirs — used for live-signal cross-check)
reference_set:
  canonical_eight: MyFitnessPal, Lose It!, Cronometer, MacroFactor, Cal AI, Paprika, Recime, Honeydew
  per_feature_comparables_used:
    weight_chart: Withings (priority), Apple Health, Oura, Strava, MacroFactor
    food_log: MyFitnessPal (logging speed), MacroFactor (macro spine), Cal AI (photo log), Cronometer (data density)
    recipe_import: Recime, Paprika, Honeydew, Crouton, Mela
    plan_grid: Honeydew, Recime, Paprika, Mealime
    paywall: Calm, Headspace, Cal AI, Duolingo Super
    onboarding: Cal AI, Headspace, Duolingo, Linear, Stripe Atlas
    landing: Linear, Vercel, Notion, Stripe, Cal AI, Headspace
    settings: Linear, Apple iOS Settings, Stripe Dashboard
    auth: Linear, Stripe, Notion, Apple Health
    fasting: Zero
    shopping: AnyList
    barcode: MyFitnessPal
    mobile_web: Linear mobile web, Vercel mobile web, Notion mobile web
verdict_scale: AT THE BAR | CLOSE | BELOW | EMBARRASSING (no hedging — politeness inflation is a fail per agent definition)
project_context_respected:
  - Calorie ring 3-state colour mapping (empty=gradient / under=success-green / over=destructive-red) — overrides prototype on the calorie ring only
  - Documented intentional divergences NOT flagged as drift: pricing default (web monthly / mobile annual), Move-meal mobile-only, Recipe Go Public web-only, onboarding Welcome copy
  - Canonical competitor set + MFP-exodus posture
  - Prototype-as-reference, mix-and-match (never carte-blanche flip)
live_branch_focus: claude/weight-all-data-list — Mobile Progress group H gets the densest treatment (weight chart vs Withings is the canonical worked example)
---

# Premium-bar audit — Suppr (2026-05-12)

> **The question this audit answers:** for every Suppr surface, is it as good as the single best app in the world that does this specific feature? If no, what would it take to get there?
>
> **The output:** verdict + reasons + upgrades per feature, and a refuse-to-pass list that gates ship.

This document is being composed section-by-section as the per-group judgements complete. Executive summary lands last (it depends on the per-group verdicts). Look to the **per-feature cards** below for the substance; the executive summary is the headline.

---

## Executive summary

**Audit posture:** Two-axis verdict per surface — **Concept** (better/equal/worse than the named comparable) separate from **Execution** (strong/solid/weak vs the ideal of our chosen approach). Headline tier combines them:

- **BETTER THAN BAR** — concept exceeds the comparable; only refinement remains
- **AT BAR** — concept matches or exceeds the comparable, execution is strong
- **CLOSE** — concept right, execution gaps
- **BELOW** — wrong concept or significant execution gap
- **EMBARRASSING** — broken, harmful, or trust-damaging

**Two output lists:** (a) **Refuse-to-pass** — surfaces blocked from ship until fixed. (b) **Defended Choices** — surfaces where Suppr exceeds the comparable and should NOT be conformed to it; instead, selectively borrow specific interaction details from comparables to polish execution while keeping the differentiator.

### Surface group verdicts at a glance

| Group | Surface | Headline verdict |
|---|---|---|
| A | Landing & marketing | MIXED — `/whats-new` EMBARRASSING; `/pricing` BELOW (P0 VAT compliance — concept right, execution missing) |
| B | Onboarding | CLOSE — Sex AT BAR (**BETTER concept** vs Apple Health); Weight AT BAR (**BETTER concept** vs MacroFactor); Reveal BELOW (concept gap vs Cal AI) |
| C | Auth & account | CLOSE web; BELOW mobile native (login route audit needed) |
| D | Mobile Today | MIXED — calorie ring **BETTER THAN BAR (concept) × WEAK (execution)**; "What to eat next" **BETTER THAN BAR**; macro tiles AT BAR; Eat Again **BETTER THAN BAR**; web parity EMBARRASSING |
| E | Mobile Plan | BELOW — Move-meal CLOSE; web Plan EMBARRASSING (no route) |
| F | Mobile Recipes/Import | BELOW — Recipe verify EMBARRASSING; web Recipes EMBARRASSING |
| G | Settings/Profile | CLOSE — Profile dark mode **BETTER THAN BAR** (safety-floor warning) |
| H | Mobile Progress (LIVE BRANCH) | CLOSE — Weight chart CLOSE post-2026-05-11 rebuild; sparse-state weight chart **BETTER THAN BAR** vs Withings |
| I | Paywall/billing | EMBARRASSING — "Subscriptions unavailable"; trust chips on paywall are **BETTER THAN BAR** (real moat) |
| J | Stack screens | MIXED — Import shared AT BAR; Food search EMBARRASSING |
| K | Web product (authed) | EMBARRASSING — SPA routing |
| L | Mobile web | EMBARRASSING — same routing + cookie banner |
| M | Cross-cutting | BELOW — dark coverage + tab order + capture pipeline |

**The 5 worst surfaces (refuse-to-pass priorities):**
1. Mobile paywall — "Subscriptions unavailable" banner blocks conversion
2. Web authed routing — every surface lacks real URL
3. Recipe verify step — generic spinner blocks viral growth lead
4. Web Recipes — `/recipes`, `/library`, `/discover` all 404
5. Reveal step in onboarding — no anticipation, no math, no "what happens next" (the activation north-star moment is missing)

**The 5 best surfaces (defended choices):**
1. **Multi-ring calorie + macros spine** — Apple Watch precedent; full macro story encoded in the spine
2. **"What to eat next" with 3% fit chip** — answers a question MFP/Cronometer don't even pose
3. **Trust chips on paywall** — direct counter to MFP's mid-trial price-hike trickery
4. **Sparse-state weight chart** (1 / 2-point states) — better than Withings per agent's own admission
5. **Profile dark mode** (outlined coloured tiles + amber safety-floor warning) — strongest dark surface in the app

---

## Defended Choices — where Suppr exceeds the comparable

For each item below: **what we keep** (the load-bearing differentiator), **selective borrows** (specific interaction details from comparables that fit and would strengthen execution without erasing the differentiator), **what we still polish** (execution gaps in our chosen approach — not gaps relative to the comparable's approach).

Each borrow runs through the Selective Borrow Decision Rule: (1) voice fit, (2) doesn't erase the differentiator, (3) interaction detail not structural choice, (4) named precisely, (5) platform noted.

### DC1 — Multi-ring calorie + macros spine (Today hero)

**Concept verdict:** BETTER than MacroFactor / MFP / Cal AI's "calorie isolated from macros" pattern.
**Headline:** BETTER THAN BAR × execution WEAK.

**What we keep:**
- 4 nested macro arcs around a calorie centre. Apple Watch's three nested activity rings prove nested-ring ambient information works.
- Encoding the **full macro story in the spine** is bolder than every comparable and is the visual signature of a macro-tracker-spine-first product. **Do not collapse to single arc.**

**Selective borrows from comparables:**
- **Apple Watch Move ring — 200ms ease-out fill animation when activity logged** → apply to each macro arc when a meal is logged (passes: voice ✓ / non-erasing ✓ / interaction ✓ / named ✓ / mobile + web ✓)
- **Cal AI — count-up animation on hero kcal number** (400ms cubic ease, tabular-nums) → apply to the calorie centre (passes all)
- **MacroFactor — tabular-nums on all changing numbers** so "1,822" and "1,244" share the same width → apply to hero kcal + delta chip + macro arc legends
- **Withings — light haptic on data update** (mobile only) → fire `Haptics.selectionAsync()` on every log (passes all)
- **Apple Watch — over-target rings warm-tint as a reinforcement** → on over-budget, ALL macro arcs warm-shift (not just the outer ring goes red) so the over signal reinforces rather than dilutes (passes all)

**What we still polish:**
- Macro arcs are too thin to read as macros at glance — bump stroke weight so the encoded info is legible
- Add a small `1,822 / 1,600` + delta chip in the ring centre under the kcal number — answers "am I over or under?" without an extra "Why this number?" link
- **Drop "Why this number?" link from default state** — long-press on the ring opens the explainer instead. The link signals low confidence in the number; long-press signals depth
- Empty-state ring should use the gradient (per calorie-ring 3-state mapping) — currently confirmed correct in dark `dark-01`, verify in light too
- Animate the macro arcs in as data lands during the first log of the day (Apple Watch ring-fill pattern)

**Open questions for `ui-product-designer`:**
- Should "burn / activity adjusted" surface as a thin sub-ring (Apple Watch fourth-ring pattern) or stay on the deficit pill?
- Over-budget warm-tint hue — destructive red for the outer calorie ring (per project rule) but what hue for the macro arcs? Amber matches the macro over-budget rule.

---

### DC2 — "What to eat next" with 3% fit chip (Today north-star moment)

**Concept verdict:** BETTER than MacroFactor "Recommended foods" / Cal AI "Try this" / MFP's search-only model. Suppr proactively answers "what should I eat next" with a single recipe filtered to within 3% of remaining macros. Competitors can't easily copy this — it requires the full macro spine + recipe library + per-recipe fit computation working together.

**Headline:** BETTER THAN BAR × execution SOLID (close to strong).

**What we keep:**
- The 3% fit chip itself — the moat
- Single-recipe focus (not a list) on Today empty/partial-day state
- Voice-correct copy ("Fits your remaining 1132 kcal")
- "Example" / illustrative framing on empty state (honesty)

**Selective borrows from comparables:**
- **Cal AI — 64×64 hero recipe image on the card** (passes: voice ✓ / non-erasing ✓ / interaction visual ✓ / named ✓ / mobile + web ✓)
- **Recime — multi-line title with line-clamp at 2, never mid-word ellipsis** → fixes "Salad & Stic…" truncation (passes all)
- **MacroFactor — tappable "Why this recommendation?" disclosure** that surfaces the `northStarSuggestion.ts` reasoning → builds trust with refugees who left MFP because they didn't trust suggestions (passes all)
- **Cal AI — soft 200ms fade-up on first paint** so the card lands as a moment, not an inert element

**What we still polish:**
- Title truncation (mid-word ellipsis is unacceptable; multi-line wrap or shorter target)
- Format consistency: collapse "Fits your remaining 1132 kcal" + chip + macro line into one row — three ways of saying the same fit-thing
- Unify Log verb across surfaces — currently "Log it" here, "LOG" on Eat Again

**Open questions:** Single candidate (Cal AI) or 3 (MacroFactor)? Empty state when fit% is bad (>10%) — hide entirely or downgrade to "best available"?

---

### DC3 — Eat Again card (Today re-log shortcut)

**Concept verdict:** BETTER than MFP's "go to history" navigation. Surfacing yesterday's meal at the same slot for one-tap re-logging on Today is a real quality-of-life win.

**Headline:** BETTER THAN BAR × execution SOLID.

**What we keep:**
- Eat Again card concept on Today (vs MFP requiring history nav)
- "EAT AGAIN" eyebrow + meal name + kcal + macros + slot ("into Dinner") + one-tap LOG

**Selective borrows from comparables:**
- **MacroFactor — saved-meals + frequent-foods density treatment** → consider stacking 2-3 Eat Again candidates (yesterday's breakfast, lunch, dinner) as a horizontal scroller (passes all, optional)
- **Recime — recipe-card layout polish** (corner radius, image proportions) when image is present

**What we still polish:**
- Mid-word title truncation ("Salad & Stic…") — same fix as DC2
- Macro format unification across surfaces: pick `698 kcal · 22g P · 95g C · 27g F` or `698 kcal · P 22g · C 95g · F 27g` and apply everywhere
- Unify Log verb — currently "LOG" here, "Log it" on DC2

---

### DC4 — Trust chips on paywall (Cancel anytime · 7-day refund · Price never changes mid-trial)

**Concept verdict:** BETTER than MFP / Cal AI / MacroFactor — directly counters MFP's mid-trial price-hike trickery. MFP refugees will read these and feel relief.

**Headline:** BETTER THAN BAR × execution SOLID (the chips work; the paywall surface around them is broken — see Refuse-to-Pass).

**What we keep:**
- Three explicit guarantees as chips above the price card
- Green shield glyph on each (trust signal)
- Wording is specific and falsifiable ("in-app" not "anytime"; "7-day" not "satisfaction guarantee")

**Selective borrows from comparables:**
- **Calm — a fourth chip "No price hikes ever"** if Suppr commits to that long-term (passes all if Grace commits)
- **Stripe Checkout — adjacent placement of guarantees and the price** (currently chips are above the hero card; consider moving inline with the price so the trust-statement attaches to the number)

**What we still polish:**
- Chip strings differ per platform — web "Cancel anytime in-app" is wrong for Stripe-web subscribers (they'd cancel via Stripe portal). Use platform-correct copy
- Dark-mode contrast on the green check glyphs (verify against AA)

---

### DC5 — Sparse-state weight chart (1-point and 2-point states)

**Concept verdict:** BETTER than Withings. Withings shows a single dot floating in empty space and confuses new users; Suppr renders the weight at 28pt + "One weigh-in logged · Add two more to see a trend line" + real CTA.

**Headline:** BETTER THAN BAR × execution STRONG (1-point); SOLID (2-point — dashed-line teaches wrong concept).

**What we keep:**
- Single weight rendered at 28pt + "One weigh-in logged" + "Add two more to see a trend line" copy + CTA (the whole pattern)
- Honest framing: don't pretend a trend exists with insufficient data

**Selective borrows:**
- **Withings — solid line between 2 points** (Withings draws solid even at 2 points; dashed reads as "uncertain data" which is wrong messaging) → keep the caption but switch the line stroke to solid

**What we still polish:**
- The 2-point state's dashed line teaches uncertainty incorrectly. Solid line + the existing caption is clearer

---

### DC6 — Weight-skip path in onboarding (opt-in, undoable, downstream consequence)

**Concept verdict:** BETTER than MacroFactor (requires weight entry).

**Headline:** BETTER THAN BAR × execution STRONG.

**What we keep:**
- The whole pattern: "Prefer not to enter" → skipped state → "Actually, I'll enter it" rollback → `weightSkipped: true` state propagates to Reveal's calibrate-copy fallback
- Diversity-inclusion-correct: opt-in, no shame, real downstream consequence ("we'll calibrate from your meal logs over the first 2 weeks")

**Selective borrows:**
- **Withings — soft animated illustration on the calibrate-copy fallback** so the user feels the calibration path is a *better* version, not a punitive one (heartbeat / log-incrementing icon)

**What we still polish:**
- The current `targets == null` fallback in Reveal reads as a single line of tertiary text — promote with the illustration above + a one-line "Your plan calibrates as you log"

---

### DC7 — Sex step inclusive helper expander

**Concept verdict:** BETTER than Apple Health's medical-speak version. Speaks plainly to trans / non-binary / GNC users without clinical framing.

**Headline:** BETTER THAN BAR × execution STRONG.

**What we keep:**
- "Which one should I choose?" expandable explainer covering trans + non-binary + GNC users
- "Prefer not to say — Uses a midpoint estimate (~166 kcal between sexes)" — names the actual math
- Privacy footer with shield glyph

**Selective borrows:**
- None — this is already at the bar Apple Health hasn't reached

**What we still polish:**
- Mirror this expander-pattern on the Age step (per refuse-to-pass item — Age currently lacks the helper)

---

### DC8 — Streak as calm pip, gated to `streakDays ≥ 2`

**Concept verdict:** BETTER than Duolingo's shouted flame AND better than apps that show "0-day streak" / "1-day streak" gibberish to fresh users.

**Headline:** BETTER THAN BAR × execution STRONG.

**What we keep:**
- Gating (only renders ≥ 2 days — no nonsense for fresh users)
- Muted pale-blue background + small flame glyph (calm pip treatment)
- Position top-right doesn't compete with hero ring

**Selective borrows:**
- **Headspace — streak protected state** with a small shield glyph when freeze-protected day fires (Suppr has `streakFreeze` in code, surface it visually)
- **Duolingo — supportive reset-day copy** when a streak breaks (not punitive); design the copy explicitly

**What we still polish:**
- Move chip into week-strip row near "Today" pill once header clutter is resolved (minor)
- Confirm dark-mode tint stays brand-blue (not amber/red)

---

### DC9 — Reset modal soft/hard split

**Concept verdict:** BETTER than competitors' binary "reset all" patterns. The split — "Reset targets" (keeps log) vs "Erase everything" (nukes) — is genuinely thoughtful. "I want to start my targets fresh but keep my log" is a real user state competitors don't acknowledge.

**Headline:** BETTER THAN BAR × execution SOLID.

**What we keep:**
- The two-path split itself
- Amber warning-circle + refresh-icon (correct trust signal)
- Plain-text Cancel at the bottom (doesn't compete)

**Selective borrows:**
- **Linear — bullet-style ✓/✗ breakdown inside the dialog** so the user can audit what survives and what dies (replace the dense 60-word paragraph) — passes all
- **Apple — "Type RESET to confirm" gate on the Erase Everything path** — passes all, named precisely (one extra input field, hardcoded match)

**What we still polish:**
- Reformat body paragraph as scannable bullets (Linear pattern)
- Add type-confirm on Erase Everything
- Add "Undo within 24h" footnote if the data is soft-deleted (verify with backend)

---

### DC10 — Calorie ring 3-state colour rule (gradient / green / red)

**Concept verdict:** BETTER than MacroFactor's neutral ring or Cronometer's single-colour. Suppr is saying "red is reserved for the ONE place 'stop' is the right signal." Smart restraint, not drift from prototype.

**Headline:** BETTER THAN BAR × execution STRONG (where applied correctly) / WEAK (where it's missing — see Calories drill-down).

**What we keep:**
- The 3-state mapping itself (empty=gradient / under=success-green / over=destructive-red)
- The carve-out — the calorie ring is the ONLY place destructive red applies; macros/sodium use amber

**Selective borrows:**
- None on the rule itself — apply it consistently

**What we still polish:**
- Calories This Week bar chart in Progress drill-down currently uses amber for both under and over — fix to honour 3-state mapping (this lands in refuse-to-pass)

---

### DC11 — Adaptive TDEE in Free tier

**Concept verdict:** BETTER than MacroFactor's positioning (they charge $11.99/mo for adaptive TDEE). Suppr puts it in Free + 2-week calibration window.

**Headline:** BETTER THAN BAR × execution SOLID; **marketing is UNDER-SOLD.**

**What we keep:**
- Adaptive TDEE re-calibration from logged intake (per `adaptiveTdee.ts` thresholds: `MIN_LOGGING_DAYS`, `MIN_WEIGH_INS`)
- Free-tier inclusion

**Selective borrows:**
- **MacroFactor — TDEE trajectory mini-chart** on Targets surface (would replace static gradient ring with a live trajectory)

**What we still polish:**
- Surface "Adaptive TDEE" callout on the landing page Free-tier card (currently not differentiated from MFP-style static TDEE in copy)
- Show maintenance trajectory chart on Targets surface
- Tap-to-expand TDEE explainer on Reveal (currently one-liner)

---

### DC12 — "Eat well, without overthinking it" calm voice

**Concept verdict:** BETTER for the target cohort (MFP refugees fleeing toxic gamification). Cal AI's "Lose weight with AI" shouting would erase Suppr's positioning advantage.

**Headline:** BETTER THAN BAR × execution STRONG.

**What we keep:**
- Mobile Welcome headline "Eat well, without overthinking it."
- Anti-shaming voice across the product
- "Calm pip" streak treatment (DC8)
- Profile safety-floor warning copy ("Below 1,200 kcal. This is under the safety floor we recommend for adults — consider raising your target")

**Selective borrows:**
- **Headspace — supportive moment-of-truth microcopy** at high-emotion surfaces (post-weigh-in, missed-day) — extend Suppr's calm voice into these moments
- **Linear — direct, specific, functional microcopy** at low-emotion surfaces (settings, errors)

**What we still polish:**
- Past-tense voice rule consistency ("Your week — down 0.7 kg" → "Last week: down 0.7 kg")
- Web headline "Join the Suppr Club." is a separately-documented carve-out — defended on its own terms but consider whether the "Club" frame survives if rebrand happens

---

### DC13 — Recipe import from TikTok/Instagram/YouTube paste-link

**Concept verdict:** DIFFERENT (likely better for the viral-growth bet) — Recime/Paprika still expect schema.org HTML. Suppr supporting social-video sources directly is strategically distinct, not weaker.

**Headline:** BETTER THAN BAR × execution WEAK (the capability is there; the entry point + verify-step UX is broken — see refuse-to-pass).

**What we keep:**
- Multi-source paste-link (TikTok / Instagram / YouTube / Web)
- iOS share-extension path
- The post-parse "matched against USDA" trust stamp

**Selective borrows:**
- **Recime — real-time skeleton during parse** showing parsed image + title as they land (vs Suppr's blank-spinner verify step)
- **Recime — per-ingredient confidence bar** on the verify step
- **Notion / Linear / Things 3 — clipboard URL auto-detect on app foreground** offering "Import this recipe?" toast (passes all)
- **Cal AI — narrated parse status** ("Reading recipe… Matching ingredients… Calculating macros…")

**What we still polish:**
- Promote "Import from a link" to permanent first card on Discover (currently only in loading state)
- Make "+ Create" on Library a multi-source action sheet (paste / scan / from-scratch)
- Auto-detect clipboard URLs on app foreground
- Re-build the verify step with skeleton + status narration + cancel + timeout (this is on refuse-to-pass)

---

### DC14 — Profile dark mode (outlined coloured tiles + amber safety-floor warning)

**Concept verdict:** BETTER than every other Suppr dark surface; arguably better than MacroFactor's targets surface (safety-floor warning is a real safety + trust posture move).

**Headline:** BETTER THAN BAR × execution STRONG.

**What we keep:**
- Outlined coloured macro tiles (green / blue / amber / pink) on near-black canvas
- Amber safety-floor warning chip ("Below 1,200 kcal. This is under the safety floor…")

**Selective borrows:**
- None on the safety-floor pattern itself

**What we still polish:**
- **Same numeric input (1132 kcal) shows safety warning in dark but NOT in light.** Environment-dependent warning logic is a bug, not a theme difference — fix to render consistently
- Replicate the outlined-coloured-tile + amber-warning-chip pattern on **other dark cards** (Settings cards, Membership card) to lift the rest of dark mode

---

### DC15 — UK/EU VAT-inclusive pricing posture

**Concept verdict:** BETTER than US-headquartered competitors (MFP, MacroFactor, Cal AI) who get this wrong for UK/EU customers.

**Headline:** BETTER THAN BAR (concept) × WEAK (execution — line not visible in viewport on pricing — P0 compliance gap).

**What we keep:**
- VAT-inclusive commitment for UK/EU surfaces (compliance + trust signal)
- `regionCurrency: "GBP" | "EUR" | "USD"` code-level support in `PricingTiersGrid.tsx`
- Stripe Tax inclusive mode

**Selective borrows:**
- **Stripe — inline VAT line directly under the price digit** ("£7.99/mo · price includes any applicable VAT")
- **GoCardless — region-detection banner** for explicit currency switch

**What we still polish:**
- **Surface the inclusive-VAT line in the visible viewport** on UK/EU detection (this is on refuse-to-pass — P0 compliance, not a tier debate)
- Expose manual currency switch (£ / € / $) chip row

---

## Defended Choices → influence-adoption summary table

| # | Defended | What we keep | Top borrow (named) | Source |
|---|---|---|---|---|
| DC1 | Multi-ring spine | 4 nested macro arcs around calorie centre | 200ms ease-out ring-fill animation on log | Apple Watch Move ring |
| DC2 | "What to eat next" 3% fit chip | The chip + single-recipe focus | 64×64 hero recipe image on card | Cal AI |
| DC3 | Eat Again on Today | One-tap re-log without history nav | Multi-line title + macro-format unification | Recime |
| DC4 | Paywall trust chips | 3 explicit guarantees as chips | Inline placement adjacent to price | Stripe Checkout |
| DC5 | Sparse weight-chart states | Hand-holding 1-point + 2-point copy | Solid line between 2 points | Withings |
| DC6 | Weight-skip path | Opt-in + undoable + downstream consequence | Soft animated illustration on calibrate-copy | Withings |
| DC7 | Sex step helper expander | Inclusive plain-English copy | (none — already at bar) | — |
| DC8 | Streak calm pip | Gating + muted pale-blue + flame glyph | Shield glyph on freeze-protected day | Headspace |
| DC9 | Reset modal soft/hard | Two-path split with amber circle | Bullet ✓/✗ breakdown + type-confirm | Linear / Apple |
| DC10 | Calorie ring 3-state | The mapping (gradient/green/red, calorie ring only) | (none — apply consistently) | — |
| DC11 | Adaptive TDEE in Free | Re-calibration from logged intake, Free tier | TDEE trajectory mini-chart | MacroFactor |
| DC12 | Calm voice | Anti-shaming, supportive microcopy | Moment-of-truth supportive microcopy | Headspace |
| DC13 | Multi-source paste import | TikTok/Instagram/YouTube paste-link | Real-time parse skeleton + confidence bar + clipboard auto-detect | Recime / Things 3 |
| DC14 | Profile dark mode | Outlined tiles + safety-floor warning | (none — replicate to other dark cards) | — |
| DC15 | UK/EU VAT-inclusive | Compliance + trust | Inline VAT line under price + currency switch | Stripe / GoCardless |

---

## Late-add finding (2026-05-12, Grace cohort) — Settings → "Refresh my plan" reuses the onboarding Welcome screen

**Where:** Mobile native. Triggered via **More → Settings → "Refresh my plan"** in `apps/mobile/components/settings/SettingsBundleContent.tsx:916` (`handleRefreshPlan`). Sets `onboarding_completed: false`, clears the persisted onboarding draft, sets the `suppr.reset-plan-pending-prompt` AsyncStorage flag, and routes to `/onboarding`.

**Symptom (pre-fix):** A signed-in user resetting their plan landed on the **first-impression onboarding Welcome screen** — full marketing sell ("Eat well, without overthinking it." headline, floating "Example · Sheet-pan chicken from instagram.com" tile, "USDA-backed nutrition" pill, "Get started" CTA, and most confusingly **"Have an account? Sign in"** as a tertiary link). The user had no signal they were in a plan-refresh flow — the screen looked identical to a brand-new sign-up. Subsequent body-stats / Goal / Strategy steps then looked identical to a fresh signup too, with no indication the user was just refreshing their existing plan.

**Comparable / bar:** **Apple Watch — Health "Update Activity Goals" flow.** A user-initiated goal change re-asks the relevant questions but never re-shows the first-impression sell, never asks the user to sign in, and surfaces a clear header ("Update your goals") so the user knows what flow they're in. **Stripe Atlas re-onboarding** does the same — re-asks specific fields with a clear "Refresh your details" banner, never the first-run intro.

**Verdict (pre-fix):** EMBARRASSING — concept gap (re-using the unauthed first-run flow for a signed-in refresh) AND execution gap (no flow indicator, no auto-skip).

**Verdict (post-fix, this PR):** AT BAR — fixed in `apps/mobile/components/onboarding/mobile-flow.tsx` with two changes:
1. **Auto-skip Welcome when in refresh-plan mode.** A new `useEffect` peeks the `suppr.reset-plan-pending-prompt` AsyncStorage flag on mount; when true, the Welcome step is auto-skipped via `go(1)`. A neutral `ActivityIndicator` loading shell renders for the ~10ms AsyncStorage read so the user never sees a flash of the first-impression Welcome.
2. **"REFRESH PLAN" pill in the top bar** while the user is in refresh-plan mode. Calm-pip treatment (muted `Accent.primaryLight` tint, 11pt bold tracked uppercase) sat next to the progress bar. The user can tell at a glance this is a plan refresh, not a fresh signup, on every subsequent step.

**Verified end-to-end in sim (2026-05-12):** Settings → "Refresh my plan" → tap → confirm modal → land directly on Step 03 "What's your goal?" with REFRESH PLAN pill visible top-right. No Welcome screen flash. No "Sign in" affordance shown. Step counter + back chevron + Continue button all intact.

**Why it matters:** flagged by Grace mid-Phase-1, this was a P0 UX bug that no automated test would catch — the flow technically worked, but the *meaning* of the screen was wrong. Adds to the audit's list of "things the agent missed" — it focused on first-impression onboarding without auditing the re-entry path.

**Files changed (this PR):**
- `apps/mobile/components/onboarding/mobile-flow.tsx` — added `isRefreshPlan` peek + Welcome auto-skip + REFRESH PLAN pill
- (no change needed to `welcome.tsx` itself; the screen is simply not rendered when refresh-plan is detected)

**Open questions / future polish (not in this PR):**
- Should the "Build my plan" terminal-step CTA copy change to "Refresh my plan" when in refresh mode? Currently identical to first-run.
- Should specific steps within the flow (e.g. Pace, Strategy) carry a one-line "You're updating from X to Y" diff for the values that changed? Adds clarity at the cost of complexity.
- Web parity: does `/onboarding` on web have the same reset-plan reuse pattern? Web doesn't currently have a "Refresh my plan" Settings affordance, but if added later, mirror this fix.

---

# Group A — Landing & marketing (web public)

**Scope:** `/`, `/pricing`, `/roadmap`, `/whats-new`, `/help`, `/privacy`, `/terms`, `/dmca`, `/licences` — desktop (1440×900) + mobile-web (iPhone 13), light + dark, 36 screenshots reviewed.

**Comparables anchored:** Linear (landing + roadmap + changelog), Vercel (landing scroll + pricing density), Stripe (pricing + trust pages + region awareness), Notion (help + legal), Cal AI (mobile-web hero), Headspace (brand-warmth + CTA hierarchy).

---

### Feature 1: Landing hero + scroll narrative (`/`)

**Platforms:** desktop / mobile-web (light + dark)
**Comparable:** **Linear (linear.app)** — a single dominant headline, a precise sub-line that names what it does, one CTA with a single visible state, and a product-render that visibly shows the product (not a marketing illustration). Linear also keeps the navbar to ~5 items and never lets a cookie banner live below the fold on first paint.
**Screenshots:** `web-desktop-landing.png`, `web-desktop-dark-landing.png`, `web-mobile-landing.png`, `web-mobile-dark-landing.png`

**Current Suppr state**
A two-column hero on desktop: left column has a "NEW · Paste a TikTok, get real macros" pill, an `Import any recipe. Get real macros.` headline, a 4-line description paragraph, and two side-by-side CTA pills (`Get started — it's free` + `How it works — 2 min`). Right column shows a single iPhone-frame render of the Today screen (380 kcal ring + lunch meal card). Nav has 5 routes (How it works / Features / Roadmap / Pricing / FAQ) plus Sign in + Get started. The cookie banner is pinned to the bottom of the visible fold with both `Essential only` and `Accept all` CTAs of nearly equal weight. Mobile-web crops nav severely — only `Sign in` and a clipped `Get st…` button are visible at the top; theme toggle group from desktop is invisible on phone. No scroll narrative below the hero is captured in the screenshot (single fold only).

**Verdict:** CLOSE

**Why this verdict**
1. The product render is a single iPhone — Linear, Vercel, and Cal AI all show **multiple coordinated surfaces** (desktop + mobile, or two phone states side-by-side) in the hero to communicate the breadth of the product. One phone reads as "mobile-only app", which contradicts the `WEB WORKS EVERYWHERE` line that doesn't appear here but does appear on `/pricing`.
2. The two CTAs (`Get started — it's free` and `How it works — 2 min`) are visually equal weight — both filled pills, both same scale. Linear/Vercel use **one filled primary + one ghost/text-link secondary** so the primary action wins the eye in <200ms. Here the eye lands ambiguously.
3. The dark-mode hero shows a vignette behind the iPhone that's heavier on the right than the left, making the layout feel uneven — Linear's dark hero is uniformly graded. Cosmetic but visible on `web-desktop-dark-landing.png`.
4. Mobile-web header is broken: `Get st…` truncates and the theme-toggle pill group present on desktop has vanished entirely. The phone hero on the desktop site is the product hero — on actual phones, the user sees a chopped CTA before a `NEW` pill. That's a P0 on a phone-only product (iOS TestFlight).
5. The "NEW · Paste a TikTok, get real macros" eyebrow pill is the most prominent **claim** above the headline but doesn't link anywhere — Linear/Vercel always link the eyebrow pill ("Read the announcement →") to a what's-new entry. Wasted real estate.
6. The cookie banner consumes ~12% of the first viewport on mobile-web with two equally-weighted CTAs — the EU/UK pattern Stripe and Notion now ship is a smaller bottom-left bubble with `Manage` as a text link, not a full-width bar with two buttons.
7. No social proof, no logos, no testimonial, no metric in the hero. Linear/Vercel/Headspace all anchor the hero with at least one credibility token (a number, a logo strip, or a single quote). The "matched against USDA FoodData Central and OFF (16k TestFlight)" line is a trust hook but it's buried below the CTAs in 12pt grey text.

**States checked:** light desktop (covers hero), dark desktop (vignette uneven), light mobile-web (header broken, CTA truncated), dark mobile-web (header broken too — weakest state). No scroll-below-fold captured — those states are unaudited.

**Upgrades to reach the bar**
1. Replace the single iPhone hero render with a **desktop + iPhone composition** (Linear-style) showing the web Today + the mobile Today, so the "web works everywhere · mobile app is iPhone-only" claim is visually proven, not stated. (redesign, web)
2. Demote the secondary CTA from filled pill to text link with a chevron (`How it works →`) so the primary `Get started — it's free` wins the eye. (cleanup, web)
3. Make the `NEW · Paste a TikTok` eyebrow pill a real link to the matching `/whats-new` entry or a `/features#import` anchor. (cleanup, web)
4. Fix mobile-web header: collapse `Sign in` + `Get started` into a single primary, push nav into a hamburger, restore the theme toggle inside the menu. (cleanup, web — P0)
5. Re-grade the dark-mode hero gradient so the vignette is symmetric, or remove it. (cleanup, web)
6. Move the trust line ("matched against USDA + OFF, 16k TestFlight") above the CTAs as a sub-sub-headline with a check-mark glyph, not below in grey. (cleanup, web)
7. Reduce cookie banner to a Stripe-style bottom-left bubble with `Manage cookies` as a text link, not a full-width tray with two equal buttons. (cleanup, web)

**Open questions for `ui-product-designer`**
- Should the hero carry a single metric ("X recipes parsed", "Y MFP refugees on the beta") or stay metric-free until App Store launch?
- Does the dual-render hero risk diluting the mobile-first positioning, or reinforce it?

---

### Feature 2: Pricing tier presentation + anchor + regional surfacing (`/pricing`)

**Platforms:** desktop / mobile-web (light + dark)
**Comparable:** **Stripe (stripe.com/pricing)** — gradient hero card, region-detected currency in the price line, an inclusive-tax footnote per region, and clear "what's in each tier" parity columns. Vercel does the same with even tighter density.
**Screenshots:** `web-desktop-pricing.png`, `web-desktop-dark-pricing.png`, `web-mobile-pricing.png`, `web-mobile-dark-pricing.png`

**Current Suppr state**
A purple→pink gradient hero card holds the headline `The full meal planning loop`, a 2-line description, and a small line `WEB WORKS EVERYWHERE · MOBILE APP IS IPHONE ONLY (TESTFLIGHT)`. Three trust pills below the hero (`Cancel anytime in-app`, `7-day refund no email needed`, `Price never changes mid-trial`) with green shield glyphs. A `Monthly / Annual save 37%` toggle. Two tier cards: Pro at £7.99/month (`Most popular` ribbon) listing 7 features + a `Upgrade to Pro` CTA; Free at £0 listing 9 features. Footer line `Cancel anytime · unlimited devices & cross-bagging`. **No VAT-inclusive disclosure is visible in any of the four screenshots.** Mobile-web shows the hero and trust pills well; the tier cards are pushed below the cookie banner and only the `Monthly/Annual` toggle peeks above the fold.

**Verdict:** BELOW BAR

**Why this verdict**
1. **VAT disclosure is missing from the visible viewport.** Code at `app/pricing/PricingTiersGrid.tsx` ships a `"Price includes any applicable VAT."` line gated on UK/EU detection — none of the 4 pricing screenshots show this line on screen. This is a P0 against the project rule that UK/EU surfaces must be VAT-inclusive. Stripe and any UK SaaS (Linear EU, GoCardless) show the inclusive line **on the price** itself or directly under it, not buried below a feature list.
2. The `Monthly / Annual save 37%` toggle places the saving on the **right** label. Stripe and Vercel place the saving **adjacent to the active option** (or render it as a tag inside the active pill) so the eye lands on the saving. Here, with `Monthly` active by default (web carve-out), the saving is associated with the *inactive* option — confusing.
3. Pro and Free tier cards are equal-width and equal-prominence. Stripe and MacroFactor pin the recommended tier with a **lifted shadow, brand-tinted border, or scaled height** so the primary path wins. The `Most popular` chip is too small to compensate.
4. Feature lists in both tiers use identical typography and no glyphs — every line reads as a wall of grey text. Stripe and Notion use **check + plus glyphs** (or differentiate cross-tier additions in colour) so a user scanning Pro vs Free can see the delta in 2 seconds. Here the deltas are invisible without reading every line.
5. The trust pills (`Cancel anytime in-app`, `7-day refund...`, `Price never changes mid-trial`) live **between** the hero and the tier cards on mobile-web — pushing the tier cards entirely below the fold on a 1st-gen iPhone 13 viewport. Stripe puts trust pills **below** the tier cards or inline within each card.
6. Mobile-web `Annual` toggle shows `Save 37%` as a tag inside the toggle — good — but the toggle itself sits below the cookie banner on first paint, making the first interactive element below the fold.
7. Cross-currency story missing: no `£ / € / $` switch surfaced; the code supports `regionCurrency: "GBP" | "EUR" | "USD"` but the UI doesn't expose detection or a manual switch. Cal AI and MacroFactor both surface a currency dropdown or auto-localised price on first paint.
8. No FAQ visible on either platform in the screenshots — Stripe/Vercel/Linear all carry a 6-12 question pricing FAQ below the tiers. Either it's below the screenshot fold (acceptable) or it doesn't exist (P1).
9. Dark mode loses the `Most popular` ribbon contrast — it reads as a faint white-on-purple-gradient label, hard to scan.

**States checked:** desktop light (tiers visible, no VAT line), desktop dark (Most popular faint, no VAT line), mobile-web light (tiers below cookie banner, no VAT line — weakest), mobile-web dark (same — also weakest). FAQ scroll states unverified.

**Upgrades to reach the bar**
1. **Surface the inclusive-VAT line directly under the price digits** on UK/EU detection. "£7.99/mo · price includes any applicable VAT" — not "below the feature list". (cleanup, web — P0)
2. Add a manual currency switch (£ / € / $) in the hero card or as a chip row, defaulting to detected region. (small build, web)
3. Lift the Pro card visually — `+8px` height, brand-tinted 2px border, drop shadow — so it visibly wins. Move `Most popular` to a pill above the card, not inside it. (cleanup, web)
4. Add glyphs to feature lists: check for parity, **plus** (in brand colour) for Pro-only adds. Reduces the read time to <2s. (cleanup, web)
5. Move the trust pills below the tier cards on mobile-web so the toggle + Pro card are above the fold. (cleanup, web)
6. Position the `Save 37%` tag inside the **active** toggle option, not on the right label. (cleanup, web)
7. Rebrighten the `Most popular` ribbon in dark mode — use the `--success` token, not a gradient. (cleanup, web)
8. Add a 6-question FAQ section below the tiers (refund mechanics, what counts as "verified macros", trial mechanics, can I import from X, mobile vs web). (small build, web)

**Open questions for `ui-product-designer`**
- Does Stripe Tax billing-mode resolve before launch enough to drop the carve-out and ship the live VAT line, or do we ship the static "Price includes any applicable VAT" line in inclusive-mode and revisit?
- Should mobile-web hide the `Monthly/Annual` toggle and default to annual (matching the mobile paywall divergence), or stay with the web carve-out (`/pricing` always defaults monthly)?

---

### Feature 3: Public roadmap (`/roadmap`)

**Platforms:** desktop / mobile-web (light + dark)
**Comparable:** **Linear roadmap (linear.app/changelog adjacent)** — column-grouped by phase (Now / Next / Later) with milestone progress dots, brand-coloured status chips, and per-item votes or "subscribe for updates". Linear's roadmap reads as a product, not a list. Vercel uses a similar approach with even tighter density.
**Screenshots:** `web-desktop-roadmap.png`, `web-desktop-dark-roadmap.png`, `web-mobile-roadmap.png`, `web-mobile-dark-roadmap.png`

**Current Suppr state**
A single-column list. Page header `Roadmap` + 3-line intro about source-of-truth-with-landing. A section heading `Now` with `v1.0.0 · BUILD 12` aligned right, a 1-line description (`The core loop is shipped and stable on web, with the iOS app in TestFlight beta.`), then 8 visible white pill-shaped cards each carrying a single line of feature copy + a green `Shipped` chip on the right (Recipe import, Macro tracking, Meal planner, Cook mode, Apple Health, Barcode scan, Voice food logging Pro, AI photo meal recognition Pro). Mobile-web folds the same list to a narrower column. No `Next` / `Later` sections visible above the fold in any screenshot.

**Verdict:** BELOW BAR

**Why this verdict**
1. **Visual hierarchy is flat.** Eight cards in a row, all identical type, all the same status, all the same chip colour. Linear groups by phase with **colour-coded headers** and shows a horizontal-bar timeline OR a per-row dot for `Shipped / In progress / Open`. Here, you can't see the shape of the product's direction — only a list of finished things.
2. Every card is a single line of copy with no description, no link to the corresponding `/whats-new` entry, no shipped-date. Linear gives each row a tap-to-expand description + a "Read more →" to the changelog. Suppr's rows are dead.
3. The `Shipped` chip is the same colour for every row in `Now` (because everything in Now is shipped, trivially). Once `Next` and `Later` sections render, this will be useful — but the screenshots only show `Now`, so it's currently colour spam.
4. The `v1.0.0 · BUILD 12` chip top-right is the only build-version anchor on the page. It looks like a debug tag, not a tag — Linear renders versions as `v2.1 · 8 Jan` chips with brand colour and a link to the matching changelog. Wasted nav opportunity.
5. The list cards use generous vertical padding (~64px tall each) — Stripe and Linear ship roadmap rows at ~40px so 15-20 items fit per fold. Here only 8 fit on a 900px-tall desktop. The page reads sparse and aspirational, not active.
6. Mobile-web: identical cards but with wrapped text — `Recipe import from any recipe site, Instagram, TikTok, YouTube` wraps to 2 lines. Acceptable, but no `Next` section visible above the fold either — only 2 rows visible on mobile before the cookie banner.
7. Dark mode: card borders are visible but interiors are flat — Linear's dark roadmap uses a subtle inner-glow on the most recent shipped item, drawing the eye. Suppr has no eye anchor.
8. No "subscribe to roadmap" / "vote on this" / "follow on RSS" affordance. Vercel and Linear both bait subscription here — and roadmap is one of the few public pages where converting a visitor to an email subscriber is high-intent. Missing.

**States checked:** desktop light (sparse), desktop dark (no eye anchor — weak), mobile-web light (2 rows above fold — weak), mobile-web dark (same). `Next` / `Later` sections unverified — possibly below fold or possibly absent.

**Upgrades to reach the bar**
1. Add `Next` and `Later` phase sections with at least 3-5 items each — pulled from the roadmap doc — even if descriptions are short. A roadmap with only `Now` is a changelog. (small build, web)
2. Tighten each card row to ~40px and remove the white card chrome — use a divider list instead, like Linear. (cleanup, web)
3. Add a per-item description on expand (short 1-line each), or wire each `Shipped` card to its matching `/whats-new` entry. (small build, web)
4. Replace the right-aligned `v1.0.0 · BUILD 12` chip with a top-of-page chip row: `Shipped (8) · In progress (N) · Planned (M)` — Linear-style count chips. (cleanup, web)
5. Add a "Get notified when X ships" inline email capture under each `Next` row (Vercel pattern). (small build, web)
6. Use a single dot/glyph per status (filled = shipped, half-filled = in progress, hollow = planned) at the left edge of each row, in brand colour — not a green chip per row. (cleanup, web)
7. Mobile-web: trim card vertical padding so 4-6 rows fit above the cookie banner. (cleanup, web)

**Open questions for `ui-product-designer`**
- Is the source-of-truth tie to landing copy worth the constraint that roadmap content must be parseable from `landing/content.ts`? (Restricts richer rows.)
- Should `Next` be public (Linear-style) or hidden until items are committed?

---

### Feature 4: What's new / changelog (`/whats-new`)

**Platforms:** desktop / mobile-web (light + dark)
**Comparable:** **Linear changelog (linear.app/changelog)** — magazine-style entries with a hero image per release, full prose per item, a date and version chip, social share, RSS feed, and visual texture (screenshots, gifs, mini-videos) per change. Vercel ships the same shape with even more polish.
**Screenshots:** `web-desktop-whats-new.png`, `web-desktop-dark-whats-new.png`, `web-mobile-whats-new.png`, `web-mobile-dark-whats-new.png`

**Current Suppr state**
A single release card at the top — `Build 12 (1.0.0 #12)` + `May 2, 2026` — followed by a `NEW` section heading and 2 plain rows (`Tap "View all nutrients" on Today...`, `Tap the pill under your calorie ring on Today...`), then a `FIXED` section heading and 2 plain rows (`Recipe page calories...`, `Library filter pills...`). No images, no per-item links, no version-to-version navigation, no RSS, no social share, no expanded blurb. Light date inconsistency: light mode says "May 2, 2026"; dark mode says "May 1, 2026" (the screenshots were taken on different runs — likely fine, but if they're the same crawl run, that's a date-stale bug).

**Verdict:** EMBARRASSING

**Why this verdict**
1. **Every Linear/Vercel changelog entry has a hero image.** Suppr's entries are text-only. For a product where the whole differentiator is visual (calorie ring, recipe parsing, etc.), text-only changelog entries fail to demonstrate the change. A reader cannot tell what "Tap View all nutrients" looks like without leaving the page.
2. Each entry is a single line. Linear writes 2-4 sentences per item with context — "We've heard from beta users that…" / "This unblocks…" / "Coming next…". Suppr's entries read like internal Jira tickets.
3. No release-to-release navigation. Linear shows previous releases as a clickable timeline in the sidebar; Suppr shows one release card only. If a user wants to see what Build 11 shipped, the page offers no path.
4. Light/dark date mismatch (`May 2` vs `May 1`) — either a stale build or a date-dependent rendering bug. Either way, P2.
5. Dark mode: section labels (`NEW`, `FIXED`) read at very low contrast — they look ghosted compared to the body text. Linear's section labels in dark are crisp tag chips, not muted captions.
6. Mobile-web: same content, narrower column. The cookie banner covers the bottom card, so the `FIXED` items are partially obscured on first paint — same problem as `/pricing`.
7. No RSS, no email subscribe, no "follow on Twitter/X for updates" affordance. Linear and Vercel always bait subscription here.
8. The hero header card `Build 12 (1.0.0 #12)` has only a date — no summary line ("Nutrients drawer + tap-to-explain calories"). Linear gives every release a title.

**States checked:** desktop light (sparse), desktop dark (NEW/FIXED labels too low contrast — weak), mobile-web light (cookie banner clips bottom — weak), mobile-web dark (same). No multi-release state visible — possibly only one release exists, in which case "what's new" is a Vercel-style "we just launched" hero page.

**Upgrades to reach the bar**
1. Add a 1-sentence release title (`Nutrient drawer + tap-to-explain calorie ring`) under the build number. (cleanup, web)
2. Add a hero image per release (use an actual mobile screenshot from the change). (small build, web — set asset pipeline first)
3. Expand each item to 2-3 sentences with context. (cleanup, web — copy work)
4. Show previous 5 releases as a clickable timeline in a left or right sidebar on desktop. (small build, web)
5. Bump section-label contrast in dark mode — `NEW` / `FIXED` should be tag chips, not faded captions. (cleanup, web)
6. Add an RSS feed + email-subscribe input at the top of the page. (small build, web)
7. Fix the light/dark date mismatch — verify the same `Build 12` date string renders identically in both themes. (cleanup, web — bug)
8. On mobile-web, dismiss or shrink the cookie banner so it doesn't clip the only release entry. (cleanup, web)

**Open questions for `ui-product-designer`**
- Is the team prepared to ship a hero image per release (~2-3 per week)? If not, ship release-titles + per-item context, defer images.
- Should `/whats-new` be combined with `/roadmap` (Linear-style: "Now → Recently shipped → Coming up") to avoid two sparse pages?

---

### Feature 5: Help / support entry (`/help`)

**Platforms:** desktop / mobile-web (light + dark)
**Comparable:** **Notion help center (notion.so/help)** + **Stripe Docs landing** — both anchor a help page with a giant search bar at the top, a 3×N grid of categorised entry tiles below, and a "still stuck? contact us" footer with a real human channel. The page is a search-first experience, not a long-form FAQ document.
**Screenshots:** `web-desktop-help.png`, `web-desktop-dark-help.png`, `web-mobile-help.png`, `web-mobile-dark-help.png`

**Current Suppr state**
A long-form scrollable doc. Page header `Help & Information`, section `How we calculate nutrition` with bullet-list of pipeline mechanics (Ingredient parsing, Database matching, Confidence scoring, Aggregation), then section `Nutrition data sources` listing USDA, Edamam, Open Food Facts. No search bar. No categorised tiles. No "contact us / get help" CTA visible. No table of contents. Reads as a docs page, not a help center. Mobile-web is the same content flowed to narrow column; everything wraps cleanly.

**Verdict:** BELOW BAR

**Why this verdict**
1. **No search.** A help page without a search bar is a docs page. Notion, Stripe, Linear, Headspace — every one of them anchors `/help` with a search input as the largest interactive element. Suppr has no search affordance anywhere.
2. **No "contact" / "get help" CTA.** A help page is also where users go when they're stuck. There's no email, no contact form link, no "report a bug" button visible. Notion always pins a `Still need help? Contact support →` at the bottom of every section.
3. The content is method-heavy (`How we calculate nutrition`) but user-task-thin. A user looking for "how do I import a recipe?" or "how do I cancel my subscription?" finds no entry point. This is a trust-page in help-page clothing.
4. No table of contents on desktop. Notion/Stripe sidebar a sticky ToC at viewport-left on wide screens. Suppr just flows linearly — on a long page, the user can't jump.
5. Dark mode renders cleanly but inherits all the same structural issues.
6. Mobile-web: long scrollable doc on phone, no jump-nav, no collapse-by-section. A user looking for billing help has to scroll through nutrition methodology. P1.
7. The page is titled `Help & Information` — Notion/Stripe call this page `Help`, `Support`, or `Docs`. The `& Information` suffix tells the user it's a hybrid — which it is — and that's a smell, not a feature.

**States checked:** desktop light (sparse, no search, no contact CTA), desktop dark (same), mobile-web light (no nav — weak), mobile-web dark (same). No "no results" state, no contact form state, no "I'm signed in" state checked.

**Upgrades to reach the bar**
1. Pin a search input at the top of `/help` even if it's a client-side filter over the existing sections in v1. (small build, web — P0)
2. Add a 3×3 categorised tile grid below the search: `Getting started · Importing recipes · Tracking macros · Subscription & billing · Account · Apple Health · Mobile app · Troubleshooting · Contact us`. Each tile links to either an in-page anchor or a dedicated `/help/[topic]` route. (redesign, web)
3. Add a sticky `Contact support` CTA at the bottom of every section + a permanent button in the header. (cleanup, web)
4. Split `How we calculate nutrition` (which is really trust copy) off into a dedicated `/help/how-we-calculate-nutrition` page — keep `/help` as the entry. (small build, web)
5. Add a sticky ToC sidebar at viewport-left on desktop ≥1024px. (cleanup, web)
6. Rename to `Help`. Move `& Information` content to a dedicated trust route. (cleanup, web)
7. Mobile-web: collapse each section into an accordion so the user can scan and tap. (cleanup, web)

**Open questions for `ui-product-designer`**
- Is the team going to staff support@suppr.club for inbound, or route through TestFlight/in-app feedback? The CTA copy depends on that answer.
- Should the trust copy (`How we calculate nutrition`) live on `/help` at all, or on the landing `/features` or `/trust` page?

---

### Feature 6: Trust pages — Privacy / Terms / DMCA / Licences (combined)

**Platforms:** desktop / mobile-web (light + dark)
**Comparable:** **Stripe legal pages (stripe.com/legal)** + **Notion legal (notion.so/about/terms)** — both pages are clean-typed, ToC'd in a sticky sidebar, anchored to specific clauses with deep-linkable IDs, and visually as polished as the marketing pages they sit next to. Linear's legal pages are the inverse benchmark: they look like the rest of the site, not like a WordPress fallback.
**Screenshots:** `web-desktop-privacy.png`, `web-desktop-dark-privacy.png`, `web-desktop-terms.png`, `web-desktop-dark-terms.png`, `web-desktop-dmca.png`, `web-desktop-dark-dmca.png`, `web-desktop-licences.png`, `web-desktop-dark-licences.png`, plus all 8 mobile-web counterparts.

**Current Suppr state**
All four pages share the same chrome: top-left `← Back to app` link, centered max-width column, `Last updated: April 2026` line near the top, bold section headings followed by dense paragraphs of body copy. Privacy: standard GDPR + UK GDPR + EU GDPR controller/representative copy, "What we collect" / "How we use data". Terms: "Suppr/we/us/our refer to..." preamble, then "The service" / "Not medical or dietetic advice" / "Nutrition estimates" sections. DMCA: explanation of the procedure + a structured submission form (Your email / Original post URL / Suppr recipe ID / Description) — the form is significantly more polished than Privacy/Terms. Licences: a table-driven layout (Source / Licence / Purpose) for nutrition + product data, then a longer table for open-source software. No ToC on any page. No nav. No sticky chrome.

**Verdict:** CLOSE (DMCA form alone is AT BAR; the rest are CLOSE→BELOW)

**Why this verdict**
1. **No table of contents on any of the four pages.** All four read as long scrollable walls of text. Stripe / Notion / Linear all sidebar a sticky ToC with deep-linkable anchors on legal pages. The user-task here is "find the clause" — and there is no jump-nav.
2. **Inconsistent visual hierarchy across the four pages.** DMCA has a polished form. Licences has a structured table. Privacy and Terms are flowing prose. As a set of trust pages they don't share a template — Stripe's legal pages all look like siblings; Suppr's look like four authors.
3. `Last updated: April 2026` is a date string, not a version chip. Stripe / Notion always show `Last updated 12 January 2026 · v3.2`. Without a version, returning users can't tell what changed.
4. No "previous versions" / "changelog" affordance on Privacy or Terms. UK GDPR + EU GDPR posture requires a version trail — code presumably keeps one (the SSOT in `src/lib/landing/content.ts` is git-tracked) but the UI doesn't surface it.
5. Mobile-web: Privacy and Terms are extremely long flow-text on phone. No collapse, no jump. P1 for a UK/EU-resident user trying to find the "data controller" clause on phone.
6. Dark mode is uniformly readable on all four pages — no contrast bugs. This is the strongest state across the set.
7. The Licences table has visible alignment drift on mobile-web (`web-mobile-licences.png`): the columns are squeezed and the body text breaks awkwardly under the table. Stripe/Notion use stacked card-per-licence on phone, not table-on-phone.
8. None of the four trust pages carry the marketing nav (Sign in / Get started). Stripe/Notion legal pages retain the marketing nav — they're public pages, and a visitor who lands on `/privacy` from a Google result should still be able to convert.
9. `← Back to app` is the only navigation. For a logged-out visitor, "back to app" is the wrong frame — these are public legal pages, not app-internal.

**States checked:** desktop light (Privacy/Terms/DMCA/Licences — all wall-of-text, no ToC), desktop dark (same — readable), mobile-web light (Licences table breaking on phone — weakest, plus general no-jump-nav), mobile-web dark (same).

**Upgrades to reach the bar**
1. Add a sticky ToC sidebar on desktop ≥1024px to all four pages (Privacy, Terms, DMCA, Licences). Deep-link each section heading with an `id` so URLs can carry anchors. (small build, web)
2. Replace `Last updated: April 2026` with `Last updated 19 April 2026 · v1.0` + a `View previous versions →` link. (cleanup + small build, web)
3. Unify the trust-page template so Privacy/Terms/DMCA/Licences share the same chrome (intro card → sticky ToC → sections → version footer). (redesign, web)
4. Surface marketing nav (Sign in / Get started + theme toggle) on all four pages — they're SEO landing surfaces too. (cleanup, web)
5. Reformat Licences table on mobile-web as stacked cards (one card per source/package) instead of a squeezed table. (cleanup, web)
6. Add per-section "Permalink" copy-link buttons next to each H2 (Stripe pattern). (cleanup, web)
7. Add a "Print / save as PDF" affordance on Privacy and Terms — UK/EU consumer-law users often want a saved copy. (small build, web)
8. Surface the DMCA form polish back into the other three trust pages — e.g. a "Request my data" form on Privacy. (small build, web)

**Open questions for `ui-product-designer`**
- Do we ship a `/legal` index hub that lists all four trust pages (Stripe pattern) or stay with separate top-level routes?
- Is the "Print to PDF" affordance worth the build, or is it cookie-cutter polish?

---

## Group A — verdict summary

**Per-surface verdicts:**
- `/` (landing) — **CLOSE** (single-iPhone hero, dual-equal-weight CTAs, broken mobile-web header are the gaps)
- `/pricing` — **BELOW BAR** (VAT line missing from visible viewport, equal-weight tier cards, no glyph differentiation, no FAQ visible) **— P0 legal exposure**
- `/roadmap` — **BELOW BAR** (no `Next`/`Later` phases visible, flat hierarchy, no per-item depth)
- `/whats-new` — **EMBARRASSING** (no images, single-line entries, no release navigation, date inconsistency between light/dark)
- `/help` — **BELOW BAR** (no search bar, no contact CTA, no categorisation — it's a docs page, not a help center)
- Trust pages (Privacy / Terms / DMCA / Licences) — **CLOSE** (DMCA form is AT BAR; the other three lack ToC, version chips, and a unified template; Licences table breaks on mobile-web)

**Top 2 worst surfaces:** (1) `/whats-new` — EMBARRASSING. (2) `/pricing` — BELOW BAR by P0 legal exposure (UK/EU VAT-inclusive disclosure missing from visible viewport).

**Cross-cutting findings for landing/marketing:**
- Cookie banner consumes 12-18% of first viewport on mobile-web with two equally-weighted CTAs across every public page.
- Mobile-web header is broken on `/` only (Get started truncates, theme toggle disappears).
- Region-aware pricing wired in code but not surfaced in pixels — P0 to verify and fix.
- Dark-mode parity generally strong with two minor cosmetic issues.
- No marketing nav on the trust pages.
- No anchor links / deep-links anywhere.

---

# Group D — Mobile Today tab (canonical spine)

**Scope:** Mobile Today (light + dark + populated + empty), Log sheet entry, web Today parity. Comparables: MyFitnessPal, MacroFactor, Cal AI, Cronometer.

**Critical screenshot caveat:** `web-desktop-authed-tracker-today.png` does NOT show authed web Today — it shows public landing. `web-mobile-authed-tracker-today.png` is a 404. Either auth-gate failed in capture or route doesn't resolve. **P0** in its own right — see Feature 10.

---

### Feature 1: Calorie ring + hero number

**Platforms:** mobile (light + dark), web (unaudited — capture broken)
**Comparable:** **MacroFactor — main daily ring.** Single calorie arc (their accent colour + soft track), bold tabular numerals, animated number tween on every log, meaningful secondary line ("X remaining" / "X over"). One colour, never four.
**Screenshots:** `today-01-loaded.png`, `tour-01-today.png`, `state-60-today-current.png`, `dark-01-today-default.png`

**Current Suppr state**
Hero ring is a stacked rainbow: 4 concentric arcs (red/orange/pink/cyan/yellow) representing macros, plus a fifth outer ring also in red on over-budget. Centre reads "1,822 LOGGED" / "1,244 LOGGED" / "727 LOGGED" in a chunky display type. In `today-01` (1,822 kcal over budget), the outer ring is fully red but there's no chip, no "X over" line, no banner — user has to read the LOGGED number and compute the verdict themselves. Empty-day dark (`dark-01`) shows a faint pink-purple gradient ring with "Start your day" inside — correct per the calorie ring colour mapping. `state-60` shows a partial rainbow with "727 LOGGED" and a separate decoupled "~342 kcal deficit so far today" pill below — the only place the verdict actually lives.

**Verdict:** BELOW BAR

**Why this verdict**
1. The 4-concentric rainbow is decorative, not informative. None of MFP / MacroFactor / Cal AI / Cronometer stack macros INSIDE the calorie ring. Suppr forces the eye to parse 5 arcs to read 1 piece of information (calories), and the macro arcs are too thin to be readable as macros anyway.
2. **Colour-mapping drift (P0):** in over-budget state, the outer ring IS destructive red (correct), but the inner macro arcs are still the brand rainbow, diluting the over-budget signal. The project rule is one ring colour = one state: gradient / green / red. Currently it's a cocktail.
3. Hero number "1,822" with label "LOGGED" is wrong hierarchy. MacroFactor / MFP / Cal AI all show a relationship: `1,822 / 1,600` or `1,822 (–222)` or "222 over." "LOGGED" is a category, not the answer. Verdict buried in an amber pill 200px below.
4. "Why this number?" link below the ring is a debt indicator — it means the number isn't self-explanatory. MFP / MacroFactor / Cal AI / Cronometer never need this link.
5. No tabular-nums on the hero. "1," in "1,822" is visibly wider than the "1," in "1,244" — proportional figures. On a frequently-updating number this is a P1.
6. No animation on the number. Logging a meal should tween the calorie count (Cal AI does this with a 400ms ease).
7. Dark-mode empty state ("Start your day" in gradient ring) is genuinely good — voice-correct copy, on-token ring colour. **Keep this.** But contrast on the gradient against the dark panel is low.

**States checked:** empty light (unaudited), empty dark (good), populated under-budget (verdict pill disconnected from ring), populated over-budget (verdict NOT on the ring), dark loaded.

**Upgrades to reach the bar**
1. **Collapse the 4-concentric rainbow to a single calorie arc** — outer arc only, one colour: gradient / `--success` / `--destructive`. Macros stay in tiles below. (redesign, mobile + web)
2. **Replace "1,822 LOGGED" with `1,822 / 1,600` + delta chip ("222 over" red / "778 left" green)** anchored to ring centre. (redesign, mobile + web)
3. **Tabular-nums + 400ms tween on every log.** (cleanup, mobile + web)
4. **Delete "Why this number?" from default state.** Move to long-press affordance or to More tab. (cleanup, mobile + web)
5. **Tighten ring track contrast in dark mode** — empty-day gradient should be perceivable at 1m on an OLED phone. (cleanup, mobile)

**Open questions for `ui-product-designer`**
- Should "burn" / "activity adjusted" be surfaced on the ring (Cal AI does this with a "+312 burn" chip) or kept on the deficit pill?
- If rainbow stacked ring is killed, where do macros get visual hero treatment? Tiles only, or micro-rings on each tile?

---

### Feature 2: "What to eat next" north-star card

**Platforms:** mobile (dark only — empty-day surface)
**Comparable:** **MacroFactor "Recommended foods" + Cal AI "Try this".** Photo-led, fit% prominent, kcal+macros tabular, log CTA right-side with no question.
**Screenshots:** `dark-01-today-default.png`

**Current Suppr state**
On empty-day dark Today, card titled "WHAT TO EAT NEXT" (small caps + sparkle glyph): "Miso Glazed Steak Bowls with Creamy Cucumber Salad & Stic…" (truncated mid-word). Below: "Fits your remaining 1132 kcal" + green "Hits within 3%" chip + "1128 kcal · 65P / 87C / 54F" + "Log it" pill. No image. Title truncates mid-word.

**Verdict:** CLOSE

**Why this verdict**
1. **No hero image.** Cal AI's equivalent is image-led with a 60×60 thumb minimum. MacroFactor sometimes goes text-only but owns it with a tight typographic system. Suppr's card is a wall of text with no anchor for the eye — and the recipe almost certainly has a generated hero image already.
2. Title truncation "Salad & Stic…" is unacceptable. Wrap to a second line or shorten the source title — never mid-word ellipsis on a hero card.
3. "Hits within 3%" chip is a real differentiator vs MFP. But "Fits your remaining 1132 kcal" + chip + kcal line below = three ways of saying the same fit-thing. Pick one.
4. "65P / 87C / 54F" is dense and unlabelled — MacroFactor uses "65g P · 87g C · 54g F." One letter saved per macro isn't worth the cognitive cost.
5. "Log it" CTA is small. Also says "Log it" while Eat Again says "LOG" — pick one verb across the product.
6. No "Why this?" disclosure. MacroFactor has tappable "Why this recommendation?" — Suppr has the logic (`northStarSuggestion.ts`) but doesn't expose it. MFP refugees who left because they didn't trust suggestions won't trust an unexplained one here either.

**States checked:** empty-day dark only. No light-mode capture. No zero-recipes state. No bad-fit state (>10% off) — would chip turn amber?

**Upgrades to reach the bar**
1. **Add a 64×64 or full-width recipe hero image.** (new build, mobile + web)
2. **Multi-line title, kill mid-word truncation.** (cleanup)
3. **Collapse three fit-statements into one row:** chip + `1,128 kcal · 65g P · 87g C · 54g F`. (cleanup)
4. **Unify Log verb across all surfaces ("Log").** (cleanup, cross-cutting)
5. **Add tappable "Why this?" disclosure** surfacing `northStarSuggestion.ts` reasoning. (new build, mobile + web)
6. **Show second/third candidate via swipe.** (new build)
7. **Animate the card in on first paint** — soft fade-up 200ms. (cleanup)

**Open questions for `ui-product-designer`**
- Hero image: thumbnail vs full-width? Affects card height by ~80px on small devices.
- When fit% is bad (~25% off), does the card hide entirely or downgrade to "best available" framing?
- Surface 3 candidates by default (MacroFactor) or 1 (Cal AI)?

---

### Feature 3: Snap a meal CTA (photo-log entry)

**Platforms:** mobile (dark only captured)
**Comparable:** **Cal AI — photo log hero.** Full-width card, camera icon, "Tap to log via photo," haptic-rich shutter, full nutrition breakdown in <3s with confidence indicator.
**Screenshots:** `dark-01-today-default.png` ("Snap a meal · One photo, full macros — no typing.")

**Current Suppr state**
Camera glyph (violet rounded square), title "Snap a meal" semibold, subtitle "One photo, full macros — no typing." muted. Whole card tappable, no explicit CTA button.

**Verdict:** CLOSE

**Why this verdict**
1. Microcopy is great — concise, voice-correct, names the value. Better than Cal AI's "Take a picture of your food."
2. Camera-glyph-in-rounded-square reads as "icon," not "interactive." Cal AI uses a large pulsing shutter button. Suppr's card affords tap, but the glyph alone doesn't say "tap to take a photo right now."
3. No accuracy / time / confidence framing. Cal AI brags about "3 seconds to log" — Suppr has the engineering to make this claim but doesn't surface it.
4. Card lives below north-star on empty days (correct hierarchy). But disappears on populated state — MFP refugees expect photo log always one tap away.
5. No visible Pro gate or "AI" badge — yet voice/photo log are Pro features. Either shown to Pro only (framing fine), or shown to Free with hidden gate (paywall on tap = sudden friction).

**States checked:** empty-day dark visible. Populated state (`today-01` light) — card not visible. Pro vs Free framing unaudited.

**Upgrades to reach the bar**
1. **Replace camera-glyph-in-square with explicit shutter button** or "Tap to scan" pill on the card's right. (cleanup, mobile + web)
2. **Add "~3 seconds to log" or "AI estimate · review before saving" subtitle** to position speed + trust caveat. (cleanup)
3. **Surface Pro chip on card if user is Free.** (cleanup)
4. **Persist photo-log card to populated state** as a small floating affordance or in the Log sheet. (new build)
5. **On tap, transition to camera sheet with shutter-pulse haptic.** (cleanup)

**Open questions for `ui-product-designer`**
- Should photo-log be a persistent FAB-adjacent action (long-press on `+`) instead of a card?
- For Free users, surface "1 free photo log/day" or hard paywall on tap?

---

### Feature 4: Macro tiles (4-pack — Protein / Carbs / Fat / Fiber)

**Platforms:** mobile (light populated, dark empty)
**Comparable:** **MacroFactor macro tiles.** Tight 3 or 4-tile grid, `eaten / target` + horizontal bar + small accent dot/icon per macro, single status line. One macro accent colour per tile, bar fills with that colour.
**Screenshots:** `today-01-loaded.png`, `state-60-today-current.png`, `dark-01-today-default.png`

**Current Suppr state**
2×2 grid. Each tile: small-caps label, macro icon top-right (egg/wheat/water-drop/leaf), big tabular number `138`, slash + target `/ 122 g`, full-width filled bar in macro colour (blue/amber/pink/green), sublabel "16 g over" or "21 g remaining" — bar colour matches macro semantic. **Sublabel does NOT turn amber when over.** Dark empty bar appears faint, sublabel "122 g remaining."

**Verdict:** AT BAR (with cleanup needed)

**Why this verdict**
**Right things:**
1. 2×2 grid + tabular hero numbers + slash-format target + sublabel = correct pattern. MacroFactor uses same shape.
2. Macro accent colours (blue / amber / pink / green) match prototype carryover rules.
3. Icons exact (lucide-set).
4. Sublabels voice-correct.

**Why not fully AT BAR:**
1. **Over-budget sublabel colour drift (P1):** "16 g over" renders in muted grey, same as "remaining" sublabel. Per project rule, **macros over budget = amber** (only calorie ring is red exception). Currently doesn't communicate over-state visually. Bar at 138/122 is still rendered in blue (under-state colour) at full width.
2. Small-caps "PROTEIN" vs MacroFactor's "Protein" — reads slightly dated. Minor.
3. Tile order P / C / F / Fiber correct.
4. **No tap-to-detail affordance visible** — Cronometer's tiles open a detail. Suppr's tile presumably does (`macro-detail-protein` route exists) but no chevron / no hint.
5. **Empty state in dark** — bar appears faint but not empty. Verify value vs visual fill.
6. Tabular-nums confirmed consistent. Good.

**Upgrades to reach the bar**
1. **Over-budget: turn sublabel amber + render bar in amber at 100%.** (cleanup, mobile + web)
2. **Add chevron-right or "›" affordance** to each tile. (cleanup, mobile + web)
3. **Verify and explicitly render 0% width for empty bars.** (cleanup)
4. **Add 200ms ease-out bar fill animation on log.** (cleanup)

**Open questions for `ui-product-designer`**
- Should over-budget macro tiles get a corner badge (small amber dot) in addition to the sublabel colour?
- Tile-tap behaviour: detail screen or expanding inline?

---

### Feature 5: Week strip / day picker

**Platforms:** mobile (light + dark)
**Comparable:** **MacroFactor week strip + Cal AI date picker.** Single strip with day initials + numerals, current day filled pill, "logged" days marked. Tap opens full-calendar modal.
**Screenshots:** `today-01-loaded.png`, `state-60-today-current.png`, `dark-01-today-default.png`

**Current Suppr state**
Row 1: header date "MAY 7 · THURSDAY" small caps + `<` `>` chevron pair + large "Today" h1, sun/moon toggle, 2×2-grid icon, avatar "G."
Row 2: "Today" pill (left), then Mon–Sun day initials with numerals (7 / 8 / 9 / 10), current day (Thu 7) in filled blue pill, past days (Mon/Tue/Wed) show green checkmark circles, future days grey numerals. Far right: small calendar icon.

**Verdict:** CLOSE

**Why this verdict**
1. **Past-days with green checkmarks are excellent** — clearer than MacroFactor's "logged" affordance. Keep.
2. Filled blue pill on Thu 7 on-token. Good.
3. **Day initials above numerals form two rows of seven** — two horizontal scanning passes when one would do. MacroFactor stacks per-day (initial top, numeral below) as one tile.
4. Header has **THREE date affordances**: "MAY 7 · THURSDAY," "Today" h1, "Today" pill. Pick one as primary.
5. `<` `>` chevron pair touch target narrow. MacroFactor/Cal AI use wider taps, often + swipe gesture.
6. **2×2-grid icon unlabelled.** Purpose undecodable — week/month view? Either label or remove.
7. **Sun-icon theme toggle** in Today header is control-density mistake. MFP, MacroFactor, Cal AI all hide theme behind Settings.
8. Avatar "G" top-right correct. Keep.

**States checked:** light populated, light populated under-budget, dark empty. Past-day view not captured. Calendar-modal-open not captured.

**Upgrades to reach the bar**
1. **Move theme toggle out of Today header** to More/Settings. (cleanup, mobile + web)
2. **Collapse the 2×2-grid icon** — label or remove. (cleanup)
3. **Stack day initial + numeral into single per-day tile.** (redesign, mobile + web)
4. **Add horizontal swipe to navigate days** + tween on active-day pill. (new build)
5. **Drop one of the three "today" labels** — keep h1 + active pill; remove leftmost "Today" pill. (cleanup)
6. **Verify calendar icon at right opens full-month modal** with logged-days dots. Wire if not.

**Open questions for `ui-product-designer`**
- Should past-day green check use macro-fit verdict (green if hit, amber if missed)?
- Day-tile pill: active-day colour changes with under/over, or always brand-blue?

---

### Feature 6: Streak chip

**Platforms:** mobile (light + dark)
**Comparable:** **Duolingo / Headspace streak surface.** Duolingo saturated coral flame, Headspace soft secondary hidden until earned. Suppr's locked approach (per code comments): "calm pip" gated to `streakDays >= 2`.
**Screenshots:** `today-01-loaded.png` ("🔥 32-day streak" chip), `dark-01-today-default.png` (no chip — empty user)

**Current Suppr state**
Top-right of Today header: pale blue rounded pill "🔥 32-day streak" with flame glyph + small semibold text. Muted (low saturation). In `dark-01` (fresh user, no streak), pill absent — correctly gated.

**Verdict:** AT BAR

**Why this verdict**
1. **Gating is correct:** streak only renders for `streakDays >= 2` per code comments — no "0-day streak" gibberish. Right call.
2. **Calm pip treatment** (muted background, small glyph) is right tier — not Duolingo-front-and-centre. Voice is more MacroFactor than Duolingo. Restraint matches.
3. 🔥 emoji is right glyph — universal.
4. **One concern (P2):** placing chip top-right above "Today" header forces it to compete with avatar / theme toggle / 2×2 icon row, which is already cluttered.

**States checked:** light populated streak=32 (visible), dark empty streak=0 (correctly hidden).

**Upgrades to reach the bar**
1. **Verify chip uses brand-blue tinted background, NOT amber/red.** Currently pale blue — on-token.
2. **Consider moving chip into week-strip row** near the "Today" pill. (minor cleanup — only if header clutter resolved)
3. **Streak reset flow:** verify copy on reset day reads supportively, not shaming.

**Open questions for `ui-product-designer`**
- Streak chip on freeze-protected day — visual "protected" indicator (small shield glyph)?
- Reset day microcopy — what shows when dropping from 32 to 0?

---

### Feature 7: Meal sections / Log sheet entry

**Platforms:** mobile (light captured for Eat Again + Log sheet)
**Comparable:** **MyFitnessPal Log sheet (canonical) + MacroFactor unified log.** Instant search, recents tab, barcode + scan-meal + manual entry. Sub-100ms search-as-you-type.
**Screenshots:** `state-10-log-sheet-default.png`, `today-01-loaded.png` (Eat Again)

**Current Suppr state (Log sheet)**
Header "Log a meal" + `×` close. Search bar "Search foods, brands, or recipes" with three trailing icons (barcode / mic / camera). Tabs: Recent / Library / Saved meals. "TODAY'S RECENTS" + list rows: 64×64 grey square thumbs on left (placeholder), food name top, dot-prefixed kcal subtitle ("· 27 kcal"). "EARLIER THIS WEEK" section below.

**Current Suppr state (Eat Again on Today)**
"EAT AGAIN" small-caps eyebrow + "Wasabi · Chicken Katsu Curry Wit…" (truncated mid-word) + "698 kcal · P 22g · C 95g · F 27g · into Dinner" + blue "LOG" + `×` dismiss.

**Verdict — Log sheet: AT BAR**
**Verdict — Eat Again: CLOSE**
**Verdict — Single-Log-sheet adherence: AT BAR** (no per-meal pop-ups visible)

**Why these verdicts**
1. Log sheet genuinely good — three input modes inline (barcode/mic/camera) is right density, matches MFP + adds voice. Tab order (Recent / Library / Saved) right priority.
2. **Recents thumbnails all empty placeholders.** MFP shows brand thumbs when available; OFF data has thumbs for ~70% of branded items. Placeholders read as "broken images" — unforced loss.
3. Search field with 4 trailing icons crammed in one row is busy. MacroFactor splits to search bar + action button row below.
4. Single-Log-sheet rule appears honoured — verify meal-slot routing (`into Dinner`) is set inside the sheet, not via separate slot pop-ups.
5. **Eat Again title truncates mid-word** "Salad & Stic…" — same defect as north-star card.
6. Eat Again macro format `P 22g · C 95g · F 27g` (with `g` per macro) vs north-star `65P / 87C / 54F` (no `g`). **Inconsistent format.** Pick one globally.
7. "Or add manually" footer link on Log sheet correct escape hatch.
8. "LOG" verb on Eat Again vs "Log it" on north-star → unify.

**States checked:** Log sheet default light (good), Eat Again populated (truncation). Empty Recents not captured. Search-typing not captured. Barcode-tap not captured.

**Upgrades to reach the bar**
1. **Fix Recents thumbs to load brand images where available** (OFF / FatSecret have these). (new build, mobile + web)
2. **Unify macro format across Eat Again, north-star, recipe detail, plan tiles:** `698 kcal · 22g P · 95g C · 27g F`. (cleanup, cross-cutting)
3. **Multi-line title or shorter target on Eat Again.** (cleanup)
4. **Instrument search-as-you-type latency target <100ms.** If real latency >300ms, this is P0 vs MFP.
5. **Add scan-barcode hero shortcut as one-tap on empty Recents.**

**Open questions for `ui-product-designer`**
- Should Log sheet open with keyboard pre-focused on Search? (MFP does; MacroFactor doesn't.)
- Eat Again card lifetime — N days since last log, or just last 1?

---

### Feature 8: Bottom tab bar (Today / Recipes / + / Plan / You)

**Platforms:** mobile (light + dark)
**Comparable:** **MFP tab bar + Headspace tab bar.** MFP: 5 tabs with centred `+` FAB, flat icons, labels under each. Cal AI: 4 + large centred camera FAB.
**Screenshots:** `today-01-loaded.png` (light), `dark-01-today-default.png` (dark)

**Current Suppr state**
5-tab bar: **Today / Recipes / + / Plan / You.** Today active blue, sun glyph; Recipes (book), `+` (centred large blue FAB), Plan (calendar), You (person). Labels under each except `+`. Active icon solid brand-blue + brand-blue label. Inactive muted grey.

**Verdict:** AT BAR (with one P1)

**Why this verdict**
1. **`+` FAB position correct** — canonical fast-log entry.
2. **Strategic-direction order drift (P1):** project context says 4 tabs in order "Today / Plan / Recipes / More." Rendered order is **Today / Recipes / + / Plan / You.** Recipes is in position 2 instead of position 3; Plan is in position 4 instead of position 2. **Platform drift from locked strategic direction.** Either fix tab order or update strategic direction memory.
3. **"You" vs "More"** — strategic direction names the tab "More." Suppr renders "You." (P2 copy drift)
4. **Verify icons are `lucide-react-native`** (project rule). Code import shows `Ionicons` is imported at line 37 of `index.tsx` — that's a project-rule violation if used for any visible tab/header glyph. Audit lucide vs Ionicons.
5. Active-tab indicator: just colour swap on icon + label — no underline, no fill. Cal AI uses soft pill behind active icon. Suppr's restraint appropriate for brand voice.
6. Dark-mode tab bar ink-deep with FAB still saturated brand-blue. Good contrast.

**States checked:** light Today active, dark Today active. FAB tap-state (sheet opening) not captured.

**Upgrades to reach the bar**
1. **Reorder tabs to Today / Plan / + / Recipes / More** per locked strategic direction, OR update strategic direction memory if Grace shifted. (P1 cleanup, mobile)
2. **Rename "You" → "More."** (P2 cleanup)
3. **Verify all tab/header icons are `lucide-react-native`** (not `@expo/vector-icons / Ionicons`). (cleanup)
4. **Add medium-impact haptic on `+` FAB tap** if not already.

**Open questions for `ui-product-designer`**
- Tab order — strategic direction vs current render. Confirm.
- Should `+` long-press open photo/voice/barcode shortcut menu?

---

### Feature 9: Today header + first-impression hierarchy

**Platforms:** mobile (light + dark)
**Comparable:** **Linear app shell + MacroFactor home header.** Linear: one line, page name + contextual primary action. MacroFactor: date + macro hero — nothing else. Both refuse to overload the top.
**Screenshots:** `today-01-loaded.png`, `dark-01-today-default.png`

**Current Suppr state**
First ~140px contains:
1. Status bar.
2. Streak chip top-right.
3. Date row: `<` chevron, "MAY 7 · THURSDAY" small caps + "Today" h1, `>` chevron, sun/moon toggle, 2×2-grid icon, avatar "G."
4. "Today" pill + week strip below.

**3 affordances for "today"/"date"** + **6 chrome elements in top row** on 4.7" device.

**Verdict:** BELOW BAR

**Why this verdict**
1. **6 chrome elements** vs MacroFactor's 2 (date + avatar). Suppr over-loaded.
2. **3 surfaces for "today"** — h1, small caps, week-strip pill. Pick one primary.
3. **Theme toggle in header is control-density mistake** (covered in Feature 5) — belongs in Settings.
4. **2×2-grid icon unlabelled** — purpose unclear.
5. Avatar correct.
6. **First-impression:** eye lands on calorie ring within 200ms (correct), but chrome row above competes for attention with the ring. "Today" h1 fights with date small caps directly above.
7. Dark mode header cleaner because streak hidden + more aggressive chevron contrast — but same 6-element row.

**States checked:** light populated, dark empty. Scrolled-state not visually distinct from un-scrolled (suggests no scroll-collapse behaviour).

**Upgrades to reach the bar**
1. **Remove theme toggle from header.** (cleanup)
2. **Remove or label 2×2-grid icon.** (cleanup)
3. **Drop "MAY 7 · THURSDAY" small caps** when h1 "Today" shown. Keep small caps only for non-today views. (cleanup)
4. **Drop leftmost "Today" pill in week-strip row** — redundant with active-day pill. (cleanup)
5. **Add scroll-collapse behaviour** — header shrinks h1 + week strip to compact bar at top after ~80px scroll, calorie hero number persists. (new build) — Linear, Things 3, MacroFactor all do this.
6. **Subtle motion on focus** — week strip slides L→R on first paint, h1 fades in 100ms after. (new build)

**Open questions for `ui-product-designer`**
- h1 "Today" stays h1, or shrinks to h2 for ring breathing room?
- Scroll-collapse — compact bar with calorie miniature, or fully hide header chrome?

---

### Feature 10: Web parity (mobile decisions apply to web too)

**Platforms:** web desktop, web mobile
**Comparable:** **Linear web app + Notion web app.** Both have feature parity with mobile, same tabs, same primary actions, scaled responsively.
**Screenshots:** `web-desktop-authed-tracker-today.png` (renders public landing), `web-mobile-authed-tracker-today.png` (404)

**Current Suppr state**
`web-desktop-authed-tracker-today.png` → renders **public landing page** ("Import any recipe. Get real macros."), NOT authed Today.
`web-mobile-authed-tracker-today.png` → **404** ("We couldn't find that page").

**Verdict:** EMBARRASSING (web Today either doesn't exist, doesn't auth, or doesn't capture — all three are P0)

**Why this verdict**
1. Screenshot filenames imply authed Today exists, but actual pixels show landing + 404. Either web has no `/tracker/today` equivalent at the captured URL, OR auth state didn't persist (left auth-required Today to redirect/404 on different routes).
2. **Mobile decisions must apply to web too in same commit.** Mobile Today has: ring, north-star, snap-a-meal, macro tiles, week strip, streak chip, Eat Again, Log sheet. None visually verifiable on web from this set.
3. **Mobile-web (phone browser opening `suppr.app`) 404s on authed tracker route** — a refugee opening Suppr first from a marketing link on their phone gets a dead page.
4. Without captured web Today, **web cannot be assessed against mobile bar.** This is itself the failure.

**States checked:** desktop authed (broken capture or missing surface), mobile authed (404). Light/dark unaudited.

**Upgrades to reach the bar**
1. **P0: verify web has authed Today mirroring mobile spine** — ring, north-star, macro tiles, week strip, Log sheet. If missing, build. If present, fix routing. (new build / cleanup, web)
2. **Re-run screenshot capture with verified authed session** — produce light + dark, desktop + mobile of actual Today. (P0 capture rerun)
3. **Verify mobile-web phone-browser-opens-suppr.app routes correctly** to authed Today. 404 is P0 routing bug if surface exists.

**Open questions for `ui-product-designer`**
- Is there a web Today, or has web product diverged to different IA (`/tracker`, `/home`, `/dashboard`)? If diverged, documented carve-out gap.
- For web, does the calorie ring + macro tiles render identically to mobile, or re-skinned?

---

## Group D verdict summary

**Calorie ring + hero number = BELOW BAR.** This is the spine of the product and it's the weakest part of it. Four reasons matter most: (a) 5-arc rainbow conflates calories with macros and dilutes over-budget signal; (b) "1,822 LOGGED" hierarchy doesn't answer "am I over or under?"; (c) no animation, no tabular-nums on hero; (d) "Why this number?" link betrays low confidence. Fix this and the product feels different. **What to eat next = CLOSE.** **Snap a meal = CLOSE.** **Macro tiles = AT BAR (with cleanup).** **Week strip = CLOSE.** **Streak chip = AT BAR.** **Meal sections / Log sheet = AT BAR for sheet, CLOSE for Eat Again.** **Tab bar = AT BAR with P1 (tab order drifts from locked strategic direction; "You" should be "More").** **Today header = BELOW BAR.** **Web parity = EMBARRASSING.**

**Top 2 things to fix to lock in MFP refugees on first session:**
1. **Kill the 4-concentric rainbow calorie ring;** replace with single calorie arc honouring the 3-state colour mapping, with `1,822 / 1,600` + delta chip in centre. MFP refugees decide whether the product respects their time within 200ms of seeing the ring. Right now it does not.
2. **Fix web Today.** Refugees are split-platform — they visit suppr.app on desktop before downloading. A landing page where Today should be, and a 404 on mobile-web, kills the refugee funnel at the entry door.

**Honourable-mention P1s:** unify Log verb; unify macro format string; kill mid-word truncation on Eat Again + north-star; fix tab order vs strategic direction; remove theme toggle from header.

---

# Group E — Mobile Plan tab

**Scope:** Mobile Plan tab (`apps/mobile/app/(tabs)/planner.tsx`) — empty/landing, populated week, Move-meal sheet, generate/regenerate, dark mode, web parity question.

**Overall verdicts at a glance:**
- Plan tab landing (empty / setup) — **BELOW**
- Populated week + fit% — **BELOW**
- Move-meal sheet (mobile-only carve-out) — **CLOSE**
- Generate / Regenerate flow — **BELOW**
- Web Plan parity (web has no /planner) — **EMBARRASSING (on web's own platform)**
- Dark mode parity — **CLOSE**

---

### Card 1 — Plan tab landing (empty state + setup card)

**Platforms:** mobile (native). Web has no equivalent route (see Card 5).
**Comparable:** **Mealime first-run plan setup** — single hero CTA, illustrated empty state with one obvious next-step button ("Set up your week"), preference recap chip row.
**Screenshots:** `plan-01-landing.png`, `tour-05-plan.png`, `tour-ext-50-plan-this-week.png`

**Current Suppr state**
Grey-on-grey screen with: segmented `This week / Shopping` at top, "WEEK OF MAY 7" eyebrow, "Meal plan" h1, two unlabeled circular icon buttons (refresh + sliders), `This week` chip with check + `+ New` dashed chip, a **black 56-px-tall "Plan setup ▶" pill** dominating visual centre, then a faint "Your 7-day plan / Browse recipe library" link, a `Thu TODAY · 1,137 kcal` day card with three meal rows. At bottom: "Add a meal slot."

**Verdict:** BELOW

**Why this verdict**
1. **Eye-magnet is wrong element.** The black "Plan setup" pill has more visual weight than the actual week of meals — an `accordion-collapsed` settings entry made to look like a primary CTA. Mealime would never give a settings disclosure pill primary visual treatment over the user's actual plan.
2. **Two circular icon buttons (refresh + sliders) have no labels, no tooltips.** Honeydew gives them text on first run or pairs them with a one-shot tooltip — Suppr just hopes the user guesses.
3. **"WEEK OF MAY 7 / Meal plan" eyebrow + h1 is a debug-print stack.** Honeydew, Recime, Paprika all show **week range (May 7–13)**, not "WEEK OF MAY 7" — current copy implies a single day. Should be `May 7 – 13` with no separate "Meal plan" label.
4. **`This week` chip with check next to `+ New` dashed chip** — dashed-create-new pattern correct, but the active-state pill is visually identical to a filter chip rather than a week selector. One chip pretending to be a list.
5. **"Your 7-day plan / Browse recipe library"** is a small grey label + blue link reading like a section header even though it's a link. Half-link state unclear.
6. **Thu card kcal target "1,137 kcal" floats at top right with no context** — day total, budget, achieved, planned? Honeydew labels `Planned · 1,137 / 1,800 kcal`.

**States checked:** empty (weak — "Add a meal slot" is text-only, not real CTA), partial (only B/L/D — no Snacks), overflow (`Peanut Butter Prot...` truncates), dark — see Card 6, dark empty-day variant is *better* than light's busy version because the empty-day card uses pill CTAs `+ Breakfast / + Lunch / + Dinner / + Snacks`. **Light should adopt that.**

**Upgrades to reach the bar**
1. **Replace "Plan setup ▶" black pill** with outlined disclosure row (icon + label + caret) at 44px — demote it. (cleanup, mobile)
2. **Label two circular header buttons** ("Regenerate" + "Filters" inline on first visit, collapse to icon-only after). (small build, mobile)
3. **Rewrite eyebrow** from "WEEK OF MAY 7 / Meal plan" to single line `May 7 – 13 · Meal plan`; remove orphan h1. (cleanup)
4. **Promote day-card kcal pill** to `1,137 / 1,800 kcal` with 2-px progress underline. (cleanup, mobile)
5. **Adopt dark-mode empty-day pill row** (`+ Breakfast / + Lunch / + Dinner / + Snacks`) into light theme. (cleanup, both modes)
6. **Hide "Browse recipe library" as separate link** — make it a chip inside day card's "Add a meal slot" pill row. (cleanup)

**Open questions for `ui-product-designer`**
- Is `+ New` (week) meant to spawn brand-new plan, duplicate, or template?
- Should `Plan setup` be inline-expandable or push to sub-screen?

---

### Card 2 — Week grid: day cells, meal slots, fit% treatment

**Platforms:** mobile only.
**Comparable:** **Honeydew week grid** — vertical-scrollable day cards each headed with `Day · ratio·trend dot`, meal images at consistent 64×64, a fit-pill on the right of each meal showing "Fits within: 92%" with inline ring chip. Long names wrap to 2 lines, never ellipse at 14 chars. **Recime** also: per-day macros visible without tapping.
**Screenshots:** `plan-02-generated.png`, `state-50-plan-week.png`

**Current Suppr state**
After generate, top shows `THIS WEEK / Hits your targets 6 of 7 days` summary card with `Shopping list` + `Regenerate` buttons. Then **horizontally scrollable day-pill row** (`Thu 1219 / Fri 1169 / Sat 1142 / Sun 1199 / Mon 1296 / Tue 1200 / Wed 1231`) each with coloured 2-px underline (green/amber/red). Below, full-width "Thu TODAY · 1,219 kcal" day card with three meal rows: 56-px hero image, blue eyebrow, bold recipe title (truncated `Peanut Butter Prot...`), thin gray "429 kcal · P 41g · C 47g..." (Fat truncates). Circular refresh + "Log today" per row. Third row has `0.5x` pill (portion modifier).

**Verdict:** BELOW

**Why this verdict**
1. **Fit % is invisible.** Product has `recipeFitPercent.ts` and summary promises "6 of 7 days on target" — but user can't see *which* day is over-target without arithmetic. Day pills have colour underline but no number / no trend dot. Honeydew uses both. Without per-row fit%, the core differentiator is hidden.
2. **Hero images inconsistent across states** — landing shows emoji on peach background, generated shows generic emoji, populated shows real recipe photos. Three states for same slot is a tier indicator. Paprika/Recime always show photos with fallback hero gradient.
3. **Macro line truncates at 14 chars** — `429 kcal · P 41g · C 47g...` cuts Fat entirely on default-width iPhone. Cronometer/MFP never ship a macro line that can't show all 4 macros.
4. **`0.5x` pill has no label** — what does 0.5x mean? Sits mid-row, overlapping macro line + "Log today" button. Adopt MacroFactor's chip pattern: `0.5× portion`.
5. **"Log today" link as primary row action is wrong.** User on Plan looking at planned meal — implied default is "log as-eaten," not new log. Honeydew distinguishes `Log as planned` from `Edit`.
6. **"Hits your targets 6 of 7 days" panel above day pills doesn't visually correlate to underlines below.** Adopt Honeydew: summary IS the day strip — bold green days, fade over-target day, tiny chevron opens "what went over."
7. **"Howse · 1 member · sharing dinners" row** is household scope — useful but parked between summary and Plan setup. Floats with no anchor. Recime puts household scope inline in day-card eyebrow.

**States checked:** populated standard week (rendered), single-day populated (rendered), empty day inside populated week (`dark-20-plan.png` `Tue · 0 kcal` empty card — cleanest empty-day in feature; light lacks this — drift), overflow long names (weak — truncates), household sharing scope (parked, doesn't anchor), past day (not visible), shopping list mode (not in scope).

**Upgrades to reach the bar**
1. **Add per-recipe fit-pill in row:** `Fits 92%` faint green / `Over by 220 kcal` amber — landed against `recipeFitPercent.ts`. (small build, mobile)
2. **Standardise hero image:** always photo, fall back to deterministic gradient + glyph (project already has this for recipe library — port). Kill emoji-on-pastel-square in landing. (cleanup, mobile)
3. **Show all 4 macros** or replace macro line with 4-cell tile mini-row (Cronometer pattern). Ellipsis must not eat F-value. (cleanup, mobile)
4. **Label portion-modifier pill** `0.5× portion` aligned to row's right edge. (cleanup)
5. **Split "Log today" into two affordances:** primary `Log as planned` button + `…` overflow for edit/swap/move/remove. (small build)
6. **Replace standalone summary panel with day-strip-integrated summary** — bold on-target day count above strip, each day pill click opens meal list below for that day. (small build)
7. **Anchor household scope** into day-card eyebrow. (cleanup)
8. **Adopt dark-mode empty-day `+ Breakfast / + Lunch / + Dinner / + Snacks` pill row** for light theme. (cleanup)

**Open questions for `ui-product-designer`**
- Per-day kcal: is "1,219 kcal" planned total or target? UI implies planned; user expectation implies ratio. Resolve.
- Day-pill underline colour using calorie-ring 3-state (green/red) or amber over-budget (per non-calorie-ring rule)?

---

### Card 3 — Move-meal sheet (mobile-only carve-out)

**Platforms:** mobile only (intentional carve-out — `MoveMealSheet.tsx` is mobile-native).
**Comparable:** **Things 3 quick-action sheet** — pill-button stack, destructive in red, cancel pinned, haptic on every option, smooth iOS-native spring-in. Secondary: Apple Reminders move-to sheet.
**Screenshots:** `state-51-move-meal-sheet.png`

**Current Suppr state**
Native iOS-style action sheet over dimmed plan view. Top: recipe context `Peanut Butter Protein Oats / 429 kcal · Breakfast`. Below: five buttons stacked vertically with pill divider gaps — `Move to another slot…`, `Swap with another meal…`, `Adjust portion…`, **`Remove slot (this day)`** (destructive red), `Cancel`. Destructive matches iOS HIG colour. "(this day)" parenthetical useful — distinguishes from week-wide removal.

**Verdict:** CLOSE (highest-quality surface in Group E — clearest hierarchy, best copy, only one with proper destructive semantics. Stops short of AT BAR for reasons below.)

**Why this verdict**
1. **Three `…` options visually identical** — same colour, weight, no leading icon. Things 3 uses leading glyph (move/swap/scale) so eye scans without reading every word.
2. **Recipe context header buries information.** Should show actual slot acted on — `Breakfast · Thu May 7` — so on multi-tap user knows *which* meal grabbed. Day currently implicit.
3. **No visible haptic confirmation** — verify `expo-haptics` fires on `selectionAsync()` per row, especially destructive (`notificationAsync('warning')`). If absent, P1 — Apple Reminders does this.
4. **`Adjust portion…`** most ambiguous label — stepper? slider? chip row (0.25× / 0.5× / 1× / 1.5× / 2×)?
5. **Sheet corner-radius + translucency** look correct vs iOS native, but destructive label + cancel pill use same gap — Cancel should be visually separated (HIG pattern).

**States checked:** single-recipe selection, destructive primary, cancel pinned. Last-meal-of-day edge unclear. Household sharing scope warning not visible. Dark not captured.

**Upgrades to reach the bar**
1. **Leading glyphs** (`Move`, `Swap`, `ArrowsScale`) using `lucide-react-native`. (cleanup)
2. **Expand recipe context header** to `Breakfast · Thu May 7 · 429 kcal`. (cleanup)
3. **Confirm haptics fire** on each row with `warning` on destructive. (code-check)
4. **Disambiguate `Adjust portion…`** to `Adjust portion (½, 1×, 2×)…` or `Change portion size…`. (cleanup)
5. **Separate Cancel into own group** with iOS standard 8-px gap. (cleanup)
6. **Warning toast on destructive** when household-shared: "Shared with 2 members — remove for everyone or just you?" (small build)

**Open questions for `ui-product-designer`**
- Should `Remove slot (this day)` undo via toast like Today log row?
- Household-shared meal removal semantics — confirm with `ui-product-designer`.

---

### Card 4 — Generate-plan / Regenerate flow

**Platforms:** mobile only.
**Comparable:** **Recime auto-plan recap** — 1-line headline with stacked bar viz beneath, single `Refine` CTA opens constraints sheet. **Honeydew** pairs `Regenerate` + `Adjust constraints`.
**Screenshots:** `plan-02-generated.png`

**Current Suppr state**
Pale lilac panel (~1/4 viewport), `THIS WEEK` header, h2 `Hits your targets 6 of 7 days`, body `Some days run over target. Tap a meal to swap or adjust the portion.`, two buttons: filled `Shopping list` (cart icon) + outlined `Regenerate` (refresh icon). Below: day-strip with coloured underlines.

**Verdict:** BELOW

**Why this verdict**
1. **No visualisation of 6/7.** Headline tells you 6 of 7 — but a 7-cell stacked bar (or seven dots) would make this glanceable. Recime puts viz next to headline.
2. **`Shopping list` primary next to `Regenerate`** — but `Shopping list` is also top-level segment 200px above. Primary CTA duplicates a tab toggle. Honeydew never duplicates navigation in CTA.
3. **`Regenerate` is unmodified** — Honeydew/Recime offer `Regenerate` *and* `Adjust constraints` paired. A one-shot regenerate without knobs is gambling.
4. **"Some days run over target..." copy** is instruction text — should be one-time tooltip on first generation, not permanent body. After day 2 it's noise.
5. **Pre→post generate transition is invisible** — no skeleton, no progress. For >500ms server-side gen, skeleton-shimmer or "Cooking up your week…" hero is the bar.
6. **No "what changed" diff on regenerate.** Recime tells you which days changed; Suppr swaps silently. Without a diff, can't tell if regenerate did anything.

**States checked:** post-first-generation (rendered). Post-regenerate diff (not visible). Generation in progress (not visible). Generation error (not visible). Partial generation (unknown). 7-of-7 on target (unknown).

**Upgrades to reach the bar**
1. **Add 7-dot stacked viz** inline with headline. (cleanup, mobile)
2. **Drop `Shopping list` from post-gen panel** — duplicates segmented control. Make post-gen primary `Adjust constraints`. (cleanup)
3. **Pair `Regenerate` with `Adjust constraints`** in 2-button row, constraints primary. (small build)
4. **Move instruction copy to one-time tooltip** dismissed by tap. (cleanup)
5. **Add generation skeleton state** (Cal AI-style hero: "Generating your week…" + 3-state progress). (new build, mobile)
6. **Show regenerate diff toast** — "3 meals swapped. Mon dinner now under target." (small build)

**Open questions for `ui-product-designer`**
- Is `Adjust constraints` already exposed via Plan setup accordion? If so, black pill should link from regenerate.
- Is generation server-side (Supabase edge function) or client-side (`mealPlanAlgo.ts`)?

---

### Card 5 — Web Plan parity

**Platforms:** web (desktop + mobile-web).
**Comparable:** **Honeydew web app `/plan`** — same week grid as iOS, drag-and-drop reorder (web-only affordance), keyboard shortcuts (`G P`), side-rail summary. **Recime web `/plan`** matches mobile feature parity.
**Screenshots:** `web-desktop-authed-planner.png` (shows public landing), `web-mobile-authed-planner.png` (**404 — "We couldn't find that page"**)

**Current Suppr state**
**There is no web Plan route.** `web-mobile-authed-planner.png` resolves to 404. `web-desktop-authed-planner.png` shows public landing instead. Code confirms: `app/planner/` directory does not exist; only mobile has `apps/mobile/app/(tabs)/planner.tsx`.

**Verdict:** EMBARRASSING (on web's own platform)

**Why this verdict**
1. **Strategic direction 2026-04-27 locked 4-tab model (Today / Plan / Recipes / More).** Plan is one of the four spines. Having zero web Plan surface is not parity drift — it's a missing tab on half the product. The 404 also breaks URL-share path: any link to `/planner` from email, push, or marketing dies.
2. **Honeydew and Recime both ship web planners with mobile feature parity.** Drag-and-drop, keyboard nav, side-panel fit% — none of which Suppr ships. Category-baseline gap.
3. **The 404 itself is a content failure** — recovery CTAs are `Back to Today` and `Browse recipes`, both dodging user's actual intent (they wanted to plan). A web Plan stub should at minimum redirect to "Plan is mobile-only for now" notice with TestFlight CTA, not a 404 implying URL is broken.
4. **`Move-meal mobile-only` is documented** — but Move-meal is one feature *inside* Plan. The whole Plan tab being mobile-only is not on documented carve-out list and **must not be confused with the Move-meal carve-out**.
5. **Search ranking + GTM impact:** competitors' `/plan` pages rank for "meal plan app" — Suppr's missing route means zero SEO surface for planning capability.
6. **Mobile-web degradation:** opening `/planner` on phone browser serves 404 with no "open in app" deep-link CTA. Linear/Notion/Vercel all handle this with smart banner.

**States checked:** desktop authed (404 / shows landing — confirmed), mobile-web authed (404 — confirmed), unauthed untested.

**Upgrades to reach the bar**
1. **Ship `/planner` on web as stub minimum** — read-only weekly grid from same `meal_plan` table, no Move-meal sheet (documented carve-out applies *within* Plan, not for Plan itself). (new build, web)
2. **Until web Plan ships**, replace 404 at `/planner` with `Plan is in the iOS app today — open Suppr on iOS / Join TestFlight` page. (small build, web)
3. **"Open in app" smart banner** on mobile-web for any deep-link hitting mobile-only surface. (small build, mobile-web)
4. **`/plan` redirect** to `/planner` (or vice versa — pick one canonical and 301 the other). (cleanup, web)
5. **Decision-log entry** explicitly recording "Web Plan deferred" or "Web Plan committed" — currently there's documented carve-out for Move-meal but not parent surface. (cleanup, docs)

**Open questions for `ui-product-designer`**
- Is web Plan deferred (commit to shipping) or descoped (commit to never shipping)? Escalate to Grace / `journey-architect`.
- Does `meal_plan` Supabase table have RLS / read-paths usable from web?

---

### Card 6 — Dark mode parity

**Platforms:** mobile native dark.
**Comparable:** **Things 3 dark mode** (per-card elevation via tone, not heavy borders) + **MacroFactor dark** (data viz keeps green/amber/red legible against `#0A0A0A`).
**Screenshots:** `dark-20-plan.png`

**Current Suppr state**
Near-black warm grey background. Segmented control: active segment slightly lighter fill — barely distinguishable. Two circular icon buttons in header now have soft border ring (correct). `This week` chip blue tint, `+ New` chip dashed grey. "Howse · 1 member · sharing dinners" pill row has soft elevated card tone (good). `Plan setup ▶` pill now elevated dark, much less visually loud than light (good — light should do this too). `Tue · TODAY · 0 kcal` empty-day card with proper copy and **4 pill CTAs** (`+ Breakfast / + Lunch / + Dinner / + Snacks`) in blue tint — **best empty-day state in the entire feature, missing from light mode.**

**Verdict:** CLOSE

**Why this verdict**
1. Empty-day card with 4 pill CTAs is genuinely good and matches MacroFactor's dark pattern. **But state is only visible in dark — light mode shows "Add a meal slot" as static text.** Drift between modes.
2. Segmented control's active state has too little contrast — at distance, both segments look inactive. Apple HIG dark uses ~12% lighter fill on active; Suppr looks ~6%.
3. Day-pill underlines (visible in light's `plan-02-generated.png`) need verification in dark — not visible because no populated week in dark.
4. Recipe photos in dark not visible. Honeydew dims to ~85% in dark to reduce eye-burn; verify.
5. `Plan setup ▶` chevron barely visible against elevated card — 1 shade brighter or filled outline.
6. `Browse recipe library` link in blue is only saturated-blue text in viewport — pulls eye from day card. Use demoted treatment.

**States checked:** dark empty-day (strong), dark populated (gap), dark Move-meal sheet (gap), dark generate panel (gap), dark shopping list (gap).

**Upgrades to reach the bar**
1. **Port dark-mode 4-pill CTA empty-day row to light mode.** (cleanup, light)
2. **Boost segmented-control active contrast in dark** to ~12%. (cleanup)
3. **Brighten `Plan setup ▶` chevron** or filled chevron-right glyph. (cleanup)
4. **Capture missing dark screenshots** (populated, Move-meal, generate, shopping) and re-audit. (audit-blocking)
5. **Demote `Browse recipe library` link colour** to match secondary text. (cleanup)

**Open questions for `ui-product-designer`**
- OLED-true-black variant or just dark grey? Current looks slate, not OLED black.

---

## Group E verdict summary

Plan is the **second-biggest gap in the product after the missing web surface itself**. Mobile native Plan does table-stakes work (week grid + generate + move-meal sheet) but doesn't ship the differentiators it already computes — `recipeFitPercent.ts` is invisible on row level, 6-of-7 headline has no viz, Plan setup pill steals eye from actual meals. Move-meal is strongest surface, only one approaching AT BAR — only place hierarchy, destructive semantics, and labelling clearly thought through. Dark-mode empty-day with 4 pill CTAs is better than light's "Add a meal slot" text — one-day fix and parity win. But load-bearing gap is **web Plan doesn't exist at all** — Suppr currently can't honour "one product across web and mobile" promise on the Plan spine until web stub ships or Plan is formally decisions-logged as mobile-only. **Refuse-to-pass: 404 at `/planner` on web (replace with stub or smart banner this week), missing per-row fit% on mobile, light-mode empty-day card.**

---

# Group B — Onboarding (web + mobile)

**Scope:** Canonical `/onboarding` flow on web + mobile. 13 steps: `welcome → signup → goal → sex → age → height → weight → activity → pace → diet → strategy → reveal → data-bridges`. Plus `/onboarding-v2` redirect.

**Capture caveat:** 11 of 13 mobile-native step captures are stale 404s (dated 2026-05-05 11:24); 3 more render wrong destinations (Today / Log sheet, not onboarding). Source-audited the affected steps; flagged pipeline drift as a cross-cutting P0.

**Overall verdicts at a glance:**
- B1 Welcome (mobile native cold-open) — **CLOSE**
- B1 Welcome (web public, both viewports + dark) — **CLOSE**
- B2 Goal-setting — **CLOSE**
- B3 Sex → Age → Height → Weight — **Sex AT BAR / Weight AT BAR / Age BELOW / Height CLOSE**
- B4 Activity & Diet — **Activity AT BAR / Diet CLOSE**
- B5 Strategy → Reveal — **BELOW BAR vs Cal AI (biggest gap in this group)**
- B6 Permissions ask — **CLOSE**
- B7 Recipe import + first-recipe seed — **Import-card CLOSE / Seed picker BELOW**
- B8 Web equivalent — **CLOSE**
- B9 `/onboarding-v2 → /onboarding` redirect — **BELOW BAR**

### Feature B1: Welcome / cold-open

**Platforms:** web (desktop + mobile-web, light + dark), mobile native
**Comparable:** **Cal AI cold-open** — value prop in one image (real photographed plate with kcal overlay), one headline, one CTA, one secondary. Also **Linear `/signup`** — wordmark + headline + minimal proof + one CTA, no scrolling on first viewport.
**Screenshots:** `web-desktop-onb-01-welcome.png`, `web-mobile-onb-01-welcome.png`, `web-desktop-dark-onboarding.png`, `web-mobile-dark-onboarding.png`, `tour-ext-70-onboarding-entry.png`, `route-onboarding-canonical.png`

**Current Suppr state**
*Web:* two-column on desktop with floating product-preview tile stack ("IMPORTED · Korean beef bowl", calorie ring "380", "Protein intake up 14%" pill); single-column on mobile-web with three-row green-tick checklist. Headline "Join the Suppr Club." (web carve-out copy). Two side-by-side CTAs equal weight: "Join the club — free" + "I'm already a member." *Mobile native:* lavender→pink gradient, floating "IMPORTED · Sheet-pan chicken from instagram.com" card + USDA pill, "S" tile, "Eat well, without overthinking it." headline, "Get started" + "Have an account? Sign in."

**Verdict:** CLOSE (both surfaces)

**Why this verdict**
1. **Web floating-preview tile is generic.** Cal AI shows the exact thing the product does in product-state photography. Suppr's preview shows a mock dashboard, not a thing the user is about to do.
2. **Mobile floating preview's "Example" overline** (added per 2026-05-11 customer-lens P1 fix) works for honesty but loses activation magnetism.
3. **Headlines name identity, not benefit.** Web "Join the Suppr Club." (carved out) and mobile "Eat well, without overthinking it." both soft. Cal AI runs "Lose weight with AI."
4. **Cookie consent intrudes** on web mobile-web ~12% of first viewport.
5. **Dark mode (web)** gradient overpowers content; right-column floating tile loses contrast against the wash.
6. **No social proof, no scarcity, no testimonial, no live count.** Three green-tick rows are mechanical features.
7. **Three different proof affordances** across web desktop (floating tiles) / web mobile-web (checklist) / mobile native (USDA pill). Not on documented carve-out list. Either consolidate or document.

**Upgrades to reach the bar**
1. Replace web marketing-tile with one real, captioned product moment (real Suppr Today screenshot). (redesign, web)
2. Add a single proof line above CTA on both surfaces. (cleanup, web + mobile)
3. Move web cookie consent to bottom-right pill. (small build, web)
4. Dampen dark-mode gradient by 50%. (cleanup, web)
5. Promote mobile native "Sign in" out of "Have an account?" prefix. (cleanup, mobile)
6. Unify the three proof affordances across platforms. (small redesign)

### Feature B5: Strategy → Reveal — THE NORTH-STAR MOMENT (judged harshly)

**Platforms:** mobile native + web. Source-audit only (captures stale).
**Comparable:** **Cal AI's "We've built your plan" reveal.** Pre-reveal 6-bullet animated checklist (~2.5s anticipation), then reveal screen: single hero number at ~80pt with count-up animation, animated ring drawing concurrently, 3 macro pill-cards with their own count-up animations + coloured progress bars, "Why this number?" expander with the BMR + activity + goal math, "Your plan vs the average for someone like you" comparison row, "Continue to your plan" full-bleed CTA, post-state "what happens next" 3-step roadmap.

**Current Suppr state (from source `steps/reveal.tsx`)**
Overline "YOUR DAILY TARGET", title "Here's what your day looks like.", 220×220 ring (gradient stop `Accent.primaryLight → MacroColors.fat`) drawing in ~1.2s, centre kcal number tabular-nums 56pt count-up cubic-ease 1.2s, kcal unit label, goal-blurb sentence varying by `state.goal`, 3 macro tiles with percentage + value + progress bar, BMR + TDEE side-by-side card, methodology footer (Mifflin-St Jeor + re-calibration over 2 weeks).

**Verdict:** BELOW BAR

**Why this verdict (this is the audit's biggest single gap)**
1. **No anticipation beat before the reveal.** Cal AI runs a 6-line checklist animation BEFORE the reveal — Suppr cuts from Strategy directly into Reveal. No prior anticipation manufacturing.
2. **Title is descriptive, not declarative.** "Here's what your day looks like." is too mild. Replace with "Your daily plan is ready." or "This is your number."
3. **Ring gradient mixes brand token with macro token** (`Accent.primaryLight → MacroColors.fat`) — reads as "two unrelated colours interpolating" rather than "brand colour in motion."
4. **No "why this number" explainer.** Goal-blurb describes the maths but doesn't *show* it. No BMR + activity + goal adjustment breakdown visible.
5. **Macro tile percentages calculated client-side and rendered in tabular-nums** (correct). But % sits separate from g value — should pair tightly inline ("129 g · 32%").
6. **No "compared to" line.** No anchor for whether 1,800 kcal is high, low, or normal for someone like the user.
7. **Methodology note is doing trust-posture work** — keep it, but make it bolder. Currently 11pt tertiary at bottom.
8. **Skipped-weight branch is honest but reads as a downgrade.** Calibration-copy fallback sets user up to feel they got a worse version.
9. **No "what happens next".** After reveal, only action is Continue → data-bridges. No 3-step seeding of "what to eat next" north-star at the moment of highest attention.
10. **No haptic on count-up landing.** Number arrives without acknowledgment.

**States checked:** standard (unverified pixel), weight-skipped (calibrate-copy fallback weak), goal=maintain (correct copy), goal=recomp (works but doesn't visualise protein-anchor logic). Dark unverified.

**Upgrades to reach the bar**
1. **Anticipation beat between Strategy and Reveal** — 6-line "Building your plan…" overlay resolving into Reveal. (new build, web + mobile shared)
2. **Re-title** to "Your plan is ready." (cleanup)
3. **Show the maths** — expandable "How we got here" with BMR + Activity + Goal adjustment = Target. (cleanup)
4. **Pair macro % with g inline.** (cleanup)
5. **Add "compared to" anchor.** Run by trust posture. (small build)
6. **Hit haptic at count-up terminus** on mobile. (cleanup)
7. **Promote methodology footer** to a "How we calculate" chip-expander. (cleanup)
8. **Rebuild weight-skipped branch** as a soft-illustration moment. (small build)
9. **Add "What happens next" 3-step card** seeding north-star. (small build)
10. **Unify ring gradient** to single brand gradient. (cleanup)

### Feature B9: `/onboarding-v2 → /onboarding` redirect

**Comparable:** **Linear's silent 308.** No chrome flash, no perceptible latency.
**Screenshots:** `route-onboarding-v2-entry.png` (shows "Not found" header chrome briefly), `route-onboarding-v2-redirect.png` (correctly lands Welcome)

**Verdict:** BELOW BAR

**Why this verdict**
1. `+not-found` page-header is visible for ≥1 frame on transit. The "Not found" chrome reads as a fatal error to a first-time user, even disappearing in 200ms.
2. Should convert to a server-side / route-level redirect that doesn't mount `+not-found`. Expo Router's `<Redirect>` should run before `+not-found` resolves.

**Upgrades to reach the bar**
1. Investigate why Expo Router's `<Redirect>` mounts after `+not-found` paints. (cleanup)
2. Add `redirect_followed` analytics event firing on mount of `onboarding-v2.tsx`. (cleanup)
3. Document end-of-life date for the redirect (6-12 months). (decision)

## Group B verdict summary

The flow's structure is right and the trust posture is exemplary — Sex's inclusive copy, Weight's diversity-inclusive skip path, the Reveal's Mifflin-St Jeor methodology honesty are all moves Cal AI / MacroFactor would not make. Where Suppr falls short is on the *moments*: the Reveal does not feel like a moment, the Welcome floating preview reads as marketing not proof, the legacy redirect flashes a "Not found" chrome, and Age doesn't carry the same explainer-pattern hygiene as Sex. **Two weakest moments: the Reveal (BELOW BAR vs Cal AI) and the `/onboarding-v2` redirect (BELOW BAR vs Linear's silent 308).** The flow does NOT have the "wow at the reveal" that Cal AI achieves — that gap is the single most important blocker on this group. **Refuse-to-pass: Reveal anticipation + math reveal + "what happens next" card; redirect chrome flash; Welcome proof unification across platforms; Age explainer + DOB toggle; Goal icon library migration (Ionicons → lucide).**

**Cross-cutting (Group B):** Stale screenshot capture pipeline is itself a P0 — 11 stale captures means Grace cannot validate visuals before push. Icon library inconsistency (Goal uses Ionicons; rest of flow uses lucide). Auto-advance pattern inconsistent across decision steps.

---

# Group F — Mobile Recipes (Library + Discover + Detail + Cook + Import)

**Scope:** Library landing + saved + filters + search, Discover hero + feed, Recipe detail, Cook mode, Create-recipe manual entry, Recipe import flow (the viral lead bet), Recipe verify step, Web Recipes parity, Dark mode parity.

**Overall verdicts:**
- Library landing — **CLOSE**
- Library hero card — **BELOW**
- Discover feed — **BELOW**
- Recipe detail — **BELOW**
- Cook mode (populated) — **UNVERIFIABLE (only empty state captured)**
- Cook mode (empty) — **CLOSE**
- Create recipe — **BELOW**
- **Recipe import flow** — **BELOW (escalated — this is the viral lead)**
- Recipe verify step — **EMBARRASSING**
- Web Recipes parity — **EMBARRASSING (`/recipes`, `/library`, `/discover` all 404)**
- Dark mode parity — **CLOSE**

### Highlight 1: Recipe verify step — **EMBARRASSING**

**Comparable:** **Recime — Verify ingredients.** Skeleton screen for ingredient rows, narrated parsing status, per-row confidence bar, single tap to override low-confidence.
**Screenshots:** `route-recipe-verify.png`, `tour-ext-20-recipe-verify.png` — **both show a blank screen with a centred spinner. No header, no skeleton, no fallback content, no error timeout.**

**Why EMBARRASSING:**
1. Generic spinner over blank background. No skeleton of eventual content layout. User has zero context for what's happening.
2. **No header, no back button, no Cancel.** If parsing takes >5s the user has no escape hatch. They might force-quit the app, abandoning the import.
3. **No timeout / failure copy.** Spinner presumably spins forever.
4. **No "What we're doing" reassurance.** Cal AI and Recime narrate the parsing step ("Reading recipe… / Matching ingredients… / Calculating nutrition…").
5. **Two screenshots, both identical spinners** — there isn't even a screenshot of the verified-output state to audit. **The most important step in the viral growth funnel has no visible success-state coverage.**

**Upgrades:** Replace generic spinner with skeleton screen + status narration + cancel + 8s timeout + per-row confidence treatment when results arrive.

### Highlight 2: Recipe import entry point — **viral growth lead, BELOW**

**Comparable:** **Recime — Import recipe.** Paste URL → instant parse with loading skeleton showing parsed image + title in real-time → automatic ingredient extraction → manual override → save. For Reels/TikTok: share-to-app deep linking + caption parsing.

**Why BELOW:**
1. **Import entry point is hidden.** Only surfaces from Today add-sheet, share-extension, or Discover *loading* tile. Not findable from the Library tab. User's mental model: "tap + on Recipes → there should be a Paste link option." There isn't.
2. **"+ Create" on Library leads to a manual form**, not a multi-source action sheet. Costs a viral-growth tap.
3. **No "from your clipboard" auto-detect.** When user opens app immediately after copying a TikTok/Instagram URL, app should detect clipboard contents and offer "Import this recipe?" (Notion, Linear, Things 3 all do this).
4. **No share-extension confirmation flow screenshot.** Highest-conversion path for Reel-import not visually validated.

**Upgrades — ranked by viral impact:**
1. **Surface "Import from a link" as a permanent first card on Discover** (not loading-state only). Cheapest, biggest discoverability win.
2. **Make "+ Create" a multi-source action sheet** with "Paste link" / "Paste TikTok URL" / "Paste Instagram URL" / "Scan photo" / "From scratch."
3. **Auto-detect clipboard URLs on app foreground.** If clipboard contains TikTok/Instagram/YouTube/recipe URL, offer "Import this recipe?" as one-tap toast.
4. **Screenshot every state of import flow** — release-gate blocker.

### Highlight 3: Web Recipes — **EMBARRASSING**

**Screenshots:**
- `web-desktop-authed-recipes.png` — 404 ("We couldn't find that page")
- `web-desktop-authed-library.png` — 404
- `web-desktop-authed-discover.png` — public marketing landing (authed user routed to marketing!)

**Why EMBARRASSING:**
1. **`/recipes` returns 404 to authed users. `/library` returns 404. `/discover` redirects authed users to marketing.**
2. **The 404 page's CTA says "Browse recipes" which routes to `/recipes` which 404s.** Error page recommends the broken page.
3. **Strategic principle "web and mobile must stay in sync at all times" violated at routing level** — not at design level. Below-bar at design is fixable; absent-route is shipping-blocker.

## Group F verdict summary

Group F mid-pack at best with two outright shipping-blockers. Library + Discover are CLOSE-to-CLOSE in design language but lose to Recime on rail variety, to Paprika on density, and to both on no-photo placeholder. Recipe detail BELOW Paprika because servings stepper undersized and 4-tile macro pattern wrong for this surface. Cook mode cannot be judged (only empty-state captured — process P0). Create-recipe BELOW because "+ Create" hard-routes to manual form when the viral growth lead bet demands a multi-source action sheet. **Recipe verify step is EMBARRASSING.** **Web Recipes is EMBARRASSING.** Dark mode CLOSE and reveals a better deterministic-placeholder treatment than light mode. **Refuse-to-pass: web Recipes routes (P0), import flow entry from Library (P0 — viral growth blocker), recipe verify skeleton, library hero placeholder, recipe detail servings stepper + sticky footer.**

---

# Groups C + G + I — Auth, Settings, Paywall

**Scope:** Auth & account (web + mobile), More tab Settings + Profile (mobile), Paywall (mobile + web pricing).

**Comparables:** Linear/Stripe/Notion/Apple Health for auth; Linear settings/Apple iOS Settings/Stripe Dashboard for settings; Calm/Headspace/Cal AI/Duolingo Super/RevenueCat sample for paywall.

**Project context:** Pricing default divergence documented (web monthly / mobile annual). Delete-account flow already wired. UK/EU VAT-inclusive required.

### Highlight: Mobile paywall

**Comparable:** **RevenueCat's published sample paywall** + **Calm + Cal AI.** Single value-prop hero, plan toggle (monthly/annual) with savings tag, feature checklist with clear Free vs Pro differentiation, trial framing, restore-purchase + manage-subscription affordances, dismissible cleanly.

**Screenshots:** `route-paywall.png`, `tour-15-paywall.png`

**Current state (inferred):** Mobile paywall defaults to annual per documented divergence. Trial SKU constraint. Need to verify trial-framing, restore-purchase, manage-sub affordances are at the bar of the RevenueCat sample.

**Verdict:** Cannot fully audit without dark capture + interaction states. Provisional: **CLOSE** based on light captures.

### Web pricing surface — see Group A Card 2 (BELOW BAR / P0 VAT exposure)

## Groups C+G+I verdict summary

Auth surfaces are CLOSE — sign-in/sign-up clean, magic-link option present. Settings hub is CLOSE with search input + section structure. Profile screen needs density audit. Destructive actions (reset modal + delete account stage 1) are correctly wired (already in code per project memory). Paywall needs dark capture before final verdict; web pricing surface has P0 VAT exposure already covered in Group A.

**Refuse-to-pass:** P0 VAT line on web pricing (Group A); paywall restore-purchase + manage-subscription affordances visible on first interaction; auth-wall H1 currently uses marketing copy instead of auth-specific copy.

---

# Group J — Mobile stack screens (long tail)

**Scope:** Fasting (idle + active), Shopping list, Barcode scanner, Notifications hub + permission prompt, Health Sync, Import shared, Nutrition sources, Targets/TDEE, Household settings, What's new, Food search modal.

**Overall verdicts:**
- Fasting tab landing — **BELOW BAR vs Zero**
- Fasting active timer — **BELOW BAR vs Zero**
- Shopping list — **BELOW BAR vs AnyList**
- Barcode scanner — **UNAUDITED (light)** / dark frame finder CLOSE vs MFP
- Notifications hub — **CLOSE vs Linear**
- Notification permission prompt — **EMBARRASSING vs Cal AI (capture renders as skeleton)**
- Health sync — **CLOSE vs Apple Health**
- Import shared — **AT THE BAR vs Paprika/Recime**
- Nutrition sources — **CLOSE vs MacroFactor**
- Targets / TDEE — **BELOW BAR vs MacroFactor**
- Household settings — **CLOSE vs Linear settings**
- What's new — **CLOSE vs Linear changelog**
- Food search modal — **EMBARRASSING vs MFP search**
- Dark mode parity — **INCOMPLETE (≥8 surfaces lack dark capture)**

### Highlight: Food search modal — **EMBARRASSING**

**Comparable:** **MyFitnessPal — food search.** Search input pinned top, immediate recents below (chips + rows), category tabs, barcode scan inline, search-as-you-type with brand attribution, swipe-to-quick-log.

**Current Suppr state (`route-tabs-search.png`):** Large "Food search" title, subtitle "Search foods and log portions.", single text input pre-filled "apple", brand-blue "Search" button. **Empty space until tab bar. No recents. No category tabs. No barcode-from-search. No results-as-you-type.**

**Why EMBARRASSING:**
1. MFP shows recents on input tap. Suppr shows nothing — biggest UX miss in Group J.
2. "Search" requires explicit button tap. Modern food-search is search-as-you-type debounced 200ms.
3. No barcode glyph inline (MFP has this).
4. No category filter (saved / branded / recents scoping).
5. Pre-filled "apple" is test artefact — affordance unclear.

**Upgrades:** Render recents on screen-mount, search-as-you-type, barcode glyph inside input, category tabs, drop subtitle.

### Highlight: Notification permission prompt — capture failure

**Screenshots `route-notifications-prompt.png` + `tour-ext-21-notifications-prompt.png` both render as near-blank skeleton.** Either capture happened before screen rendered, or screen is not built. **Re-capture immediately** — release-blocker if real.

### Highlight: Fasting active timer

**Comparable:** **Zero — active state pattern.** Bold filled progress ring, milestone labels ("Glycogen depleting" at ~10h, "Ketosis" at ~14h), projected end time, "End Fast" effortful (long-press or sheet).

**Current Suppr state (`state-21-fasting-active.png`):** Thin gradient ring (identical to idle), `00:00:07` digital clock heavy weight, "Fasting" subtitle + "16:8 — 16h fast, 8h eat", two timestamps "8:08 pm Started" / "12:08 pm Goal" (green pre-completion!), single outlined "End Fast" button.

**Why BELOW:**
1. **Ring never fills.** Idle and active visually identical — only delta is clock face.
2. **No fasting stage / milestone labels.** Zero surfaces these; Suppr has none.
3. **"End Fast" one tap.** Zero hides ending behind long-press because fat-finger at 15h50m of 16h fast is real pain.
4. **Goal time uses success green pre-completion.** Pre-goal, that should be neutral.
5. **No projected fast outcome.** Zero shows "Break fast in 11h 52m."
6. **No haptic/celebration at milestones.**

## Group J verdict summary

Long tail of stack screens where Suppr drifts furthest from the canonical Today/Plan/Recipes spine. Two surfaces AT/NEAR bar (Import shared, Notifications hub empty), four CLOSE with cleanup (Nutrition sources, Health sync, Household, What's new), five BELOW (Fasting idle, Fasting active, Shopping, Targets, Food search), one EMBARRASSING (Notification permission). **Single most urgent fix: Food search (J13)** — BELOW vs MFP AND strategic-direction violator against canonical Log sheet. MFP refugees expect this on day one. Dark mode parity unknown for ~8 J-group surfaces.

**Refuse-to-pass:** Food search recents-on-mount + search-as-you-type; Notification permission prompt re-capture or build; Fasting active ring fill + milestone labels; Shopping list aisle-based categories + checkboxes; Targets truncated date string ("≈ 15") cleanup.

---

# Groups K + L — Web product surfaces + Mobile web

**Scope:** Every authed web product surface at desktop 1440×900 and at iPhone 13 viewport (mobile web).

## CRITICAL META-FINDING — read this first

**Nine of the ten "authed" desktop screenshots are 404s, redirects to landing, or unauthed Sign-in walls.** Only `web-desktop-authed-fasting.png` and `web-desktop-authed-account-billing.png` (which bounced to sign-in wall) render real product chrome.

**What's actually rendered:**

| File | Rendered | Why |
|---|---|---|
| `web-desktop-authed-tracker-today.png` | Public landing | `/tracker-today` route does not exist |
| `web-desktop-authed-planner.png` | Public landing | `/planner` route does not exist |
| `web-desktop-authed-recipes.png` | 404 card | `/recipes` route does not exist |
| `web-desktop-authed-library.png` | 404 card | `/library` route does not exist |
| `web-desktop-authed-discover.png` | Public landing | `/discover` route does not exist |
| `web-desktop-authed-shopping.png` | 404 card | `/shopping` route does not exist |
| `web-desktop-authed-fasting.png` | Real `/fasting` page (minimal stub) | Route exists |
| `web-desktop-authed-account-settings.png` | 404 card | `/account/settings` route does not exist |
| `web-desktop-authed-account-profile.png` | 404 card | `/account/profile` route does not exist |
| `web-desktop-authed-account-billing.png` | Unauthed sign-in wall | Route exists; harness session issue |

**Mobile-web variants exhibit identical pattern.**

**This is not just a screenshot-harness bug — it's a structural surface-discoverability problem.** Web canonical authed product is a single-page app at `/home?view={today|planner|library|shopping|discover|progress|settings}`. There are no top-level URLs for any product surface other than `/home`, `/account/billing`, `/fasting`, `/recipe/[id]`, `/creator/[id]`. **Notion, Linear, Stripe Dashboard, Cronometer all give every tab a real URL.** That is the headline finding of this audit.

### Highlight: Web Fasting (`/fasting`) — only real authed surface that rendered

**Comparable:** **Zero web companion + Apple Health Fasting.** Big circular progress timer, schedule status header, preset chips, scheduled times, last-7-fasts strip.

**Current Suppr state:** Very minimal — a back-arrow + "Fasting" H1 in a card top-left. Single card centered labelled "Intermittent Fasting" with four chips (16:8 / 18:6 / 20:4 / 14:10) and full-width "Start 16:8 Fast" button. **Vast empty white area below.** No timer ring. No history. No "Why fasting?" copy. No estimated next eating window. Card 460px wide, anchored top-left'ish on 1440×900. The remaining horizontal real estate is grey nothing. **A centred 460px card on desktop is mobile-web design squashed into a window.**

**Verdict:** BELOW BAR vs Zero / Apple Health.

## Groups K+L verdict summary

**Group K: EMBARRASSING.** Nine of eleven cards rendered either 404, redirect to public landing, or auth wall. The one card that rendered real authed product (`/fasting`) is a one-card stub. Underlying root cause: web authed product is a single-page SPA at `/home?view=*` with no top-level URLs per surface. **Group L: EMBARRASSING / unknown.** Same root routing issue compounded by mobile-web being the ONLY phone experience for non-iOS audience. Cookie banner consumes 25–30% of phone viewport. There is no captured proof that mobile-web authed product works at all beyond auth wall and fasting page.

**Refuse-to-pass:** Web routing contract (every authed surface needs a real URL — `/today`, `/plan`, `/library`, `/discover`, `/shopping`, `/account/*`); web fasting expansion to Zero/Apple Health bar; cookie banner trim to single-line 52px on all platforms; auth wall H1 ("Meal plans that hit your macros" → "Sign in to Suppr"); re-capture web authed flows once routing fixed.

---

# Group H — Mobile Progress + Drill-downs + Weight Chart (live-branch focus)

**Scope:** Mobile Progress tab landing, weight chart (canonical card, live branch), WeightTrendHeader, AllWeightDataSheet, LogWeightSheet, Progress metric drill-downs (Calories This Week), Macro Detail (Protein/Carbs/Fat/Fiber), Burn Detail (Activity Bonus), Meal Nutrition, Targets, Weekly Digest, dark-mode parity.

**Splash caveat:** `tour-07-progress.png` is the splash, not Progress (captured during Maestro warm-up). Multiple filename mismatches (route-progress-metric-weight.png shows Calories This Week, etc.) — flagged for capture follow-up.

**Top verdicts:**
- H.1 Progress tab landing — **CLOSE**
- **H.2 Weight chart (canonical card)** — **CLOSE (post-2026-05-11 rebuild; was BELOW)**
- H.3 WeightTrendHeader — **CLOSE**
- H.4 All-data weight list — **CLOSE**
- H.5 Log weigh-in sheet — **AT THE BAR**
- H.6 Calories drill-down — **BELOW**
- H.7 Macro detail — **BELOW**
- H.8 Burn detail — **BELOW**
- H.9 Meal nutrition detail — **EMBARRASSING (only error state captured)**
- H.10 **You → Settings → Daily targets** (route `/targets`; was called "Targets summary" — naming now corrected per nav path) — **CLOSE**
- H.11 Weekly Digest — **CLOSE**
- H.12 Dark-mode parity — **CLOSE**

### Feature H.2: Weight chart  ←  **CANONICAL CARD (live branch focus)**

**Platforms:** mobile (light primary; dark for chart route not directly captured)
**Comparable:** **Withings — Health Mate weight trend.** Auto-adapting period (`1W / 1M / 3M / 1Y / All`), faded raw points (~25% opacity) with bold smoothed trend line on top, gentle gradient fill under line, halo dot on latest weigh-in, tap-and-drag scrub with floating value pill that snaps to nearest entry, header "WEIGHT / TREND" two-column chip with delta + signed arrow, in-chart goal line with end-of-line goal label, period label centred under chart, "Show all data" entry to chronological list.
**Screenshots:** `route-weight-tracker.png`, `tour-10-weight-tracker.png`, `dark-31-progress-scrolled.png` (cropped). Code: `WeightChart.tsx`, `WeightTrendHeader.tsx`.

**Current Suppr state**
Three different presentations of the same data co-exist in the app today:
- (A) **Inline summary on Progress tab** — small unlabelled sparkline.
- (B) **Old weight-tracker chart** at `/weight-tracker` — pre-2026-05-11 chart with 1M/3M/12M/All pills + historical depth card + chart with floating axis values + goal caption.
- (C) **New chart** (post-2026-05-11) — `1W / 1M / 3M / 1Y / All` pills, halo dot on latest, dashed goal line, tooltip "54.6 kg · w/c 4 May."

**Verdict:** CLOSE (was BELOW pre-2026-05-11 rebuild)

**Why this verdict — Withings parity gaps**

1. **Three co-existing presentations** of the same data is the single biggest pixel-level problem. Withings has *one* canonical chart at two zoom levels (summary tile → detail screen) rendered by the same component. **Refuse-to-pass: the chart consolidation Phase 2 work in `docs/decisions/2026-05-11-weight-chart-consolidation-plan.md` must land before this is AT BAR.**

2. **Raw points vs trend line weighting.** New chart correctly distinguishes smoothed MA line from raw dots (`WeightChart.tsx:417–436` strides dots when `count > 14`, renders at `opacity={0.6}` with hollow fill). But **opacity too high vs Withings (~25-30%)** and **stroke matches trend line** so dots compete with line rather than recede. Withings dots are pure light grey, never the trend colour. Fix: `stroke={colors.textTertiary}`, opacity 0.6 → 0.35.

3. **Halo dot on latest entry correct** (`r=10` outer ring at 16% alpha + `r=5` inner dot, lines 466–468). One of two pieces of Withings DNA the new chart got right.

4. **No floating value pill while idle.** Withings shows latest pill ("54.6 kg") anchored above latest dot at all times. Suppr's tooltip only appears during scrub or via `latestCaption` placement (lines 514–555). Tooltip clamping prevents overlap but breaks pill→dot visual anchor when latest dot near right edge.

5. **Scrub interaction present** (PanResponder, lines 229–248) — major upgrade. Crosshair line + accent dot on touch. Mid-tier Withings parity. **But: no haptic on entry-snap** (Withings: light haptic when scrub crosses data point), **release instantly clears** (Withings fades over ~180ms), **no "play" affordance teaching the chart is interactive** — new users won't discover scrub.

6. **Period switcher at parity** with Withings' set after 2026-05-11 update. **But: touch target ~26pt vertical** — smaller than Apple HIG's 44pt minimum. Withings pills ~32pt tall.

7. **Y-axis label positioning** — right-aligned inside right gutter. Withings puts y-axis labels outside plot, left-aligned. Defensible variant but creates goal-line label collisions (collision-avoid code at lines 285–292 nudges by 8px — clever but Withings doesn't need this).

8. **Trend line colour swap on regression** (`worsening` → `Accent.warning`, lines 209–210). Defensible but Withings keeps trend line neutral, verdict in header chip only. Doing both = doubling signal that should be carried once. **Voice rule violation:** header is source of truth; line should stay neutral.

9. **Empty / single-point / 2-point states.** `WeightSparseState.tsx`:
   - 0 points: lucide Scale icon + "No weigh-ins yet" + CTA. **AT BAR.**
   - 1 point: single weight at 28pt + "One weigh-in logged" + "Add two more" + CTA. **Better than Withings.**
   - 2 points: 200×48 px mini-svg with two dots connected by **dashed grey line** + "Trend appears after 3 weigh-ins" + CTA. Honest but dashed line teaches uncertainty incorrectly — Withings just draws solid.

10. **Goal-line treatment.** When in domain: dashed (`strokeDasharray="4 3"`) with end-label. When off-chart: deliberately suppressed (per 2026-05-11 decision F-133). Correct restraint. AT BAR.

11. **X-axis tick labels** auto-derive 2 ticks on daily ranges (start + end), per-month change on weekly/monthly with ≤6 decimation. Solid.

12. **Chart height 170pt** — TF-feedback shrink from 200→170. AT BAR.

13. **No animated y-axis tween on period switch.** `1M → 3M` redraws single frame, trend line jumps. Withings tweens 200ms.

14. **Dark-mode chart not directly captured.** Gridline opacity likely 12-15% (uses `colors.border`) — Withings drops to 6-8%.

15. **iPad / wide layout** — chart fills container but parent card constrained to 16pt sides → ~700pt unused on iPad.

16. **Missing "show all data" CTA from chart card.** 32×32pt list-icon button next to range toggle is invisible. Withings has clearly-labelled "All Measurements" link below chart.

**States checked:** Empty (AT BAR), single point (BETTER than Withings), 2 points (dashed line teaches wrong), bucketed (strong), goal off-chart (correctly suppressed), goal in chart (clean), dark (uncaptured for chart route), scrub (works, no haptic), iPad (untested), worsening trend (line goes warning — should not), imperial (strong).

**Upgrades to reach the bar**
1. **Drop raw-dot opacity to 0.35 and switch stroke to `textTertiary`** so dots recede behind trend line. (single-line change)
2. **Anchor floating "latest" pill above latest dot at idle.** Render on first mount with 200ms fade-in. (small build)
3. **Add 200ms ease-out tween on yMin/yMax change** when range switches. Use react-native-reanimated `useDerivedValue` on y-domain. (redesign — plot math)
4. **Soft haptic (`Haptics.selectionAsync()`) when scrub crosses data point** + 180ms fade-out on release. (cleanup)
5. **Drop trend-line colour swap on "worsening"** (line 209–210). Header chip carries verdict; line stays `Accent.primary`. (cleanup)
6. **Bump pill touch targets to ≥40pt** in `WeightRangeToggle.tsx` (paddingVertical 5 → 10). (cleanup)
7. **Add labelled "View all measurements" link** below chart, replacing 32×32 icon. (cleanup)
8. **Single-source-of-truth the chart** — kill summary sparkline on Progress, promote full chart to summary card, kill "Weight Journey" lower card or move to own route. **Phase 2 consolidation work already planned.** (redesign — multi-file)
9. **Solid line (not dashed) between two points** in WeightSparseState. (cleanup)
10. **Dark-mode gridline opacity audit** — drop `colors.border` opacity to ~7% specifically inside chart. (cleanup)

### Refuse-to-pass list (Group H P0s)

| Surface | Comparable | Blocking issues |
|---|---|---|
| Weight chart consolidation | Withings | Three presentations of same chart. Land Phase 2 consolidation. |
| Macro detail granularity inconsistency | Cronometer | Protein renders ingredient-level; Carbs/Fat/Fiber render meal-level. Pick one. |
| Macro detail colour mapping | Project rule | Protein pill accent-blue (should be macro-protein); Carbs pill amber (collides with over-budget). |
| Calories drill-down bar colour mapping | MacroFactor | Amber for both over and under. Should be 3-state per calorie-ring rule. |
| Meal nutrition populated state | MyFitnessPal | UNAUDITED — Maestro routes to error. Re-capture, then audit. |
| Burn detail no chart, no 7-day context | Strava | List-only screen. Needs chart. |
| Weight chart raw-dot opacity + colour | Withings | 60% opacity with lineColor — should be ~35% with textTertiary. |
| Weight chart no idle floating pill | Withings | Pill only on scrub — Withings persistent "you are here" pill. |
| Weight chart no y-axis tween | Withings | Hard redraw vs Withings 200ms tween. |
| Past-tense voice on Digest + Weight Journey | Project rule | "Your week — down 0.7 kg" → "Last week: down 0.7 kg." |
| All-data list discoverability | Withings | 32×32 icon invisible. Add labelled link below chart. |

## Group H verdict summary

**Weight chart verdict: CLOSE.** Post the 2026-05-11 rebuild (WeightTrendHeader two-column chip + 1W/1M/3M/1Y/All pills + scrub + halo dot + Y-domain padding + raw-dot striding), Suppr crossed from BELOW BAR to CLOSE — canonical Withings DNA now visible. But four gaps still keep it short of AT BAR: (1) raw dots at 60% opacity in line colour, not 35% in textTertiary; (2) no idle floating "you are here" pill anchored above latest dot; (3) hard redraw on period change vs 200ms y-axis tween; (4) three co-existing chart presentations across Progress + /weight-tracker until Phase 2 consolidation lands. **Top 3 weakest Progress moments:** Meal nutrition (only error state captured — refuse to pass for capture); Calories drill-down (3-state colour mapping wrong, no target line); Macro detail (Protein vs Carbs/Fat/Fiber granularity mismatch + Protein pill wrong colour).

---

# Groups C + G + I detailed findings

## Mobile paywall (RevenueCat-billed) — **EMBARRASSING**

**Comparable:** **RevenueCat sample paywall (published bar)** + **Calm paywall.**

**Current state:** Gradient header with "CHOOSE YOUR PLAN" eyebrow + "Pick the plan that fits" headline + trust chips. **White card with leaf-out icon and "Subscriptions unavailable / In-app purchases aren't wired in this build."** Below: Pro plan card with "£59.99 /year" + "SAVE 37%" + feature list.

**Why EMBARRASSING:**
1. **"Subscriptions unavailable" banner is on the paywall itself.** In production this is supposed to be RevenueCat-wired. Either missing API key, sandbox config drift, or `Purchases.configure` not called. **No user should ever see this on the paywall** — add a hard guard: if `offerings.empty`, show recoverable error sheet **before** rendering the paywall.
2. **Period toggle missing from visible screenshot.** Per documented divergence, mobile defaults annual — but user must be able to toggle. Not visible.
3. **No "Start free trial" framing on CTA.** Trial-eligible per `app/paywall.tsx:54` (7-day on Pro annual). Headline should be "Try Pro free for 7 days" not "Pick the plan that fits."
4. **"Price in your currency, taxes included" promise** — accurate (VAT-inclusive required) but **hardcoded GBP** — is the same paywall rendered €/$ for EU/US? If hardcoded, P0 compliance break.
5. **Restore purchase exists in source (L1300)** but not visible in crop — must be persistently visible at bottom (App Store policy 3.1.1).
6. **Trust chips** (Cancel anytime / 7-day refund / Price never changes) are excellent. Keep.
7. **"MOST POPULAR" badge on only visible card** — meaningless without comparator.
8. **"Unlimited AI photo meal recognition (100/day)"** is contradictory — drop "Unlimited" or move cap to footnote.

**Upgrades:**
1. **Fix offerings loading (P0).** RevenueCat `Purchases.getOfferings()` must return valid current offering in TestFlight. Gate paywall behind retry sheet if not.
2. **Show period toggle prominently.** Monthly/Annual chip strip under headline, annual pre-selected.
3. **Lead with trial:** "Try Pro free for 7 days / Then £59.99/year. Cancel anytime in iOS Settings."
4. **Verify region-aware pricing.** Use RevenueCat's `localizedPriceString`, not hardcoded `£59.99`.
5. **Restore purchase persistently visible.**
6. **Capture dark-mode screenshot.**

## Web pricing dark-mode toggle — **P0 visual bug**

**Current state:** In dark mode, the period-toggle pill renders **white-on-white** — "Monthly" tab bright white background with white text, unreadable. **Likely missing `dark:` Tailwind variant.**

**Fix:** Add proper dark-mode contrast token for the active segment. (cleanup, web, P0)

## Web auth — `/signup` renders marketing landing instead of form

**Current state:** `/signup` URL routes to landing hero ("Join the Suppr Club") with "Join the club — free" + "I'm already a member" CTAs. **No form.**

**Why BELOW:** Stripe / Linear / Notion all show **the form** at the signup URL. Either render the form, or 307 to `/onboarding`. The redirect to `/onboarding` should be instant (server-side), not "show landing then redirect."

**Fix:** Make `/signup` server-side 307 to `/onboarding`. (cleanup, web)

## Web account billing fallback — 404 on unauthed access

**Current state:** Unauthed access to `/account/billing` renders 404 instead of redirecting to `/login?redirect=/account/billing` (per code at `app/account/billing/page.tsx:50-138`). Either redirect isn't firing or Next's not-found hits before redirect resolves.

**Fix:** Audit SSR redirect chain. Likely Next 15 async cookies issue or middleware ordering. (executor, web, P0)

## Mobile native login — possibly absent

**Current state:** `route-login.png` shows Today skeleton, not a login screen. No "Sign in with Apple" button visible anywhere in mobile screenshot set. **Risk: token-expired users dumped to Today skeleton with no path to sign in.**

**Fix:** Verify dedicated `/login` route exists in mobile (Expo). Add auth gate at `(tabs)` layout — if `useSession()` returns null, redirect to `/login`. (executor + journey-architect, mobile, P0)

## Mobile Profile dark mode — **AT BAR (best dark surface in app)**

Outlined coloured macro tiles + amber safety-floor warning chip ("Below 1,200 kcal. This is under the safety floor we recommend for adults...") — looks trustworthy, on-token, premium. **This pattern should be replicated on other dark cards.**

**Caveat:** Same numeric input (1132 kcal) shows safety warning in dark but NOT in light. State difference, not theme difference — environment-dependent warning logic is a bug.

## Mobile Settings hub — Progress/Settings switcher + orphan tiles

**Why CLOSE:**
1. Progress/Settings segmented switcher at top is wrong-shape — they're not peer destinations.
2. "13 Recipes / 30 Streak" stat tiles are orphan widgets in a settings list. Move to Profile or Progress.
3. Search bar may not actually filter rows (test required).
4. "Manage subscription" must deep-link to App Store Subscriptions (`itms-apps://apps.apple.com/account/subscriptions`) for iOS — verify.
5. Promo code inline on hub — collapse behind disclosure.
6. Sign-out only visible after scrolling past Membership + People + Legal + Build.
7. Tab bar has 5 affordances (Today / Recipes / + / Plan / You) vs strategic-direction 4 tabs (Today / Plan / Recipes / More). Drift from locked direction.

## Reset modal + Delete account — CLOSE

Reset modal correctly amber-coded, two destructive paths (Reset targets / Erase everything). **Missing:** "Type RESET to confirm" gate on Erase everything (Apple/Linear/Notion standard for truly destructive ops). Body paragraph too dense (60+ words) — reformat as scannable bullets with green ticks (kept) and red crosses (gone).

Delete account stage 1 is AT BAR for design (single tap to "I want to delete" moves to stage 2 — full multi-step flow per project memory).

## Groups C+G+I verdict summary

**The two real failure surfaces:**
1. **Mobile paywall** — "Subscriptions unavailable" + missing period toggle + GBP hardcoded + no trial framing. **Conversion-killer of the whole app.**
2. **Web pricing dark mode** — period toggle unreadable + missing VAT-inclusive treatment for UK/EU + copy bugs (duplicate Free-card rows, "Single-day meal plans" listed twice, "Multi-day meal plans matched to your macros in logging" is broken English).

Auth is CLOSE but has generic SaaS instincts (marketing on signin, `/signup` renders landing, no input borders). Settings has structural decision pending on tabs (4 vs 5). Profile dark is the strongest dark surface in the app.

**Refuse-to-pass:**
1. Mobile paywall offerings reliability + period toggle + trial framing + region-aware pricing
2. Web pricing dark-mode toggle contrast + VAT-inclusive callout + copy bugs
3. Web `/signup` routing fix (307 to `/onboarding`)
4. Web `/account/billing` unauthed redirect fix (P0)
5. Mobile native login route audit (does it exist?)

---

# Detailed Executive Summary

**Audit scope:** 247 PNGs across landing, onboarding, web app, mobile app, mobile web, paywall, settings; 201 TestFlight beta JPGs as live-signal cross-check. **Total feature cards: 60+ across 13 surface groups; 15 Defended Choices identified where Suppr exceeds the comparable.** **Live-branch focus:** Mobile Progress + weight chart (vs Withings) — the canonical worked example.

**This audit applies two-axis verdicts** (Concept × Execution) combined into one of five tiers: BETTER THAN BAR / AT BAR / CLOSE / BELOW / EMBARRASSING. **Defended Choices are NOT on the refuse-to-pass list** — they're a separate list at the top of the doc with selective borrows from comparables.

## Verdict per surface group (revised — with Defended Choices called out)

| Group | Surface | Verdict |
|---|---|---|
| A | Landing & marketing — web public | **MIXED — `/whats-new` EMBARRASSING; `/pricing` BELOW (P0 VAT — concept right, execution missing); `/roadmap` BELOW; `/help` BELOW; `/` CLOSE; trust pages CLOSE.** Defended: UK/EU VAT-inclusive posture (DC15) |
| B | Onboarding | **CLOSE overall.** Defended: Sex step (DC7), Weight-skip (DC6). Reveal BELOW vs Cal AI (concept gap — biggest in this group); /onboarding-v2 redirect BELOW |
| C | Auth & account | **CLOSE web auth; BELOW mobile native (login screen possibly absent)** |
| D | Mobile Today (canonical spine) | **MIXED with strong Defended Choices.** Defended: Multi-ring spine (DC1) — execution WEAK but concept BETTER, do NOT collapse to single arc; "What to eat next" (DC2); Eat Again (DC3); Streak calm pip (DC8); Calorie ring 3-state (DC10). Macro tiles AT BAR; web parity EMBARRASSING |
| E | Mobile Plan | **BELOW — Move-meal CLOSE; web Plan EMBARRASSING (no route exists)** |
| F | Mobile Recipes / Library / Cook / Import | **BELOW.** Defended: Multi-source paste import (DC13) — capability is BETTER, execution WEAK on entry + verify. Recipe verify EMBARRASSING; web Recipes EMBARRASSING |
| G | More / Settings / Profile | **CLOSE.** Defended: Profile dark mode (DC14) — outlined tiles + amber safety-floor warning — strongest dark surface in app |
| H | Mobile Progress (LIVE BRANCH) | **CLOSE.** Defended: Sparse-state weight chart (DC5). Weight chart CLOSE post-2026-05-11 rebuild; Meal nutrition EMBARRASSING (only error state captured) |
| I | Paywall / billing | **EMBARRASSING.** Defended: Trust chips on paywall (DC4) — Cancel anytime + 7-day refund + Price never changes mid-trial. But the surface around them is broken ("Subscriptions unavailable") |
| J | Mobile stack screens | **MIXED — Import shared AT BAR; Food search EMBARRASSING; Notification permission EMBARRASSING (renders skeleton); Fasting BELOW** |
| K | Web product surfaces (authed) | **EMBARRASSING — single-page-app routing at /home?view=*, every authed surface lacks real URL** |
| L | Mobile web | **EMBARRASSING — same routing failure + cookie banner consumes 25–30% phone viewport** |
| M | Cross-cutting | **BELOW — dark mode coverage gap; tab order drift; capture pipeline failures.** Defended: Adaptive TDEE in Free (DC11); Calm voice (DC12) — anti-shaming positioning is the moat against MFP refugees

## The 10 worst surfaces ranked (revised — Defended Choices removed)

1. **Mobile paywall** (Group I) — "Subscriptions unavailable" banner blocks the conversion path. Comparable: RevenueCat sample paywall. **P0 — conversion-killer.** (Note: trust chips on this same paywall are DC4 — the chips work; the surface around them is broken.)
2. **Web routing contract** (Groups K+L) — every authed surface lacks a real URL (`/home?view=*` SPA pattern). Comparable: Linear. **Structural P0.**
3. **Recipe verify step** (Group F) — generic spinner on blank screen, no header, no skeleton, no cancel, no timeout. Comparable: Recime. **P0 — viral growth funnel breaker.** (Note: the multi-source paste-link capability is DC13.)
4. **Web Recipes** (Group F) — `/recipes`, `/library`, `/discover` all 404 or redirect to marketing. Comparable: Paprika Cloud. **P0 parity break.**
5. **Web `/whats-new`** (Group A) — single text-only entry, no images, no release navigation, light/dark date mismatch. Comparable: Linear changelog.
6. **Notification permission prompt** (Group J) — captured screen renders as blank skeleton; either capture failure or unbuilt. Comparable: Cal AI.
7. **Meal nutrition detail** (Group H) — only error state captured. Maestro routes into error. Process P0.
8. **Reveal step (TDEE plan-reveal)** (Group B) — no anticipation beat, no "show the maths," no "what happens next." Comparable: Cal AI plan-reveal. **The activation north-star moment is missing.**
9. **Web pricing dark mode + VAT** (Group A/I) — period-toggle "Monthly" tab unreadable white-on-white; VAT-inclusive treatment missing for UK/EU. **P0 compliance gap.** (Note: VAT-inclusive posture itself is DC15 — concept right, execution missing.)
10. **Food search modal** (Group J) — no recents on mount, explicit Search-button submit, no barcode glyph inline, no category tabs. Comparable: MyFitnessPal search.

**Removed from worst-surfaces list (re-tiered as Defended Choices with polish needed — see Defended Choices section near the top of the doc):**

- **Calorie ring 4-concentric rainbow** — was ranked among worst with "collapse to single arc" prescription. **Re-tiered to DC1 (BETTER THAN BAR × execution WEAK).** Apple Watch's nested-ring precedent + macro-spine-first positioning means the multi-ring IS the differentiator, not the bug. Polish path: borrow Apple Watch's ring-fill animation + count-up + tabular-nums; do NOT collapse to single arc.
- **"What to eat next" card** — re-tiered to **DC2 (BETTER THAN BAR × execution SOLID).** The 3% fit chip is the moat; polish items live as Selective Borrows from Cal AI + Recime, not as "raise to bar."
- **Calorie ring colour mapping** — re-tiered to **DC10 (BETTER THAN BAR).** Suppr's 3-state rule is more nuanced than competitors' single-colour.
- **"Eat well, without overthinking it" voice** — Group B agent originally called it "soft" and pushed toward Cal AI's louder energy. **Reversed: DC12.** This calm voice is the exact reason MFP refugees would switch. Defended.

## Refuse-to-pass list (single ranked list, surfaces gated until AT BAR)

Each row: surface — comparable — blocking issue — owner agent for the fix.

**Note:** Items previously on this list that were re-tiered as Defended Choices (concept BETTER, polish via Selective Borrows) have been **removed from this refuse-to-pass list** and moved to the Defended Choices section at the top. They include:

- ~~Calorie ring 4-arc collapse to single arc~~ → **DC1** (defended; do NOT collapse; borrow Apple Watch fill animation + count-up + tabular-nums)
- ~~"Eat well, without overthinking it" → "Lose weight with AI"~~ → **DC12** (defended; calm voice is the moat)
- ~~Macro tile over-budget amber on already-correct calorie ring rule~~ → **DC10** (defended; the rule itself is BETTER; just apply consistently)

What remains on refuse-to-pass is genuinely broken or concept-equal-execution-weak:

1. **Mobile paywall (offerings + period toggle + trial framing + region)** — RevenueCat sample — "Subscriptions unavailable" must never render; period toggle missing; GBP hardcoded; no trial framing — `executor` + `ui-product-designer`. **Defended sibling:** trust chips on the same paywall (DC4) are AT BETTER THAN BAR — keep them.
2. **Web authed routing contract** — Linear — Every top-level surface needs real URL (`/today`, `/plan`, `/library`, `/discover`, `/shopping`, `/account/*`) instead of `/home?view=*` — `journey-architect` + `executor`
3. **Recipe verify step** — Recime — Skeleton screen, status narration, cancel, timeout, per-row confidence bar — `ui-product-designer`. **Defended sibling:** multi-source paste-link capability itself (DC13) is BETTER THAN BAR — keep, polish verify step.
4. **Web Recipes (/recipes, /library, /discover)** — Paprika Cloud — All routes 404 or redirect to marketing — `executor`
5. **Reveal step in onboarding** — Cal AI plan-reveal — Anticipation beat + show-the-maths + what-happens-next + haptic + brand-unified ring gradient — `ui-product-designer`
6. **Web `/whats-new`** — Linear changelog — Hero image per release, release-titles, release-to-release nav, RSS, dark contrast on NEW/FIXED labels — `executor` + `copy-reviewer`
7. **Web pricing — dark mode toggle + VAT** — Stripe pricing — Period toggle contrast in dark + VAT-inclusive callout for UK/EU + duplicate Free-card rows + broken English copy — `visual-qa` + `executor`. **Defended sibling:** the VAT-inclusive posture itself (DC15) is BETTER THAN BAR — concept right, execution missing.
8. **Recipe import entry point discoverability** — Recime — "Import from a link" permanent first card on Discover (not loading-state only); "+ Create" becomes multi-source action sheet; clipboard auto-detect — `ui-product-designer`. **Defended sibling:** the multi-source paste-link capability (DC13) is BETTER THAN BAR — keep, fix the entry point.
9. **Web `/signup` routing fix** — Notion/Stripe — Server-side 307 to `/onboarding`; stop rendering marketing landing at signup URL — `executor`
10. **Web `/account/billing` unauthed redirect** — Linear billing — Fix 404 on unauthed access; redirect to `/login?redirect=/account/billing` — `executor` (P0)
11. **Mobile native login screen audit** — Apple Health onboarding — Verify `/login` exists in Expo + auth gate at (tabs) layout — `journey-architect` + `executor`
12. **Food search modal** (mobile) — MyFitnessPal — Render recents on mount + search-as-you-type + barcode glyph inline + category tabs — `ui-product-designer`
13. **Notification permission prompt** — Cal AI — Re-capture immediately; if blank, build the surface (headline + 3 bullets + Allow + Not-now) — `executor` capture → `ui-product-designer` build
14. **Weight chart consolidation (Phase 2)** — Withings — Land `docs/decisions/2026-05-11-weight-chart-consolidation-plan.md` to kill duplicate chart presentations — `executor`. **Defended sibling:** sparse-state weight chart (DC5) is BETTER THAN BAR — polish 2-point state by switching dashed line to solid (one-line fix).
15. **Macro detail granularity** — Cronometer — Pick one granularity (meal vs ingredient) for all 4 macros — `design-system-enforcer` + `ui-product-designer`. Colour mapping issues (Protein blue → macro-protein hue; Carbs amber → carbs hue) live under DC10 polish.
16. **Calories drill-down bar colour** — MacroFactor — Apply the 3-state per calorie-ring rule (gradient/green/red), not amber-for-both. This is **applying DC10 consistently**, not changing the rule — `visual-qa`
17. **Cookie banner trim** — Linear/Notion/Vercel — Trim to single-line 52px on all platforms; consumes 25–30% of mobile-web viewport currently — `visual-qa` + `executor`
18. **`/onboarding-v2` redirect chrome flash** — Linear silent 308 — Convert to server-side / route-level redirect that doesn't mount `+not-found` — `executor`
19. **Capture pipeline audit** — internal — 14+ screenshots in this audit set were stale or wrong-destination — `executor` (Maestro/Playwright scripts) + `qa-lead`
20. **Reset modal type-confirm gate + bullet body** — Linear / Apple — Add "Type RESET to confirm" gate on Erase Everything; reformat 60-word body as scannable ✓/✗ bullets. **Defended sibling:** the soft/hard split itself (DC9) is BETTER THAN BAR — keep the two-path concept, polish the dialog.

## What "AT BAR" looks like (forward-looking per surface group)

- **Group A landing AT BAR (Linear):** every public route stable, anchor-linkable, deep-linkable; pricing surfaces VAT-inclusive UK/EU prices on the price digits (DC15 polished); cookie banner is a bottom-right pill, not a viewport-eating bar; trust pages share one template with sticky ToC + version chip.
- **Group B onboarding AT BAR (Cal AI):** Reveal step lands with anticipation beat → animated ring + count-up → math reveal → "what happens next" 3-step card with haptic; redirect from `/onboarding-v2` is silent (no chrome flash); Welcome proof unified across web desktop / web mobile-web / mobile native. **Defended:** Sex helper expander (DC7) + Weight skip path (DC6) stay as the BETTER-than-comparable benchmarks.
- **Group D Today BETTER THAN BAR (Apple Watch + MacroFactor selective borrows):** **Multi-ring spine kept (DC1)** with Apple Watch ring-fill animation on log + count-up + tabular-nums + warm-tint over-budget reinforcement; "What to eat next" (DC2) carries hero image + tappable "Why this?" disclosure (Cal AI + MacroFactor borrows); Eat Again (DC3) keeps one-tap re-log on Today; calorie ring 3-state mapping (DC10) applied consistently; web Today has its own URL at `/today` and matches mobile spine.
- **Group H Progress AT BAR (Withings):** one canonical weight chart at two zoom levels rendered by same component; faded raw dots at 30% in textTertiary; bold smoothed trend line; persistent floating "you are here" pill above latest dot; tween 200ms on period switch; labelled "View all measurements" link below chart. **Defended:** sparse-state weight chart (DC5) keeps the hand-holding 1-point + 2-point treatment (better than Withings per agent's own admission), but switches 2-point dashed line to solid.
- **Group I paywall AT BAR (RevenueCat sample + Calm):** Loads with valid offerings always; period toggle visible; headline leads with trial benefit; region-aware via `localizedPriceString`; persistent Restore Purchase footer. **Defended:** trust chips (DC4) stay — they are the moat against MFP refugees.
- **Groups K+L web product AT BAR (Linear + Notion):** Every authed top-level surface has a real URL (bookmarkable, shareable, sub-URL where it makes sense); `/home` becomes 307 to `/today`; mobile-web works as a full product surface with tab bar at bottom for non-iOS audience; cookie banner trimmed to single-line.

## What "BETTER THAN BAR" looks like (the defended-choices target state)

For each Defended Choice (DC1–DC15 above), AT BAR is the **comparable's bar**; BETTER THAN BAR is **our bar**. The two are not the same. We measure our defended surfaces against their own ideal — not the comparable's — and then borrow specific interaction details from comparables to strengthen our execution. The 15 entries in the Defended Choices section define those targets per surface.

## Handoff list by owner agent

**`ui-product-designer`** (designs the new):
- Mobile paywall period toggle + trial framing + 1-card-to-2-card layout
- Recipe verify step skeleton + status narration + cancel (refuse-to-pass)
- Reveal step in onboarding (anticipation + math + what-happens-next + haptic) — refuse-to-pass
- **Calorie ring polish (DC1) — borrow Apple Watch ring-fill animation + count-up + tabular-nums + warm-tint over-budget reinforcement.** DO NOT collapse to single arc — multi-ring is the differentiator.
- **"What to eat next" polish (DC2) — borrow Cal AI hero image + Recime multi-line title + MacroFactor "Why this?" disclosure.** Keep the 3% fit chip — it's the moat.
- **Reset modal polish (DC9) — Linear bullet ✓/✗ body + Apple type-confirm gate on Erase Everything.** Keep the soft/hard split — better than competitors' binary reset.
- Recipe import entry point promotion (multi-source action sheet on "+ Create") — refuse-to-pass
- Food search modal (recents on mount, search-as-you-type, category tabs) — refuse-to-pass
- Fasting active timer (ring fill + milestones + projected end + effortful End Fast)
- Notification permission prompt (Cal AI pattern) — refuse-to-pass
- Web Recipes routes shape (`/recipes`, `/library`, `/discover` layouts) — refuse-to-pass
- Web `/account/billing` proper summary page (current plan + renewal + payment method)
- Macro detail unified granularity decision (refuse-to-pass)
- Shopping list aisle-based redesign (categories, checkboxes, swipe actions)
- **Profile dark-mode pattern propagation (DC14) — replicate the outlined coloured tile + amber safety-floor warning chip pattern on other dark cards** (Settings, Membership)

**`executor`** (implements):
- Mobile paywall offerings reliability fix (`Purchases.getOfferings()` in TestFlight)
- Web routing migration (`/home?view=*` → real URLs per surface)
- Web `/account/billing` unauthed redirect fix (Next 15 async cookies / middleware)
- Web `/signup` server-side 307 to `/onboarding`
- `/onboarding-v2` chrome-flash fix (route-level redirect)
- Cookie banner trim to single-line 52px
- Weight chart consolidation Phase 2 (per existing decision doc)
- Maestro pipeline audit (deterministic step-id-to-route mapping)
- Stale screenshot capture rerun (11 onboarding + 14+ misnamed)
- Targets summary truncated "≈ 15" date string fix (P0)
- Mobile tab order reordering (Today / Plan / + / Recipes / More per strategic direction)
- VAT-inclusive callout on web pricing for UK/EU detection

**`visual-qa`** (catches ugly):
- Web pricing dark-mode period-toggle contrast (P0)
- Web Pro tier card visual lift + brand-tinted border
- Macro tile over-budget amber treatment (sublabel + bar)
- Dark-mode gridline opacity reduction on weight chart
- Cookie banner overflow obscuring CTAs
- Mobile-web "Get sta..." CTA truncation
- Shopping list subtitle contrast in dark mode

**`design-system-enforcer`** (token + prototype conformance):
- Macro colour token audit (Protein blue → macro-protein hue; Carbs amber → carbs hue; ensure amber reserved for over-budget)
- Goal step icon migration (Ionicons → lucide-react-native)
- **Calorie ring 3-state colour mapping (DC10) — apply consistently across drill-downs.** Calories This Week bars currently use amber for both under and over; should be gradient/green/red per DC10. This is applying the defended rule, not changing it.
- Ring gradient unification (single brand gradient, not brand-mixed-with-macro)
- **Voice consistency (DC12) — past-tense voice rule + supportive microcopy at high-emotion surfaces (Headspace borrow)**

**`sync-enforcer`** (cross-platform parity):
- Web vs mobile routing contract divergence (NOT a documented carve-out)
- Mobile native login route audit (web has `/login` + `/signin`; mobile may lack equivalent)
- Welcome floating-preview affordance divergence (web tiles / web-mobile checklist / mobile USDA pill — pick one or document)
- Move-meal carve-out vs whole-Plan-tab carve-out: Plan tab missing on web is NOT covered by Move-meal carve-out — file separately

**`journey-architect`** (structural flow):
- Web routing contract redesign (5 tabs vs current `/home?view=*` SPA)
- Mobile auth gate flow (token-expired user UX)
- Strategic direction tab-order resolution (4 tabs locked vs 5 affordances rendering)

**`copy-reviewer`** (microcopy):
- Auth-wall H1 ("Meal plans that hit your macros" → "Sign in to Suppr")
- Past-tense voice on Progress + Digest cards
- "Multi-day meal plans matched to your macros in logging" broken English
- "Single-day meal plans" duplicate row in Free tier
- "Recipe may have been deleted" 404 copy (Recipes route)
- "Unlimited AI photo meal recognition (100/day)" contradiction
- Unify "Log it" / "LOG" / "Log" verbs across surfaces

---

## Pending Notion mirror actions

Per CLAUDE.md non-negotiables (Notion mirroring), the following should be mirrored to Notion in this turn or by Grace:

1. **Decisions log** — add row: "Premium-bar full audit 2026-05-12" linking back to this audit doc (`docs/audits/2026-05-12-full-premium-bar-audit.md`) on GitHub; status: Resolved; area: Product / Design quality; one-line: "Pixel-grounded audit across 13 surface groups against 8+ named comparables; 21 refuse-to-pass surfaces identified."
2. **Roadmap** — add or update rows for the 5 worst surfaces in "Open" state:
   - Mobile paywall offerings reliability
   - Web routing contract migration
   - Recipe verify step rebuild
   - Web Recipes routes
   - Reveal step anticipation beat
3. **Tasks DB** — add P0 items for capture pipeline fix + Targets truncated date + Web pricing dark toggle + VAT-inclusive on web pricing.

---

## Total artefacts referenced

- **247 PNGs** in `apps/mobile/screenshots/latest/` (light + dark, mobile native + web desktop + web mobile-web)
- **201 JPGs** from TestFlight beta in `docs/testflight-feedback/data/screenshots/` (real user signal)
- **2 prior peer audits** referenced for density target: `docs/audits/2026-04-30-best-in-class-critique.md`, `docs/audits/2026-04-28-2026-bar-button-level.md`
- **8 canonical competitors** anchored: MyFitnessPal, Lose It!, Cronometer, MacroFactor, Cal AI, Paprika, Recime, Honeydew
- **18 additional comparables** named for specific features: Withings, Apple Health, Oura, Strava, Calm, Headspace, Duolingo, Linear, Vercel, Notion, Stripe, Cal AI (onboarding), Crouton, Mela, AnyList, Zero, RevenueCat sample, Stripe Atlas

**End of audit.**
