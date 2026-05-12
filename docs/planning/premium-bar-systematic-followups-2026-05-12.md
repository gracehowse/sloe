# Premium-bar audit systematic follow-ups — 2026-05-12

**Source audit:** `docs/audits/2026-05-12-full-premium-bar-audit.md` (2022 lines).
**Branch:** `claude/premium-bar-audit`.

Every actionable item from the audit extracted and tagged. The audit
includes ~190 items across:

1. Defended Choices DC1–DC15 polish paths
2. Per-Group sections (A/B/D/E/F/H/I/J/K+L) "Upgrades to reach the bar"
3. Refuse-to-pass list (20 ranked items)
4. "10 worst surfaces" snapshot
5. Late-add findings

**Tag legend:**

- `[x] SHIPPED` — landed in branch `claude/premium-bar-audit`
- `[p] PARTIAL` — work landed but finishing details still open
- `[ ] OPEN` — not yet shipped
- `[d] DEFENDED` — explicit carve-out (do NOT change)
- `[e] EXTERNAL` — cannot be done in pure code (RevenueCat dashboard,
  TestFlight, Maestro/Playwright sim re-capture, Apple App Store
  Connect)

This doc is the live tracking surface — update tags as items ship.

---

## DC1 — Multi-ring calorie + macros spine (Today hero)

- [x] Bump macro arc stroke weight so info is legible (mobile 5→6.5, web 5→7, dim-on-over)
- [x] Drop "Why this number?" link from default state — lives at /home?view=targets / mobile Targets
- [x] Empty-state ring uses gradient (DC10 mapping) verified light + dark
- [ ] Apple Watch 200ms ease-out fill animation on each macro arc when logged
- [ ] Cal AI count-up animation on hero kcal (400ms cubic ease, tabular-nums)
- [ ] MacroFactor tabular-nums on all changing numbers (hero + delta + legends)
- [ ] Withings light haptic on data update
- [ ] Apple Watch warm-tint reinforcement on over-budget across all arcs
- [ ] Add `1,822 / 1,600` + delta chip in ring centre under kcal
- [ ] Animate macro arcs in as data lands on first log of day

## DC2 — "What to eat next" 3% fit chip

- [ ] 64×64 hero recipe image on card
- [ ] Recime multi-line title + line-clamp(2), no mid-word ellipsis
- [ ] MacroFactor "Why this recommendation?" disclosure
- [ ] Cal AI 200ms fade-up on first paint
- [ ] Collapse three fit-statements into one row
- [ ] Unify Log verb (vs Eat Again "LOG")

## DC3 — Eat Again card

- [ ] MacroFactor stacked 2-3 Eat Again candidates as horizontal scroller
- [ ] Recime card-layout polish when image present
- [ ] Fix mid-word title truncation ("Salad & Stic…")
- [ ] Unify macro format string (`698 kcal · 22g P · 95g C · 27g F`)
- [ ] Unify Log verb (cross-cuts DC2)

## DC4 — Paywall trust chips

- [ ] Calm "No price hikes ever" 4th chip (pending Grace decision)
- [ ] Stripe Checkout adjacent placement of guarantees next to price
- [ ] Platform-correct chip strings (web Stripe portal copy)
- [ ] Dark-mode contrast audit on green check glyphs

## DC5 — Sparse-state weight chart

- [ ] Solid line between 2 points (replace dashed)
- [ ] 2-point state caption stays; just stroke swap

## DC6 — Weight-skip path in onboarding

- [ ] Withings soft animated illustration on calibrate-copy fallback
- [ ] Promote `targets == null` Reveal fallback with illustration + one-liner

## DC7 — Sex step inclusive helper expander

- [ ] Mirror expander pattern on Age step

## DC8 — Streak calm pip

- [ ] Headspace shield glyph on freeze-protected day (surface `streakFreeze`)
- [ ] Duolingo supportive reset-day copy when streak breaks
- [ ] Move chip into week-strip row near "Today" pill
- [ ] Confirm dark-mode tint stays brand-blue

## DC9 — Reset modal soft/hard split

- [x] Apple "Type RESET to confirm" gate on Erase Everything
- [ ] Linear bullet ✓/✗ breakdown inside dialog
- [ ] Reformat dense paragraph as scannable bullets
- [ ] "Undo within 24h" footnote if soft-deleted (pending backend verify)

## DC10 — Calorie ring 3-state colour

- [x] Apply 3-state to Calories This Week bar chart in Progress drill-down (mobile + web)

## DC11 — Adaptive TDEE in Free tier

- [ ] Surface "Adaptive TDEE" callout on landing Free-tier card
- [ ] MacroFactor TDEE trajectory mini-chart on Targets surface
- [ ] Tap-to-expand TDEE explainer on Reveal

## DC12 — "Eat well, without overthinking it" calm voice

- [ ] Past-tense voice rule consistency ("Last week:" not "Your week —")
- [ ] Headspace supportive moment-of-truth microcopy at weigh-in, missed-day
- [ ] Linear direct/functional microcopy at low-emotion surfaces
- [d] Web "Join the Suppr Club" headline — survives rebrand decision (carve-out)

## DC13 — Recipe import paste-link

- [x] Recime real-time skeleton during parse
- [x] Things 3 clipboard URL auto-detect on app foreground
- [x] Cal AI narrated parse status
- [x] Multi-source action sheet on "+ Create"
- [ ] Recime per-ingredient confidence bar on verify
- [ ] Promote "Import from a link" to permanent first Discover card

## DC14 — Profile dark mode

- [ ] Fix safety warning rendering parity (1132 kcal shows warning in dark, not light)
- [ ] Replicate outlined-tile + amber-warning pattern on other dark cards (Settings, Membership)

## DC15 — UK/EU VAT-inclusive pricing

- [ ] Stripe inline VAT line under price digit (P0 compliance)
- [ ] GoCardless region-detection banner for currency switch
- [ ] Surface inclusive-VAT line in visible viewport on UK/EU detection (P0)
- [ ] Expose manual currency switch (£/€/$) chip row

---

## Group A — Landing & marketing

### Landing hero (`/`)

- [ ] Replace single iPhone with desktop+iPhone composition
- [ ] Demote secondary CTA to text link with chevron
- [ ] Make "NEW · Paste a TikTok" eyebrow pill a real link
- [ ] Fix mobile-web header (Sign in + Get started collapse, hamburger nav, theme toggle in menu) — P0
- [ ] Re-grade dark-mode hero gradient symmetric
- [ ] Move trust line above CTAs as sub-sub-headline
- [x] Reduce cookie banner to Stripe-style bottom bubble

### Pricing (`/pricing`)

- [ ] Surface inclusive-VAT line under price digits on UK/EU detection (P0)
- [ ] Manual currency switch chip row
- [ ] Lift Pro card visually (+8px height, 2px border, drop shadow)
- [ ] Glyphs in feature lists (check/plus)
- [ ] Move trust pills below tier cards on mobile-web
- [ ] Position "Save 37%" tag inside active toggle option
- [ ] Rebrighten "Most popular" ribbon in dark with `--success` token
- [ ] Add 6-question FAQ section
- [ ] Fix duplicate Free-card row
- [ ] "Multi-day meal plans matched to your macros in logging" broken English

### Roadmap (`/roadmap`)

- [ ] Add Next + Later phase sections (3-5 items each)
- [ ] Tighten cards to ~40px, divider list
- [ ] Per-item description on expand / wire to /whats-new
- [ ] Replace right-aligned version chip with count chip row
- [ ] "Get notified when X ships" inline email capture
- [ ] Single status dot/glyph at row left edge
- [ ] Mobile-web: trim card vertical padding

### What's new (`/whats-new`)

- [x] Previous 5 releases as clickable timeline
- [x] Bump NEW/FIXED label contrast in dark
- [ ] 1-sentence release title under build number
- [ ] Hero image per release
- [ ] Expand each item to 2-3 sentences
- [ ] RSS feed + email subscribe
- [ ] Fix light/dark date mismatch

### Help (`/help`)

- [ ] Pin search input at top (P0)
- [ ] 3×3 categorised tile grid
- [ ] Sticky Contact support CTA
- [ ] Split nutrition methodology to own page
- [ ] Sticky ToC sidebar on desktop ≥1024px
- [ ] Rename to "Help" (drop "& Information")
- [ ] Mobile-web accordion collapse per section

### Trust pages (Privacy/Terms/DMCA/Licences)

- [ ] Sticky ToC sidebar on all four
- [ ] "Last updated 19 April 2026 · v1.0" + previous versions link
- [ ] Unify trust-page template
- [ ] Surface marketing nav on all four
- [ ] Reformat Licences mobile-web as stacked cards
- [ ] Per-section "Permalink" copy-link buttons
- [ ] Print/save as PDF affordance
- [ ] Surface DMCA form polish back to other three

---

## Group B — Onboarding

### B1 Welcome

- [x] Move web cookie consent to bottom-right pill
- [ ] Replace web marketing tile with real product moment
- [ ] Add single proof line above CTA
- [ ] Dampen dark-mode gradient by 50%
- [ ] Promote mobile native "Sign in" out of "Have an account?" prefix
- [d] Unify three proof affordances across platforms (welcome divergence carve-out)

### B5 Reveal (THE biggest gap)

- [x] Anticipation beat (6-line "Building your plan…")
- [x] Hit haptic at count-up terminus
- [x] "What happens next" 3-step card
- [ ] Re-title to "Your plan is ready."
- [ ] Show the maths (expandable BMR + Activity + Goal)
- [ ] Pair macro % with g inline
- [ ] Add "compared to" anchor
- [ ] Promote methodology footer to "How we calculate" chip-expander
- [ ] Rebuild weight-skipped branch as soft-illustration moment
- [ ] Unify ring gradient to single brand gradient

### B9 `/onboarding-v2` redirect

- [x] Investigate Expo Router redirect-before-NotFound mounting (headerShown=false, animation=none)
- [ ] Add `redirect_followed` analytics event
- [ ] Document end-of-life date for redirect

### Cross-cutting B

- [ ] Goal step icon migration (Ionicons → lucide-react-native)
- [ ] Age step DOB toggle + explainer pattern from Sex
- [ ] Auto-advance pattern consistency across decision steps
- [e] Stale screenshot capture pipeline (P0 process) — requires Maestro re-run

### Late-add — Refresh-my-plan

- [x] Auto-skip Welcome + REFRESH PLAN pill
- [ ] "Build my plan" terminal CTA copy → "Refresh my plan" in refresh mode
- [ ] Per-step "You're updating from X to Y" diff
- [ ] Web parity (if `/onboarding` ever gets Refresh-my-plan affordance)

---

## Group D — Mobile Today

(See DC1 / DC2 / DC3 above for the ring, "what to eat next", and Eat Again items.)

### Feature 3 Snap a meal

- [ ] Replace camera glyph with explicit shutter button
- [ ] Add "~3 seconds to log" / "AI estimate · review before saving" subtitle
- [ ] Surface Pro chip on card if Free
- [ ] Persist photo-log card to populated state
- [ ] Shutter-pulse haptic on tap → camera sheet

### Feature 4 Macro tiles

- [x] Over-budget sublabel + bar turn amber (carbs token split from amber → warm orange)
- [ ] Chevron-right "›" affordance on each tile
- [ ] Explicit 0% width on empty bars
- [ ] 200ms ease-out bar fill on log

### Feature 5 Week strip

- [ ] Move theme toggle out of Today header
- [ ] Label/remove 2×2-grid icon
- [ ] Stack day initial + numeral into single tile
- [ ] Horizontal swipe to navigate days + active-day tween
- [ ] Drop redundant "Today" pill
- [ ] Verify calendar icon opens full-month modal

### Feature 8 Tab bar

- [x] Rename "You" → "More"
- [ ] Reorder to Today/Plan/+/Recipes/More per strategic direction
- [ ] Verify all icons lucide-react-native (not Ionicons)
- [ ] Medium-impact haptic on `+` FAB tap

### Feature 9 Today header

- [ ] Remove theme toggle from header
- [ ] Remove/label 2×2-grid icon
- [ ] Drop date small-caps when h1 "Today" shown
- [ ] Drop leftmost "Today" pill in week-strip
- [ ] Add scroll-collapse behaviour
- [ ] Subtle motion on focus

### Feature 10 Web parity

- [p] Verify web has authed Today mirroring mobile spine (redirect pages added /today→/home?view=today)
- [e] Re-run screenshot capture with verified authed session (Playwright re-capture)
- [ ] Verify mobile-web phone-browser routes to authed Today

---

## Group E — Mobile Plan

### Card 1 Plan landing

- [ ] Replace black "Plan setup ▶" pill with outlined disclosure
- [ ] Label two circular header buttons
- [ ] Rewrite eyebrow to `May 7 – 13 · Meal plan`
- [ ] Promote day-card kcal pill to `1,137 / 1,800 kcal` with underline
- [ ] Adopt dark-mode 4-pill empty-day CTAs into light
- [ ] Hide "Browse recipe library" as separate link → chip in day card

### Card 2 Week grid

- [ ] Per-recipe fit-pill in row (`Fits 92%` / `Over by 220 kcal`)
- [ ] Standardise hero image (photo with deterministic gradient fallback)
- [ ] Show all 4 macros / replace with 4-cell mini-row
- [ ] Label portion-modifier pill `0.5× portion`
- [ ] Split "Log today" into primary `Log as planned` + `…` overflow
- [ ] Day-strip-integrated summary (drop standalone panel)
- [ ] Anchor household scope in day-card eyebrow

### Card 3 Move-meal sheet

- [ ] Leading glyphs (lucide)
- [ ] Expand recipe context header to `Breakfast · Thu May 7 · 429 kcal`
- [ ] Confirm haptics fire per row, warning on destructive
- [ ] Disambiguate "Adjust portion…" label
- [ ] Separate Cancel into own group with 8-px gap
- [ ] Warning toast on household-shared destructive

### Card 4 Generate flow

- [ ] 7-dot stacked viz inline with headline
- [ ] Drop `Shopping list` from post-gen panel
- [ ] Pair `Regenerate` with `Adjust constraints`
- [ ] Move instruction copy to one-time tooltip
- [ ] Generation skeleton state
- [ ] Regenerate diff toast

### Card 5 Web Plan parity

- [p] Ship `/planner` web stub (read-only weekly grid) — redirect /plan → /home?view=plan added
- [ ] Until built, replace 404 with "Plan is in iOS app today"
- [ ] "Open in app" smart banner on mobile-web
- [x] `/plan` canonical 301
- [ ] Decision-log entry for Web Plan deferred/committed

### Card 6 Dark mode

- [ ] Port dark 4-pill CTA empty-day row to light
- [ ] Boost segmented-control active contrast in dark
- [ ] Brighten Plan setup ▶ chevron
- [e] Capture missing dark screenshots (Maestro)
- [ ] Demote "Browse recipe library" link colour

---

## Group F — Mobile Recipes

### Recipe verify (P0)

- [x] Skeleton screen + status narration
- [ ] Cancel button
- [ ] 8s timeout
- [ ] Per-row confidence bar

### Recipe import entry

- [x] Multi-source action sheet on "+ Create"
- [x] Clipboard auto-detect
- [ ] Promote "Import from a link" to permanent first Discover card
- [e] Screenshot every state of import flow (Maestro)

### Web Recipes (P0)

- [p] `/recipes`, `/library`, `/discover` routes (redirects shipped; real surfaces still SPA-routed)
- [ ] Fix 404 page CTA loop

### Other Group F items

- [ ] Library landing polish
- [ ] Library hero card placeholder
- [ ] Discover feed polish
- [ ] Recipe detail (servings stepper + sticky footer)
- [e] Cook mode populated (unaudited; capture P0)
- [ ] Create-recipe manual entry redesign

---

## Group H — Mobile Progress

### Weight chart (canonical card)

- [x] Major Withings parity (always-on trend line, hollow rings, today indicator, range ticks, kg unit, vertical gridlines, full-word tabs)
- [ ] Drop raw-dot opacity 0.6→0.35, stroke→textTertiary
- [ ] Anchor floating "latest" pill above latest dot at idle
- [ ] 200ms ease-out tween on yMin/yMax change
- [ ] Soft haptic on scrub crossing data point + 180ms fade-out
- [ ] Drop trend-line colour swap on worsening
- [ ] Bump pill touch targets ≥40pt
- [ ] Labelled "View all measurements" link
- [ ] Single-source-of-truth chart (Phase 2 consolidation)
- [ ] Solid line between 2 points (DC5)
- [ ] Dark-mode gridline opacity audit

### Other Group H

- [x] H.6 Calories drill-down (DC10 3-state app-wide; web Daily Calories chart now has 3-state + dashed target + colour legend)
- [ ] H.7 Macro detail granularity (pick meal vs ingredient for all 4)
- [ ] H.7 Macro detail colour mapping (verify hues)
- [ ] H.8 Burn detail needs chart + 7-day context
- [e] H.9 Meal nutrition populated state (P0 re-capture)
- [ ] H.10 Targets truncated "≈ 15" date string (P0)
- [ ] H.11 Weekly Digest past-tense voice

---

## Group I — Paywall

- [x] Lead with trial: "Try Pro free for 7 days" (headline + subtitle)
- [x] Drop vestigial "MOST POPULAR" badge
- [e] Fix offerings loading (RevenueCat `Purchases.getOfferings()` reliability) — P0 (needs RC dashboard)
- [ ] Period toggle prominently
- [ ] Verify region-aware pricing via `localizedPriceString` (not hardcoded GBP) — P0
- [ ] Restore purchase persistently visible (audit confirm)
- [ ] Drop "Unlimited" from "Unlimited AI photo meal recognition (100/day)"
- [e] Capture dark-mode paywall screenshot

---

## Group J — Mobile stack screens

- [ ] Fasting active timer (ring fill + milestone labels + projected end + long-press End Fast + haptic)
- [ ] Fasting tab landing
- [ ] Shopping list aisle-based categories + checkboxes + swipe actions
- [e] Barcode scanner light capture
- [x] Notification permission prompt (3-bullet value ladder)
- [ ] Health sync polish
- [x] Apple Health "we never write" copy fix
- [ ] Nutrition sources polish
- [ ] Targets/TDEE vs MacroFactor
- [ ] Household settings polish
- [x] Food search modal (recents-on-mount when query empty)
- [ ] Food search: search-as-you-type
- [ ] Food search: barcode glyph inline
- [ ] Food search: category tabs
- [ ] Food search: drop subtitle / drop pre-filled "apple"
- [e] Dark mode parity audit (≥8 surfaces)

---

## Group K + L — Web product surfaces + Mobile web

- [p] Web routing contract: every authed surface needs real URL (redirects shipped; real per-tab URLs still OPEN)
- [ ] Web Fasting expansion to Zero/Apple Health bar (timer ring, milestones, history)
- [x] Cookie banner trim to single-line 52px
- [ ] Auth-wall H1 ("Meal plans that hit your macros" → "Sign in to Suppr")
- [e] Re-capture web authed flows once routing fixed
- [ ] Mobile-web full product surface with bottom tab bar
- [ ] `/home` becomes 307 to `/today`
- [x] Web `/signup` server-side 307 to `/onboarding`
- [x] Web `/account/billing` unauthed redirect to /login (P0)
- [x] Mobile native `/login` route audit + (tabs) auth gate (P0)
- [ ] Smart "open in app" banner on mobile-web mobile-only surfaces

---

## Cross-cutting

- [ ] Unify "Log it" / "LOG" / "Log" verb
- [ ] Unify macro format string (`698 kcal · 22g P · 95g C · 27g F`)
- [ ] Past-tense voice rule on Digest + Weight Journey ("Last week:" not "Your week —")
- [ ] Headspace supportive moment-of-truth microcopy at high-emotion surfaces
- [ ] Linear direct/functional microcopy at low-emotion surfaces
- [x] Macro colour token audit (Protein blue→macro-protein hue, Carbs→carbs hue split from amber)
- [ ] Voice consistency past-tense
- [ ] Ring gradient unification (single brand gradient)
- [ ] Targets summary truncated "≈ 15" date string (P0)
- [e] Capture pipeline reliability (14+ stale)
- [ ] Tab order resolution (4 vs 5 affordances)
- [ ] Decision log + Tasks DB Notion mirror actions

---

## Phase 4+ execution log

Items being worked in batches. Each batch ends with CI green + push.

(updated as batches land)
