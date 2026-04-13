# Executor backlog — orchestrator-full-sweep (2026-04)

**Source:** `orchestrator-full-sweep` consolidation (whole product: web + Expo + Supabase).  
**Handoff:** `executor` implements in order below; `qa-lead` aligns tests; `docs-keeper` updates legal/env docs where noted.

---

## 1. Top 5 actions (execution order)

**Status:** items 1–5 shipped in `main` (2026-04); see commit history for `getUserTier`, mobile journal, privacy, legal links, voice paywall + web tracker polish.

| # | Title | Severity | Owner | Why now |
|---|--------|----------|-------|---------|
| 1 | Fix `getUserTier` under RLS | P0 | executor (+ security-reviewer review) | Paid users incorrectly get free-tier API limits (`photo-log`, `voice-log`, etc.). |
| 2 | Mobile journal parity with web legacy `nutrition_journals` | P0 | executor (+ sync-enforcer review) | Subset of users see food on web, empty log on mobile. |
| 3 | Privacy policy: AI, photo, voice, subprocessors | P0 | executor (+ legal-reviewer review) | Store / EU-style scrutiny; policy must match processing. |
| 4 | Mobile in-app Privacy + Terms links | P0 | executor (+ legal-reviewer review) | Ship checklist / store parity with web. |
| 5 | Mobile voice paywall error framing (`upgrade_required`) | P1 | executor | Trust: stop showing “parse” errors for billing. |

---

## 2. Full backlog (sequenced by dependency)

### P0 — Ship blockers (legal + entitlements + parity)

| ID | Title | Problem | Goal | Effort | Deps | Platforms | Validation | Owner | Review |
|----|--------|---------|------|--------|------|-----------|------------|-------|--------|
| T1 | Tier lookup with RLS | `getUserTier` uses anon `createClient` without user JWT; `profiles` RLS hides rows → always `free`. | Tier read uses service role after `userId` is verified, or `SECURITY DEFINER` RPC `get_user_tier(uid)` granted to authenticated. | S | — | API | Pro user gets pro limits on photo/voice; unit or integration test with mock JWT + profile row. | executor | security-reviewer |
| T2 | Mobile `nutrition_journals` fallback | Web `useNutritionJournalState` falls back to legacy JSONB; mobile tracker only reads `nutrition_entries`. | Mobile loads same fallback path as web when entries empty / legacy only. | M | — | mobile | Legacy fixture: web and mobile show same day totals. | executor | sync-enforcer |
| T3 | Privacy policy completeness | `/privacy` thin on OpenAI (photo/voice), Web Speech, image import, named subprocessors. | Single updated policy page + terms cross-check. | M | — | web | Privacy expanded; **terms** link AI optional features → `/privacy`. | executor | legal-reviewer |
| T4 | Mobile legal links | No privacy/terms in mobile app surfaces. | Settings or More → open `/privacy` and `/terms` (WebView or `Linking`). | S | T3 optional copy | mobile | Manual: links work, match production URLs. | executor | legal-reviewer |

### P1 — Trust, product, correctness

| ID | Title | Problem | Goal | Effort | Deps | Platforms | Validation | Owner | Review |
|----|--------|---------|------|--------|------|-----------|------------|-------|--------|
| T5 | Voice upgrade UX (mobile) | 403 `upgrade_required` surfaced as parse failure. | Branch on `error` / status; title “Upgrade required”, body from API `message`. | S | — | mobile | Free user: clear paywall path copy. | executor | customer-lens |
| T6 | In-product AI disclosure | Photo/voice UI lacks third-party / transfer disclosure. | Short pre-action copy + link to privacy. | S | T3 | web (+ mobile if mirrored) | **Web + mobile:** tracker sheet + voice modal copy points to Privacy (More). | executor | legal-reviewer |
| T7 | Adaptive TDEE persistence | `computeAdaptiveTDEE` tested but nothing writes `profiles.adaptive_*`. | Job or post-save hook persists when confidence rules pass. | M | T1 if tier affects feature | both | **Done:** `refreshAdaptiveTdeeForUser` after web journal insert/delete + mobile `nutrition_entries` upsert; 6h throttle; medium/high only. Types synced. | executor | nutrition-engine |
| T8 | Dedupe `classifyMealType` | Two copies: `apps/mobile/lib` vs `src/lib/recipe-import`. | Single implementation in `src`; mobile re-export. | S | — | both | **Done:** `apps/mobile/lib/classifyMealType.ts` re-exports `src/lib/recipe-import/classifyMealType.ts`; `metro.config.js` watches monorepo root. | executor | code-quality |
| T9 | CI: mobile | No lint/tsc for `apps/mobile` in CI. | Add job step: `npm ci` in `apps/mobile` + `expo lint` or `tsc --noEmit` if configured. | M | — | CI | **Partial:** job `mobile` runs `npm ci` + grep guard on classify re-export. Full `expo lint` / `tsc` blocked until mobile debt cleared. | executor | release-gate |
| T10 | FAB sheet a11y | Absolute `Pressable` stack vs `Modal`; FAB no label. | `Modal` or RN sheet + `accessibilityLabel` / focus. | M | — | mobile | **Done:** `Modal` + FAB / action `accessibilityLabel`; Android `onRequestClose`. | executor | ui-product-designer |
| T11 | Web date nav `aria-label` | ← → buttons unlabeled. | `aria-label="Previous day"` / `Next day`. | S | — | web | **Done** on `NutritionTracker`. | executor | qa-lead |
| T12 | `VERIFY_STRICT` on release | `verify:production-env` always exits 0 in CI. | Enable `VERIFY_STRICT=1` on `main` or release workflow only. | S | — | CI | **Done:** `VERIFY_STRICT=1` when `github.event_name == push` and `ref == refs/heads/main`. | executor | release-gate |
| T13 | Fasting cross-platform | Fasting UI mobile-only; onboarding may capture intent. | Minimal web surface or honest “use mobile” copy. | L | product call | both | Decision recorded; UX matches. | planner → executor | journey-architect |
| T14 | Brand token pass | Violet / purple / pink / rose drift. | Single accent system in theme + App shell. | M | — | both | Design token doc + visual QA. | executor | ui-product-designer |
| T15 | Docs: FatSecret + Sentry | `docs/environment.md` wrong FatSecret names; `.env.example` missing `NEXT_PUBLIC_SENTRY_DSN`. | Align names; document both DSNs. | S | — | docs | **Done:** FatSecret consumer keys; `NEXT_PUBLIC_SENTRY_DSN` + `SENTRY_DSN` in docs and `.env.example`. | executor | docs-keeper |

### P2 — Hygiene

- Subscription narrative doc + in-app copy (Stripe vs IAP): **product-lead** brief → **executor**.
- Rate limit / Upstash production confirmation: **ops** + **security-reviewer**.
- `pnpm.overrides` vs npm: **docs-keeper** + single package-manager story.

---

## 3. Critical path (minimum to unblock next production ship)

```text
T1 (tier RLS) → T2 (journal parity)  } parallel where possible
T3 (privacy)   → T4 (mobile links)  } T4 can start after T3 draft
```

**Gate:** Do not tag App Store / Play production until **T1–T4** validated.

---

## 4. Quick wins (parallel opportunistic)

- T5, T8, T11, T15 (all **S** effort).
- T6 after T3 text is stable (avoid double edits).

---

## 5. Open decisions (need product-lead before build)

- Recipe `/recipe/[id]` auth-gated in middleware: intentional for SEO/share or change?
- RevenueCat empty offerings: env-only vs product fallback copy?
- Fasting on web: ship stub vs mobile-only forever (**T13**).

---

## 6. Reference paths (known)

- Tier: `src/lib/supabase/serverAnonClient.ts` (`getUserTier`), `app/api/nutrition/photo-log/route.ts`, `voice-log/route.ts`
- Journal web: `src/context/appData/useNutritionJournalState.ts`
- Journal mobile: `apps/mobile/app/(tabs)/index.tsx`, `apps/mobile/lib/nutritionJournal.ts`
- Privacy: `app/privacy/page.tsx`
- Mobile voice errors: `apps/mobile/app/(tabs)/index.tsx` (`submitVoiceTranscript`)
