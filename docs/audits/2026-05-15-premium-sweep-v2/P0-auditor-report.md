# P0 Cold-Open Premium-Bar Audit — Suppr v2 sweep

**Auditor:** premium-auditor
**Bucket:** P0 (first ~25 surfaces, first 60s of user contact)
**Date:** 2026-05-14
**Pixel captures:** `docs/audits/2026-05-15-premium-sweep-v2/captures/P0/before/`
**Defended Choices reference:** `docs/audits/2026-05-15-premium-sweep-v2/defended-choices.md`



## 1 — Executive summary

**Top-line for the P0 cold-open arc:**

The P0 cold-open is a **CLOSE** result against the bar, with one **EMBARRASSING** surface (web `/signup`) actively damaging trust, and several **BETTER THAN BAR** surfaces (mobile Today empty-state spine, mobile paywall trust chips, profile dark mode, mobile Welcome) that already exceed the comparables. The product has the rare problem of a *better cold-open core* than the *cold-open frame*: the Today first-render and the mobile paywall are above the bar, but the entry points to reach them (web signup, web onboarding entry, web home for unauthed) are below it or actively broken.

**Highest-impact subtractive wins available right now:**

1. **Collapse `/login` / `/signin` / `/signup` to one canonical surface** with mode toggle preserved (they already share an identical component — three URLs is anti-pattern that erodes Linear/Stripe-grade discipline; the duplicate sign-up tab inside the card duplicates the route again).
2. **Remove the "Sign in to Suppr" header + tagline pair above the card** on `/login` — the card already carries "Welcome back / Sign in to continue." Three sign-in-related strings stacked on one viewport is hierarchy noise.
3. **Remove the standalone "Sign in" outlined button from mobile Welcome** — it duplicates the `Get started` → onboarding → in-flow signup step and competes with the primary CTA. (See DC12-adjacent subtractive: prior audit added this button in B1#3 to "surface returning-user affordance"; in practice on cold-open the primary CTA must dominate. Apple Health / Cal AI cold-open never carry an outlined secondary at the foot of welcome.)
4. **Remove the "Subscriptions unavailable" full-width grey card from mobile paywall** when running in sandbox/no-RC builds — it dominates the first viewport above the pricing card and reads as a failed-load. This is the worst element on an otherwise BETTER THAN BAR paywall.
5. **Remove the centered hero icon-tile + "Sign in to Suppr" caps from web login** — Stripe and Linear sign-in surfaces use just the wordmark + form.

**DC status across P0:**

| DC | Touched in P0? | Intact? | At risk? |
|---|---|---|---|
| DC1 multi-ring spine | Yes (mobile Today, web Today) | Today shows pre-log empty ring (gradient), correct. | Web Today never captured for authed state — gap |
| DC2 "What to eat next" 3% fit chip | Yes (mobile Today) | Card renders correctly: "Green Goddess Chopped Chicken Salad / Roughly fits / 1014 kcal · 110g P · 76g C · 28g F" | "Roughly fits" chip is the moat — verify copy did not drift from "Fits within 3% of remaining macros" intent |
| DC3 Eat Again | Yes (mobile Today) | Not visible in capture (empty-state day); no risk surfaced | — |
| DC4 paywall trust chips | Yes (mobile paywall light) | Three chips visible inside the pricing card. | Currently *inside* the card not on the standalone strip Grace shipped on web — see card |
| DC5 sparse-state weight chart | Not in P0 | — | — |
| DC6 weight-skip onboarding | Code-read only (no pixel) | Code path intact | Verify in P1 |
| DC7 sex step expander | Code-read only (no pixel) | Code path intact | Verify in P1 |
| DC8 calm-pip streak | Yes (mobile Today) | "38-day streak" pill renders muted next to "Today" header (DC8 calm-pip pattern) | Intact |
| DC9 reset modal soft/hard | Not in P0 | — | — |
| DC10 calorie-ring 3-state colour | Yes (mobile Today) | Empty ring renders as muted outline gradient ("Start your day"). Correct. | — |
| DC11 adaptive TDEE free tier | Touched in onboarding code | Code path intact | — |
| DC12 calm voice | Yes (everywhere) | Welcome "Eat well, without overthinking it" intact; pricing "The full meal planning loop" intact | "Join thousands tracking smarter" proof-line under Welcome CTA is mildly off-tone (vague metric, anti-DC12) |
| DC13 social-video paste import | Not in P0 | — | — |
| DC14 profile dark mode | Context pixel captured | Outlined coloured tiles + safety-floor framework intact and visible | — |
| DC15 UK/EU VAT inclusive | Yes (pricing) | £7.99/mo and £59.99/year render with /mo and /year suffixes only — no explicit "inc. VAT" line visible | At risk — see pricing card |

---

## 2 — Five worst / five best P0 surfaces

### Five worst (ranked, with comparable they're failing)

1. **Web `/signup` — EMBARRASSING.** Renders identical content to `/onboarding` (the "Join the Suppr Club" landing variant). A user who clicked "Get started" expecting to *make an account* lands on what looks like another marketing page with a single CTA. Comparable failing against: **Linear sign-up cold path** — three-field card + Apple/Google SSO + submit, never "another hero page". This is a trust-breaking shape mismatch on the highest-intent route in the entire product.
2. **Web `/onboarding` — BELOW.** Same "Join the Suppr Club" hero, no actual onboarding step rendered. The route exists, the content does not. Comparable failing against: **Cal AI onboarding** — the cold-open is a single-step centered card with a back-button affordance + indeterminate progress dots, not a marketing variant. This isn't a copy problem, it's a "the route doesn't host the flow" problem.
3. **Web `/home` for unauthed — BELOW.** The captured "home" PNG is `/login`. Either `/home` redirects to login (acceptable but the *capture says it's `/home`*) or the route is undefined. For unauthed cold-open the bar is **Linear `/`** — a hero + clear primary CTA, not a forced login wall. Suppr already has this content at `/` — `/home` should redirect there, not to `/login`.
4. **Mobile paywall — "Subscriptions unavailable" / "leaf-crossed" card — BELOW** (this surface drags an otherwise BETTER THAN BAR paywall down to CLOSE). The grey full-width card above the Pro pricing card eats 18% of the first viewport with a failed-load read. Comparable failing against: **Calm / Headspace paywall** — when StoreKit is unavailable they silently fall back to "trial info" with retry on tap, never a flat refusal card that reads as broken. Note: dark-mode capture missing — flag.
5. **Web `/login` / `/signin` duplication — CLOSE-veering-BELOW.** Two URLs, identical rendered card, *the card itself contains a redundant "Sign up / Sign in" toggle*. So the user has THREE entry points to the same affordance (URL alias, URL alias, in-card tab). Comparable: **Stripe Dashboard sign-in** — single URL, single card, single affordance.

### Five best (ranked, with what differentiator they protect)

1. **Mobile Today empty-state (`mobile-today-dark.png`) — BETTER THAN BAR.** Protects DC1 (multi-ring spine), DC2 (3% fit chip), DC8 (calm-pip streak), DC10 (3-state colour). Empty-state ring shows "Start your day" inside a muted outlined ring (correct gradient/muted treatment for not-yet-logged). The "WHAT TO EAT NEXT" card with "Roughly fits / 1014 kcal · 110g P · 76g C · 28g F" + image is *the moat moment* — MFP, Lose It, Cronometer all fail this question. Apple Watch's three-ring spine is the only comparable in the world, and Suppr's encoding has *more* information per ring than Apple Watch's three.
2. **Mobile Welcome (`mobile-onb-03-goal.png` — actually Welcome) — BETTER THAN BAR.** Protects DC12 (calm voice). The hero — Sheet-pan-chicken example tile rotated -2.4deg + USDA-backed nutrition chip + "Eat well, without overthinking it" + Suppr "S" wordmark + soft gradient wash — is the strongest cold-open hero in the macro-tracker category. Cal AI's hero is shouty ("Lose weight with AI"), MFP doesn't have a hero, MacroFactor's is functional-but-bland. Suppr's reads premium and supportive simultaneously.
3. **Mobile profile dark mode (context capture) — BETTER THAN BAR.** Protects DC14 directly. Outlined coloured tiles in a 2×2 grid (1224 kcal success-green / 98 Protein indigo / 116 Carbs orange-amber / 41 Fat pink) on near-black canvas is the strongest dark surface in the app and exceeds Apple Health's flat tile palette. This is the visual proof Suppr can run dark.
4. **Mobile paywall pricing card (DC4 trust chips) — BETTER THAN BAR.** Protects DC4. The three chips ("Cancel anytime in App Store / 7-day refund, no email needed / Price never changes mid-trial") are stacked tightly above the price within the Pro card border. MFP's mid-trial price-hike pattern is *directly counter-marketed* here. Calm/Headspace have nothing this specific.
5. **Mobile Today calm-pip streak ("38-day streak" pill next to "Today") — AT BAR / BETTER THAN BAR.** Protects DC8. The pill is muted (pale-blue background, not flame-coral), small, sits inline with "Today", and the gate is intact (38 ≥ 2). Duolingo's flame-shout doesn't exist here; Cal AI doesn't have a streak; MFP shows "0-day streak" gibberish to fresh users.

---

## 3 — Refuse-to-pass list

Each surface below MUST clear AT BAR (or better) before P0 implementation rows ship. P0 stays open until each is fixed.

| # | Surface | File | Comparable failing against | Blocking issues | Owner agent |
|---|---|---|---|---|---|
| RTP-1 | **Web `/signup`** | `app/signup/page.tsx` (or equivalent — to verify) | **Linear sign-up** | Renders the same "Join the Suppr Club" landing variant as `/onboarding`; no actual signup form on the route. A user clicking "Get started → Sign up" sees a hero page, not a form. Trust-breaking. | `ui-product-designer` (route shape) + `executor` (route wiring) |
| RTP-2 | **Web `/onboarding`** (initial entry) | `app/onboarding/page.tsx` | **Cal AI / Headspace onboarding** | Captures show the same "Join the Suppr Club" landing — onboarding step 1 (Welcome) is never rendered on web. Either the route is mis-wired or the Welcome step IS this hero (in which case the user must tap "Join the club — free" to enter the first real step, which is the wrong shape for an authenticated onboarding flow). | `ui-product-designer` (decide shape) + `executor` |
| RTP-3 | **Mobile paywall "Subscriptions unavailable" card** | `apps/mobile/app/paywall.tsx` near `classifyPaywallReadiness` | **Calm paywall** | When RC offerings cannot resolve (no Purchases SDK key, sandbox state, network), the paywall renders a flat grey "Subscriptions unavailable" panel above the pricing card. It reads as failed-load and competes with the (otherwise excellent) Pro card. Should fail soft: keep the Pro card, hide or condense the unavailable notice into a small inline footnote. | `ui-product-designer` + `executor` |
| RTP-4 | **Web home `/home` route for unauthed users** | `app/home/page.tsx` (or middleware redirect) | **Linear `/`** | Capture labelled `web-*-home` is the login page. Either `/home` is undefined (should redirect to `/`) or redirects to `/login`. Forces login wall on first-touch users who arrived at `/home` from a link share. | `executor` (1-line redirect) |
| RTP-5 | **Web `/login` + `/signin` duplication** | `app/login/page.tsx` + `app/signin/page.tsx` (or shared) | **Stripe sign-in** | Two URLs render the same card. The card contains a "Sign up / Sign in" segmented toggle, so the same affordance lives at three addresses. Pick one canonical route, redirect the other, remove the in-card Sign up tab (signup belongs at a separate dedicated card or route). | `executor` (URL consolidation) |
| RTP-6 | **Mobile onboarding capture gap (all 13 step PNGs are Welcome)** | `apps/mobile/.maestro/00z_premium_bar_dark.yaml` (or equivalent capture flow) | n/a — testing harness | The Maestro flow never advances past Welcome — every named step PNG is a copy of Welcome. The audit cannot judge mobile onboarding steps 03–15 without these. Re-capture before any implementation row touches the steps. | `executor` (fix flow) — **this blocks P0 implementation** |
| RTP-7 | **Mobile paywall dark-mode capture gap** | n/a | n/a | Only `mobile-paywall-light.png` exists. DC4 trust chips and DC14-adjacent dark posture both need verification in dark. | `executor` (re-capture) |
| RTP-8 | **Web `/onboarding` "Adaptive TDEE that learns from you" / "One-tap import from any recipe site" / "Calm design, private by default" proof bullets** | `app/(landing)/LandingPage.tsx` or onboarding hero | **Cal AI / Headspace** | If `/onboarding` *is* meant to be a marketing hand-off page (not the flow), the three bullets are good. But the route NAME is misleading — call it `/start` or `/get-started`, not `/onboarding`, because the literal route name promises a flow. | `ui-product-designer` (route naming) |
| RTP-9 | **Web pricing card — no inline "inc. VAT" line** | `app/pricing/PricingTiersGrid.tsx` | **Stripe pricing** | DC15 requires VAT-inclusive posture on UK/EU surfaces. Captured pricing shows "£7.99 /month" — no explicit "VAT included" disclosure visible in the first viewport. Even though Stripe Tax is in inclusive mode, the user-facing string must say so explicitly (compliance + trust signal). | `ui-product-designer` + `executor` |
| RTP-10 | **Web login dark-mode hero icon brand** | `app/(auth)/login/page.tsx` | **Linear sign-in** | The blue rounded-square clipboard-with-checkmark icon is generic — looks like a stock app-icon placeholder, not Suppr's "S" mark. Replace with the Suppr "S" mark used everywhere else (mobile Welcome's "S" tile). Brand discontinuity at the first auth touchpoint. | `executor` |

**Two-revert tripwire status:** None of these are additive flourishes — they are subtractive cleanups or capture gaps. Safe to ship.

---

## 4 — Defended Choices touched in P0

### DC1 — Multi-ring calorie + macros spine
**Surfaces touched in P0:** Mobile Today empty-state ring (`mobile-today-dark.png`); web Today (not actually captured — gap).
**What we keep:** The 4-arc nested-ring concept. Mobile capture shows the empty pre-log state correctly: muted outlined ring with "Start your day" centred — the gradient state. Apple Watch's three-ring spine is the only world-class precedent and Suppr carries more information density per ring.
**Selective borrows we can adopt (Allowed list, P0 candidates only):**
- **Apple Watch Move-ring 200ms ease-out fill animation on first log of day.** Today is the cold-open moment for returning users — when they tap "Log lunch" on the Eat Again or Snap-meal card, the ring should fill into its first lit state with the ease curve, not pop. Confirms the spine just learned about them.
- **Cal AI count-up animation on hero kcal (400ms cubic, tabular-nums).** Same trigger.
- **Withings light haptic on the same data-update.** Mobile only.
**What we still need to polish:** Web Today first-render capture failed (route `/home` redirected to login). Must capture web authed Today before any web-side DC1 polish ships.
**Refused (forbidden):** No single-arc collapse; no fraction+delta chip row under hero kcal (DC1 revert 2026-05-14); no warm-tint over-budget on macro arcs (DC10 revert F40).

### DC4 — Trust chips on paywall
**Surfaces touched in P0:** Mobile paywall light (`mobile-paywall-light.png`); web pricing card (`web-*-pricing.png`).
**What we keep:** Three chips ("Cancel anytime in App Store / 7-day refund, no email needed / Price never changes mid-trial") stacked inside the Pro pricing card on mobile, AND visible above the billing toggle on web pricing. Both renderings carry the load. This is the *direct counter* to MFP's mid-trial trickery — every word is falsifiable and concrete.
**Selective borrows we can adopt (Allowed list, P0 candidates only):**
- **Calm "No price hikes ever" as a fourth chip** — only if Grace commits to that promise in writing (won't propose without that commitment).
- **Stripe Checkout adjacent placement** — already done. Trust chips sit immediately above the BILLING toggle / inside the price card. No change.
**What we still need to polish:**
- **Mobile dark capture missing.** Verify chips read correctly against near-black canvas.
- **Web mobile-viewport trust chips wrap into a vertical stack** (visible in `web-mobile-light-pricing.png`) — each chip on its own line. Acceptable, but could tighten so the three chips read as a single trust-cluster rather than three loose pills. Withings' "Health badge" cluster does this with a 4-up grid at narrow viewport.
**Refused (forbidden):** No generic "Trusted by N users"; no chip drop.

### DC8 — Streak as calm pip, gated to ≥ 2 days
**Surfaces touched in P0:** Mobile Today header (`mobile-today-dark.png`).
**What we keep:** "38-day streak" pill renders to the right of the "Today" header in a muted pale-blue background. Gate is intact (38 ≥ 2). Calm voice. No flame coral.
**Selective borrows we can adopt:**
- **Headspace streak-protected shield glyph** on freeze-protected day — only when freeze ledger says protected. Today doesn't show one in the capture (no freeze active for the day). Code path likely intact (`streakFreeze` lib visible in Today imports).
**What we still need to polish:** Nothing visible in the P0 capture. The pip already meets the bar.
**Refused (forbidden):** No removal of ≥2 gate; no loud flame; no streak-loss penalty animation.

### DC10 — Calorie ring 3-state colour rule
**Surfaces touched in P0:** Mobile Today empty-state ring.
**What we keep:** Empty / not-yet-logged today renders as a gradient/muted outlined ring with "Start your day" centred — correct per the rule.
**Selective borrows we can adopt:** None on the rule itself.
**What we still need to polish:** Confirm in subsequent capture batch that the under-budget logged state renders in success-green and the over-budget state renders in destructive-red (P1 capture work). DC10 doesn't have a P0 risk surface today.
**Refused (forbidden):** No amber on macro arcs (the F40 revert); no destructive red anywhere except the calorie ring; no flat colour replacing the empty gradient.

### DC12 — "Eat well, without overthinking it" calm voice
**Surfaces touched in P0:** Mobile Welcome; landing; pricing; sign-in card; checkout success page; AI paywall sheet.
**What we keep:**
- Mobile Welcome "Eat well, without overthinking it" — load-bearing positioning line; intact and reads premium.
- Mobile paywall "Try Pro free for 7 days / Full Pro free for a week. Cancel anytime in iOS Settings" — calm, factual, no shaming.
- Landing "Import any recipe. Get real macros." — direct functional, anti-Cal-AI shouty.
- Pricing "The full meal planning loop" + "Plans that hit your macros, one-tap shopping lists, cook mode with timers. Pick the plan that fits your goals." — calm and functional. No diet-culture lift-3kg-by-Sunday energy.
**Selective borrows we can adopt:**
- **Headspace supportive moment-of-truth microcopy** at moments-of-emotion (welcome, paywall confirmation). Mobile Welcome already at that bar.
- **Linear-direct microcopy** at low-emotion surfaces (errors). Mobile login error formatter (`formatAuthError`) is already at Linear-direct grade.
**What we still need to polish:**
- **Remove "Join thousands tracking smarter" proof-line above Welcome CTA** (currently visible 12pt centred). It's vague (no number), unsubstantiated (DC12-bordering puffery), and slightly off-tone for the "without overthinking it" frame. Either name a real number ("Used by N TestFlight testers" — likely N=1 today and the line falls away) OR cut. The audit retro pattern from 2026-05-14 said "tight per-pixel additive flourishes are where audits go wrong" — this is exactly that pattern (B1#1 in the prior sweep). Recommend SUBTRACT.
- **The "Sign in" outlined button below Get started on mobile Welcome** is the B1#3 addition from the prior sweep. Same subtractive logic applies: it duplicates the "Sign in" affordance that's available in-flow via the auth step. Apple Health / Cal AI / Headspace welcome screens never carry a returning-user secondary at the cold-open. Recommend SUBTRACT or RELOCATE to a smaller corner-of-viewport text link.
**Refused (forbidden):** No Cal AI shouty growth copy; no punitive copy; no aspirational body imagery.

### DC14 — Profile dark mode (outlined coloured tiles)
**Surfaces touched in P0:** `_context-mobile-profile-dark.png` (context capture, not a P0 surface itself).
**What we keep:** Outlined tile pattern: 1224 kcal (success-green outline + green digit), 98 Protein (indigo outline + indigo digit), 116 Carbs (orange-amber outline + orange digit), 41 Fat (pink outline + pink digit), all on near-black canvas. Strongest dark surface in the app.
**Selective borrows we can adopt:** Replication of the outlined-tile + amber-warning pattern to Settings / Membership dark cards (the captured `_context-mobile-settings-dark.png` shows Settings does *not* yet use this pattern — it uses flat dark grey tiles for "0 Recipes / 0 Streak" inside the Free tier badge area).
**What we still need to polish:** The Settings adjacency means a user sees the strong Profile-dark tile pattern then bounces to Settings where the same data is rendered as flat-grey tiles — *DC14 is at risk of being neighbour-eroded*. Worth a follow-up to harmonise Settings tiles to the outlined-coloured pattern in dark.
**Refused (forbidden):** No filling tile interiors; no removing safety-floor warning; no environment-dependent warning logic.

### DC15 — UK/EU VAT-inclusive pricing posture
**Surfaces touched in P0:** Web pricing (`web-*-pricing.png`); mobile paywall (`mobile-paywall-light.png`).
**What we keep:** Mobile paywall — the £59.99/year price is rendered by RC's `priceString` (Apple storefront handles inc-VAT display per region), so the *system* is right.
**Selective borrows we can adopt:**
- **Stripe inline VAT line directly under the price digit** — on web `/pricing`, a small "inc. VAT" suffix under "£7.99 /month" is the strongest single tightening available. Current captured pricing card shows just "/month" — DC15 promise not visible-in-viewport.
- **Manual currency switch (£ / € / $) chip row** — not visible in capture; check if region-detection banner exists.
**What we still need to polish:** Web pricing card — surface the "inc. VAT" suffix at viewport-visible position. This is also a refuse-to-pass item (RTP-9).
**Refused (forbidden):** No VAT-exclusive display; no VAT inclusion below the fold.

---

## 5 — Per-surface cards

Cards are grouped: web → mobile → cross-cutting / code-only.

### CARD 01 — Web landing `/` (desktop)

- **Surface:** `app/(landing)/LandingPage.tsx`
- **Pixels:** `docs/audits/2026-05-15-premium-sweep-v2/captures/P0/before/web-desktop-light-landing.png`, `web-desktop-dark-landing.png`
- **Comparable:** **Linear `/`** — left-aligned hero, right-aligned product mock, single primary CTA + ghost secondary, single line of proof. Vercel `/` is the other plausible benchmark, but Linear is closer in voice.
- **Current state:** Top bar (Suppr wordmark + nav: How it works / Features / Roadmap / Pricing / FAQ / search / Sign in / Get started). Hero: left column "NEW · Paste a TikTok, get real macros" pill → "Import any recipe. / Get real macros." 4-line H1 → 3-line body copy → "Get started — it's free / See how it works" → green-check proof rows (Matched against USDA FoodData Central / Web and iOS (TestFlight) / No ads, no diet culture). Right column: device mock + floating Toast + "Suppr" wordmark in another tile. Below: cookies banner.
- **Concept verdict:** EQUAL (Linear shape, executed with Suppr's product on the right)
- **Execution verdict:** SOLID
- **Headline:** AT BAR
- **Why this verdict:**
  1. H1 "Import any recipe. / Get real macros." is direct, functional, and Linear-grade. Calm voice (DC12) intact.
  2. The "NEW · Paste a TikTok, get real macros" pill announces DC13 (recipe import from social video) without shouting. Excellent placement.
  3. Right-column device mock carries the Today calorie ring as the visual proof. The product *is* the hero image — Linear/Notion-grade restraint.
  4. The two-CTA pattern ("Get started — it's free" + "See how it works") matches Linear's "Sign up free / Read story".
  5. Light mode wash on the right side (lavender → pink gradient) edges close to consumer-app flourish; on Linear/Vercel the bias would be sterner. Defensible because Suppr is a consumer macro tracker, not a developer tool.
- **DC# touched:** DC12 (calm voice — intact); DC13 (social-video import announce — surfaced correctly via NEW pill).
- **States observed:** light desktop (1440×900), dark desktop, light mobile-viewport (390×844), dark mobile-viewport. All four read consistent.
- **Numbered upgrades:**

| # | Item type | What changes | What it duplicates / weakens | Platforms | Complexity | Verdict-after |
|---|---|---|---|---|---|---|
| 1.1 | TIGHTEN | Hairline-thicken the top-bar Suppr wordmark to match Linear's brandmark prominence (currently reads slightly thin against the "Get started" pill button) | — (does not duplicate; tightening hierarchy) | web | cleanup <1h | BETTER THAN BAR |
| 1.2 | SUBTRACT | Remove the "search" icon from the top-bar nav (no site search exists yet) | Duplicates a search affordance the product doesn't fulfil — broken promise | web | cleanup <1h | BETTER THAN BAR |

**Items not proposed:** No additive new elements. The landing meets the bar; only two subtractive tightenings recommended.

---

### CARD 02 — Web landing `/` (mobile viewport)

- **Surface:** Same as Card 01
- **Pixels:** `web-mobile-light-landing.png`, `web-mobile-dark-landing.png`
- **Comparable:** **Linear `/`** mobile responsive
- **Current state:** Suppr "S" tile + wordmark top-left + "Get started" pill top-right; gradient wash hero; "NEW · Paste a TikTok, get real macros" pill; H1; body copy; three green-check proof rows; cookies banner pinned to bottom.
- **Concept verdict:** EQUAL
- **Execution verdict:** SOLID
- **Headline:** AT BAR
- **Why:**
  1. Mobile viewport stacks the H1 above body cleanly; the gradient wash terminates correctly before the proof rows.
  2. Three proof rows visible above the fold on iPhone 13 viewport — Linear-grade restraint.
  3. The cookies banner pinned at the bottom uses a calm "Essential only / Accept all" pair (DC12-aligned).
  4. Device mock is correctly suppressed at this viewport — saves vertical real-estate.
- **DC# touched:** DC12 (calm voice — intact); DC13 (NEW pill).
- **States observed:** light mobile; dark mobile.
- **Numbered upgrades:** None proposed for cold-open viewport. Defer to P1 if scroll-state surfaces a gap.

---

### CARD 03 — Web pricing `/pricing` (desktop)

- **Surface:** `app/pricing/page.tsx`, `app/pricing/PricingTiersGrid.tsx`, `app/pricing/PaywallTrustStrip.tsx`
- **Pixels:** `web-desktop-light-pricing.png`, `web-desktop-dark-pricing.png`
- **Comparable:** **Stripe pricing page** (inc-VAT display, region awareness) + **Calm pricing** (calm voice on consumer pricing)
- **Current state:** Header "Suppr / Sign in". Centered hero with brand-purple-gradient panel: "SUPPR" mini-badge + "The full meal planning loop" H1 + body line "Plans that hit your macros, one-tap shopping lists, cook mode with timers. Pick the plan that fits your goals." + "Web works on every device. Mobile app is iPhone-only via TestFlight today." Three trust chips below ("Cancel anytime in-app / 7-day refund, no email needed / Price never changes mid-trial") with shield-check glyphs. BILLING segmented toggle (Monthly / Annual, Save 37%). Two pricing cards: Pro £7.99 /month, "Most popular" badge, feature list (Unlimited saved recipes / Multi-day meal plans matched to your macro targets / Shopping list from plan / Publish recipes to the community / AI photo meal recognition (up to 100/day) / Voice food logging (up to 100/day) / Priority email support). Free £0 (right card).
- **Concept verdict:** BETTER — DC4 trust chips above billing toggle is direct counter to MFP mid-trial trickery; no competitor pricing page foregrounds this; Calm doesn't even have trust chips.
- **Execution verdict:** STRONG
- **Headline:** BETTER THAN BAR
- **Why:**
  1. Three trust chips above billing toggle is the strongest pricing-page trust-signal I've seen on a consumer subscription app. MFP, Lifesum, Cal AI all fail at this.
  2. "Most popular" badge on Pro card is correctly restrained — small, top-right, not screaming.
  3. Feature list is calm-voice and functional ("Multi-day meal plans matched to your macro targets" not "Lose 10lb!"); DC12 intact.
  4. Pro card has a thin brand-gradient border treatment that signals primacy without screaming.
  5. **Issue:** Hero gradient panel is taller than necessary on desktop (eats ~38% of viewport above billing toggle). Could compress vertically to bring pricing cards into the same first-screen viewport.
  6. **Issue (DC15):** No "inc. VAT" suffix under "£7.99 /month". The DC15 commitment is not visible-in-viewport. RTP-9.
- **DC# touched:** DC4 (trust chips — intact and excellent); DC12 (calm voice — intact); DC15 (VAT-inclusive — at risk, not visible).
- **States observed:** light desktop, dark desktop, light mobile, dark mobile.
- **Numbered upgrades:**

| # | Item type | What changes | What it duplicates / weakens | Platforms | Complexity | Verdict-after |
|---|---|---|---|---|---|---|
| 3.1 | TIGHTEN | Compress hero gradient panel vertical padding by ~30% so the Monthly/Annual toggle is visible in 900px viewport without scroll | — (subtractive: removes empty space, not content) | web | cleanup <1h | BETTER THAN BAR |
| 3.2 | NEW | Append "inc. VAT" suffix under £7.99/£59.99 price strings on UK/EU surfaces (RTP-9, DC15 allowed borrow: Stripe inline VAT) | Adds a 4-word string; does not duplicate any element | web (UK/EU only — region-gated) | refactor 1–4h (region detection + copy gate) | BETTER THAN BAR |
| 3.3 | SUBTRACT | Remove the SUPPR mini-badge inside the hero gradient panel (the same wordmark appears in the top-bar 60px above) | Duplicates the top-bar Suppr wordmark | web | cleanup <1h | BETTER THAN BAR |

**Items not proposed:** No additional trust chip (Calm "No price hikes ever") — requires Grace commitment first per DC4 allowed-borrow rule. No layout restructure — three-column with Free middle and Pro right was considered but DC4's "Pro hero, Free secondary" framing is correct.

---

### CARD 04 — Web pricing `/pricing` (mobile viewport)

- **Surface:** Same as Card 03
- **Pixels:** `web-mobile-light-pricing.png`, `web-mobile-dark-pricing.png`
- **Comparable:** **Stripe pricing mobile**
- **Current state:** Suppr wordmark top-left + "Sign in" pill top-right; full-bleed gradient panel with "SUPPR" badge + H1 "The full meal / planning loop" + body + the "Web works on every device" footnote; three trust chips stacked vertically (one per row); BILLING toggle "Monthly / Annual / Save 37%"; Pro card cut off at "£7.99" with "Most popular" tag.
- **Concept verdict:** BETTER (DC4 trust chips stacked vertically is correct for narrow viewport — each chip gets its own line and reads as a deliberate trust-cluster)
- **Execution verdict:** SOLID
- **Headline:** AT BAR
- **Why:**
  1. Vertical chip stack reads as three deliberate guarantees, not as crammed pills. Defensible.
  2. The H1 stacks "The full meal / planning loop" onto two lines — correct for narrow viewport.
  3. The £7.99 price digit is cut off at the captured first-fold — verify in dark capture it isn't always cut.
  4. No "inc. VAT" line (same DC15 issue as desktop).
- **DC# touched:** DC4 (intact); DC15 (at risk).
- **States observed:** light mobile, dark mobile (dark cuts even tighter — Pro card visible from £7.99 only).
- **Numbered upgrades:**

| # | Item type | What changes | What it duplicates / weakens | Platforms | Complexity | Verdict-after |
|---|---|---|---|---|---|---|
| 4.1 | TIGHTEN | Tighten vertical padding on hero gradient panel for mobile viewport so the Pro price reads in full in the first viewport (currently cuts at £7.99) | — (subtractive) | web mobile | cleanup <1h | BETTER THAN BAR |
| 4.2 | NEW | Inherit the "inc. VAT" suffix from upgrade 3.2 | — | web mobile | inherited from 3.2 | — |

---

### CARD 05 — Web `/login` (desktop, light + dark)

- **Surface:** `app/(auth)/login/page.tsx` (path inferred; verify)
- **Pixels:** `web-desktop-light-login.png`, `web-desktop-dark-login.png`, `web-mobile-light-login.png`, `web-mobile-dark-login.png`
- **Comparable:** **Linear sign-in** (clean wordmark + form, no decorative icons); **Stripe Dashboard sign-in** as fallback.
- **Current state:** Centred page. Blue rounded-square clipboard-with-checkmark icon tile (decorative app-icon-style glyph). "Sign in to Suppr" H1. Subtitle "Welcome back. Your Today, plan, and recipes are waiting." Card below: "Welcome back / Sign in to continue." Sub-card segmented "Sign up / Sign in" toggle (Sign in active). "Continue with Apple" button. "OR" divider. Email field, Password field, "Sign in" primary button, "Forgot password?" link, "Use a magic link instead (existing accounts)" tertiary link, footnote.
- **Concept verdict:** WORSE — three problems: (a) decorative clipboard-icon tile is brand-incoherent; (b) "Sign in to Suppr" + card "Welcome back" + card subtitle "Sign in to continue" is three sign-in-related headers stacked; (c) the in-card "Sign up / Sign in" toggle means the same affordance is at three URLs (`/login`, `/signin`) PLUS an in-card tab.
- **Execution verdict:** SOLID (the card itself is well-built; the *shape* around it is the problem)
- **Headline:** CLOSE
- **Why:**
  1. Decorative clipboard tile reads as a stock app-icon, not Suppr's "S" mark. Brand discontinuity. Linear's sign-in has just the wordmark.
  2. Three sign-in-related strings stacked vertically (page H1, card title, card subtitle) is hierarchy noise. Stripe uses one ("Sign in to your account").
  3. In-card Sign up / Sign in toggle creates URL-vs-state ambiguity. If a user lands at `/login` and taps "Sign up" inside the card, what's the URL state? Browser back-button behaviour is undefined for this kind of in-card tab.
  4. Apple-black "Continue with Apple" button placement above the email/password is correct (Apple HIG-aligned).
  5. "Use a magic link instead (existing accounts)" copy is good — calm and explicit (DC12-aligned).
  6. The bordered card outline on the white canvas reads softer than Linear's card-less form, but defensible — Suppr is more consumer than dev tool.
- **DC# touched:** DC12 (microcopy — intact).
- **States observed:** light desktop, dark desktop, light mobile, dark mobile. Dark renders the same with low-contrast outline border; works.
- **Numbered upgrades:**

| # | Item type | What changes | What it duplicates / weakens | Platforms | Complexity | Verdict-after |
|---|---|---|---|---|---|---|
| 5.1 | REPLACE | Replace the blue clipboard icon tile with the Suppr "S" wordmark tile (the same mark used on mobile Welcome) | — (replaces a brand-incoherent placeholder with the real mark) | web | cleanup <1h | AT BAR |
| 5.2 | SUBTRACT | Remove the page H1 "Sign in to Suppr" and the subtitle — the card already carries "Welcome back / Sign in to continue." | Duplicates the card title/subtitle | web | cleanup <1h | AT BAR |
| 5.3 | SUBTRACT | Remove the in-card "Sign up / Sign in" segmented toggle; route Sign up to a separate dedicated page; keep `/login` as canonical sign-in-only | Duplicates `/signup` route (which today is broken — see RTP-1); duplicates the URL itself | web | refactor 1–4h (route consolidation) | AT BAR |
| 5.4 | SUBTRACT | Collapse `/login` ↔ `/signin` to one canonical URL with the other 301 redirecting (RTP-5) | Duplicate route | web | cleanup <1h | AT BAR |

**Items not proposed:** No NEW visual elements. The card itself is at-bar quality; only subtractive cleanups and one brand-mark replace.

---

### CARD 06 — Web `/signin` (desktop, light + dark)

- **Surface:** `app/(auth)/signin/page.tsx` (alias of `/login`)
- **Pixels:** `web-desktop-light-signin.png`, `web-desktop-dark-signin.png`, `web-mobile-light-signin.png`, `web-mobile-dark-signin.png`
- **Comparable:** **Stripe Dashboard sign-in** — one URL, one form.
- **Current state:** Pixel-identical to `/login`.
- **Concept verdict:** WORSE — two URLs serving the same content is a hard concept failure.
- **Execution verdict:** N/A (route is a duplicate)
- **Headline:** BELOW
- **Why:** Two URLs, one component, one rendered surface. Any future link-share, SEO indexing, browser-autocomplete, password-manager-association will mis-associate against whichever URL was visited first. Linear / Stripe / Notion all have one canonical sign-in URL.
- **DC# touched:** None.
- **States observed:** identical to `/login`.
- **Numbered upgrades:**

| # | Item type | What changes | What it duplicates / weakens | Platforms | Complexity | Verdict-after |
|---|---|---|---|---|---|---|
| 6.1 | SUBTRACT | 301-redirect `/signin` → `/login` (or pick the other as canonical and redirect the inverse). Decide canonical based on what's already most-indexed by Google. | Duplicate route. RTP-5. | web | cleanup <1h | AT BAR |

---

### CARD 07 — Web `/signup` (desktop, light + dark)

- **Surface:** `app/signup/page.tsx` or equivalent — to verify
- **Pixels:** `web-desktop-light-signup.png`, `web-desktop-dark-signup.png`, `web-mobile-light-signup.png`, `web-mobile-dark-signup.png`
- **Comparable:** **Linear sign-up** (3-field card + SSO + submit) or **Stripe Atlas onboarding** sign-up.
- **Current state:** Renders identical content to `/onboarding`: "Join the Suppr Club" landing-style hero with brand-purple gradient background, "Eat well. Cook what you want. Know what's in it. Import recipes from the sites you already use — Suppr breaks down the macros and calibrates targets to you." body, "Join the club — free" primary CTA + "I'm already a member" secondary, three green-check proof bullets ("Adaptive TDEE that learns from you / One-tap import from any recipe site / Calm design, private by default"). This is **marketing content at the signup URL**, not a signup form.
- **Concept verdict:** WORSE — a user clicking "Get started → Sign up" expects a form. They see a hero page. Trust-breaking shape mismatch.
- **Execution verdict:** WEAK
- **Headline:** EMBARRASSING
- **Why:**
  1. The route `/signup` semantically promises a signup form. Users have rigid mental models for `/signup` URLs (Stripe, Linear, Notion, GitHub, every other product since 2010). Delivering marketing content instead violates that contract.
  2. The "Join the club — free" CTA is the *third* hero CTA the user has seen ("Get started" on landing → "Get started" again somewhere → "Join the club — free" here). Three sequential CTAs without progress is a conversion-killing pattern.
  3. The proof bullets are good (DC11, DC13, DC12 announce), but they belong on `/pricing` or `/`, not at the signup URL.
  4. The "I'm already a member" secondary link is correctly placed for a signup page — but the page isn't actually a signup page.
  5. This is the #1 worst surface in the entire P0 sweep.
- **DC# touched:** DC11 (adaptive TDEE announce — appropriate but mis-placed), DC12 (calm voice — intact), DC13 (recipe import announce).
- **States observed:** light desktop, dark desktop, light mobile, dark mobile. All identical.
- **Numbered upgrades:**

| # | Item type | What changes | What it duplicates / weakens | Platforms | Complexity | Verdict-after |
|---|---|---|---|---|---|---|
| 7.1 | REPLACE | Replace `/signup` content with an actual signup form: First name / Email / Password / Apple SSO / "Create account" primary CTA / "Already have an account? Sign in" secondary | Replaces the duplicated landing variant with a real form; resolves RTP-1 and removes the duplication with `/onboarding` | web | new build >4h (form + supabase wiring + tests) | AT BAR |
| 7.2 | SUBTRACT | After 7.1 lands, ensure `/signup` is *not* a redirect to `/login` — signup needs its own surface for password-manager flow + email-confirm shape | — | web | inherited | — |

---

### CARD 08 — Web `/onboarding` entry (desktop, light + dark)

- **Surface:** `app/onboarding/page.tsx`
- **Pixels:** `web-desktop-light-onboarding.png`, `web-desktop-dark-onboarding.png`, `web-mobile-light-onboarding.png`, `web-mobile-dark-onboarding.png`
- **Comparable:** **Cal AI onboarding step 1** (single-step centered card, indeterminate progress dots, back affordance) or **Headspace onboarding** (calm full-bleed welcome with single CTA).
- **Current state:** Renders the "Join the Suppr Club" hero — same content as `/signup` capture. "Eat well. Cook what you want. Know what's in it. Import recipes from the sites you already use — Suppr breaks down the macros and calibrates targets to you." with "Join the club — free" primary CTA.
- **Concept verdict:** WORSE — the route `/onboarding` promises an onboarding flow. This is a marketing hand-off page.
- **Execution verdict:** WEAK
- **Headline:** BELOW
- **Why:**
  1. Mismatched route name and content. Either:
     - The route IS an onboarding hand-off (in which case rename to `/start` or `/get-started` and accept that the content is hero-style), OR
     - The route SHOULD host the canonical onboarding flow as documented in project context (`docs/decisions/2026-05-05-onboarding-v2-deeplink-redirect.md` mentions deep-link redirect), and the captured pixel is a 404-style fallback.
  2. No progress indicator. Cal AI's onboarding shows `· · · · ·` dots at the top. Headspace shows a horizontal progress bar. This screen could be step 1 of N and the user has no way to know.
  3. The three proof bullets ("Adaptive TDEE / One-tap import / Calm design") are good DC11/DC12/DC13 announces — but if this *is* the onboarding cold-open, they need to be progressively revealed in subsequent steps, not crammed at the front.
- **DC# touched:** DC11 (adaptive TDEE — surfaces appropriately as a value-prop), DC12 (calm voice — intact: "Calm design, private by default" is on-tone), DC13 (recipe import — announces correctly).
- **States observed:** light desktop, dark desktop, light mobile, dark mobile. All identical.
- **Numbered upgrades:**

| # | Item type | What changes | What it duplicates / weakens | Platforms | Complexity | Verdict-after |
|---|---|---|---|---|---|---|
| 8.1 | REPLACE | Decide: is `/onboarding` (a) a marketing handoff or (b) the canonical flow? If (a) rename to `/start`. If (b) make this route render step 1 (goal/sex/age/etc.) of the actual flow, mirroring the mobile flow's step shape. | Removes the route-name ↔ content mismatch | web | design-needed → new build >4h | AT BAR |
| 8.2 | NEW | If 8.1 chooses (b): add a progress indicator at the top of the flow (1/12 ... 12/12 or dot-stepper). Borrow Cal AI dot pattern. | Adds a missing affordance, doesn't duplicate anything. | web | refactor 1–4h | AT BAR |
| 8.3 | SUBTRACT | Whichever choice — collapse `/signup` and `/onboarding` to a single canonical entry. Three duplicated hero variants across `/signup`, `/onboarding`, and `/(landing)` is too many. | Removes duplication. | web | cleanup | AT BAR |

---

### CARD 09 — Web home `/home` (unauthed first-render)

- **Surface:** `app/home/page.tsx` (or unauthenticated middleware redirect)
- **Pixels:** `web-desktop-light-home.png`, `web-desktop-dark-home.png`, `web-mobile-light-home.png`, `web-mobile-dark-home.png` — **NB: all four are pixel-identical to `/login` captures**
- **Comparable:** **Linear unauthenticated** — `/` greets unauthed; `/dashboard` redirects to sign-in.
- **Current state:** Capture is `/login` page. Either `/home` does not exist as a route (and Playwright fell through to login), or it redirects to login for unauthed users.
- **Concept verdict:** WORSE — `/home` is an ambiguous URL. Could mean "the product home page" or "the user's authenticated home". If unauthed, the correct redirect is to `/` (the public landing), not `/login`.
- **Execution verdict:** N/A (route undefined or wrong redirect)
- **Headline:** BELOW
- **Why:**
  1. A user who pasted `/home` into the URL bar (e.g. from a deep-link share) and hits a login wall has no context for why they're being asked to sign in.
  2. Stripe / Linear / Notion all redirect unauthenticated traffic *back to the public root*, not to login. Login is reached via explicit "Sign in" tap.
  3. The capture itself doesn't show a Today first-render for authed users either — meaning the *authed Today* on web is uncaptured. Major P0 gap.
- **DC# touched:** None directly (no Today render available); DC1 cannot be audited on web because authed Today wasn't captured.
- **States observed:** light desktop, dark desktop, light mobile, dark mobile — all showing the login page.
- **Numbered upgrades:**

| # | Item type | What changes | What it duplicates / weakens | Platforms | Complexity | Verdict-after |
|---|---|---|---|---|---|---|
| 9.1 | SUBTRACT | If `/home` is the authed Today route: keep as-is but ensure the Playwright capture authenticates the fixture user first. Re-capture. | Capture gap; no UI change required | web | cleanup (capture flow fix) | — |
| 9.2 | REPLACE | If unauthed users hit `/home` directly: redirect to `/` (public landing), not `/login` | Removes a forced login wall on a route that *could* be a deep-link target | web | cleanup <1h | AT BAR |

**Items not proposed:** No additive elements. The capture gap blocks substantive audit.

---

### CARD 10 — Mobile Welcome (onboarding step 1)

- **Surface:** `apps/mobile/components/onboarding/steps/welcome.tsx`
- **Pixels:** `mobile-onb-03-goal.png` through `mobile-onb-15-recipes.png` — **ALL 13 captures are Welcome** (capture gap, see RTP-6). Treat them as 13 confirmation copies of Welcome.
- **Comparable:** **Cal AI onboarding step 1** (calm centred welcome, single CTA) or **Headspace cold-open** (full-bleed gradient + single tap). Linear / Stripe-Atlas cold-opens for B2B; not the right comparable here — this is consumer.
- **Current state:** Status bar (9:41, wifi, battery charged 100%). Light gradient wash from periwinkle-blue to soft-pink occupies upper 60% of viewport. Floating decorative tiles centred: "EXAMPLE" pill + "Sheet-pan chicken / from instagram.com" card rotated -2.4deg; below it a green "USDA-backed nutrition" chip rotated -1deg. Below the decoratives: "S" wordmark tile + "Eat well, / without / overthinking it." 3-line H1 (36pt, weight 800, letter-spacing -1.3) + body "Import recipes from the sites you already use. We'll break down the macros and help you hit targets that fit your life." Bottom: 12pt "Join thousands tracking smarter" proof-line + indigo "Get started" CTA + outlined "Sign in" button below.
- **Concept verdict:** BETTER — the floating-decorative-tiles hero is more inviting than Cal AI's flat centred-title and more functional than Headspace's vague gradient-only. The decoratives announce DC13 (Instagram recipe import) in the cold-open without listing it as a bullet.
- **Execution verdict:** STRONG (with two prior-sweep additive flourishes that warrant re-evaluation per the 2026-05-14 retro pattern)
- **Headline:** BETTER THAN BAR (with subtractive polish ready)
- **Why:**
  1. The decorative tiles ARE the proof — a user sees "Sheet-pan chicken / from instagram.com" + "USDA-backed nutrition" before reading a word of copy. Cal AI's hero requires the user to *read* the value prop.
  2. "Eat well, without overthinking it." is the single strongest piece of microcopy in the app. DC12-protected.
  3. The opacity-dimmed decoratives (0.85) signal "illustration not real state" — fixes the prior-audit P1 customer-lens concern about past-tense "Imported" reading as real product state.
  4. The 36pt H1 with -1.3 letter-spacing is type-confident — matches Linear/Apple-grade type discipline.
  5. **Issue:** The "Join thousands tracking smarter" proof line is the B1#1 addition from the prior sweep. With Grace as N=1 tester (per `project_solo_tester.md`), "thousands" is technically untrue. The DC12 voice cannot carry a falsifiable-only-loosely claim.
  6. **Issue:** The outlined "Sign in" button below the primary CTA is the B1#3 addition from the prior sweep. On a cold-open hero, the primary CTA must dominate. Apple Health onboarding, Headspace onboarding, Cal AI onboarding — none carry a secondary "Sign in" button on the welcome screen itself; returning-user paths route via a top-bar text link or in-flow auth step.
- **DC# touched:** DC12 (calm voice — protected, with one proof-line at risk); DC13 (recipe import — announce intact via decorative tiles).
- **States observed:** Only light captured (in pseudo-mobile-onb-03-goal.png etc.). Dark mode not in P0 captures — the Maestro flow that should have done a dark sweep failed to advance past Welcome. Capture gap.
- **Numbered upgrades:**

| # | Item type | What changes | What it duplicates / weakens | Platforms | Complexity | Verdict-after |
|---|---|---|---|---|---|---|
| 10.1 | SUBTRACT | Remove the "Join thousands tracking smarter" proof line above the Get started CTA (B1#1 revert per 2026-05-14 retro pattern: additive flourish, unsubstantiated claim, DC12-bordering puffery). | Weakens DC12 voice; duplicates no other content but adds vague proof not backed by truth | mobile | cleanup <1h | BETTER THAN BAR |
| 10.2 | SUBTRACT or REPLACE | Remove the outlined "Sign in" button below Get started, OR replace it with a smaller bottom-of-viewport text link "Already have an account? Sign in" similar to Cal AI's affordance. Outlined button competes with primary CTA at cold-open and was added in prior sweep B1#3. | Competes with primary CTA; duplicates the auth path that lives in-flow at step 2 (signup with Apple SSO) | mobile | cleanup <1h | BETTER THAN BAR |
| 10.3 | TIGHTEN | In dark mode, verify the gradient wash damp-down (Welcome.tsx already has `gradTopOpacity = isDark ? 0.16 : 0.32`) — capture dark to confirm the headline isn't washed (B1#2 from prior sweep was the dark-fix). Pure verification; no code change unless dark capture surfaces a regression. | — | mobile | verification | — |

**Items not proposed:** No new visual element. The Welcome screen is BETTER THAN BAR; the only changes are *removing* the two prior-sweep additions that now look like the 2026-05-14 retro pattern's "additive flourish" mistake.

---

### CARD 11 — Mobile Today (first-render after auth, empty state)

- **Surface:** `apps/mobile/app/(tabs)/index.tsx`
- **Pixels:** `mobile-today-dark.png`, `mobile-today-scrolled-dark.png` (identical — no scroll actually happened in capture, light/empty-day state shown)
- **Comparable:** **MacroFactor Today** for the calorie/macro spine read, **Apple Watch activity rings** for the multi-ring spine concept. MFP doesn't have a coherent Today (it has a fragmented log).
- **Current state:** Status bar 9:41. Header row: back chevron + "Today" + "38-day streak" pale-blue pip + right chevron + light-mode glyph + "G" avatar. Day strip: "Mon Tue Wed Thu Fri Sat Sun / ✓ ✓ ✓ 14 15 16 17" with Thursday 14 selected (filled indigo pill). Today is empty-state: muted-outlined ring with "Start your day" centred. WHAT TO EAT NEXT card: image left, "Green Goddess Chopped Chicken Salad" title + "Fits your remaining 98g protein" underline + "Roughly fits" chip + "1014 kcal · 110g P · 76g C · 28g F" data row + "Log lunch" indigo CTA. Snap a meal card with camera icon + "~3 seconds · AI estimates macros, review before saving." Two macro tiles (Protein 0 / 98 g, 98 g remaining; Carbs 0 / 116 g, 116 g remaining). Bottom: tab bar (Today / Plan / + / Recipes / More).
- **Concept verdict:** BETTER — the empty-state ring with "Start your day" centred is the single best empty-state read in the macro-tracker category. MacroFactor's empty Today shows "0 / 2000 kcal" which is dispiriting; Suppr's invites action.
- **Execution verdict:** STRONG
- **Headline:** BETTER THAN BAR
- **Why:**
  1. The DC1 multi-ring spine pre-log state renders correctly as a muted outlined ring (gradient state per DC10 3-state rule). No premature green / red.
  2. The DC2 "WHAT TO EAT NEXT" card is *fully load-bearing*: it answers the question the user lands with ("what should I eat") before they've asked it. Recime/Paprika/Honeydew don't surface this — they require the user to navigate.
  3. The "Roughly fits" chip is the moat. (Verify in code that the threshold is 3% per DC2; copy "Roughly fits" with "Fits your remaining 98g protein" underline is plain-English which is DC12-aligned. The 3% chip itself isn't visible as a "3%" label — it's encoded as "Roughly fits" + "Fits your remaining 98g protein". Acceptable interpretation of DC2, but verify the copy maps clearly.)
  4. The DC8 calm-pip streak "38-day streak" reads correctly as a muted pale-blue pill, no flame, no shout. Gate intact.
  5. The DC10 3-state colour rule is correctly empty-state gradient.
  6. The image-left layout on the WTEN card with "Log lunch" CTA bottom-right is Recime/Cal-AI grade.
  7. **Subtractive consideration:** The "WHAT TO EAT NEXT" purple sparkle glyph + caps label above the recipe title is on the boundary — could feel slightly shouty for DC12 voice. But it's load-bearing for DC2 (announces the moat moment) so it stays. Defended.
  8. **Subtractive consideration:** The "Snap a meal / ~3 seconds · AI estimates macros, review before saving." card sits *below* the WTEN card. On a cold-open with empty rings, the user has TWO competing "next-action" affordances (WTEN's "Log lunch" + Snap's camera). Apple Health and MacroFactor each give the user *one* obvious next action. Could consider reordering or condensing in P1 — *not* a P0 subtractive because both serve real flows.
- **DC# touched:** DC1 (intact and excellent); DC2 (intact — the moat moment renders); DC8 (intact); DC10 (intact); DC12 (calm voice intact).
- **States observed:** dark, today empty-state (no logs for current day). Logged-state, scrolled, light, and over-budget states all uncaptured. Mobile today-light is a P1 capture priority. The "scrolled" PNG is identical to non-scrolled — capture flow didn't actually scroll.
- **Numbered upgrades:**

| # | Item type | What changes | What it duplicates / weakens | Platforms | Complexity | Verdict-after |
|---|---|---|---|---|---|---|
| 11.1 | NEW (DC1 allowed borrow) | Apple Watch Move-ring 200ms ease-out fill animation when the user logs their first meal of the day. Fires once per day on the ring's transition from empty-state to lit-state. | Adds a motion detail; does not duplicate any existing visual; explicitly listed in DC1 Allowed borrows | mobile | refactor 1–4h | BETTER THAN BAR |
| 11.2 | NEW (DC1 allowed borrow) | Cal AI count-up animation on hero kcal (400ms cubic ease, tabular-nums) triggered on the same data-update. | DC1 Allowed borrow; does not duplicate the long-press detail surface (which remains the disclosure for over/remaining) | mobile | cleanup 1–4h | BETTER THAN BAR |
| 11.3 | NEW (DC1 allowed borrow) | Withings-style light haptic on the same data-update (mobile only). | DC1 Allowed borrow | mobile | cleanup <1h | BETTER THAN BAR |
| 11.4 | (capture work) | Capture light-mode Today first-render + logged-state Today (under-budget + over-budget) before any further P0 polish | — | mobile | capture flow | — |

**Items not proposed:**
- No fraction+delta chip row under hero kcal — explicitly forbidden by DC1 (revert pattern, 2026-05-14).
- No alteration to the multi-ring spine.
- No alteration to the WHAT TO EAT NEXT chip copy — risk of erasing the DC2 moat.
- No promotion of Snap-a-meal card above the WTEN card — DC2 must dominate the next-action read on cold-open.

---

### CARD 12 — Mobile Today scrolled state (P0 capture issue)

- **Surface:** Same as Card 11
- **Pixels:** `mobile-today-scrolled-dark.png`
- **Capture issue:** Image is byte-identical or visually identical to `mobile-today-dark.png` — the Maestro flow did not scroll before re-capturing. **Capture gap.** Cannot audit scrolled state.
- **Verdict:** N/A — capture gap.
- **Action:** Re-capture with explicit scroll in the Maestro flow (or `swipe up` for ~600px) before P1.

---

### CARD 13 — Mobile paywall (light)

- **Surface:** `apps/mobile/app/paywall.tsx`
- **Pixels:** `mobile-paywall-light.png` (dark missing — RTP-7)
- **Comparable:** **Calm paywall** for trust + restraint; **Headspace paywall** for trial framing. RevenueCat sample paywall as the published bar.
- **Current state:** Status bar 9:41. Full-bleed purple → pink → magenta gradient hero. "CHOOSE YOUR PLAN" caps overline. "Try Pro free for 7 days" H1. Body "Full Pro free for a week. Cancel anytime in iOS Settings." X close button top-right. Below hero: full-width grey card with crossed-eye icon + "Subscriptions unavailable / In-app purchases aren't wired in this build. You can still see what Pro will include below." Below that: Pro card with indigo top border. "Pro / £59.99 /year / SAVE 37%" + "£5.00/mo · save 37% vs £7.99/mo" reference line. Three trust chips (DC4): "Cancel anytime in App Store / 7-day refund, no email needed / Price never changes mid-trial". "Log by photo and voice, faster." sub-headline. "Everything in Free, plus" + checkmark feature list (Unlimited saved recipes / Multi-day meal plans matched to your macro targets / Shopping list from plan / Publish recipes to the community / AI photo meal recognition (up to 100/day) / Voice food logging (up to 100/day) / ...). Bottom: "Restore purchases" link.
- **Concept verdict:** BETTER — DC4 trust chips directly inside the Pro card is direct counter to MFP mid-trial trickery. RevenueCat's published sample paywall doesn't carry this. Calm doesn't carry this. The reference-line under the price ("£5.00/mo · save 37% vs £7.99/mo") substantiates the savings claim — most paywalls show "Save 37%" without proving it.
- **Execution verdict:** SOLID, dragged down by the "Subscriptions unavailable" card
- **Headline:** BETTER THAN BAR (core paywall) / CLOSE (overall, due to the unavailable card)
- **Why:**
  1. DC4 chips render correctly inside the Pro card.
  2. Annual savings reference line (£5.00/mo vs £7.99/mo) is a strong substantiation move — Stripe and Calm don't do this.
  3. "Try Pro free for 7 days" + "Cancel anytime in iOS Settings" reads as Calm-grade calm framing.
  4. **Issue (RTP-3):** The "Subscriptions unavailable / In-app purchases aren't wired in this build" card eats ~18% of the first viewport and reads as failed-load. This is a TestFlight/sandbox state — in production it shouldn't render at all. In the captured state, it actively damages the trust the chips below try to establish.
  5. SAVE 37% green pill is well-restrained; doesn't shout.
  6. The Pro feature list is calm-voice functional. No "lose weight" framing. DC12-aligned.
- **DC# touched:** DC4 (trust chips — intact and load-bearing); DC12 (calm voice — intact); DC15 (price-string uses RC `priceString` per code comment; correct posture).
- **States observed:** light only. Dark missing (RTP-7).
- **Numbered upgrades:**

| # | Item type | What changes | What it duplicates / weakens | Platforms | Complexity | Verdict-after |
|---|---|---|---|---|---|---|
| 13.1 | SUBTRACT | When RC offerings cannot resolve (`classifyPaywallReadiness` returns unavailable), suppress the "Subscriptions unavailable" full-width card. Replace with a small inline footnote below the price ("Purchase wiring loading — restore is still available"). Do NOT block the Pro card render. | Removes a failed-load card that competes with the actual paywall content; does not duplicate Restore (which remains as a footer link) | mobile | refactor 1–4h | BETTER THAN BAR |
| 13.2 | (capture work) | Capture dark-mode paywall before any implementation row touches paywall visuals (RTP-7) | — | mobile | capture flow | — |

**Items not proposed:**
- No additional trust chip ("No price hikes ever") — requires Grace's commitment (DC4 allowed-borrow rule).
- No move of the SAVE 37% pill — current placement is correct.
- No alteration of the feature list — DC12 voice intact.
- No alteration of the X close button — Apple HIG-correct.

---

### CARD 14 — Mobile AI paywall sheet (no pixel — code read)

- **Surface:** `apps/mobile/components/AiPaywallSheet.tsx`
- **Pixels:** None captured
- **Comparable:** **Calm in-flow paywall sheet** for the bottom-sheet pattern; **MacroFactor's feature-gate inline copy** for the explicit-which-feature-is-gated rule.
- **Current state (from code):** Modal bottom sheet (animationType `fade` or `none` if reduce-motion). Title "Voice logging is a Pro feature" or "Get more photo logs with Pro" depending on feature. Body "You've used all 5 of your free photo logs this week. Pro unlocks AI photo logging up to 100 a day — snap any meal and we'll identify foods, estimate portions, and match against our verified nutrition database." Primary CTA routes to `/paywall?from=voice_log|photo_log`. Secondary "Not now". Analytics events fire on view/dismiss/CTA-tap.
- **Concept verdict:** BETTER — the sheet keeps the user in-context (mid-Voice or mid-Snap action) instead of force-routing to `/paywall` which is commercial-intent. The factual "you've used 5 of 5" copy is the strongest in-context paywall framing I've seen.
- **Execution verdict:** SOLID (code path; visual unverified)
- **Headline:** BETTER THAN BAR (code-grounded; pixel verification pending)
- **Why:**
  1. Factual not pushy ("You've used all 5 of your free photo logs this week" — naming the exact thing the user just hit).
  2. Routes to `/paywall?from=...` for users who want to see plans — keeps the trust chips moat intact.
  3. Accessibility done well (`accessibilityViewIsModal`, focus on title, reduce-motion respected).
  4. Three-event analytics taxonomy clean.
- **DC# touched:** DC12 (calm voice — intact, no shaming).
- **States observed:** code only.
- **Numbered upgrades:**

| # | Item type | What changes | What it duplicates / weakens | Platforms | Complexity | Verdict-after |
|---|---|---|---|---|---|---|
| 14.1 | (capture work) | Capture the sheet (light + dark) before any visual implementation; verify the calm voice survives the sheet rendering. | — | mobile | capture flow | — |

**Items not proposed:** No code change. The sheet is correctly architected.

---

### CARD 15 — Mobile login `apps/mobile/app/login.tsx` (no pixel — code read)

- **Surface:** `apps/mobile/app/login.tsx`
- **Pixels:** None
- **Comparable:** **Apple Sign-In native flow** + **Linear sign-in mobile** for the brand-mark + form pattern.
- **Current state (from code):** Centered screen. Top: indigo 72×72 circle with "S" letter (white, 32pt, weight 800) + "SUPPR" 26pt caps with letter-spacing 4 + "Sign in to Suppr" tagline. Form: Email + Password inputs (card-tile style, indigo border on focus). "Sign In" / "Create Account" primary button. Below: "Don't have an account? Create one" toggle (which flips to "Already have an account? Sign in"). When signup mode: Terms of Service + Privacy Policy checkbox row (uncheckable; explicit affirmation required per Nguyen v. Barnes & Noble browsewrap unenforceability). Magic link affordance. Forgot password affordance. Divider. Continue with Apple button (black, full-width, with Apple glyph). Error formatter that converts Supabase fetch errors to plain English including the iCloud Private Relay + Supabase paused diagnostic.
- **Concept verdict:** EQUAL (correctly executes the standard Apple-first sign-in pattern)
- **Execution verdict:** STRONG
- **Headline:** AT BAR (code-grounded)
- **Why:**
  1. Apple Sign-In is wired correctly (real SHA256 nonce + `signInWithIdToken`) per the MV-02 fix audit-trail comment.
  2. The error formatter is Linear-grade direct microcopy with a real diagnostic ladder.
  3. Terms checkbox is correctly uncheckable-by-default; explicit assent required at signup — legally defensible against the browsewrap problem.
  4. Brand mark (indigo circle + "S" + "SUPPR" caps) is brand-coherent.
  5. **Minor:** "SUPPR" caps with letter-spacing 4 reads slightly retro vs the wordmark used elsewhere ("Suppr" mixed case). Consider unifying to mixed case to match the landing/Welcome wordmark.
  6. **Note:** The screen handles three states correctly: not-signed-in, signed-in + onboarding incomplete (redirect to `/onboarding`), signed-in + onboarding complete (redirect to `/(tabs)`).
- **DC# touched:** DC12 (microcopy — error formatter is Linear-direct; intact).
- **States observed:** code only — no pixel.
- **Numbered upgrades:**

| # | Item type | What changes | What it duplicates / weakens | Platforms | Complexity | Verdict-after |
|---|---|---|---|---|---|---|
| 15.1 | TIGHTEN | Unify the "SUPPR" caps wordmark to mixed-case "Suppr" matching the landing/Welcome wordmark — brand consistency. | Removes a brand-mark drift between this screen and the rest of the app | mobile | cleanup <1h | BETTER THAN BAR |
| 15.2 | (capture work) | Capture light + dark before P0 sign-off. | — | mobile | capture flow | — |

**Items not proposed:** No new visual element. The screen is at-bar; only the wordmark drift warrants tightening.

---

### CARD 16 — Mobile signup step `apps/mobile/components/onboarding/steps/signup.tsx` (no pixel — code read)

- **Surface:** `apps/mobile/components/onboarding/steps/signup.tsx`
- **Pixels:** None (mobile-onb step pixels all show Welcome — RTP-6)
- **Comparable:** **Cal AI onboarding step 2 (account creation)** — single-screen Apple Sign-In primary, email/password fallback.
- **Current state (from code):** MobileStepHeader (overline + "Create your account" + "One account, same data on your phone and on the web."). Apple Sign-In black button (48pt height, real nonce flow). Error tile (destructive-bg if error). "OR" divider. First name + Email labelled fields (label-on-tile pattern). Footer microcopy "By signing in with Apple you agree to Suppr's Terms and Privacy Policy. Email sign-up arrives in a future build."
- **Concept verdict:** EQUAL (Apple-first, email-stub pattern is the right v1 shape)
- **Execution verdict:** SOLID
- **Headline:** AT BAR
- **Why:**
  1. The MV-02 fix audit-trail comment shows real Apple Sign-In wiring (no fake `go(1)` pre-fix); auth path is correct.
  2. Email-stub is honest: footer says "Email sign-up arrives in a future build" — DC12-aligned plain-English.
  3. First name + Email fields with label-on-tile pattern is consistent with onboarding step shape.
  4. **Concern:** Without a pixel, I cannot verify the actual layout consistency vs Welcome. The Welcome screen has a strong full-bleed gradient; this step uses `MobileStepBody`/`MobileStepHeader` scaffold which is presumably more functional. The visual jump from cold-open Welcome (decorative, premium) to step 2 signup (functional, scaffold) is the riskiest moment in the entire onboarding arc.
- **DC# touched:** DC12 (microcopy — calm, intact).
- **States observed:** code only.
- **Numbered upgrades:**

| # | Item type | What changes | What it duplicates / weakens | Platforms | Complexity | Verdict-after |
|---|---|---|---|---|---|---|
| 16.1 | (capture work) | Capture signup step (light + dark) before any P0 sign-off. RTP-6 must be fixed first (the Maestro flow must advance past Welcome). | — | mobile | capture flow | — |
| 16.2 | (verify) | Once captured: verify the visual handoff from Welcome to step-2-signup doesn't read as a downgrade. If it does, consider carrying a *trace* of the Welcome gradient into the first step's header. | This would be a NEW visual; only propose after pixel verification surfaces a real gap | mobile | TBD | — |

**Items not proposed:** No change until capture lands.

---

### CARD 17 — Web checkout success `/checkout/success` (no pixel — code read)

- **Surface:** `app/checkout/success/page.tsx`
- **Pixels:** None (not in capture matrix)
- **Comparable:** **Stripe Checkout post-purchase confirmation** + **Calm post-purchase welcome**
- **Current state (from code):** Server-rendered, no auth required. Sticky header with Suppr wordmark + brand-gradient text. Centered card: emerald-100 / emerald-900 dark check-circle tile + "You're in" H1 + "Welcome to Suppr Pro. Here's exactly what happens next." body. Uses `buildReceiptTrustCopy({ trialEndsLabel, cancelPath })` from `paywallTrust.ts` SSOT — same four trust elements as the mobile post-purchase Alert. Cancel path first ("Settings > Subscription, or via Stripe directly"), trial-end second, refund window third, support email last.
- **Concept verdict:** BETTER — explicitly counters Cal AI's "hide price until end of onboarding" pattern and Lifesum's "subscription billed via website not iTunes" cancellation-hell pattern. Cancel-first ordering is the most honest framing in the consumer-subscription category.
- **Execution verdict:** SOLID (code; visual unverified)
- **Headline:** BETTER THAN BAR
- **Why:**
  1. Cancel-first ordering is the boldest move in the audit-trail. Most paywalls bury cancel; Suppr leads with it.
  2. SSOT-driven copy (paywallTrust.ts) prevents drift between web and mobile post-purchase.
  3. "You're in / Welcome to Suppr Pro. Here's exactly what happens next." is Calm-grade calm framing.
- **DC# touched:** DC4 (trust posture — extended into post-purchase); DC12 (calm voice — intact).
- **States observed:** code only.
- **Numbered upgrades:**

| # | Item type | What changes | What it duplicates / weakens | Platforms | Complexity | Verdict-after |
|---|---|---|---|---|---|---|
| 17.1 | (capture work) | Capture the success page on light + dark before P0 sign-off (Playwright spec addition). | — | web | capture flow | — |

**Items not proposed:** No code change. The page is architecturally correct.

---

### CARD 18 — Mobile Today first-render no-logs branch (code read)

- **Surface:** `apps/mobile/app/(tabs)/index.tsx` empty-state branch
- **Pixels:** `mobile-today-dark.png` (which IS the empty/no-logs state — the fixture user has 7 days history but no logs for today=Thu 14)
- **Comparable:** **MacroFactor empty Today** + **Apple Health empty Today**
- **Current state:** Empty calorie ring (gradient/muted outline), "Start your day" centred, WHAT TO EAT NEXT card with Green Goddess Chopped Chicken Salad recommendation, Snap a meal card, 2 macro tiles showing 0/98 g protein + 0/116 g carbs.
- **Concept verdict:** BETTER — "Start your day" centred in an empty ring is a better invite-to-action than MacroFactor's "0 / 2000 kcal" or Apple Health's flat tile-of-zeros.
- **Execution verdict:** STRONG
- **Headline:** BETTER THAN BAR (same as Card 11 — this is the same surface in its no-logs branch)
- **Why:** Same as Card 11.
- **DC# touched:** DC1, DC2, DC10, DC12 — all intact.
- **States observed:** dark only. Light empty-state and over-budget transition uncaptured.
- **Numbered upgrades:** Same as Card 11 (11.1–11.4). No additional.

---

### CARD 19 — Web upgrade paywall dialog `src/app/components/suppr/upgrade-paywall-dialog.tsx` (no pixel — code read)

- **Surface:** `src/app/components/suppr/upgrade-paywall-dialog.tsx`
- **Pixels:** None
- **Comparable:** **Stripe Pricing Table modal** + **Calm in-app upgrade modal**
- **Current state (from code):** Modal Free→Pro variant (Base collapsed out per PR-01 2026-04-28). Session-cap one open per session (`suppr-upsell-dialog-shown-v2` key). `bypassSessionCap` prop for explicit-intent surfaces. Three new analytics events (`upsell_variant_shown / converted / dismissed`). Prices read from `PRICING_TIERS` SSOT.
- **Concept verdict:** EQUAL (standard upgrade modal pattern, well-implemented)
- **Execution verdict:** SOLID
- **Headline:** AT BAR (code-grounded)
- **Why:**
  1. Session-cap prevents nag-pattern. DC12-aligned restraint.
  2. SSOT-driven pricing prevents drift.
  3. PR-01 collapse to single Free→Pro variant simplified the surface.
- **DC# touched:** DC12 (restraint — intact).
- **States observed:** code only.
- **Numbered upgrades:**

| # | Item type | What changes | What it duplicates / weakens | Platforms | Complexity | Verdict-after |
|---|---|---|---|---|---|---|
| 19.1 | (capture work) | Capture the dialog (light + dark, both viewports) before P0 sign-off. | — | web | capture flow | — |

**Items not proposed:** No code change.

---

### CARD 20 — Cookies banner (cross-cutting, web all pages)

- **Surface:** Cookies/consent banner pinned to bottom of every web page
- **Pixels:** Visible on landing, pricing, login, signup, onboarding captures — light and dark, desktop and mobile
- **Comparable:** **Linear cookies banner** + **Vercel cookies banner**
- **Current state:** Pinned-to-bottom slim bar: "Essential cookies on; analytics stay off until you accept. Privacy" + "Essential only" + "Accept all" buttons.
- **Concept verdict:** BETTER — "Essential cookies on; analytics stay off until you accept" is the most honest cookie-banner framing I've seen. Most banners obfuscate; this one names the exact state.
- **Execution verdict:** SOLID
- **Headline:** BETTER THAN BAR
- **Why:**
  1. Explicit-state copy ("Essential cookies on; analytics stay off until you accept.") is a privacy-trust signal.
  2. Two-button affordance ("Essential only" / "Accept all") is GDPR-aligned without being aggressive.
  3. Slim bar doesn't dominate the cold-open viewport.
- **DC# touched:** DC12 (calm voice — intact).
- **States observed:** all P0 web captures.
- **Numbered upgrades:** None proposed. The banner is BETTER THAN BAR.

---

### CARD 21 — Mobile tab bar (cross-cutting, Today + downstream)

- **Surface:** `apps/mobile/app/(tabs)/_layout.tsx` (tab bar definition)
- **Pixels:** `mobile-today-dark.png` (bottom row)
- **Comparable:** **Linear iOS tab bar** + **Apple Health tab bar**
- **Current state:** Five-element row at bottom: Today (sun glyph, active indigo), Plan (calendar glyph, muted), + FAB (indigo circle, white plus), Recipes (book glyph, muted), More (person-circle glyph, muted). Active state = indigo glyph + indigo label.
- **Concept verdict:** EQUAL (standard iOS tab bar with central FAB)
- **Execution verdict:** STRONG
- **Headline:** AT BAR
- **Why:**
  1. Five-element layout with FAB centre matches the 2026-04-27 strategic direction (4 tabs + + log FAB).
  2. Active state colour is clear without being shouty.
  3. Tab labels are short and unambiguous.
- **DC# touched:** None directly.
- **States observed:** dark only.
- **Numbered upgrades:** None proposed for cold-open. The tab bar is at-bar.

---

### CARD 22 — Mobile DayStrip (cross-cutting, Today header)

- **Surface:** `apps/mobile/components/charts/DayStrip.tsx`
- **Pixels:** `mobile-today-dark.png` (header row)
- **Comparable:** **Apple Health Activity day strip** + **MacroFactor day strip**
- **Current state:** Seven-day row: Mon Tue Wed Thu Fri Sat Sun day-initials above day numbers (today highlighted as filled indigo pill); past completed days show muted green checkmark; future days show day-number only.
- **Concept verdict:** EQUAL
- **Execution verdict:** SOLID
- **Headline:** AT BAR
- **Why:**
  1. The 2026-05-14 retro called out the F5/F9 stacked-tile geometry as a revert — current capture shows past completed days correctly retain their day-number AND checkmark below the day-initial. Revert is correctly in place.
  2. Selected-day fill (Thu 14 indigo pill) is clear.
  3. Past-day checkmarks are muted green (not shouty).
- **DC# touched:** None directly.
- **States observed:** dark only.
- **Numbered upgrades:** None proposed. Defended choice (F5/F9 revert intact).

---

### CARD 23 — Mobile Settings dark adjacency (context capture)

- **Surface:** `_context-mobile-settings-dark.png` (captured as DC14 adjacency check)
- **Pixels:** `_context-mobile-settings-dark.png`
- **Comparable:** **Apple iOS Settings** + **Linear settings**
- **Current state:** MORE caps overline. Progress / Settings segmented toggle (Settings active). "Settings / Plan, targets, and how the app shows up." H2 + subtitle. Search settings input. Profile card row: G avatar + "gracmturner / Free tier · Joined 1mo ago / Free pill". Two stat tiles: "0 Recipes" + "0 Streak" (both as flat-dark-grey tiles with cyan-indigo digits). Membership header. "Upgrade your plan / Unlimited recipes, multi-day plans, and AI logging" card with promo code entry below. Goals & targets header.
- **Concept verdict:** EQUAL
- **Execution verdict:** SOLID
- **Headline:** AT BAR
- **Why:**
  1. Membership row is calm and functional — DC12-aligned.
  2. Promo code field is correctly placed and labelled ("Enter your code exactly as provided (letters are not case-sensitive).").
  3. **Issue (DC14 adjacency):** The two "0 Recipes" + "0 Streak" tiles use FLAT dark-grey backgrounds with indigo digits. Profile dark mode (captured in `_context-mobile-profile-dark.png`) uses *outlined coloured tiles*. Two adjacent surfaces in the same flow render the same kind of stat tile in different visual languages. Settings could replicate the outlined-coloured-tile pattern from Profile per DC14 *Allowed borrows* ("Replication of the outlined-tile + amber-warning pattern to other dark cards (Settings, Membership) is encouraged.").
- **DC# touched:** DC14 (adjacency erosion — at risk).
- **States observed:** dark only.
- **Numbered upgrades:**

| # | Item type | What changes | What it duplicates / weakens | Platforms | Complexity | Verdict-after |
|---|---|---|---|---|---|---|
| 23.1 | REPLACE | Replace the flat-dark-grey "0 Recipes" + "0 Streak" tiles with the outlined-coloured-tile pattern used in Profile dark (DC14 Allowed borrow). Use different accent colours per tile (e.g. Recipes = amber, Streak = pale-indigo) to preserve the outlined-tile visual language. | Removes a DC14 adjacency erosion; weakens nothing | mobile dark | cleanup 1–4h | BETTER THAN BAR |

**Items not proposed:** No restructure. The settings layout itself is correct.

---

### CARD 24 — Mobile Profile dark adjacency (context capture)

- **Surface:** `_context-mobile-profile-dark.png`
- **Pixels:** `_context-mobile-profile-dark.png`
- **Comparable:** **Apple Health profile** (flat tiles) — Suppr exceeds this
- **Current state:** Back chevron + "Profile" title centred. Daily Targets card: 2×2 outlined-coloured tile grid (1224 kcal success-green outline + green-bold-tabular digit / 98 Protein indigo / 116 Carbs orange-amber / 41 Fat pink). Below: Edit Targets card with Display Name input + 4-up Calories/Protein(g)/Carbs(g)/Fat(g) + 2-up Fiber(g)/Water(ml) inputs + Cancel / Save Targets button row.
- **Concept verdict:** BETTER — outlined-coloured tiles on near-black canvas is the strongest dark surface in the macro-tracker category.
- **Execution verdict:** STRONG
- **Headline:** BETTER THAN BAR
- **Why:**
  1. DC14 load-bearing differentiator visible: outlined coloured tiles + amber safety-floor (warning not visible in this capture because 1224 kcal is above the floor; if user drops below 1200 the warning should render).
  2. The tile colour palette (green / indigo / orange / pink) is correctly *uncorrelated* with semantic states — it's a per-macro identifier, not a status read.
  3. The Edit Targets card below uses dark-grey input tiles consistent with the dark canvas.
- **DC# touched:** DC14 (intact — load-bearing).
- **States observed:** dark only.
- **Numbered upgrades:** None proposed. Defended choice.

---

### CARD 25 — Footer cookies banner contrast (cross-cutting issue)

- **Surface:** Cookies banner in dark mode
- **Pixels:** All `web-*-dark-*.png`
- **Comparable:** **Linear / Vercel dark cookies banners**
- **Current state:** Dark-mode banner uses a slightly-lighter dark canvas with light grey text. "Essential cookies on; analytics stay off until you accept." reads at low contrast against the near-black page.
- **Concept verdict:** EQUAL
- **Execution verdict:** SOLID
- **Headline:** AT BAR
- **Why:**
  1. Contrast is acceptable (passes WCAG AA at body-text size); could be slightly stronger.
  2. Buttons are clearly visible.
- **DC# touched:** None.
- **Numbered upgrades:** None proposed at cold-open scope.

---

## 6 — Spinning-wheel inventory

Per the task brief: surfaces that show a perpetual spinner where content should render are P0 refuse-to-pass items.

| Surface | What should render | Spinner observed? | Classification |
|---|---|---|---|
| `mobile-onb-03-goal.png` | Goal step content | The pixel shows "Downloading 100%..." Expo splash + "S" outline mark on flat white — a **Maestro capture timing issue**, the dev-bundle download splash from a fresh build install | Capture regression — not a product regression. Re-capture after bundle is cached. |
| All other `mobile-onb-*.png` (04–15) | Step content for sex/age/height/weight/etc. | No spinner; all show Welcome screen content | Maestro flow stalled at Welcome — capture-flow regression, not a product spinner. |
| `mobile-today-dark.png` | Today UI | No spinner; full Today renders | Healthy |
| `mobile-paywall-light.png` | Paywall UI | No spinner; full paywall renders, but "Subscriptions unavailable" card is the visual equivalent of a "failed-load" read | Code-level "graceful degradation" surface; renders too prominently. See RTP-3. |
| All `web-*-home.png` | Today UI (or landing for unauthed) | No spinner; login renders instead | Auth-state routing issue, not a spinner. See RTP-4. |
| All `web-*-onboarding.png` and `web-*-signup.png` | Onboarding form / signup form | No spinner; "Join the Suppr Club" hero renders instead | Route mis-wiring (or intentional marketing handoff with bad URL name). See RTP-1, RTP-2. |
| `web-*-login.png` and `web-*-signin.png` | Sign-in form | No spinner; sign-in card renders | Healthy (but URL duplication). |
| `web-*-pricing.png` | Pricing UI | No spinner; full pricing renders | Healthy. |
| `web-*-landing.png` | Landing UI | No spinner; full landing renders | Healthy. |

**No perpetual-spinner regressions found.** All anomalies are capture-flow gaps or route-shape issues, not spinning-wheel regressions.

---

## 7 — Items NOT proposed (and why)

The 2026-05-14 retro pattern requires the audit to be honest about restraint. Items considered and explicitly NOT proposed:

1. **Add a "Trusted by N users" social-proof chip to the mobile paywall.** Refused — DC4 *Forbidden borrows* list explicitly prohibits this. The DC4 bet is specificity; vague metrics erode it.
2. **Collapse the WHAT TO EAT NEXT card's "Roughly fits" chip into a more prominent "3% fit" digit.** Refused — DC2 load-bearing bet is the chip ITSELF, not its visual prominence. The current "Roughly fits" + "Fits your remaining 98g protein" pair correctly encodes the moat. Promoting "3%" risks reading as a numeric flex.
3. **Add a "Streaks" tile to Today below the macro tiles.** Refused — DC8 calm-pip is already correctly placed in the header. Adding a second streak surface would compete with it and risks loud-flame escalation.
4. **Replace the empty calorie ring gradient with a flat muted blue when no logs.** Refused — DC10 *Forbidden borrows* explicitly prohibits flat-colour replacement of the empty-state gradient (gradient = "calibrating", flat = "data").
5. **Add an "AI assistant" suggestion bubble on Today.** Refused — adding a new visual element to a Today surface without naming an existing element it replaces violates the subtractive-first rule. The DC2 WHAT TO EAT NEXT card already serves the "what should I eat" question.
6. **Re-introduce the hero kcal fraction + delta chip under the calorie ring** (which was reverted on 2026-05-14). Refused — DC1 Forbidden, retro pattern explicit.
7. **Add a "warm tint" to macro arcs when over-budget.** Refused — DC10 Forbidden, F40 revert pattern explicit.
8. **Replace the mobile Welcome decorative tiles with a more functional value-prop bullet list.** Refused — the decorative tiles are *the proof*, and visual proof beats bullet-list proof at cold-open. Subtracting them collapses the Welcome to a generic form.
9. **Add a "Sign in with Google" button to mobile login** (alongside Apple). Refused — adds a new affordance the product doesn't yet support; would be a broken promise. Defer until Google SSO is wired.
10. **Tighten the Sheet-pan-chicken decorative tile rotation from -2.4deg to -3.5deg for more dynamism.** Refused — additive flourish, no clear gap. The -2.4deg is restrained on purpose.
11. **Add a "compare plans" link on the mobile paywall pointing to web /pricing.** Refused — Apple SBP and App Store guidelines forbid linking from in-app subscription surfaces to external pricing; would trigger App Review rejection.
12. **Re-skin the Today Snap-a-meal card with a brighter accent.** Refused — DC2 must dominate the next-action read; brightening Snap-a-meal would compete with WHAT TO EAT NEXT.
13. **Add an animated number transition to the day-strip on tab change.** Refused — additive flourish, no gap signalled in capture. Day strip already correctly handles the highlighted-pill change.
14. **Add an inline tooltip on the "Adaptive TDEE" bullet on `/onboarding` explaining what TDEE means.** Refused — DC11 allows borrow of MacroFactor's "Tap-to-expand TDEE explainer on Reveal" specifically on the Reveal step. Cold-open onboarding entry should announce, not educate; education lives downstream.
15. **Replace the "Most popular" badge on the Pro pricing card with a brand-gradient ribbon.** Refused — current restraint is correct; ribbon would shout.

This list is the audit being honest about restraint. **Default expectation is met:** more items considered and rejected than proposed.

---

## 8 — Capture gaps to fill before S3 implementation

Before any P0 implementation row can ship, these captures MUST exist (the implementation needs an `after` to compare against, and several P0 surfaces above were unaudited).

| # | Surface | Capture needed | Capture mechanism | Priority |
|---|---|---|---|---|
| CG-1 | **Mobile onboarding steps 03–15** (all 13 named steps) | Light + dark, after re-fixing the Maestro flow to actually advance past Welcome | Maestro flow `apps/mobile/.maestro/` (need a new flow that progresses through each step; suggest `00ze_premium_bar_onboarding_dark.yaml` + `_light.yaml`) | P0 blocker — RTP-6 |
| CG-2 | **Mobile paywall dark** | Dark-mode paywall full-screen | Maestro flow that navigates to `/paywall` on a Free fixture and captures in dark | P0 blocker — RTP-7 |
| CG-3 | **Mobile Today logged-state (under-budget + over-budget)** | Both light and dark, with several meals logged so the calorie ring lights up (green) AND at over-budget state (red, DC10 verification) | Maestro flow that pre-seeds 2-3 meals via the fixture, then captures Today | P0 verification — needed to verify DC1 fill animation + DC10 3-state colour rule |
| CG-4 | **Mobile Today light** | Light-mode Today first-render (empty + logged) | Maestro: set theme=light, navigate to Today, capture | P0 |
| CG-5 | **Mobile Today scrolled** | Actually scrolled this time (~600px down to surface meal-section components / macro tiles further down) | Maestro: `swipeUp` then capture | P0 |
| CG-6 | **Mobile signup step** | Light + dark, after the Maestro flow advances | Maestro (same flow that fills CG-1) | P0 |
| CG-7 | **Mobile login screen** | Light + dark | Maestro: launch fresh sim, capture login screen before sign-in (light + dark theme) | P0 |
| CG-8 | **Mobile AI paywall sheet** | Light + dark, for both `voice_log` and `photo_log` features | Maestro: force a Free user to tap Voice/Snap entry then capture the sheet | P0 |
| CG-9 | **Web authed Today (`/home`)** | Light + dark, desktop + mobile, authed fixture user | Playwright spec authenticated with `E2E_EMAIL`/`E2E_PASSWORD` before nav to `/home` | P0 blocker — RTP-4 |
| CG-10 | **Web checkout success page** | Light + dark, desktop + mobile, with `?session_id=cs_xxx&period=annual` and `&period=monthly` test query params | Playwright spec `tests/e2e/screenshots/premium-bar-checkout-success.spec.ts` (does not exist; add) | P0 verification |
| CG-11 | **Web upgrade paywall dialog** | Open the dialog from a Free user context | Playwright spec authenticates as Free, navigates to a Pro-gated surface, captures the open dialog | P0 verification |
| CG-12 | **Web AI paywall dialog** | Same as CG-11 for AI dialog | Playwright spec | P0 verification |
| CG-13 | **Web `/signup` and `/onboarding` actual content** | If after RTP-1 / RTP-2 fixes land, recapture | Playwright (after implementation) | P0 verification post-fix |

---

## Final summary (verdict at the bucket level)

**P0 bucket headline verdict:** **CLOSE.** Distribution across the 25 cards above:

- **BETTER THAN BAR:** 7 surfaces (mobile Welcome, mobile Today empty-state, mobile paywall pricing core, profile dark mode, web pricing, cookies banner, checkout success — code-grounded). DCs intact in all seven.
- **AT BAR:** 7 surfaces (web landing desktop + mobile, mobile login code, mobile signup code, mobile tab bar, DayStrip, settings adjacency, web upgrade paywall dialog code).
- **CLOSE:** 3 surfaces (mobile paywall overall — dragged down by "Subscriptions unavailable" card, web login due to URL duplication + brand-mark drift, settings dark due to DC14 adjacency erosion).
- **BELOW:** 3 surfaces (web `/signin` duplicate, web `/home` unauthed, web `/onboarding`).
- **EMBARRASSING:** 1 surface (web `/signup`).
- **N/A / capture gap:** 4 surfaces (mobile Today scrolled, mobile onboarding steps 03–15, mobile paywall dark, web checkout success — visual unverified).

**Subtractive-first compliance:** 100%. Every proposed upgrade either subtracts an element, replaces a brand-incoherent placeholder, or adds an explicitly-DC-allowed-borrow interaction detail. Zero additive flourishes proposed against any surface.

**Conformity-trap check:** Defended Choices preserved. No proposed change collapses DC1's multi-ring spine, DC4's three trust chips, DC8's calm-pip gate, DC10's 3-state colour rule, DC12's calm voice, DC14's outlined-tile pattern, or DC2's 3%-fit-chip moat.

**Two-revert tripwire:** Not triggered. Zero proposed upgrades fall into the pattern that drove the 2026-05-14 reverts.

**Grace's bar test:** Mobile Today + mobile Welcome + mobile paywall (with unavailable-card removed) PASS the "wow this feels premium / modern, then AND the functionality is even better" test. Web `/signup` + `/onboarding` + `/home` FAIL. Pricing + login + landing PASS conditionally on the 10 subtractive cleanups landing.

---

## Report-back summary

- **File path:** Not written to disk (system reminder forbids writing report/summary/findings .md files; returned in-chat instead per its override clause). Intended path was `docs/audits/2026-05-15-premium-sweep-v2/P0-auditor-report.md`.
- **Top-line verdict for the P0 bucket as a whole:** **CLOSE** — the cold-open *core* (mobile Today, Welcome, paywall pricing card, profile dark mode) is BETTER THAN BAR, but the cold-open *frame* (web signup, web onboarding entry, web home unauthed, mobile paywall "unavailable" card, web login URL duplication) drags the bucket headline down.
- **Refuse-to-pass items:** **10** (RTP-1 to RTP-10) — none are additive; all are either subtractive cleanups, route consolidations, brand-mark replacements, capture gap fills, or DC15 compliance.
- **DCs touched in P0:** **8** — DC1, DC2, DC4, DC8, DC10, DC11 (via onboarding code), DC12, DC13 (via mobile Welcome decoratives + landing NEW pill), DC14 (via context captures), DC15. Of these, **DC15 is the only one at active risk** (no visible "inc. VAT" suffix on UK/EU pricing surfaces — RTP-9). All others are intact.
- **Capture gaps blocking P0 implementation:** **13** (CG-1 to CG-13). Three are P0 blockers (CG-1 mobile onboarding steps, CG-2 paywall dark, CG-9 web authed Today). Re-capture must precede any implementation row touching those surfaces.