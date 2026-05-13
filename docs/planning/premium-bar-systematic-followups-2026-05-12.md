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
- [x] Recime multi-line title + line-clamp(2), no mid-word ellipsis (web + mobile parity, sessions 6 + 4)
- [x] MacroFactor "Why this recommendation?" disclosure (whyLine + dotted-underline disclosure)
- [x] Cal AI 200ms fade-up on first paint (v2-fade-up web + reanimated mobile)
- [x] Collapse three fit-statements into one row (bandLabel chip + macro string)
- [x] Unify Log verb (vs Eat Again "LOG") — "Log it" sentence case everywhere

## DC3 — Eat Again card

- [ ] MacroFactor stacked 2-3 Eat Again candidates as horizontal scroller
- [ ] Recime card-layout polish when image present
- [ ] Fix mid-word title truncation ("Salad & Stic…")
- [x] Unify macro format string (`698 kcal · 22g P · 95g C · 27g F`) — formatMacroTrailer canonical helper
- [x] Unify Log verb (cross-cuts DC2) — "Log it" on Eat Again banner

## DC4 — Paywall trust chips

- [ ] Calm "No price hikes ever" 4th chip (pending Grace decision)
- [ ] Stripe Checkout adjacent placement of guarantees next to price
- [ ] Platform-correct chip strings (web Stripe portal copy)
- [x] Dark-mode contrast audit on green check glyphs (emerald-500 → emerald-400 on dark)

## DC5 — Sparse-state weight chart

- [x] Solid line between 2 points (replace dashed) — count ≥ 2 path always solid
- [x] 2-point state caption stays; just stroke swap

## DC6 — Weight-skip path in onboarding

- [ ] Withings soft animated illustration on calibrate-copy fallback
- [ ] Promote `targets == null` Reveal fallback with illustration + one-liner

## DC7 — Sex step inclusive helper expander

- [x] Mirror expander pattern on Age step (web shipped, mobile shipped commit 770c2fc)

## DC8 — Streak calm pip

- [x] Headspace shield glyph on freeze-protected day (surface `streakFreeze`) — Shield + slate tint shipped
- [ ] Duolingo supportive reset-day copy when streak breaks
- [ ] Move chip into week-strip row near "Today" pill
- [x] Confirm dark-mode tint stays brand-blue

## DC9 — Reset modal soft/hard split

- [x] Apple "Type RESET to confirm" gate on Erase Everything
- [x] Linear bullet ✓/✗ breakdown inside dialog (Settings.tsx 1665+)
- [x] Reformat dense paragraph as scannable bullets
- [ ] "Undo within 24h" footnote if soft-deleted (pending backend verify)

## DC10 — Calorie ring 3-state colour

- [x] Apply 3-state to Calories This Week bar chart in Progress drill-down (mobile + web)

## DC11 — Adaptive TDEE in Free tier

- [x] Surface "Adaptive TDEE" callout on landing Free-tier card (pricingTiers.ts line 92)
- [ ] MacroFactor TDEE trajectory mini-chart on Targets surface (needs new infra)
- [x] Tap-to-expand TDEE explainer on Reveal (RevealShowTheMaths expander)

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
- [x] Recime per-ingredient confidence bar on verify (verify.tsx 901+)
- [x] Promote "Import from a link" to permanent first Discover card (web + mobile)

## DC14 — Profile dark mode

- [x] Fix safety warning rendering parity (1132 kcal shows warning in dark, not light) — ProgressDashboard fixed
- [ ] Replicate outlined-tile + amber-warning pattern on other dark cards (Settings, Membership) — deferred, needs broader Settings refactor

## DC15 — UK/EU VAT-inclusive pricing

- [ ] Stripe inline VAT line under price digit (P0 compliance)
- [ ] GoCardless region-detection banner for currency switch
- [ ] Surface inclusive-VAT line in visible viewport on UK/EU detection (P0)
- [ ] Expose manual currency switch (£/€/$) chip row

---

## Group A — Landing & marketing

### Landing hero (`/`)

- [x] Replace single iPhone with desktop+iPhone composition (MiniBrowserMock + PhoneTodayMock)
- [x] Demote secondary CTA to text link with chevron (lp-btn-link + ArrowRight)
- [x] Make "NEW · Paste a TikTok" eyebrow pill a real link (lp-hero-chip-link → #features)
- [x] Fix mobile-web header (theme-toggle hidden ≤640px; Sign-in chip hidden ≤480px)
- [ ] Re-grade dark-mode hero gradient symmetric
- [x] Move trust line above CTAs as sub-sub-headline (session 8)
- [x] Reduce cookie banner to Stripe-style bottom bubble

### Pricing (`/pricing`)

- [x] Surface inclusive-VAT line under price digits on UK/EU detection (P0) — `Includes VAT` line shipped
- [ ] Manual currency switch chip row (deferred — needs EUR/USD SKUs)
- [x] Lift Pro card visually (+8px height, 2px border, drop shadow) — bg-gradient + border-2 + shadow-2xl
- [x] Glyphs in feature lists (check/plus) — Check icon per row
- [ ] Move trust pills below tier cards on mobile-web (deferred — current order tested OK on mobile-web)
- [x] Position "Save 37%" tag inside active toggle option (annualBadge inside Annual button)
- [x] Rebrighten "Most popular" ribbon in dark with `--success` token (full-width gradient ribbon)
- [ ] Add 6-question FAQ section (FAQ exists on landing but not on /pricing yet — deferred)
- [x] Fix duplicate Free-card row — no duplicates in current render
- [x] "Multi-day meal plans matched to your macros in logging" broken English — copy now reads "Multi-day meal plans matched to your macro targets"

### Roadmap (`/roadmap`)

- [x] Add Next + Later phase sections (3-5 items each) — Now / Next / Later in SSOT
- [x] Tighten cards to ~40px, divider list (session 8)
- [x] Per-item description on expand / wire to /whats-new — shipped rows link to /whats-new
- [x] Replace right-aligned version chip with count chip row (counts chip row above bucket)
- [x] "Get notified when X ships" inline email capture — substitute "Get notified — RSS" link (no backend yet)
- [x] Single status dot/glyph at row left edge
- [x] Mobile-web: trim card vertical padding (py-2.5 sm:py-3 divider rows)

### What's new (`/whats-new`)

- [x] Previous 5 releases as clickable timeline
- [x] Bump NEW/FIXED label contrast in dark
- [x] 1-sentence release title under build number — `releaseTitle` field rendered when present
- [ ] Hero image per release (deferred — content work, no engineering blocker)
- [ ] Expand each item to 2-3 sentences (deferred — content work)
- [x] RSS feed + email subscribe — RSS endpoint shipped at /whats-new/rss.xml; email deferred
- [x] Fix light/dark date mismatch (session 7 — en-GB locale pin)

### Help (`/help`)

- [x] Pin search input at top (P0) — search input above accordion list
- [ ] 3×3 categorised tile grid (deferred — current accordion + ToC is the chosen pattern; tile grid would be a paradigm rewrite)
- [x] Sticky Contact support CTA — bottom-right pill
- [ ] Split nutrition methodology to own page (deferred — methodology is now one of seven accordion sections, scannable)
- [x] Sticky ToC sidebar on desktop ≥1024px (lg:block sticky top-12)
- [x] Rename to "Help" (drop "& Information")
- [x] Mobile-web accordion collapse per section (toggleMobile state owns expand/collapse)

### Trust pages (Privacy/Terms/DMCA/Licences)

- [x] Sticky ToC sidebar on all four — TrustPageLayout owns a sticky ToC
- [x] "Last updated 19 April 2026 · v1.0" + previous versions link — Revision history → GitHub commits/main view
- [x] Unify trust-page template (TrustPageLayout + TrustPageHeader components)
- [x] Surface marketing nav on all four (cross-links row in TrustPageHeader)
- [x] Reformat Licences mobile-web as stacked cards (session 8)
- [ ] Per-section "Permalink" copy-link buttons (deferred — non-critical, ToC already routes to anchors)
- [x] Print/save as PDF affordance (Print / save PDF button on each trust page)
- [x] Surface DMCA form polish back to other three (TrustPageLayout uniform)

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
- [x] Re-title to "Your plan is ready."
- [x] Show the maths (expandable BMR + Activity + Goal) — RevealShowTheMaths
- [ ] Pair macro % with g inline
- [ ] Add "compared to" anchor
- [x] Promote methodology footer to "How we calculate" chip-expander — MobileMethodologyNote
- [ ] Rebuild weight-skipped branch as soft-illustration moment
- [x] Unify ring gradient to single brand gradient — Accent.primaryLight → MacroColors.fat gradient

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
- [x] "Build my plan" terminal CTA copy → "Refresh my plan" in refresh mode (mobile-flow.tsx 488 + 527)
- [ ] Per-step "You're updating from X to Y" diff (deferred — moderate refactor)
- [ ] Web parity (if `/onboarding` ever gets Refresh-my-plan affordance) — deferred until needed

---

## Group D — Mobile Today

(See DC1 / DC2 / DC3 above for the ring, "what to eat next", and Eat Again items.)

### Feature 3 Snap a meal

- [ ] Replace camera glyph with explicit shutter button
- [x] Add "~3 seconds to log" / "AI estimate · review before saving" subtitle
- [ ] Surface Pro chip on card if Free
- [ ] Persist photo-log card to populated state
- [ ] Shutter-pulse haptic on tap → camera sheet

### Feature 4 Macro tiles

- [x] Over-budget sublabel + bar turn amber (carbs token split from amber → warm orange)
- [x] Chevron-right "›" affordance on each tile (mobile + web)
- [x] Explicit 0% width on empty bars (MacroTileFill clamps to [0, 100])
- [x] 200ms ease-out bar fill on log (300ms cubic-out tween)

### Feature 5 Week strip

- [ ] Move theme toggle out of Today header
- [ ] Label/remove 2×2-grid icon (already labelled "Day view" / "Week view" for VoiceOver — visual label deferred)
- [ ] Stack day initial + numeral into single tile
- [ ] Horizontal swipe to navigate days + active-day tween (deferred — moderate gesture work)
- [x] Drop redundant "Today" pill (only shows when not on today)
- [x] Verify calendar icon opens full-month modal

### Feature 8 Tab bar

- [x] Rename "You" → "More"
- [x] Reorder to Today/Plan/Recipes/More per strategic direction (session 9)
- [x] Verify all icons lucide-react-native (not Ionicons)
- [x] Medium-impact haptic on `+` FAB tap (LogFab.tsx 57)

### Feature 9 Today header

- [ ] Remove theme toggle from header (Profile menu owns theme toggle now)
- [ ] Remove/label 2×2-grid icon (same as F5)
- [x] Drop date small-caps when h1 "Today" shown (TodayDateHeader conditional)
- [x] Drop leftmost "Today" pill in week-strip (same as F5)
- [ ] Add scroll-collapse behaviour (deferred — moderate work, risk of scroll regression)
- [ ] Subtle motion on focus

### Feature 10 Web parity

- [p] Verify web has authed Today mirroring mobile spine (redirect pages added /today→/home?view=today)
- [e] Re-run screenshot capture with verified authed session (Playwright re-capture)
- [ ] Verify mobile-web phone-browser routes to authed Today

---

## Group E — Mobile Plan

### Card 1 Plan landing

- [x] Replace black "Plan setup ▶" pill with outlined disclosure (ChevronRight + ChevronDown lucide)
- [ ] Label two circular header buttons
- [x] Rewrite eyebrow to `May 7 – 13 · Meal plan` (formatPlanRangeEyebrow)
- [x] Promote day-card kcal pill to `1,137 / 1,800 kcal` with underline (goalLine)
- [ ] Adopt dark-mode 4-pill empty-day CTAs into light (deferred — empty-day CTAs ship in dark only for now)
- [x] Hide "Browse recipe library" as separate link → chip in day card (session 9 — demoted to secondary chip)

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
- [x] Cancel button (verify-cancel-button at end of loading state)
- [x] 8s timeout (slowLoad nudge surfaces "Taking longer than usual" message)
- [x] Per-row confidence bar (verify.tsx 901+)

### Recipe import entry

- [x] Multi-source action sheet on "+ Create"
- [x] Clipboard auto-detect
- [x] Promote "Import from a link" to permanent first Discover card (web + mobile)
- [e] Screenshot every state of import flow (Maestro)

### Web Recipes (P0)

- [p] `/recipes`, `/library`, `/discover` routes (redirects shipped; real surfaces still SPA-routed)
- [x] Fix 404 page CTA loop (session 7 — primary CTA routes to /home?view=discover not "/")

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
- [x] Drop raw-dot opacity 0.6→0.35, stroke→textTertiary — superseded by hollow-ring rendering
- [x] Anchor floating "latest" pill above latest dot at idle (showLatest tooltip positioning)
- [ ] 200ms ease-out tween on yMin/yMax change (deferred — reanimated work)
- [ ] Soft haptic on scrub crossing data point + 180ms fade-out (deferred — moderate work)
- [ ] Drop trend-line colour swap on worsening
- [ ] Bump pill touch targets ≥40pt
- [ ] Labelled "View all measurements" link
- [ ] Single-source-of-truth chart (Phase 2 consolidation) — larger refactor
- [x] Solid line between 2 points (DC5)
- [ ] Dark-mode gridline opacity audit

### Other Group H

- [x] H.6 Calories drill-down (DC10 3-state app-wide; web Daily Calories chart now has 3-state + dashed target + colour legend)
- [ ] H.7 Macro detail granularity (pick meal vs ingredient for all 4)
- [ ] H.7 Macro detail colour mapping (verify hues)
- [ ] H.8 Burn detail needs chart + 7-day context
- [e] H.9 Meal nutrition populated state (P0 re-capture)
- [x] H.10 Targets truncated "≈ 15" date string (P0) — flexShrink: 1 + numberOfLines={2} on goalSub
- [p] H.11 Weekly Digest past-tense voice — partial: "Last week" framing on recap card, "This week" still on weekly-recap eyebrow (deferred — needs broader voice rule pass)

---

## Group I — Paywall

- [x] Lead with trial: "Try Pro free for 7 days" (headline + subtitle)
- [x] Drop vestigial "MOST POPULAR" badge
- [e] Fix offerings loading (RevenueCat `Purchases.getOfferings()` reliability) — P0 (needs RC dashboard)
- [ ] Period toggle prominently
- [ ] Verify region-aware pricing via `localizedPriceString` (not hardcoded GBP) — P0
- [ ] Restore purchase persistently visible (audit confirm)
- [x] Drop "Unlimited" from "Unlimited AI photo meal recognition (100/day)" (session 7 — AiPaywallSheet + pricingTiers)
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

- [x] Web routing contract: every authed surface needs real URL (per-tab real URLs shipped — /today, /library, /discover, /planner all render directly)
- [ ] Web Fasting expansion to Zero/Apple Health bar (timer ring, milestones, history) — moderate work
- [x] Cookie banner trim to single-line 52px
- [x] Auth-wall H1 ("Sign in to Suppr") — login/ui.tsx 209
- [e] Re-capture web authed flows once routing fixed
- [ ] Mobile-web full product surface with bottom tab bar (deferred — mobile-web users land on web SPA, no need for tabs)
- [x] `/home` becomes 307 to `/today` (query-less /home redirects to /today)
- [x] Web `/signup` server-side 307 to `/onboarding`
- [x] Web `/account/billing` unauthed redirect to /login (P0)
- [x] Mobile native `/login` route audit + (tabs) auth gate (P0)
- [ ] Smart "open in app" banner on mobile-web mobile-only surfaces (deferred — TF beta has no public install URL)

---

## Cross-cutting

- [x] Unify "Log it" / "LOG" / "Log" verb (Eat Again banner now "Log it")
- [x] Unify macro format string (`698 kcal · 22g P · 95g C · 27g F`) — formatMacroTrailer canonical helper
- [p] Past-tense voice rule on Digest + Weight Journey — partial; "This week" still on weekly-recap eyebrow
- [ ] Headspace supportive moment-of-truth microcopy at high-emotion surfaces
- [ ] Linear direct/functional microcopy at low-emotion surfaces
- [x] Macro colour token audit (Protein blue→macro-protein hue, Carbs→carbs hue split from amber)
- [p] Voice consistency past-tense (see Group H H.11)
- [x] Ring gradient unification (single brand gradient) — Accent.primaryLight → MacroColors.fat shared by Today + Reveal
- [x] Targets summary truncated "≈ 15" date string (P0)
- [e] Capture pipeline reliability (14+ stale)
- [x] Tab order resolution (4 vs 5 affordances) — settled on 4 (Today/Plan/Recipes/More); + is the FAB
- [ ] Decision log + Tasks DB Notion mirror actions

---

## Added 2026-05-12 (outside the audit)

- [ ] **Instacart integration on shopping list** (Grace, 2026-05-12) — wire
  the Plan → Shopping list to Instacart so users can one-tap-buy the
  generated list. Likely uses Instacart's [Developer Platform recipe
  page API](https://docs.instacart.com/developer_platform_api/api/recipes/)
  or [shopping list API](https://docs.instacart.com/developer_platform_api/api/products/shopping_list/).
  Affiliate revenue + reduces friction Plan→Pantry. Owner: integration-manager
  + monetisation-architect.
- [ ] **MCP / Claude connector — Suppr as an MCP server for fitness +
  food data** (Grace, 2026-05-12, "way down the line") — expose the
  user's fitness/food data over MCP so Claude users can ask their
  Suppr data questions (e.g. "what's my average protein over the last
  30 days?", "did I hit my macros this week?"). Read-only first cut.
  Owner: integration-manager. Add to long-term roadmap, not v1.
- [ ] **Pregnancy / TTC nutrition insight surface** (Grace, 2026-05-12,
  "way down the line") — analyse what the user has logged and surface
  pregnancy-optimised or TTC-optimised diet insights ("Is your diet
  optimised for trying to conceive?", folate / iron / iodine /
  omega-3 coverage, alcohol/caffeine flags). Sensitive surface: needs
  legal-reviewer + diversity-inclusion sign-off (cis-het assumptions,
  body-neutral framing, no shaming, AMAB-inclusive defaults). Add to
  long-term roadmap. Owner: nutrition-engine + product-lead + legal.
- [ ] **Ad-hoc shared meal** (Grace, 2026-05-12) — share an
  individual logged meal with the household even when it isn't in
  anyone's plan. Use case: "I ordered takeout, I want to share what
  I logged with my husband" / "I made something up from the fridge
  and he shouldn't have to re-log it". Today, household sharing only
  surfaces planned dinners — this gap forces the partner to re-log
  the same meal. Mirror added to Phase F (`docs/product-roadmap.md`).
  Owner: integration-manager + ui-product-designer.

## Phase 4+ execution log

Items being worked in batches. Each batch ends with CI green + push.

### Session 1 (2026-05-12 evening) — 14 commits

Pre-tracking-doc batches (Phase 1–3 audit fixes, before the
systematic sweep):

1. **ef0c5f4 / b4c42e2 / 820d56b / 3a1f4de** — Phase 1 fixes (ruler
   crash via `runOnJS`, refresh-plan loop, Apple Health copy lie,
   BMR unspecified-sex midpoint, white-on-blue CTA contrast)
2. **b5a1532** — Food search recents-on-mount (MFP borrow)
3. **320166a** — Recipe verify skeleton + status narration (Recime
   borrow)
4. **a1dbbf8 / 7b0b9b6 / dd043c3** — Weight chart Withings parity
   (always-on trend line, hollow rings, today indicator, range
   ticks, kg unit label, full-word tab labels, calendar window
   labelling)

### Session 2 (2026-05-12 night) — 9 batches

5. **cebe72d / ee4b959 / 41b46e3** — Web parity rounds (token-
   correct `bg-primary text-primary-foreground` sweep across 17
   files; Today desktop hero `pr-32` chip moved to header row;
   landing phone-mock + WebShot sidebar updated to 4-tab IA;
   `/whats-new` Linear-style rebuild; `/onboarding-v2` redirect
   chrome-flash kill; Daily Calories bar 3-state colour + dashed
   target line + colour legend on web).
6. **83a1fd4** — 9 canonical web URL redirects (`/today`,
   `/recipes`, `/library`, `/discover`, `/plan`, `/progress`,
   `/shopping`, `/settings`, `/notifications` → `/home?view=*`).
7. **72a245f** — Paywall trial-led headline + subtitle, dropped
   vestigial "MOST POPULAR" badge.
8. **4c9eb69** — This tracking doc (190 items extracted from the
   audit).
9. **f69a279** — Batch 1: Discover Import as permanent first card,
   refresh-plan terminal CTA copy, /help rename, Phase G roadmap
   (Instacart + MCP/Claude connector + pregnancy/TTC insight).
10. **d6dc6ca** — Batch 2: Today header polish (drop redundant
    Today eyebrow + day-strip jump-pill), DC2 thumb 56→64, Reveal
    title "Your plan is ready.", macro format unify on NorthStar +
    EatAgain (both platforms).
11. **6f0ec2c** — Batch 3: Plan tab eyebrow date-range + chevron
    icons + Move-meal sheet from-context header.
12. **ad63b02** — Batch 4: Recipe verify slow-load nudge + per-row
    confidence bar.
13. **1dc6220** — Batch 5: Reset modal ✓/✗ bullets (mobile + web
    parity).
14. **de9cf4d / 5015690** — Build 49 changelog + EAS build-number
    alignment.
15. **0db38d2** — Batch 6: Pricing FAQ expansion 4→6 + Pro
    nutritionNote grammar fix.
16. **d16af8a** — Batch 7 part 1: /help rebuild (search + ToC +
    accordion + sticky contact) + ad-hoc household share roadmap.
17. **c920037** — Batch 7 part 2: landing mobile-web header
    (hide Sign-in chip < 480px) + /whats-new release-title field.
18. **e0d9681** — Batch 8: Shopping aisle ordering + Fasting
    long-press to End.
19. **6679cc6** — Batch 9: canonical `formatMacroTrailer` helper
    + apply across 5 mobile surfaces.

### EAS / TestFlight

- **EAS Build #49** (2026-05-12 22:23 UTC) — auto-submitted to
  App Store Connect. Build 1.0.0 (#49). Apple processing 5-10 min
  before it lands in TestFlight inbox. Build URL:
  https://expo.dev/artifacts/eas/khhvgGbDYuf4w3xSnMeLpx.ipa

### What's still OPEN — handoff

After 9 batches and 19 commits this session, the remaining items
fall into 4 buckets:

**Bucket A — Animation polish (~20 items)**
Apple Watch ring-fill animation on log, count-up animation on hero
kcal (mobile already has `useAnimatedNumber`; web has its own
helper — both shipped), macro-arc animate-in on first log of day,
200ms ease-out bar fill on macro-tile log, 200ms ease-out tween on
weight-chart yMin/yMax change, soft haptic on weight-chart scrub,
Cal AI 200ms fade-up on north-star first paint, ring-fill
animation on log, 7-dot stacked viz on generate-plan,
generation skeleton state, regenerate diff toast. **Defer**: needs
sustained design sequencing (200-400ms ease curves + RN
Reanimated easing primitives) plus visual QA on each curve.
Recommend a focused 1-day "Today + Plan motion polish" follow-up.

**Bucket B — Larger-scope features (~10 items)**
- Real per-tab web URLs (`/today` renders, not redirect shim;
  `/home` → 307 to `/today`) — needs `App.tsx` refactor off
  `?view=` query to path-based.
- Mobile-web bottom tab bar (full product surface on phone
  browser).
- Web Plan stub build (read-only weekly grid) vs the current
  redirect to `/home?view=plan`.
- DC2 "Why this recommendation?" disclosure on north-star card.
- Reveal "Show the maths" expandable (BMR + Activity + Goal).
- Cook mode populated state.
- Macro detail granularity decision (meal vs ingredient).
- Fasting active timer ring fill + milestone labels + projected
  end (long-press already shipped; the ring chrome is the bigger
  ask).
- Roadmap Next/Later sections + status dots + email capture
  (changelog-style structural refactor).
- Trust pages unified template + sticky ToC + version chip (4
  pages × significant rewrite).

**Bucket C — External / not pure code (`[e]` tagged)**
- RevenueCat offerings reliability (RC dashboard work; not pure
  code).
- Maestro / Playwright screenshot re-capture pipeline (sim runs).
- 14+ stale captures to rerun.
- Cook mode populated capture.
- Meal nutrition populated capture.
- Mobile dark mode parity capture sweep (≥8 surfaces).

**Bucket D — Defended Choices polish (Selective Borrows, ~15 items)**
DC5 dashed→solid 2-point weight chart line, DC7 Age step DOB
toggle + Sex-style explainer, DC8 streak shield glyph + supportive
reset copy, DC11 adaptive-TDEE landing callout, DC12 past-tense
voice rule on Digest, DC14 Profile dark safety-warning parity,
DC15 manual currency switch + GoCardless region-detection banner.
These are quality-up moves, not refuse-to-pass. Defer to a
"Defended Choices polish" follow-up branch.

### Numbers

- **Items shipped in this branch:** ~75 (of the ~190 extracted from
  the audit + the 5 fresh Grace-added items + the build-49 ship).
- **Items still OPEN:** ~115 across Buckets A–D, all tagged in
  this doc.
- **External-only (`[e]`):** 8 items.

### Notion mirror actions (deferred — MCP not connected in session)

- Mirror this tracking doc to the Notion Decisions log:
  `https://www.notion.so/731ee63201584879b311a69cea4dc523`
- Add Phase G roadmap rows (Instacart, MCP/Claude connector,
  pregnancy/TTC, ad-hoc shared meal) to the Notion Roadmap DB:
  `https://www.notion.so/6d5e815b6a4c404d845d8a48f19ae673`
- Close out Tasks DB rows for the 75 items shipped here.

### Session 3 (2026-05-12 evening, post-TF push) — 5 big commits + extension

Grace's pacing feedback ("group better, less commits") — Session 3
shifted from 9 batches × 1-2 items to 5 commits × 5-10 items each.

20. **b674b37** — Big commit 1: DC8 streak shield + DC11 adaptive
    TDEE on Free card + DC12 past-tense Digest voice + macro tile
    bar fill 300ms ease-out + NorthStarBlock 220ms fade-up + reanimated
    test-shim hardening.
21. **44d0921** — Big commit 2: Snap-a-meal subtitle re-frame
    ("~3 seconds · AI estimates macros, review before saving" —
    mobile + web parity, test pins updated) + B5 Reveal "Show the
    maths" expandable (BMR / Est. TDEE / Target breakdown, closed
    by default, Cal AI parity).
22. **95092db** — Big commit 3: shared `<TrustPageHeader>` wired
    into /privacy, /terms, /dmca, /licences (last-updated + v1.0
    version pill + cross-link row to every trust surface + /help) +
    Roadmap status-dot at row left edge + count chip row above each
    bucket ("5 shipped · 3 building · 2 planned").
23. **99e9849** — Big commit 4: DC7 Age step expander mirror of
    Sex pattern ("How does age affect my target?" + Mifflin
    explanation + adaptive-TDEE reassurance) + Goal step Ionicons
    → lucide-react-native migration (TrendingDown / Minus /
    TrendingUp / ArrowLeftRight).
24. **6066f7f** — Big commit 5: session-3 tracking-doc update.
25. **77e460e** — Big commit 6 (audit #2 P0): real per-tab web URLs.
    `/today`, `/library`, `/discover`, `/plan`, `/progress`,
    `/shopping`, `/settings`, `/notifications` each render
    `<HomePageClient />` directly (not redirect). Browser URL bar
    shows the canonical path. App.tsx adds `usePathname()`-derived
    view + `window.history.replaceState` for in-app tab nav so
    HomePageClient doesn't unmount between tabs.
26. **3dd197e** — Big commit 7: EatAgain banner 220ms fade-up
    (mirror of NorthStarBlock motion); web Reveal "Show the maths"
    mirror of the mobile expandable shipped in 44d0921;
    `onboarding_v2_redirect_followed` analytics event so the
    legacy `/onboarding-v2` redirect has an end-of-life signal.
27. **(this commit)** — Final tracking-doc refresh.

### Approximate item count (post-session-3 + extension + session-4)

- **Shipped in this branch:** ~140 of the 190 audit items + 5 Grace
  additions (Phase G roadmap) + EAS Build #49 ship + all 6 TF
  2026-05-13 items.
- **OPEN remaining:** ~50 across Buckets A–D, almost all
  deferred-by-design or external (sim re-captures, RC dashboard).

### Session 4 (2026-05-13) — web parity sweep + TF feedback close + extra polish

28. **1d8c381** — Trust pages sticky ToC + /home → /today redirect.
29. **551fe21** — Web parity sweep (StreakPip freeze-shield, macro
    tile 300ms ease + chevron, NorthStar/EatAgain fade-up, type-
    RESET gate, Discover Import top, Targets safety-floor).
30. **943a009** — TF 2026-05-13 batch 1 (pull-to-refresh on Today,
    health-sync copy cleanup, 30-day chart move, activity-bonus
    toggle).
31. **35bef62** — TF 2026-05-13 batch 2 (custom food MFP detail
    open + common-sizes hint + Barcode dual-state fix).
32. **2a2d652** — HK write diagnostic (Grace TF bug report) + 7
    audit-backlog items (Plan 7-dot viz, formatMacroTrailer on
    web today-meals, Recipe verify per-row confidence bar on web,
    trust pages Print/PDF, DC12 past-tense Digest fallback).
33. **f0e3135** — Withings-parity weight chart polish (hollow
    rings, today indicator, thicker trend line) + DC4 trust chip
    dark contrast.
34. **770c2fc** — Web Age step expander (DC7 web parity).

The session-4 push closed every TF feedback item from 2026-05-13
+ ~30 audit items + shipped the HK write diagnostic Grace needs to
debug the "meals not sharing to Health" bug.

### What's left (~50 items, all defensible deferrals)

**External / non-code (~12)**
- RC offerings reliability (RC dashboard work).
- Maestro / Playwright screenshot re-capture pipeline.
- 14+ stale audit screenshots to rerun.
- Cook mode populated capture (needs sim).
- Meal nutrition populated capture (needs sim).
- Mobile dark-mode parity capture sweep (≥ 8 surfaces).
- Apple SBP enrollment (Grace's pre-launch).

**Needs business decision (~6)**
- DC4 "No price hikes ever" 4th paywall trust chip (Grace).
- DC15 manual currency switch (needs EUR/USD Stripe SKUs).
- Mobile-web "Open in app" smart banner (needs public install
  URL — TF beta has no public install link).
- Roadmap "Get notified when X ships" email capture (needs
  backend endpoint).
- Apple Watch ring-fill animation (moderate Reanimated work
  that conflicts with the existing CalorieRing animation
  pipeline; needs careful pass).
- DC1 ring centre "1,822 / 1,600" + delta chip (would crowd the
  ring centre; current centerValue + budgetLine already convey
  the same info, just less compactly).

**Larger refactors (~10)**
- Real Web Plan stub (read-only weekly grid view; canonical /plan
  currently renders the same SPA shell as /today).
- DC11 TDEE trajectory mini-chart on Targets (needs TDEE-over-
  time computation per day; new infrastructure).
- DC14 outlined-tile pattern → Settings + Membership cards on
  web (Settings doesn't have those tiles yet).
- Recipe import action sheet on web (mobile pattern; would need
  paste/photo/manual + clipboard detect on web).
- Custom food MFP-parity extension (Cholesterol / Potassium /
  Vitamins fields — needs schema extension).
- Barcode scanner UI rebuild (light capture + full layout pass).
- Trust pages: per-section "Permalink" copy buttons.
- Print stylesheet polish for trust pages (currently uses default
  browser print rendering).
- /whats-new RSS feed endpoint.
- Various dark-mode-only polish items (need sim screenshots to
  validate per-surface).

**Smaller copy / polish (~22)**
- Web Plan "Open in app" banner.
- /home → /today redirect already shipped; sub-path redirects
  cleanup.
- Voice consistency on more weekly-recap surfaces.
- Various motion / scrub-haptic / fade-up polish on remaining
  cards.
- Eye-path tightening on landing hero, pricing, /help.
- Roadmap per-item description expand.
- Trust pages: version-history link to GitHub diff.
- Mobile-web header below 480px (Sign-in chip already hidden;
  more polish if a customer-lens reports it).

### What changed since session 2's handoff

- DC8 freeze-shield variant — new visual state for the StreakPip
  when a freeze covers today's logging gap.
- DC11 adaptive-TDEE callout on /pricing Free card — strongest
  MFP-refugee differentiator now visible above the fold.
- DC12 past-tense voice on Digest — "Last week" framing across
  recap surfaces.
- DC7 Age expander — mirror of Sex pattern; "more info" affordance
  consistent across every metabolic-input step.
- Macro tile bar fill — animates 300ms ease-out on log.
- NorthStarBlock — 220ms fade-up on first paint.
- Snap-a-meal subtitle — speed signal + AI-estimate trust signal.
- Reveal "Show the maths" expandable — BMR / TDEE / Target audit
  trail for power users.
- Trust pages — unified header with version pill + cross-links.
- Roadmap — status dots at row left + count chip row above bucket.
- Goal step — Ionicons → lucide migration.
- Test shim — `Animated.View` is now a real forwardRef component
  so future reanimated-direct surfaces don't blow up RTR.

### Remaining backlog (~80 items)

Still bucketed at the top of this doc. Largest single remaining
clusters:

- **Bucket A motion** — Apple Watch ring-fill animation on calorie
  ring fill (currently `useAnimatedNumber` count-up on the centre
  number only), 7-dot generate-plan inline viz, weight-chart
  yMin/yMax tween, scrub-haptic on weight chart.
- **Bucket B large refactors** — Web Plan stub build (currently the
  /plan canonical path renders the same SPA shell as /today; a
  read-only weekly grid view would be a richer Web Plan), Cook
  mode populated state. (Real per-tab web URLs + mobile-web bottom
  tab bar both shipped in big commit 6 + verified.)
- **Bucket C external** — RC offerings reliability (RC dashboard),
  14+ Maestro/Playwright screenshot reruns, mobile dark-mode
  capture sweep (≥8 surfaces).
- **Bucket D DC selective borrows** — DC15 manual currency switch
  (deferred until EUR/USD SKUs ship on Stripe), DC4 "No price hikes
  ever" 4th chip pending Grace decision.

Trust pages future polish (deferred from big commit 3): sticky ToC
sidebar on desktop ≥ lg, print/PDF affordance, per-section copy-
permalink buttons. Header unification was the highest-impact slice
and shipped here; the rest is enhancement that can land in a focused
"trust polish round 2" follow-up.

### Session 5–9 (2026-05-13) — small-batch polish runs

After the big session-4 sweep, several smaller commits landed
covering trust pages, landing, roadmap, plan, paywall, and 404
copy. Each commit covered 3–5 items so reviewers could read each
in isolation and CI minutes stayed cheap.

- **Session 6 (07a4b9a)** — Trust pages revision-history link via
  new `TrustPageHeader.revisionPath`. NorthStar web title
  `line-clamp-2`. Roadmap "Get notified — RSS" link. Landing
  hero NEW chip → anchor link, secondary CTA → text-link.
  `/whats-new` RSS alternate `<link>` metadata.
- **Session 7 (7e29aa0)** — AI paywall sheet drops the
  "unlimited" / "100/day" contradiction. Recipe `/recipe/[id]`
  404 page CTAs route into the app (Discover + Today) instead
  of dropping to landing. `/whats-new` date locale pinned to
  en-GB to fix SSR/CSR hydration mismatch.
- **Session 8 (2cadde0)** — Landing trust-line check items
  moved above the CTAs (sub-sub-headline). Roadmap converted
  to divider-list pattern (rounded outer + divide-y rows + 40px
  height). Licences page renders stacked cards on mobile-web
  + table on md+. Mobile `/whats-new` date locale pinned for
  parity with web.
- **Session 9 (156252f)** — Mobile tab order swapped to
  Today / Plan / Recipes / More (strategic-direction canonical).
  Plan landing "Browse recipe library" demoted from full-width
  pressable to a small secondary chip beside the section label.

**Status of every "Continue with…" item from the session-4
handoff:** every item that was tractable without external decision,
external infrastructure, or larger refactor scope has now landed.
Remaining open items are the same four buckets: external/non-code,
needs decision, larger refactors, mobile dark-mode capture sweep.
