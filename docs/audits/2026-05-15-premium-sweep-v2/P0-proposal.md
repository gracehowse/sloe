# P0 proposal table — cold-open surfaces

**Status:** EMPTY (populated after S1 audit run)
**Bucket size:** ~25 surfaces
**Capture set:** `docs/audits/2026-05-15-premium-sweep-v2/captures/P0/`
**Auditor report (S1 output):** `docs/audits/2026-05-15-premium-sweep-v2/P0-auditor-report.md`

---

## In-flight tripwire

- Items in this bucket: **0** (table not yet populated)
- Reverts so far: **0 / 2**
- On 2nd revert: bucket pauses; mini-retro required at
  `docs/audits/2026-05-15-premium-sweep-v2/P0-tripwire-retro.md`,
  and Grace must approve resuming before any further row touches code.

---

## Surface scope (~25)

### Web
- `app/(landing)/LandingPage.tsx` — Landing page
- `app/pricing/page.tsx` — Pricing
- `app/login/ui.tsx` — Login
- `app/signup/page.tsx` — Sign up entry
- `app/signin/page.tsx` — Alternative sign-in
- All 17 web onboarding step screens under
  `src/app/components/onboarding/steps/` — welcome, signup, weight,
  height, age, sex, activity, goal, diet, pace, strategy, recipes,
  data-bridges, permissions, import, reveal
- Web Today first-render (no logs) at `app/today/page.tsx`
- Upgrade paywall dialog: `src/app/components/suppr/upgrade-paywall-dialog.tsx`
- AI paywall dialog: `src/app/components/suppr/ai-paywall-dialog.tsx`
- Checkout success: `app/checkout/success/page.tsx`

### Mobile
- `apps/mobile/app/login.tsx` — Login
- `apps/mobile/app/onboarding.tsx` — Onboarding entry
- All 16 mobile onboarding step screens under
  `apps/mobile/components/onboarding/steps/`
- `apps/mobile/app/paywall.tsx` — Paywall
- `apps/mobile/components/AiPaywallSheet.tsx` — AI paywall
- Mobile Today first-render (no logs) at `apps/mobile/app/(tabs)/index.tsx`

---

## Capture map

Filled at S1 capture-OK (G1) — each surface gets `-light.png` and
`-dark.png` filenames. Maps to Maestro flow / Playwright spec invoked.

| # | Surface | Light capture path | Dark capture path | Source flow / spec |
|---|---|---|---|---|

(empty — populated at S1)

---

## Proposal table

**Schema:** every row must fill every column. NEW rows with empty
`What it duplicates / weakens` fail at G3. DC-touched rows require an
explicit non-violation statement in `DC# touched`.

`Item type`: SUBTRACT / TIGHTEN / REPLACE / NEW
`Complexity`: cleanup (<1h) / refactor (1-4h) / new build (>4h) / design-needed
`Status` lifecycle: proposed → approved → in-progress → implemented → sim-validated → `[x]` (or → rejected / reverted)

| # | Surface | Item type | What changes | What it duplicates / weakens | Before screenshot path | After-target description | Affected platforms | DC# touched | Auditor verdict | Complexity | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|

(empty — populated at S2 from S1 auditor report)

---

## Refuse-to-pass (sub-list)

Filled from S1 auditor report. Items here block bucket close at G5.

(empty)

---

## Defended Choices touched (sub-list)

Filled from S1 auditor report — any P0 surface that's a DC gets a
preservation card here so G3 review can verify load-bearing bets stay
intact.

(empty)
