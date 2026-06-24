# Sloe v3 — reskin vs new features (the backlog split) — 2026-06-23

Grace's call (2026-06-23): the v3 prototype's work is **two separate tracks**, and the
backlog should treat them separately:

- **RESKIN** = make existing, working surfaces *look exactly like the prototype* (Sloe
  cream/serif/plum grammar, borderless cards, token roles) + collapse the v3 feature
  flags. **No new capability, no new backend, no new state.** Tracked under the Sloe v3
  reskin project (ENG-1225). ~**90% of the prototype is this.**
- **NEW FEATURES** = net-new *functionality* the prototype introduces (a screen, flow,
  interaction, computation, or data capability that doesn't exist today). A separate
  track — these are product bets, not look-and-feel, and several are post-launch.

Grounded by an 11-agent classification workflow (`wf_ee100c0e-9ac`) reading the prototype
(`docs/ux/redesign/v3/Sloe-App.html`) against current `main`, surface by surface.

## The RESKIN track (what it is — so it's NOT confused with new features)

Everything that already works end-to-end on both platforms and that the prototype only
restyles: the whole **Today** spine (jewel ring, tiles/bars/rings, north-star "eat next",
net-energy/TDEE, Apple-Health, hydration, %DV, day-strip, calm mode); the **Plan** week
(verdict, day rings, calorie band, filter chips, meal cards, shopping-by-aisle); the full
v3 **cook** baseline (mise/checklist/swipe/timers/scaling, now default-on) + recipe detail;
**Discover/cookbook** shelves (creator rail, cuisine clusters, Following filter,
collections); the entire **onboarding** flow (reveal-before-signup, goal+pace+floor,
diet+allergens, macro split, BMR/TDEE reveal, data-bridges); nearly all of **Progress**;
the bulk of **Profile/Settings**; the conversion **paywall**; the import method grid +
Recent/Saved/Library tabs + the shipped CSV/recipe-import engines; and the
coach/recap/streak primitives. The job: restyle + collapse flags + SEE both platforms.

**Two prototype elements are intentional divergences — do NOT adopt:**
- The £3.99 "Base" paid tier — live app is deliberately Free + Pro (D-2026-04-27-05).
- The mobile manual region-flag price picker — live gets currency + VAT from Apple's storefront.

## The NEW-FEATURES track (net-new functionality)

`state`: absent / partial-stub / built-but-dark / backend-only · `size`: S/M/L/XL ·
`★` = launch-relevant.

### Onboarding conversion funnel
- ★ **In-onboarding trial/paywall decision step** (L, absent) — peak-intent step after the reveal: Pro value + "7-day trial then £59.99/yr" vs "Continue Free", before Today.
- ★ **Goal-weight + projected weight-trend chart in the reveal** (M, partial) — capture target weight, render an animated trend line to a derived target date.
- ★ **Guided first-log / first-win step** (M, absent) — prompt the first log (Breakfast/Coffee/Search chips) from inside the funnel.
- **Motivation / "why" capture** (M, absent) — driver + obstacle to tune tone/nudges.
- **Email magic-link auth path** (M, partial) — passwordless email alongside Apple.

### Growth loops
- ★ **Referral / invite-for-Pro loop** (L, backend-only) — personal invite link, inviter + invitee each earn a free month (referrals table exists, no surface).

### Trust / provenance
- ★ **Owner "Claim → Official" verified-macros toggle** (M, backend-only) — owner flips their recipe from community-estimate to macros-confirmed (recipe_claim ENG-870 exists, no UI).
- **Per-value nutrition-source provenance & confidence screen** (M, partial) — DB priority order, prefer-custom toggle, confidence labels, per-value "where it comes from".

### Import front-door (the unified-import shell already shipped flag-dark — these are the net-new phases)
- ★ **Unified import: single-sheet detect→review→preview** (L, partial) — stay in ONE sheet through review/preview (single-recipe ingredient review, multi-recipe pick, CSV mapping, fail) instead of navigating away.
- ★ **Multi-recipe collection import** (L, absent) — a collection/week-of-links URL returns multiple recipes with a pick-list.
- ★ **CSV importer UI: source-grid + column fingerprint + editable mapping + preview** (L, partial) — *the MFP-refugee trust moment*; the 4-adapter parse+insert engine ships, the net-new is the fingerprint/mapping/**preview-before-commit** front-end (+ 4 more sources).
- **Recipe-page/cookbook-page photo as a detected import kind** (M, absent).
- **LogHub accelerator row** (Log usual / Copy yesterday / Duplicate day) + saved-meals-as-Routines (M, partial).

### Plan depth
- ★ **Rich per-meal action sheet** (swap/move-day/portion/lock/mark-cooked/remove) (L, built-but-dark).
- **Batch-cook portion planner** (cook-once / assign-portions / fridge tracker) (L, absent).
- **Adjust-constraints plan-controls sheet** (source / floor slider / meals-per-day) (M, partial).
- **Household banner + servings-auto-match-to-eaters** (S, partial).
- **In-tab smart-suggestion rows + per-day cooked-state badging** (M, built-but-dark).

### Coach / Digest destinations
- **Standalone Coach screen + "ask the coach" chips** (L, partial) — conversational Q&A beyond the Today ranked-recipe card.
- **Daily digest / morning briefing + delivery controls** (L, absent) — daily brief (today only a weekly Sunday recap exists).
- **Adaptive-TDEE "why your target changed" explainer** (M, backend-only).

### Progress
- ★ **Body Composition · trends (Pro-gated)** (L, partial) — lean mass + body-fat trended over time, Pro-locked (today: single body-fat value only).

### Profile / identity
- **Profile streak / milestones / freeze-token surface** (M, partial).
- **Multi-category scope-selectable data export with emailed archive** (M, partial).
- **In-settings public/creator profile entry** (S, partial).

### Social / creator expansion (mostly post-launch — the bigger product surface)
- **"Following" social timeline of creator post cards** (L, partial).
- **Direct-message a creator + share-profile** (XL, absent) — a messaging primitive that exists nowhere today.
- **Creator Following count + 3-up profile stat row** (M, absent).
- **"Share my streak" from the win moment** (M, partial).
- **Browse-by-cuisine rail** (L, absent).
- **Editorial curation: "What to cook tonight" / Editors' picks** (M, absent).
- **Eating-out: curated restaurant dishes near you + one-tap Log** (M, partial).

### Today polish (minor)
- **Tap-the-ring Remaining ⇄ Consumed toggle** (S, absent).
- **Extra macro-display variants (Donut, Split) + ring-style selector** (S, built-but-dark).

### Billing depth
- **Suppr-owned in-app billing screen** (history/invoices + plan-switch + grace-period + lifecycle recovery) (XL, partial) — vs delegating to Apple/Stripe.

## The launch-relevant net-new (the short list that actually gates launch)
1. Onboarding conversion funnel — trial step + projection + first-log
2. Import front-door — unified in-line review + multi-recipe + **CSV mapping/preview**
3. "Claim → Official" provenance toggle
4. Referral loop
5. Body Composition trends (Pro-gated)
6. Plan per-meal action sheet (mostly built-but-dark)

Everything else is post-launch product. The **reskin track** ships the daily loop in days
(flag-flips + a few genuine gaps); the **new-features track** is where the multi-week
estimate actually lives.
