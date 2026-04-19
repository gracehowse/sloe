# Diversity, Inclusion & Accessibility audit — 2026-04-19

First full platform audit against the newly-authored `diversity-inclusion` specialist agent (`.claude/agents/diversity-inclusion.md`). Covers web + mobile + landing. The agent is tuned for the high-harm areas on a recipe + nutrition platform: diet-culture framing, body / weight dysphoria, dead-name & outing risk, cuisine representation, and WCAG-level accessibility.

## Verdict (at audit time)

**BLOCK** — four P0 items identified. Two shipped in the same session; two remain as backlog because they need product-level shape decisions or multi-week scope.

## Shipped in this session

| Severity | Item | Change |
|---|---|---|
| **P0** | Household dead-name leak | [`src/lib/household/householdClient.ts`](../../src/lib/household/householdClient.ts) now prefers live `profiles.display_name` over the `household_members.display_name` snapshot. A trans user who updates their profile no longer has their legacy name re-served to other members. Pinned in [`tests/unit/householdClient.test.ts`](../../tests/unit/householdClient.test.ts) ("dead-name guard"). |
| **P1** | Default sex field silently assigned to skippers | `INITIAL_DATA.sex` changed from `"female"` to `"unspecified"` in [`apps/mobile/app/onboarding.tsx`](../../apps/mobile/app/onboarding.tsx). The skip-path `calculateTDEE` call now passes `"unspecified"`. BMR math already handles the `unspecified` branch with a midpoint floor ([`src/lib/nutrition/tdee.ts:budgetSafety`](../../src/lib/nutrition/tdee.ts)). Pinned in [`apps/mobile/tests/unit/onboardingInclusionDefaults.test.ts`](../../apps/mobile/tests/unit/onboardingInclusionDefaults.test.ts). |
| **P1** | Icon-only back button on onboarding had no screen-reader label | Added `accessibilityRole="button"` + `accessibilityLabel="Back"` to the chevron Pressable. |
| **P1** | `prefers-reduced-motion` not respected on landing or onboarding | Added a `@media (prefers-reduced-motion: reduce)` block in [`app/(landing)/landing.css`](../../app/(landing)/landing.css) that neutralises the 15+ transitions and the `lp-pulse` infinite animation inside `.lp`. On mobile, `animateTransition` in onboarding now checks `AccessibilityInfo.isReduceMotionEnabled()` and skips the fade when true. Pinned in [`tests/unit/landingReducedMotion.test.ts`](../../tests/unit/landingReducedMotion.test.ts). |
| **P2** | Onboarding unit-toggle ≈8pt-high touch target | Added `hitSlop={{ top: 16, bottom: 16, left: 8, right: 8 }}`, `accessibilityRole="button"`, `accessibilityLabel`, and `accessibilityState={{ selected }}` to the UnitToggle Pressable. Effective touch area now ≥44pt. |
| **P1** | Landing FAQ claim "streak is off by default" does not match shipped behaviour | Rewrote the "Is this a diet app?" FAQ in [`src/lib/landing/content.ts`](../../src/lib/landing/content.ts) to describe actual behaviour: *"A gentle logging streak shows after your first day logged — no pressure, no punishing copy if you miss a day."* The proper Settings toggle to suppress streaks is tracked as a backlog item (below) — the promise now matches reality and doesn't imply a control that doesn't exist. |

## Clean areas (worth pinning so they don't regress)

- **Diet-culture copy** — grep for `cheat / guilt / sinful / naughty / clean eating / earn it / burn off / bad day / be good / slip up / fail` (user-facing) returns zero hits in product code. The only matches are explicit anti-pattern callouts in brand docs and a `FORBIDDEN_TODAY_PHRASES` list guarded by tests. Landing claim *"No ads, no diet culture"* is defensible.
- **Race-proxy language** — zero hits for `urban / inner-city / ethnic / exotic / foreign cuisine` in user-facing strings.
- **Household copy** — zero opposite-sex-partner assumptions (`wife / husband / him or her`). Copy is legal-reviewed in [`src/lib/household/scopeCopy.ts`](../../src/lib/household/scopeCopy.ts).
- **Stripe & push payloads** — checkout metadata carries only `supabase_user_id / tier / period`. No `display_name` leakage to receipts. Push payloads grep-clean for display_name.
- **Recipe author byline** — live-joined from profiles, never snapshotted. This is the pattern the household fix now mirrors.
- **Free tier** — genuinely useful: macro tracking with confidence, recipe import, barcode, cook mode, fibre & water, single-day planner, Apple Health sync. Nutrition value is not paywalled.
- **Religious dietary preferences** — halal + kosher are first-class filters (incomplete — see backlog).
- **Missed-day copy** — factual, not shaming (reviewed in `WeeklyRecapCard`, `progressWeekReport`).

## Backlog — blocked by this audit, unresolved

Ordered by severity first, then scope.

### P0 — hard blockers before ship

#### DI-P0-01 — Add allergen surfacing to recipes
- **Why:** allergen info does not exist as a feature. `nut-free` / `gluten-free` dietary tags are a blunt proxy. Safety concern for users with medical allergies; explicitly called out as P0 in the spec (`allergen hidden` P0 → `allergen missing` is strictly worse).
- **Scope:** new `allergens[]` column on recipes covering the 14 standard allergens (peanuts, tree nuts, milk, eggs, fish, shellfish, soy, wheat, gluten, sesame, sulfites, mustard, celery, lupin). Auto-populate from ingredient list where confident; prompt author on publish. Surface a "Contains" or "Not tagged — verify ingredients" callout on every recipe detail screen (web + mobile). Never paywalled.
- **Owner agents:** `nutrition-engine` (auto-tag confidence model), `data-integrity` (schema + RLS), `legal-reviewer` (FDA-compliant "Contains" / "May contain" wording), `ui-product-designer` (callout placement), `executor` (build).
- **Open question for `product-lead`:** auto-tag confidence threshold vs ask-author-on-publish.

#### DI-P0-02 — Add separate gender identity field + pronouns
- **Why:** product collects only `sex` (F/M/Prefer not to say) labelled "Biological sex". No gender identity field anywhere. Non-binary, genderqueer, and trans users have nowhere to represent themselves. Fix is not to collapse gender+sex — it's to add gender and pronouns as separate optional fields that never feed BMR math.
- **Scope:**
  - Migration: add `gender text null` + `pronouns text null` to `profiles`. No RLS change (profile already RLS-scoped to owner).
  - Settings (mobile `apps/mobile/app/profile.tsx`, web `src/app/` equivalent): expose both fields. Gender options: Woman / Man / Non-binary / Prefer to self-describe (free text) / Prefer not to say. Pronouns: free text.
  - Onboarding: add a single optional "About you" step after Basic Info (or fold gender+pronouns into Basic Info). Both skippable.
  - Copy: pronouns, once set, used consistently in every surface that addresses the user. If we can't use them correctly everywhere, don't ask — pin with a test.
  - Docs: update [`docs/data/schema.md`](../data/schema.md).
- **Owner agents:** `data-integrity` (schema sign-off), `journey-architect` (onboarding placement), `copy-reviewer` (pronoun-correct microcopy pass), `sync-enforcer` (web/mobile parity), `executor`.
- **Open question for `product-lead`:** optional in onboarding vs settings-only launch.

#### DI-P0-03 — Hide weight / trends-only mode on Progress
- **Why:** Progress shows weight across 3 tiles (Weight Card at `progress.tsx:1373-1423`, Weight Projection/Journey at `:1426-1580`, Trend headline tile at `:804-826`). No opt-out. Largest untreated ED-risk / dysphoria surface in the product. Spec requires a hide/trends-only mode.
- **Scope:**
  - Migration: `profiles.weight_surface_mode text default 'show'` — values `show` / `hide` / `trends_only`.
  - Settings: a Progress → Weight surfaces radio (Show / Hide / Trends only). First-run default = show (no regression), but surfaced in Settings.
  - Gate rendering in `apps/mobile/app/(tabs)/progress.tsx` and `src/app/components/ProgressDashboard.tsx`:
    - `hide`: suppress Weight Card, Projection Card; replace Trend tile with an alternate metric (logging consistency or fibre).
    - `trends_only`: render direction + percent-to-goal, suppress absolute kg/lb values.
  - Apply the same mode to Weekly Recap and progress-metric screens that mirror weight.
  - Parity test between web and mobile gating.
- **Owner agents:** `journey-architect`, `ui-product-designer`, `sync-enforcer`, `data-integrity`, `executor`.
- **Open question for `product-lead`:** what replaces the Trend tile in Hide mode — logging consistency, fibre, or hydration?

### P1 — should ship in the same cycle

#### DI-P1-01 — Streak-visibility toggle + Settings exposure
- **Why:** FAQ copy now matches shipped behaviour (streaks show after first log). The proper control is a Settings toggle so users who find streaks activating can disable them. Spec calls for streaks to be opt-in.
- **Scope:** `profiles.streak_display_enabled boolean default true` (no regression). Settings → Progress → "Show logging streak" toggle. Gate `TodayStreakInsightCard`, the streak tile on Progress, and the streak line in `WeeklyRecapCard`. Consider flipping default to `false` once the toggle exists and marketing claim is re-aligned.
- **Owner agents:** `journey-architect`, `copy-reviewer` (re-align FAQ if default flips), `executor`.

#### DI-P1-02 — Soften onboarding projection headline on "Lose" branch
- **Where:** `apps/mobile/app/onboarding.tsx:872-902` — 28pt *"You could reach [weight] by [date]"*.
- **Why:** reinforces deficit-as-virtue framing for a user who may have drifted into "lose" out of habit.
- **Scope:** rewrite to factual: *"At [pace] pace, this plan reaches your goal around [date]."*. Reduce font weight emphasis. Owner: `copy-reviewer` + `ui-product-designer`.

#### DI-P1-03 — Web Progress dashboard parity on hide-weight
- Tied to DI-P0-03. Same gating on `src/app/components/ProgressDashboard.tsx`.

### P2 — quality improvements

#### DI-P2-01 — Expand religious dietary preferences
- Add `jain`, `hindu-vegetarian`, `buddhist-vegetarian` to [`src/constants/dietaryPreferences.ts`](../../src/constants/dietaryPreferences.ts).
- Consider a separate "fasting windows" concept (Ramadan, Lent) if it affects meal planning.

#### DI-P2-02 — Explain BMR safety floor for `unspecified` sex
- `src/lib/nutrition/tdee.ts:100-107` uses a midpoint (1350 kcal) for `unspecified`. A non-binary user hitting the caution threshold has no way to know the threshold was chosen for them. Owner: `nutrition-engine` — surface an "Adjust safety floor" advanced option or a one-line explanation.

#### DI-P2-03 — "Why we ask" helper under the Biological sex step
- Current helper: `"Used for BMR calculation only"`. Expand to: *"We use this to estimate your resting metabolic rate. You can skip this or change it anytime in Settings. If you pick 'Prefer not to say' we use a midpoint estimate."* Owner: `copy-reviewer`.

#### DI-P2-04 — Regional currency on Stripe + RevenueCat
- `src/lib/landing/content.ts` prices are GBP-only. A US / INR user sees GBP. Owner: `monetisation-architect`. Confirm launch-market policy before action.

#### DI-P2-05 — Household push payloads: outing-risk pre-ship review
- When meal-add / shared-list push notifications ship, the payload must not include other members' `display_name`. Add a checklist item to `release-gate`.

### P3 — forward-looking

- **Cuisine categorisation** — currently absent; if added, use respectful origin-specific names (Filipino, Sichuan, Persian, Korean, Nigerian), never `Asian / ethnic / international`.
- **Landing imagery** — currently SVG mocks (safe). When human photography ships, route through `diversity-inclusion` for tokenism review.
- **English-only honesty** — optional landing FAQ line: *"Suppr is English-only today. Localisation is not on the roadmap."*

## Links

- Agent definition: [`.claude/agents/diversity-inclusion.md`](../../.claude/agents/diversity-inclusion.md)
- Pricing + billing decisions: [`2026-04-19-pricing-v1.md`](./2026-04-19-pricing-v1.md), [`2026-04-19-billing-architecture-pattern-a.md`](./2026-04-19-billing-architecture-pattern-a.md)
