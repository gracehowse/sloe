# Phase 6 — comprehensive audit coverage matrix

**Phase 6 expanded scope.** Mobile native, mobile-web, desktop-web. Every surface, every button, every journey.

This is the **single source of truth** for what's been audited, what's pending, what's been shipped, and where the gaps are. Updated as audits return.

---

## Surface coverage

Legend: ✓ done · ⏳ in flight · — not yet started · n/a not applicable

| Surface | Customer-lens | Visual-qa | Sync-enforcer | Other lens | Saved to disk |
|---|---|---|---|---|---|
| **Today / Home** | ✓ first-session | ✓ pixel-level | ✓ parity | ui-critic, journey-architect | `2026-04-28-customer-lens-first-session.md` + `2026-04-28-ui-critic-button-level.md` + `2026-04-28-visual-qa-pixel-level.md` |
| **Library** | ✓ deep audit | ✓ pixel-level | ✓ parity | — | `2026-04-28-library-discover-deep-audit.md` |
| **Discover** | ✓ deep audit | ✓ pixel-level | ✓ parity | — | same |
| **Recipe Detail** | ✓ via Library audit | ✓ pixel-level | ✓ parity | — | same |
| **Cook Mode** | ✓ via Library audit | ✓ pixel-level + redesign spec | ✓ parity | ui-product-designer | `2026-04-28-cook-mode-redesign.md` (spec) |
| **Settings (mobile + web)** | ✓ deep audit | partial | ✓ parity | — | `2026-04-28-more-settings-deep-audit.md` |
| **More (mobile native)** | ✓ deep audit | partial | ✓ parity | — | same |
| **Profile (mobile + web)** | ✓ via More audit | partial | partial | — | same |
| **Plan / Planner** | ⏳ comprehensive | partial (summary card spec) | ✓ parity | ui-product-designer (summary card) | `2026-04-28-planner-summary-card-redesign.md` (partial) |
| **Shopping List** | ⏳ comprehensive | partial (empty state spec) | ✓ parity | ui-product-designer (empty state) | `2026-04-28-shopping-empty-state-redesign.md` (partial) |
| **Move Meal sheet** | ⏳ via Plan audit | — | flagged in sync | — | — |
| **Plan Templates** | ⏳ via Plan audit | — | — | — | — |
| **Progress Dashboard** | ⏳ comprehensive | partial (stat grid spec) | ✓ parity | ui-product-designer (stat grid) | `2026-04-28-progress-stat-grid-redesign.md` (partial) |
| **Burn Detail** | ⏳ comprehensive | partial via Progress | partial | — | — |
| **Weight Tracker** | ⏳ via Progress audit | — | — | — | — |
| **Progress Metric Detail** | ⏳ via Progress audit | — | — | — | — |
| **Digest / Weekly Recap** | ⏳ via Progress audit | partial | — | — | — |
| **Onboarding (web v2 — 15 steps)** | ⏳ comprehensive | partial (visual refit spec) | ✓ parity | ui-product-designer | `2026-04-28-onboarding-redesign.md` (visual refit) |
| **Onboarding (mobile legacy)** | ⏳ comprehensive | partial | ✓ parity | planner | `2026-04-28-onboarding-v2-mobile-port-plan.md` |
| **Onboarding (mobile v2 in-progress)** | ⏳ comprehensive | — | — | planner | same |
| **Landing page** | ⏳ comprehensive | — | — | — | — |
| **Pricing page** | ⏳ comprehensive | — | partial via sync | — | — |
| **In-app paywall (web)** | ⏳ comprehensive | — | partial | — | — |
| **Mobile paywall (Pro-only)** | ⏳ comprehensive | — | ✓ parity | — | — |
| **Auth (login/signup/reset)** | ⏳ comprehensive | — | — | — | — |
| **Account billing / Stripe portal** | partial via Settings | — | — | — | — |
| **LogSheet (6 sub-tabs)** | ⏳ comprehensive | — | ✓ parity (best-executed surface per sync) | — | — |
| **Voice log (full flow)** | ⏳ comprehensive | — | — | — | — |
| **Photo log (full flow)** | ⏳ comprehensive | — | — | — | — |
| **Food Search Modal** | ⏳ via LogSheet audit | — | — | — | — |
| **Barcode Scanner** | ⏳ via LogSheet audit | — | — | — | — |
| **Health Sync** | ⏳ comprehensive | — | partial | — | — |
| **Notifications Center / inbox** | ⏳ comprehensive | — | — | — | — |
| **Recipe Upload (manual create)** | ⏳ comprehensive | — | — | — | — |
| **Recipe Import (URL)** | ⏳ comprehensive | — | — | — | — |
| **Recipe Import (image / OCR)** | ⏳ comprehensive | — | — | — | — |
| **Verify Recipe flow** | ⏳ comprehensive | — | — | — | — |
| **Recipe Edit** | ⏳ comprehensive | — | — | — | — |
| **Recipe Share** | ⏳ comprehensive | — | — | — | — |
| **Go Public dialog (web only)** | ⏳ comprehensive | — | ✓ documented | — | — |
| **404 / not-found** | ⏳ comprehensive | — | — | — | — |
| **Global error boundary** | ⏳ comprehensive | — | — | — | — |
| **Offline states** | ⏳ comprehensive | — | — | — | — |
| **Loading states (skeleton coverage)** | ⏳ comprehensive | partial | — | — | — |
| **Empty states (universal coverage)** | ⏳ comprehensive | partial | — | — | — |
| **Toasts / banners** | ⏳ comprehensive | — | — | — | — |
| **Cookie consent / GDPR (web)** | ⏳ comprehensive | — | — | — | — |
| **First-run checklist** | ⏳ comprehensive | — | — | — | — |
| **Email templates (welcome / verify / recap / cancel)** | ⏳ comprehensive | — | — | — | — |
| **Accessibility (VoiceOver / focus / keyboard)** | ⏳ comprehensive | — | — | — | — |
| **Reduced motion / transparency** | ⏳ comprehensive | partial | — | — | — |
| **Dynamic Type / font scaling** | ⏳ comprehensive | — | — | — | — |
| **Internationalisation (UK/US English, currency, date)** | ⏳ comprehensive | — | — | — | — |
| **Dark-mode coverage (beyond 3-fix)** | ⏳ comprehensive | partial | — | — | — |
| **Diversity / inclusion (body-neutral, identity, cuisine)** | ⏳ comprehensive | — | — | — | — |

---

## Audit fan-out — 7 parallel customer-lens sweeps in flight

1. **Plan + Shopping** — every button, journey, state on Planner + Shopping + Move-Meal + Templates
2. **Progress + Burn + Weight + Digest** — every chart, stat, tile, range
3. **Onboarding (3 platforms)** — every step, every input, every error path
4. **Landing + Pricing + Paywall + Auth** — every CTA, every flow, every conversion-killer
5. **Logging system** — LogSheet 6 tabs + Voice + Photo + Health Sync + Notifications inbox
6. **Recipe creation** — Upload + Import (URL + image + OCR) + Verify + Edit + Share + Go Public
7. **App-wide states** — error boundaries + 404 + offline + loading + empty + toasts + cookies + first-run + emails + a11y + reduced motion + dynamic type + i18n + dark mode + diversity

Each agent has a hard 4000-word cap and surfaces P0/P1/P2/P3 findings with file:line refs.

---

## Already-shipped findings + fixes (this session)

7 commits on `origin/main`:

- `76a09dd` — 9 audit-driven parity fixes (NorthStar CTA, CalorieRing, voice/photo wiring, LogFab cleanup, copy + icon sweeps)
- `e7c63ed` — type extraction unblocking GH mobile CI
- `74f649c` — P0-1 Search routing + P0-2 Recent/Saved hydration
- `e3ad7a9` — P0-3 mobile tracking-extras useFocusEffect
- `03bf765` — P3 dark-mode 3-fix + 5 P1 design specs + P0-4 plan
- `07c519e` — P2 PressableScale primitive (web + mobile)
- `2d568a8` — Library/Discover + More/Settings deep audits

GH CI **green** on all main commits.

---

## Outstanding P0/P1 already surfaced (queued for executor sprint)

From the Library/Discover audit:
- L5: Mobile-web `RecipesSubTabHeader` missing (P0)
- D1: Following filter parity drift (creatorId only on mobile vs creator+author on web) — P0 silent data divergence
- D3: Eating-out tap goes to different destinations (P0)
- CM1: Cook screen crashes on malformed JSON (P0)
- CM5: Cook web auto-logs meal; mobile doesn't (P0 write-path drift)

From the More/Settings audit:
- Mobile-web "You" tab is dead end (P0)
- "More" exists nowhere on web (P0)
- Settings + More 80% overlap (P0 strategic restructure)
- Reset/Erase/Delete-Account stacked behind one modal (P0 trust/safety)
- Build stamp visible to all production users (P1)
- Apple Health "Connected" lies post-revoke (P1)

From earlier visual-qa pixel-level:
- Cook Mode cheap-tier visual (P1) → spec written
- Onboarding fontWeight:900 + borderWidth:2 + invisible Back (P1) → spec written
- Progress stat grid 47% width hack + flat tiles (P1) → spec written
- Planner summary card flat tint where gradient was specified (P1) → spec written
- Shopping list empty emoji + asymmetric CTA (P1) → spec written

Phase 6 implementation backlog (executor sprint scope):
- Implement the 5 P1 design specs
- Implement P0-4 onboarding mobile port (~1 sprint day per planner)
- Build mobile-web pill bars (P0)
- Settings + More merge per audit recommendation (P0 strategic)
- Fix the silent data drifts (D1, CM5, eating-out)
- Cook crash try/catch (CM1)

---

## Coverage gaps to close before this matrix can be marked "comprehensive"

Pending the 7 parallel audits returning, the following surfaces are still not deeply audited:

- Move Meal sheet (mobile only — flagged but not walked)
- Plan templates flow
- Weight Tracker route (separate from Progress)
- Progress Metric Detail breakdown sheet
- Digest weekly recap end-to-end (only flagged in Progress audit so far)
- Voice log full pipeline (transcription + match + commit)
- Photo log full pipeline
- Food Search Modal (the destination LogSheet routes to)
- Barcode Scanner Modal
- Recipe Upload (manual)
- Recipe Import (3 paths)
- Verify Recipe (post-import nutrition check)
- Recipe Edit / Delete / Share
- Health Sync detailed flow
- Notifications Center inbox (only flagged in More audit)
- Landing page content + every CTA
- Pricing page tier comparison + billing toggle
- In-app paywall surfaces (entry points + copy variants)
- Mobile paywall (Pro-only)
- Login / Signup / Forgot-password / Magic-link flows
- Stripe checkout return paths
- Trial-end flow
- Cancellation flow (Stripe portal hand-off)
- Email templates
- Cookie consent flow
- First-run checklist
- 404 / global error / offline / stale states
- Toast / banner UX
- Universal EmptyState primitive coverage sweep
- Skeleton primitive migration sweep
- Accessibility audit (VoiceOver, focus, keyboard, dynamic type)
- Reduced motion / transparency compliance
- Internationalisation drift
- Dark mode coverage beyond 3-fix
- Diversity / inclusion language sweep

The 7 parallel audits in flight cover every item above. When all 7 return, this matrix flips to "✓ done" across the board and the Phase 6 implementation sprint scope is locked.

---

## Process correction

Earlier this session the audit was reactive — surfaces were added when Grace surfaced them. Going forward: **every surface in the app is in scope by default.** New surfaces only get a separate audit if the comprehensive sweep is silent on them.
