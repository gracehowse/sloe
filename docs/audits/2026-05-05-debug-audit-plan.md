# In-depth debug audit — action plan (2026-05-05)

> **Status:** PLAN ONLY. Awaiting Grace's review. **No code changes
> until approved.** This document defines what to look for, how to
> look, and how to prove a fix landed — not what to fix.
>
> **Trigger:** Grace's 2026-05-05 sim review surfaced three bugs in
> the same session (Today deficit mismatch, recipe-import vendor-name
> leak, calorie-ring CI test drift). All three were live-product
> bugs that automated tests didn't catch. This plan exists to
> systematically hunt the rest of the same shape.
>
> **Distinct from** the morning's `2026-05-05-full-sweep/` audit,
> which was a breadth scan of findings. This audit is a **depth
> scan** for math errors, copy/state drift, leaked internals, and
> contradiction-on-same-screen bugs.

---

## 1. Why this audit, why now

The three bugs we just fixed share a theme: **two surfaces presenting
related-but-differently-computed values**, where neither was wrong in
isolation but they contradicted each other in front of the user.

- **Today deficit:** banner used `goal − consumed`, Activity Bonus
  used `burn − consumed`. Both labelled "deficit". Wrong number,
  same word.
- **Import error:** OpenAI rate-limit (correct internal fact)
  rendered as user-facing text including the vendor name + HTTP
  status. Right diagnostic, wrong audience.
- **Ring CI test:** test pinned an older two-state mapping;
  shipped product runs three-state. Test was right at write-time,
  wrong now.

In every case the failure mode was **drift between two co-evolving
things that should have been one thing**. This audit looks for more
of that drift.

## 2. Scope (what we audit) and out-of-scope (what we don't)

### In scope

1. **Today screen** (web + mobile) — every number, every label,
   every state.
2. **Recipe import** (Instagram, TikTok, URL, image, MFP CSV) —
   every error path, every retry, every empty-state.
3. **Meal nutrition detail page** — already partially audited
   today (Fiber/Water fix). Re-audit with new lens.
4. **Onboarding** — gated to canonical `/onboarding` route only.
5. **Pricing surfaces** (web `/pricing`, mobile paywall) — region,
   currency, tax, default billing period.
6. **Calorie ring colour states** across all surfaces that render
   one (Today hero, Today week-strip, plan view, recipe nutrition
   summary, weekly-recap card).
7. **Streak / habit surfaces** — chip on Today, post-onboarding
   notification, weekly digest.
8. **Logged-meals list and meal cards** on Today.
9. **You / More / Profile surfaces** — settings, delete account,
   household, connected.
10. **Activity / burn surfaces** — Activity Bonus card, burn detail
    panel, steps card, AppleHealth empty-state.

### Out of scope (this pass)

- Plate-loop v2 (schema-blocked per memory)
- Move-meal web parity (deferred per memory)
- Recipe Go-Public mobile parity (web-only by design per memory)
- Android (iOS-only product per memory)
- Plan tab redesign (not yet stable)
- Notion-mirror automation
- Any infra / CI / lint cleanup that doesn't surface a user bug

### Explicit non-goals

- **No new features.** Any "this would be better as X" goes to a
  separate roadmap item, not this audit.
- **No refactors-for-aesthetics.** Only refactors that close an
  observable bug.
- **No copy polish without a bug.** Copy edits land here only when
  there's an actual contradiction or wrong label.

## 3. Methodology

### 3.1 Five inspection lenses, applied per surface

| Lens | What it asks | Examples of what it would catch |
|---|---|---|
| **Math** | Do all numbers on this screen agree? Does each formula appear exactly once? | Today deficit (just fixed). Macro % rounding to 101%. Steps progress bar overflow. |
| **Copy / label** | Does the label match what the number actually represents? Any vendor names, codes, raw statuses, dev jargon? | "OpenAI API error: 429" (just fixed). "deficit" labelling budget-remaining. "TDEE" without explanation. |
| **State** | Does the surface render correctly in **all** states — empty, loading, partial, error, full, over-limit, no-permission, offline? | Banner shows when burn data is 0. Empty-state CTA leads nowhere. Error toast persists after retry succeeds. |
| **Cross-platform** | Does the equivalent surface on the other platform agree on math, label, behaviour? | Web shows monthly default, mobile shows annual default (intentional carve-out per memory — verify the carve-out is still desired). |
| **Time / timezone** | Does the surface compute correct values for users in non-UTC zones, around midnight, around DST, on the boundary of "today"? | UTC vs local-time day-key (just fixed in TodayDeficitInsight). Streak chip flipping at UTC midnight in PT. |

### 3.2 Walk pattern per surface

For each in-scope surface:

1. **Read** the source file(s).
2. **Grep** for every number rendered. List the formula behind
   each. Look for duplicates (same number computed two ways).
3. **Capture "before" screenshot** — current shipped state on the
   sim (mobile) or local Next dev (web). Filename
   `BEFORE-<surface>-<state>-<platform>.png`.
4. **Inspect** through the five lenses above.
5. **Document** any finding inline in this audit's findings
   doc (created on approval). Each finding has:
   - Title (≤80 chars, action-shaped)
   - Severity (P0 user-broken / P1 confusing / P2 polish)
   - Surface(s) affected
   - Lens(es) that caught it
   - Evidence (file path + line, screenshot if visual)
   - Proposed fix sketch (1-2 lines, NOT implementation)
   - Expected "after" screenshot description
6. **Flag** any finding that's a math/state/timezone bug as a
   candidate for an automated test pin (so it can't regress).

### 3.3 Visual validation rubric

Every UI finding in this audit needs **two screenshots**:

- **BEFORE** — captured before any fix, showing the exact bug.
  Filed under `docs/audits/2026-05-05-debug-audit-plan/before/`.
- **AFTER** (on fix-approval, captured during implementation) —
  same surface, same state, same data fixture, post-fix.

Naming: `<surface>-<state>-<platform>.png`. Sim
device: iOS 26.4 (per memory — avoids the iOS 18.4 NAT wedge).
Web: 1280×800 viewport via the existing `tests/e2e/screenshots/`
playwright tour. **No mocked data** — use a fully-onboarded test
account so all numbers are realistic.

Findings without before/after captures are **rejected** at fix-
approval time, per the 2026-05-03 visual-validation rule.

## 4. Areas to inspect (the actual checklist)

This is the list of surfaces and the questions to ask in each.
**Each row is a question, not a verdict.** The audit's job is to
walk this and turn each row into a found-or-clean answer.

### 4.1 Today (mobile + web)

| # | Question | Lens |
|---|---|---|
| T01 | Does every kcal number on the screen agree on what `consumed` means? (eaten only? eaten + activity-adjusted goal? signed? abs?) | Math |
| T02 | Does macro % (e.g. "7% of macro calories") sum to ≤101% across protein/carbs/fat? Off-by-rounding in the Macro card? | Math |
| T03 | Does macro `Xg / Yg` `remaining` always equal `Yg − Xg`? (Or does it use a separate remaining-prop that can drift?) | Math |
| T04 | Calorie ring stroke colour state-table: empty / under / at-target / over — colours across web + mobile? Is `at-target` ambiguous (success or warning)? | State |
| T05 | Centre-digit (`727 LOGGED` vs `405 REMAINING` vs `200 OVER`) — does the label match what the number actually shows in every mode? | Copy |
| T06 | When `consumed === 0` and `goal > 0` — does the ring show gradient (welcome) and not solid green (false-success)? Both platforms? | State |
| T07 | Quick-log strip: does it always show the same three items as the actual logged-meal list below? Drift between source-of-truth and the strip? | Cross-surface |
| T08 | "Snap a meal" CTA — is it shown on every empty-day, hidden when user has logged today, or always-on? Confirm intent matches code. | State |
| T09 | "30-day streak" chip — what counts as a "day" (UTC vs local)? Does it correctly flip at local midnight? | Time |
| T10 | "30-day streak" chip — does the count match the post-onboarding push and the weekly recap card? | Cross-surface |
| T11 | Activity Bonus 4th tile (`Maintenance`) — does the popover BMR breakdown match the underlying TDEE calc? Are activity-multiplier, sex, height, age all read from the same profile source? | Math |
| T12 | "Calorie goal for this day: X kcal" — does X equal what the ring's `goal` prop is? | Math |
| T13 | Net deficit / surplus colour — green for deficit, amber/destructive for surplus — applied consistently? When `consumed === 0` does it correctly show neutral grey (per memory)? | State |
| T14 | 7-day rolling: does avg × 7 ≈ weekly? Does projected loss math (`weekDeficit / 7700` or `/ 3500`) match what onboarding promised? | Math |
| T15 | Week-mode (Sunday-start vs Monday-start) — does the strip's first day match the user's weekStartDay setting? | State |
| T16 | Why-this-number explainer (linked from the ring) — does the breakdown it shows actually equal the headline number? | Math |

### 4.2 Recipe import (mobile + web)

| # | Question | Lens |
|---|---|---|
| I01 | Every error path: does the user-facing string contain a vendor name (OpenAI, FatSecret, Supabase, Instagram), an HTTP status, or a stack trace? | Copy |
| I02 | Rate-limit (429) — does the UI surface a `Retry-After` hint or a "try again in N seconds"? Or just a static "try again later"? | State |
| I03 | Empty caption (no text, video-only) — does the importer fail loud with a coherent message, or silently render an empty recipe? | State |
| I04 | Successful import but `verifyIngredients` failed — what does the user see? Confidence indicators? | State |
| I05 | Image import retry-without-image fallback — does the user know it fell back to text-only? Confidence delta surfaced? | Copy |
| I06 | Network failure mid-import — does the UI roll back the optimistic state, or leave a half-saved draft? | State |
| I07 | Cross-platform: mobile shares the same error → message map as web? Or do mobile + web hand-roll their own copy? | Cross-platform |
| I08 | TikTok / Instagram detector — does it correctly classify the URL on first paste, or only after submit? | State |

### 4.3 Meal nutrition detail (mobile)

| # | Question | Lens |
|---|---|---|
| M01 | Macro card sums (Protein% + Carbs% + Fat%) — always ≤100% after rounding? | Math |
| M02 | "Vitamins, minerals & more" count line ("11 of 35 fields published") — does it match the actual rendered rows? Any miscounted Not-published row? | Math |
| M03 | Per-portion vs per-serving — `Portion ×N` — does multiplying the displayed values by the source-portion-size give back the database row? | Math |
| M04 | Source label (`apple_health`, `usda`, `fatsecret`, `manual`) — every source string is human-readable? Or do raw IDs leak? | Copy |
| M05 | Edit → save round-trip: does the page render exactly the same numbers post-save? (Test for floating-point drift.) | Math |

### 4.4 Calorie ring (every render site)

| # | Question | Lens |
|---|---|---|
| R01 | List every component that renders a circular calorie progress ring across web and mobile. (Today hero, Today week-strip, plan view, recipe summary, weekly recap.) Do they all use the same colour state-table? | Cross-platform |
| R02 | At exactly `consumed === goal` — green or warning? Confirm intent on each renderer. | State |
| R03 | When `goal === 0` (e.g. user without onboarding profile) — does the ring render a sane default or NaN/Infinity? | State |
| R04 | Empty-state opacity (currently 0.18) — visible on light mode AND dark mode? On both Mobile and Web? | Visual |

### 4.5 Pricing & paywall (web + mobile)

| # | Question | Lens |
|---|---|---|
| P01 | UK / EU user — is the price displayed VAT-inclusive (per memory)? Stripe Tax in inclusive mode? | Math + Legal |
| P02 | Default billing period — web monthly, mobile annual (per memory) — both surfaces correctly defaulted? | Cross-platform carve-out |
| P03 | Currency selection — does region drive currency, or is the UI hardcoded to GBP? | Math |
| P04 | Monthly → annual toggle: does the per-month-equivalent number match `(annual / 12)` exactly? | Math |
| P05 | Free → Pro upgrade CTA: does the post-upgrade state immediately reflect the upgrade, or does the user need to refresh? | State |

### 4.6 Onboarding (mobile + web)

| # | Question | Lens |
|---|---|---|
| O01 | Mobile deep-link `suppr:///onboarding-v2` — still dead per the morning's sweep? Confirm or close. | Repo |
| O02 | Onboarding step counter — `Step X of Y` on each step matches the actual route order? | Math |
| O03 | TDEE calculation displayed at end of onboarding — equal to what Today screen uses on day 1? | Math (cross-surface) |
| O04 | Pace-floor soft-warn copy — when triggered, does the user see ONE warning, or repeat-fire each time they re-enter the step? | State |
| O05 | Welcome screen platform divergence (web "Join the Suppr Club" vs mobile copy) — confirm carve-out is intentional per memory. | Cross-platform |

### 4.7 Streak & habit (mobile)

| # | Question | Lens |
|---|---|---|
| S01 | Streak chip count on Today vs the count surfaced in the post-onboarding push vs the weekly recap card — agree? | Cross-surface |
| S02 | What rule resets a streak? Logging zero meals? Logging fewer than N? Closing the app? Document and verify in code. | State + Copy |
| S03 | Streak around DST boundary — does the day count off-by-one? | Time |

### 4.8 Settings / Profile (mobile)

| # | Question | Lens |
|---|---|---|
| Y01 | Delete-account flow — already wired per memory. Confirm the confirmation copy, the post-delete experience, and that no orphan rows remain (data-integrity sign-off). | Legal + State |
| Y02 | Logout → re-login: does Today render the correct state for the actual user, not a cached previous user? | State |
| Y03 | Household membership state changes — when removed from a household, does the UI immediately reflect solo state? | State (cross-surface) |
| Y04 | Connected (Apple Health) toggle — does the burn data immediately appear on Today, or after a sync interval? Match what the empty-state instructs the user. | State |

### 4.9 Activity / burn surfaces

| # | Question | Lens |
|---|---|---|
| B01 | Steps progress bar — when `steps > 10000` (over goal), does the bar overflow the container, max at 100%, or render correctly? | State |
| B02 | Active-energy reading — Apple Health reports active-only or active+resting? Confirm we're not double-counting basal. | Math |
| B03 | Workouts list ordering — chronological? Most-recent-first? Match the actual Apple Health log. | State |

## 5. Sequence and timeboxing

Single audit run, in this order:

1. **Today (T01–T16)** — highest user-visible surface, source of all 3 today's bugs.
2. **Calorie ring (R01–R04)** — touches everything else.
3. **Recipe import (I01–I08)** — second cluster of recent bugs.
4. **Meal nutrition (M01–M05)** — partial audit already done; finish.
5. **Pricing (P01–P05)** — legal + math heavy.
6. **Activity / burn (B01–B03)** — small surface.
7. **Onboarding (O01–O05)** — verify against morning's sweep.
8. **Streak (S01–S03)** — small.
9. **Settings (Y01–Y04)** — finishes the round.

Estimated walk time per area: 30–60 min including BEFORE captures.
Total walk: ~6–8 hours of focused work, single session.

## 6. Output of this audit (when run)

A single document at
`docs/audits/2026-05-05-debug-audit/findings.md` containing:

- Per-area, per-question result (clean / finding / deferred).
- A prioritised punch-list of fixes, each with severity, surface,
  lens, evidence, proposed-fix sketch, and BEFORE screenshot link.
- A separate "automation candidates" list — bugs that should
  produce a regression test pin alongside the fix.
- A separate "deferred to roadmap" list — items that are real but
  shouldn't be fixed in this pass.

## 7. Acceptance criteria (audit-done)

- Every question in §4 has a checked answer (clean / finding /
  deferred-with-reason). No silent skips.
- Every finding has a BEFORE screenshot.
- Every finding has either a proposed fix OR an explicit
  "deferred — see roadmap" with a one-line reason.
- The findings doc is committed to the repo.

## 8. What I will NOT do until you approve this plan

- Edit any product code.
- Edit any test (other than the three already shipped).
- Run any sim flow that mutates user data.
- Mirror anything to Notion.

What I WILL do, on your approval:

- Walk §4 in order.
- Capture BEFORE screenshots into the audit directory.
- Produce the §6 findings doc.
- Stop and ask for fix-batch sign-off **before** changing any
  product code.

---

**Decision needed from Grace:** approve / reshape / reject. If
approve, also confirm:

1. iOS sim + web localhost as the capture environment (not
   TestFlight build, not preview deploy).
2. Findings doc location: `docs/audits/2026-05-05-debug-audit/`
   (this plan would move into that dir as the prelude).
3. Whether to include the deferred-from-morning items
   (`onboarding-v2` deep-link, DMCA/licences middleware) in this
   run, or treat them as out-of-scope because the morning sweep
   already catalogued them.
