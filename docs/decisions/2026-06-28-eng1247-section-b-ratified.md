# ENG-1247 — Section B product calls ratified (Grace, 2026-06-28)

**Area:** Sloe v3 prototype conformance  
**Status:** Resolved (binding for ENG-1247 completion)  
**Tracker:** `docs/planning/2026-06-24-eng1247-conformance-backlog.md` §B

Grace ratified the structural backlog via in-session product Q&A (2026-06-28). All other §B items without an explicit override adopt the **`[recommended]` option** from the planning backlog (same session, agent default rule: "ask Grace or use recommended").

## Explicit Grace calls (2026-06-28)

| ID | Decision | Grace's choice |
|----|----------|----------------|
| **B1** | AdjustConstraints sheet | **A — Build** the v3 sheet + restore the sliders header button (supersedes interim option C that removed the button) |
| **B2** | AdaptiveTDEE screen | **B — Keep inline** explainer + recap; fix/relabel dead "Why" affordances (no full AdaptiveTDEE screen for launch) |
| **B3** | BatchCook | **Build minimal v1** — batch scaling + shopping-list scale (backlog option C scope); **explicitly excludes** assign-portions day×meal planner + fridge pip tracker (full prototype phase 2) |
| **B6** | Profile | **A — Read showcase** Profile; move editing into Settings/sub-sheets — **mobile shipped** behind `profile_showcase_v1`; **web read showcase follow-up** |
| **A2b** | ConfirmFood macro grid | **Mix** — prototype 3-tile P/C/F row **plus** keep the richer micro table below |

## Ratified at recommended default (no override needed)

| ID | Outcome |
|----|---------|
| B4 | Keep search-first LogSheet; borrow rounded-square method tiles only |
| B5 | Keep Targets dashboard + delegated edit |
| B7 | Keep household sharing-grid |
| B8 | Keep Figma 284:2 paywall; v3 Paywall non-canonical |
| B9 | Keep distributed coach pieces; unified Coach screen superseded (ENG-923) |
| B10 | Web BurnDetail inline-only; delete orphan panel when touched |
| B11 | Keep scoped provenance sheet + web trust chips |
| B12 | Keep live CreateRecipe source set |
| B13 | Keep OCR inside custom-food; standalone ScanLabel deferred (ENG-1004) |
| B14 | Keep web host-surface meal editing |
| B15 | Add import clear (×) button on multiline paste |
| B16 | Adopt confidence-dot + review-banner grammar on import review rows |
| B17 | Keep full PlanImport pipeline; token conforms only |
| B18 | Add MFP named-tracker reassurance strip or grid (MFP-exodus moment) |
| B19 | Keep auto CSV column mapping |
| B20 | Mobile GoPublic attestation sheet (web ✅ shipped) |
| B21 | Add WeeklyRecap "The detail" rows + lift web to mobile richness |
| B22 | Weekly Digest on Progress supersedes morning Digest screen |
| B23 | Add Health import-depth control to weight/Health settings |
| B24 | Keep tabbed PlanTemplates dialog |
| B25 | Keep two direct export buttons |
| B26 | Build 3-step DeleteAccount sheet (reason + export-first + type-DELETE) |
| B27 | Storefront-owned billing canonical |
| B28 | Add ResetPlan keep/clear confirm sheet |
| B29 | No CalendarPicker — week strip sufficient |

## Section D — already binding (do not re-litigate)

See planning backlog §D (18 items): WinMoment gold ring, Today ring IA, LogSheet search-first, Paywall storefront, Settings web carve-out, etc.

## Execution order toward 100%

1. **Shipped this branch:** B1 AdjustConstraints sheet + sliders button; B2 Why link from energy equation; backlog doc sync.
2. **Next PRs:** B3 BatchCook minimal v1; B6 Profile showcase; A2b ConfirmFood mix; RecipeDetail method steps + review banner (flag path).
3. **Then:** B15–B16 import affordances; B18 MFP strip; B26/B28 destructive flows; remaining autonomous §A items.
4. ~~**Mark 🔒** every ratified keep-current row in `conformance-backlog.md`~~ — ✅ Done 2026-06-28 (33 🔒 + resolution registry).
5. **Ramp flags** after two-week hold at 100%.

## Follow-up tickets (file in Linear when connected)

- **ENG-1254** — Plan calorie-floor slider → generation algo hook (UI ships in AdjustConstraints; algo clamp deferred).
- **ENG-1255** — BatchCook minimal v1 (Grace scope 2026-06-28).
- **ENG-1256** — Profile read showcase + Settings editor split.
- **ENG-1257** — ConfirmFood P/C/F tiles + micro table mix.
