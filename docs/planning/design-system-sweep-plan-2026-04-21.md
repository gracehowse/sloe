# Design-system sweep — detailed decision plan (2026-04-21)

Output of the 5 parallel three-bucket audits run 2026-04-21 (Progress, Plan/Discover/More, Settings, Onboarding, Pricing/Paywall/Landing). This doc is the single place to approve or redirect each proposed change. Every item has: **current behaviour** (with file:line), **proposed change** (exact), **platforms**, **scope**, **recommendation**, and **the question** you answer.

Already-shipped carryover + activity-icons + landing-tokenisation + pricing-wordmark + disclaimer-removal landed in commit `8c79f84`.

## Resolved so far (2026-04-21)

- **D1 Welcome headline** — Grace chose Option 3 (keep divergent). Decision doc: `docs/decisions/2026-04-21-onboarding-welcome-copy-platform-divergence.md`. `sync-enforcer` carve-out logged.
- **R1–R6 mobile icon parity** — Approved as-mapped and shipped. Decision doc: `docs/decisions/2026-04-21-design-system-sweep-icon-parity.md`. Typecheck green on mobile.

Remaining D-items (D2–D13 except D1) and M2–M4 still pending Grace's call.

---

## Part 1 — Design decisions you need to make (13 items)

For each: what is, what changes, rec, your call.

---

### D1. Welcome step headline — cross-platform divergence

**Current:**
- **Web** `src/app/components/onboarding-v2/steps/welcome.tsx:62-102` leads with **"Join the Suppr Club"** (marketing/cold-traffic framing) plus a trio of checkline bullets and a Sign-In button.
- **Mobile** `apps/mobile/components/onboarding-v2/steps/welcome.tsx:56-76` uses the prototype's **"Eat well, without overthinking it."** + FloatingPreview with a "Matched to USDA · 94%" confidence chip.
- **Prototype** (`docs/ux/claude-design-bundles/onboarding/project/design/steps.jsx:156-171`) matches mobile.

**Why it matters:** First screen of onboarding. Two different first impressions for the same product. Violates the "mobile decisions apply to web same commit" rule.

**Options:**
1. **Unify to prototype copy** ("Eat well, without overthinking it.") on both platforms. Web loses the "Join the Suppr Club" marketing lean but gains parity.
2. **Unify to web copy** ("Join the Suppr Club") on both platforms. Mobile gains the marketing lean but loses the prototype's matched-to-USDA trust signal.
3. **Keep divergent** — but then needs a decision doc in `docs/decisions/` explaining *why* mobile and web have different cold opens.

**Recommendation:** Option 1. The prototype copy is tighter and the FloatingPreview is a stronger trust signal than the checkline trio. "Join the Suppr Club" is a marketing page phrase, not an onboarding moment. Landing already pushes club framing; onboarding is post-signup.

**Question:** Approve Option 1 (unify to "Eat well, without overthinking it." + FloatingPreview on both)?

**Scope if yes:** Edit `src/app/components/onboarding-v2/steps/welcome.tsx` + potentially add a web FloatingPreview component. ~60 lines on web; 0 on mobile (already correct). 1 commit, no data migration.

---

### D2. Onboarding Strategy + Narrative steps — keep or drop?

**Current:**
- **Strategy step** — `src/app/components/onboarding-v2/steps/strategy.tsx` + `apps/mobile/components/onboarding-v2/steps/strategy.tsx`. Live addition not in prototype. Lets user pick carb/protein split (nutrition_strategy).
- **Narrative step** — `src/app/components/onboarding-v2/narrative.tsx` (web only; no mobile equivalent).
- **Prototype** has 12 steps; live has 13 (or 14 with narrative) — drift from the canonical count.

**Why it matters:** Every extra step is an activation drop-off risk. But carb/protein split is a legitimate nutrition choice some users want.

**Options per step:**
1. **Keep both** — accept the 2-step drift from prototype. Needs prototype-style visual pass on both.
2. **Keep Strategy, drop Narrative** — narrative is web-only anyway (no mobile), so it's a parity break we can fix by removal.
3. **Drop both** — tighter flow, closer to prototype. Strategy collapses into default carb/protein split from the goal choice.

**Recommendation:** Option 2. Strategy earns its keep (user agency over macros). Narrative doesn't (web-only, activation tax, not in prototype).

**Question:** Approve Option 2 (keep Strategy, drop Narrative)? Or Option 1/3?

**Scope if Option 2:**
- Delete `src/app/components/onboarding-v2/narrative.tsx`
- Remove narrative from the web flow in `src/app/components/onboarding-v2/web-flow.tsx`
- Update step-index bookkeeping + any tests referencing it
- ~80 lines deleted, 1 commit

---

### D3. Digest primitive timing vs retiring WeeklyRecapCard

**Current:**
- `src/app/components/suppr/weekly-recap-card.tsx` (web) + mobile equivalent — the live recap card surface.
- Memory `project_progress_direction.md` says "Digest replaces recap card". Digest primitive doesn't exist yet.
- Streak tile at `weekly-recap-card.tsx:274-281` — you've confirmed Streak stays on Progress.

**Why it matters:** Currently we have two different surfaces doing the same job on Progress. Retiring recap without a replacement leaves a hole; building Digest first means the retirement is clean.

**Options:**
1. **Ship Digest first, then retire recap.** Requires a `ui-product-designer` brief. Maybe 2 weeks of work.
2. **Retire recap now, live without a replacement for one release.** Loses the Streak tile display surface for a week.
3. **Keep recap indefinitely until Digest is ready.** No risk, but Progress stays cluttered.

**Recommendation:** Option 1. Commission Digest design first so the transition is clean. The recap card isn't broken; there's no urgency.

**Question:** Approve Option 1 (Digest first)? Who designs it — you sketch then port, or route to `ui-product-designer` for a full spec?

**Scope:** No code changes yet; this gates a design-then-implement wave. If Option 2, ~150 lines deleted across web + mobile.

---

### D4. Apple Health card on web Progress — add or mobile-only?

**Current:**
- **Mobile:** Prototype `screens-mobile.jsx:691-711` shows an Apple Health card on Progress — Steps / Active energy / Resting burn / Weight row list with icon-box. **Live mobile does not have this card.**
- **Web:** Prototype `screens-web.jsx` for Progress doesn't show an Apple Health card — uses the Trend summary key/value card instead. Live web matches.

**Why it matters:** On mobile, Apple Health data is first-class (HealthKit integration exists). On web, there's no native health integration; Trend summary is the right web analogue.

**Options:**
1. **Adopt mobile-only** — Apple Health card on mobile Progress, web keeps Trend summary. Matches prototype intent.
2. **Adopt on both** — web Apple Health card fed by synced HealthKit data from the mobile user (same account). More work.
3. **Skip both** — current live scattering (Health data on Today steps card, weight-tracker) stays put.

**Recommendation:** Option 1. Prototype clearly intends mobile-only for this card; web Trend does a different job.

**Question:** Approve Option 1?

**Scope:** New mobile `ProgressAppleHealthCard` component (~120 lines) + fetch from the existing HealthKit context. 1 `ui-product-designer` brief if you want the visual spec written first; otherwise straight to `executor`.

---

### D5. Progress range-pill style — segmented control?

**Current:**
- **Live:** `apps/mobile/app/(tabs)/progress.tsx:849-880` renders the range selector as individual outlined pills (Day / Week / Month / etc.) with accent-filled active state.
- **Prototype:** `screens-mobile.jsx:581-591` uses a single muted container with inset active chip (card-on-muted, subtle shadow).

**Why it matters:** Purely visual. Both are clear. Prototype's is denser and more modern-looking.

**Options:**
1. **Swap to prototype's segmented control** (web + mobile same commit).
2. **Keep outlined pills.**

**Recommendation:** Option 1. Prototype reads more premium; the inset chip is a small but real tier upgrade.

**Question:** Approve Option 1?

**Scope:** ~40 lines changed on each platform. Also affects any other range-pill surface (check Plan, Discover). 1 commit.

---

### D6. Plan summary inline CTAs (Shopping list + Regenerate)

**Current:**
- **Live:** `apps/mobile/app/(tabs)/planner.tsx` summary card (~:1204) shows pace/kcal diagnosis but no inline action buttons. Shopping list is accessed via Library button; Regenerate lives elsewhere.
- **Prototype:** `screens-mobile.jsx:471-476` puts Shopping-list + Regenerate as two buttons inside the "This week" summary card, one tap from the hero.

**Why it matters:** Two of the most-used Plan verbs move from 2-3 taps to 1 tap.

**Options:**
1. **Adopt** — add Shopping list + Regenerate as inline summary-card CTAs on mobile + web.
2. **Skip** — keep current placements.

**Recommendation:** Option 1. Unambiguous UX win.

**Question:** Approve?

**Scope:** ~30 lines added per platform. Shopping-list CTA routes to existing Shopping screen; Regenerate calls existing regen logic. No new infra. Hit both platforms same commit.

---

### D7. Gradient avatar on More tab

**Current:**
- **Live mobile** `apps/mobile/app/(tabs)/more.tsx:557-562` main avatar uses `Accent.primary` flat fill (52×52) + `:523` top-right button uses `Accent.primary + "10"` tint (40×40).
- **Prototype:** `screens-mobile.jsx:740` uses `linear-gradient(135deg, #4c6ce0, #e04888)` on the main avatar. Brand gradient is explicitly allowed on avatars per design-system doc.

**Why it matters:** Brand-gradient is precious and avatars are one of its sanctioned places. Flat primary fill on an avatar is a cheaper-looking miss.

**Options:**
1. **Adopt on both avatars** (52×52 main + 40×40 top-right button).
2. **Adopt on main only**, keep top-right tinted.
3. **Skip.**

**Recommendation:** Option 1. Same rule, same treatment, one commit.

**Question:** Approve Option 1?

**Scope:** ~6 lines per avatar. Also hit the web equivalent in `src/app/components/Profile.tsx` if applicable (haven't verified yet).

---

### D8. Discover hero image fallback

**Current:**
- **Live** `apps/mobile/app/(tabs)/discover.tsx:224` — tinted placeholder with restaurant icon when recipe has no image.
- **Prototype** uses actual 16:10 photos. Live can do this when images are available, but fallback is the tinted placeholder.

**Why it matters:** Feed quality perception. Tinted placeholders read "prototype"; real images read "premium".

**Options:**
1. **Commission a fallback illustration set** — 4-6 food category placeholders (bowls, plates, baked, fresh, etc.) that rotate by cuisine/tag. Needs `ui-product-designer` + asset creation.
2. **Use a better gradient/pattern placeholder** — still no real images but richer visual treatment. In-house, no asset creation.
3. **Keep the tinted-icon placeholder** — it's not broken, just plain.

**Recommendation:** Option 2 for now. Option 1 is asset work that doesn't have to gate the sweep. Real images eventually come from the recipe imports.

**Question:** Pick 1 / 2 / 3?

**Scope:** Option 2 is a ~50-line change in `discover.tsx` + a small util. Option 1 is a mini-project.

---

### D9. Settings promo-code block — collapse to expander?

**Current:**
- `apps/mobile/app/(tabs)/settings.tsx:484-573` — a full card with input field + "Apply" button, always visible.
- **Prototype** shows no promo block at all (tighter settings) — so this is a live-only addition.

**Why it matters:** Most users never have a promo code. The block takes permanent real estate.

**Options:**
1. **Collapse to "Have a code?" link** that expands into the full block on tap.
2. **Keep always-expanded.**
3. **Move to `/pricing` surface** (web) + paywall (mobile) — where someone thinking about payment actually needs it.

**Recommendation:** Option 1. Zero-cost win. Option 3 is cleaner long-term but more refactor.

**Question:** Approve Option 1?

**Scope:** ~30 lines changed in settings.tsx. Web parity later if applicable.

---

### D10. Delete-account flow — does it exist?

**Current:**
- Settings audit asked whether a delete-account flow exists. I haven't verified.
- **Prototype** has "Privacy · Export or delete your data" as a single row.

**Why it matters:** Legal / GDPR / user-right. Must exist; question is whether it's already wired or needs building.

**Action required:** I should grep the repo for "delete account", "delete-account", "/api/account/delete" etc., then report whether a flow exists. If it does, the Settings audit item is just "surface the entry point". If not, `ui-product-designer` brief.

**Question:** Want me to check? (Yes/no — low-cost.)

---

### D11. Appearance control in Settings

**Current:**
- **Live** `apps/mobile/app/(tabs)/settings.tsx:575-595` — segmented control (Light / Dark / System).
- **Prototype** uses a row with chevron that opens a bottom sheet with the three options.

**Why it matters:** Segmented control is more efficient (1 tap); row-to-sheet is more consistent with the prototype's row pattern but 2 taps.

**Options:**
1. **Keep segmented** — favour efficiency.
2. **Adopt row-to-sheet** — favour consistency with prototype row pattern.

**Recommendation:** Option 1. Appearance is a toggle you change once; 1 tap > 2 taps. Prototype consistency isn't worth the friction.

**Question:** Approve Option 1?

**Scope:** Zero change if Option 1. Option 2 would be ~40 lines + a new sheet.

---

### D12. Upgrade dialog — Pro alongside Base?

**Current:**
- `src/app/components/suppr/upgrade-paywall-dialog.tsx` shows Base only.
- **Prototype** `flows.jsx:588-610` shows both Base + Pro as selectable tiers.

**Why it matters:** Users who are Pro-curious currently leave the dialog to hit `/pricing` — a conversion leak.

**Options:**
1. **Add Pro alongside Base** — match prototype.
2. **Keep Base-only in dialog**; route Pro-curious to `/pricing`.
3. **Dynamic — show Base if user is on Free, show Pro if user is on Base** (upsell path).

**Recommendation:** Option 3. Contextual upsell. But this needs monetisation-architect sign-off since it's a pricing UX change.

**Question:** Pick 1 / 2 / 3? Want me to loop in monetisation-architect?

**Scope:** Option 1 ~60 lines. Option 3 ~80 lines + tier-context wiring.

---

### D13. `/pricing` gradient hero panel

**Current:**
- **Live** `app/pricing/page.tsx` — flat marketing page (`bg-slate-50 dark:bg-slate-950`). Tier grid below.
- **Prototype** `flows.jsx:555-564` puts a gradient hero header with "SUPPR" pill + "The full meal planning loop" title above the tier grid.

**Why it matters:** `/pricing` is a primary conversion surface. Gradient hero is on-brand and signals premium.

**Options:**
1. **Adopt prototype's gradient hero panel** on `/pricing`.
2. **Keep flat-marketing** and reserve gradient for the `UpgradePaywallDialog` only.

**Recommendation:** Option 1. `/pricing` is as paywall-adjacent as it gets — brand gradient is allowed here.

**Question:** Approve Option 1?

**Scope:** ~70 lines added to `app/pricing/page.tsx` + maybe a small `PricingHero` component. 1 commit.

---

## Part 2 — Mass icon rewires (6 files, ~65 icons total)

Each of these is a whole-file replacement of `@expo/vector-icons` (Ionicons + MaterialCommunityIcons) with `lucide-react-native`. The web side uses `lucide-react` already; the mobile side is the parity miss. Per Carryover #2.

Each line = one icon usage to change. Exact `Ionicons.name` → `LucideIcon` mapping below. Semantic choices are mine — Grace can override any row.

### R1. `apps/mobile/app/paywall.tsx` — Ionicons → lucide

| Ionicons name | Lucide replacement | Line(s) |
|---|---|---|
| `close-outline` | `X` | :698 |
| `checkmark-circle-outline` | `CheckCircle2` | :764 |
| `calendar-outline` | `CalendarDays` | :841 |
| `restaurant-outline` | `ChefHat` | :955 |
| (plus ~7 more per audit — needs verification pass) | — | file-wide |

Size: ~10 icons, ~30 lines changed. Low semantic risk.

### R2. `apps/mobile/app/(tabs)/more.tsx` — Ionicons → lucide

~20 row icons. Proposed mapping:

| Section | Ionicons | Lucide |
|---|---|---|
| Recipes stat | `sparkles-outline` | `Sparkles` |
| Household | `people-outline` | `Users` |
| Streak | `flame-outline` | `Flame` |
| Dashboard widgets | `grid-outline` | `LayoutGrid` |
| Week start | `calendar-outline` | `Calendar` |
| Caffeine | `cafe-outline` | `Coffee` |
| Alcohol | `wine-outline` | `Wine` |
| Health | `heart-outline` | `HeartPulse` |
| Notifications | `notifications-outline` | `Bell` |
| Weekly recap | `mail-outline` | `Mail` |
| Appearance | `color-palette-outline` | `Palette` |
| Export CSV | `download-outline` | `Download` |
| Export JSON | `code-slash-outline` | `Code` |
| Help | `help-circle-outline` | `HelpCircle` |
| Legal | `document-text-outline` | `FileText` |
| What's new | `book-outline` | `BookOpen` |
| Reset | `refresh-outline` | `RefreshCw` |
| Delete account | `trash-outline` | `Trash2` |
| Chevron | `chevron-forward` | `ChevronRight` |

Size: ~20 icons, ~40 lines. Low risk.

### R3. `apps/mobile/app/(tabs)/progress.tsx` + `progress-metric.tsx` + `TodayStreakInsightCard.tsx`

~12 icons. Mapping:

| Ionicons | Lucide |
|---|---|
| `calendar-outline` | `CalendarDays` |
| `flame-outline` | `Flame` |
| `trending-up` | `TrendingUp` |
| `trending-down` | `TrendingDown` |
| `barbell-outline` | `Beef` (protein semantic) |
| `chevron-back` | `ChevronLeft` |
| `chevron-forward` | `ChevronRight` |
| `information-circle-outline` | `Info` |

Size: ~12 icons across 3 files. Low risk.

### R4. `apps/mobile/app/(tabs)/discover.tsx`

~10 icons:

| Ionicons / MCI | Lucide |
|---|---|
| `search-outline` | `Search` |
| `restaurant-outline` | `Utensils` |
| `flame-outline` | `Flame` |
| `barbell-outline` | `Beef` (protein semantic — matches prototype `screens-mobile.jsx:396`) |
| `time-outline` | `Clock` |
| `bookmark-outline` / `bookmark` | `Bookmark` / `BookmarkCheck` |
| `download-outline` | `Link` (paste link) |
| `chevron-forward` | `ChevronRight` |
| `chef-hat` (MCI) | `ChefHat` |

Size: ~10 icons. Low risk.

### R5. `apps/mobile/app/(tabs)/planner.tsx`

Small — just the 4 meal-slot icons:

| Current | Lucide |
|---|---|
| Ionicons `cafe-outline` (Breakfast) | `Coffee` |
| Ionicons `sunny-outline` (Lunch) | `Sun` |
| Ionicons `restaurant-outline` (Dinner) | `UtensilsCrossed` |
| MCI `cookie-outline` (Snacks) | `Cookie` |

Plus `refresh-cw` 30×30 muted square per prototype `screens-mobile.jsx:497-502` for per-row swap.

Size: ~4-6 icons, ~10 lines. Trivial risk.

### R6. `apps/mobile/app/(tabs)/settings.tsx`

~10 row icons. Mapping follows the More-tab mapping pattern (same icon set). Specifically:

- `chevron-forward` → `ChevronRight` (line :506, others)
- `mail-outline` → `Mail` (:535)
- `log-out-outline` → `LogOut` (:609)
- `notifications-outline` → `Bell`
- `moon-outline` → `Moon`
- `shield-outline` → `Shield`
- `document-text-outline` → `FileText`

Size: ~10 icons, ~25 lines. Low risk.

**Execution option for R1–R6:** fan to 6 parallel executor agents in one message (per `feedback_parallel_batch_sweeps`). Total estimated: ~65 icons, ~150 lines. All 6 should land in a single commit named `feat(mobile): lucide icon parity across paywall/more/progress/discover/plan/settings`.

**Question:** Approve R1–R6 as-mapped? Any specific icon you want to override (e.g. Discover's protein icon — `Beef` semantic vs `Dumbbell` aesthetic)?

---

## Part 3 — Additional mechanical wins not yet in the queue

Small, low-risk, unambiguous. Can ship autonomously once you approve as a batch.

### M1. Mobile onboarding hex-alpha — SKIP
Audit flagged `color + "22"` at `reveal.tsx:329` and `config.accent + "40"` at `pace.tsx:402` as Carryover-6 violations. **False positive** — Carryover-6 is about CSS variables specifically. On React Native, these are legal hex-with-alpha strings. No action needed.

### M2. Pricing slate palette → tokens
`app/pricing/page.tsx` uses raw Tailwind slate (`bg-slate-50 dark:bg-slate-950`, `text-slate-700 dark:text-slate-300`, `border-slate-200 dark:border-slate-800`). Swap to tokens:
- `bg-slate-50 dark:bg-slate-950` → `bg-background`
- `text-slate-700 dark:text-slate-300` → `text-foreground`
- `text-slate-600 dark:text-slate-400` → `text-muted-foreground`
- `border-slate-200 dark:border-slate-800` → `border-border`
- `bg-white dark:bg-slate-900` → `bg-card`
- Trust-signal icon colours (`text-green-600 / text-blue-600 / text-violet-600`) → `text-[var(--macro-calories)] / text-primary / text-[var(--macro-fat)]`

Scope: ~20 class-swaps. 1 commit, no new components.

### M3. Mobile paywall gradient hero
Per Pricing/Paywall audit: mobile paywall header (`paywall.tsx:701-705`) is flat `colors.background`; prototype paywall opens with the brand gradient banner (`flows.jsx:555`). Gradient is allowed here per the design-system doc. ~15 lines added.

### M4. Plan slot-icon semantic swap
Per Plan audit, swap meal-slot icons to the semantically correct prototype icons: Breakfast=Coffee (not Sun), Lunch=Sun (not Utensils), Dinner=UtensilsCrossed, Snacks=Cookie. Prototype uses `sun / utensils / moon` which reads less accurately. **Hybrid: adopt the lucide migration but override Dinner=moon → Dinner=UtensilsCrossed for clarity.**

**Question (M2–M4):** Approve as a batch once R1–R6 land?

---

## Part 4 — Blocked items

### B1. Landing Bundle 3 — full audit blocked
The landing bundle (`https://api.anthropic.com/v1/design/h/P0pCWaxptDtgoBD0jdSxeg?open_file=Suppr+Landing.html`) exceeds WebFetch's 10MB limit. Can't mirror into `docs/ux/claude-design-bundles/landing/`. Mock-hex tokenisation is done for what I could see; a full landing audit (hero, showcase, footer, section rhythm) waits on a fresh export that fits under 10MB.

**Action needed from Grace:** manual re-export of the landing bundle, strip any heavy assets (large PNGs, fonts), drop into `docs/ux/claude-design-bundles/landing/`. Or paste key CSS files directly.

### B2. Onboarding steps audit coverage
The Onboarding audit covered the flow end-to-end but flagged specific steps (Sex help-disclosure, Pace medical-safety warning layout, Import 3-phase ticker) where the audit agent couldn't fully verify the live state without reading each step file. Suggest a focused follow-up audit on those three steps specifically, post-mass-icon-rewire.

---

## Execution roadmap (proposed)

**Wave A — Safe autonomous batch (once approved):**
- D1 Welcome unify, D2 drop Narrative (if Option 2), D6 Plan inline CTAs, D7 gradient avatar, D9 Settings promo collapse, D11 keep segmented appearance (no-op), R5 Plan slot icons.
- Single commit, ~5 files, low risk.

**Wave B — Mass icon rewires R1–R6:**
- Fan to 6 parallel executor agents. Single commit when all return clean + typecheck passes.

**Wave C — Progress overhaul:**
- D4 Apple Health card (mobile), D5 range pills → segmented control. Gates on ui-product-designer brief if you want a visual spec first.

**Wave D — Marketing cluster:**
- D13 `/pricing` gradient hero, M2 slate → tokens, M3 mobile paywall gradient hero, D12 Upgrade dialog Pro (pending monetisation-architect sign-off).

**Wave E — Design briefs (no code yet):**
- D3 Digest primitive, D8 Discover hero fallback, D10 delete-account flow (if missing).

**Wave F — Blocked until Bundle 3:**
- B1 landing audit.

---

## Decisions not needed

The following were resolved earlier and don't need re-visiting:

- Streak stays on Progress (2026-04-21).
- Disclaimer footer removed from landing (shipped `8c79f84`).
- "Dinner could hit your target" dropped (2026-04-21).
- Carryover rules 1–9 resolved project-wide; mechanical cleanup shipped `8c79f84`.
- Profile → More rename shipped earlier.
- Mobile onboarding Activity step icon parity shipped `8c79f84`.

---

**Next step:** answer D1–D13 (pick options or redirect), approve R1–R6 icon map (or override individual rows), then I'll sequence Waves A+B in parallel and report back.
