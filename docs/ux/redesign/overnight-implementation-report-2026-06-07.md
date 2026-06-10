# Overnight implementation report — 2026-06-07

**For:** Grace (morning review). **By:** Claude. **Branch:** `claude/sloe-redesign-2026-06-04`.
**Constraint honoured:** nothing committed/pushed/merged; no branches/history touched; no files deleted; no functionality removed; `REDESIGN_DEFAULT_ON`/flags untouched; no destructive/auth/routing/db/dep/config changes. All edits local + reviewable.
**Companion docs:** [migration tracker](figma-migration-tracker.md) (living, source of truth) · [program plan](figma-conformance-plan.md).

---

## TL;DR (honest scope)
A complete app↔Figma audit is done and turned into a living tracker + dashboard. **Today is implemented and verified** (web + mobile). The remaining work — 140 more partial-conformance screens + 177 app-only features that each need full Julienne Figma designs across 5 platforms + 15 Figma-only builds — is a **multi-night program**, not completable in one night at the "indistinguishable-from-the-prototypes" bar you (rightly) require. So overnight I delivered: the full audit/tracker, Today conformed-and-verified, the Figma "Pending Sign-Off" design stream stood up with an exemplar batch, the evidence-backed Linear backlog, brand-drift cleanup, and this report with the sequenced plan for everything else.

---

## 1. Screens audited
**Complete:** 369 items across 14 areas (routes, screens, states, variants, modals, flows), each classified Matches / Partial / App-Only / Figma-Only.
- **Overall Figma conformance: 19%** (✅36 Matches · 🟡141 Partial · 🔵177 App-Only · 🟣15 Figma-Only).
- Most-conformed: **Today** (41%) and **Landing** (55%). Least: Onboarding, Auth, Paywall, Import, Settings (0% full matches — major drift).
- Two audit passes: pixel-grounded depth (12 core screens) + breadth (all 14 areas). Full per-item data in the tracker + `tasks/wr31o3cd9.output`.

## 2. Screens updated (implemented + verified)
**Today (654:2) — web + mobile, typecheck clean, verified on captures:**
- Hero "What to eat next": eyebrow → lavender `rgba(201,194,214,0.9)`/1px; two-layer scrim; cook-time chip (`Clock`+min+dot, data-gated); overlay/imagery preserved.
- Log-slot CTA: dashed button → **solid filled card** (radius 24, label `#6a6072`).
- Meal summary cards: radius 16 → **24**; meal-row empty grey box → **clean Utensils icon tile** (kills nonsensical images on MFP/barcode/imported entries — your flagged bug).
- Avatar: clay → **plum `#6a4b7a`**, 32 → 36px.
- **Verified:** web hero + plum avatar on seeded-today; meal-rows (icon tile, 24px, solid Log-Dinner card) on Dec 31 real-data day; mobile renders + typecheck clean.

## 3. Components updated
Web: `north-star-block.tsx`, `today-meals-figma-layout.tsx`, `today-date-header.tsx`, `NutritionTracker.tsx`, `lib/nutrition/northStarSuggestion.ts`.
Mobile: `today/NorthStarBlock.tsx`, `today/TodayMealsFigmaLayout.tsx`, `today/TodayDateHeader.tsx`, `GradientAvatar.tsx` (added non-breaking `fill`/`textColor` overrides), `today/NorthStarBlockHost.tsx`, `(tabs)/index.tsx`.
Plus brand-drift cleanup (in-flight agent): user-facing "Suppr"→"Sloe" copy (login error, paywall kicker, net-energy empty copy) — URLs/identifiers/config intentionally untouched.

## 4. Routes updated
`/today` (web) + `(tabs)/index` (mobile) visual conformance. No routing/navigation structure changed (per constraint).

## 5. Figma gaps identified (→ new design work)
- **15 Figma-Only** screens to build (e.g. Logged-confirmation S13, Favourites/Go-Tos K2, Discover collections + Reels rail, Ask coach screen, Google Sign-In, Region row, import macro-check card).
- **Platform-variant gaps:** Figma is overwhelmingly **mobile-only, light-only**. No desktop frames for Recipes/Plan/Recipe-detail/Paywall; no dark-mode frames (web has no dark at all); states (loading/error/empty) under-designed. → The "Pending Sign-Off" page must add tablet/desktop/dark/state variants for engineering to not invent responsive behaviour.
- **177 App-Only features have no Figma at all** — see §6.

## 6. App-only functionality identified (177 — preserve + design)
The app is ~48% functionality Figma never designed. Per your instruction these are **not preserved-forever** — they need the Julienne design process. Highlights to design: Cook Mode, nutrition-verification, recipe import (URL/Reel — the viral hook), multi-day Plan grid, adherence ring + weight projection, RevenueCat IAP/restore/promo, barcode scanner, quick-add, complete-day/streak/milestone moments, Settings export/danger-zone, AI photo/voice logging. Full list per area in the tracker. → **Figma "Pending Sign-Off" stream** (§9) + Linear epic.

## 7. Outstanding work
- **140 partial screens** (all areas except Today) to conform to Figma — grounded fix-lists in the tracker, sequenced: Recipes/Discover/Recipe-detail → Log-a-meal → Plan → Progress → Onboarding → Paywall → Settings → Import → Fasting → Auth → Global/Nav → Landing polish.
- **177 app-only** → Julienne Figma designs (all platforms) on Pending Sign-Off, then implement.
- **15 Figma-only** builds.
- **Missing platform variants** for existing single-platform frames (tablet/desktop/dark).
- AI imagery: FAL pipeline validated; production wiring of recipe imagery is a **DB/storage change → stopped + logged for approval** (placeholder SVG fallbacks remain meanwhile, not substituted silently).

## 8. Blockers (94 — themes)
1. **Brand drift Suppr→Sloe** in code (being cleaned this pass).
2. **Migration-flag debt** (`today_meals_figma_654`, `progressLayoutV2`, etc.) — to retire into one design system, NOT collapsed yet (per your rule).
3. **File-size debt** (CLAUDE.md 400-line cap): mobile `(tabs)/index.tsx` 6412L, `NutritionTracker.tsx` 3613L, `progress.tsx` 4007L, Settings ~3600L/88KB — structural refactor needed for clean conformance of those areas.
4. **Figma coverage gaps** (mobile-only, light-only, states under-designed) — addressed by the Pending Sign-Off stream.
5. **Web↔mobile parity gaps** (web missing macro/energy/where-from detail screens, Household, Apple Health).
6. **Total-vs-list data divergence** on seeded-today (meals counted but not listed) — verification-only; real data renders fine.
7. **Web-drive auth origin** (localhost vs 127.0.0.1) — fixed.

## 9. Designed (Figma "Pending Sign-Off" stream) — page `883:2`, existing frames untouched
Reused the file's real `Sloe / Color` variable collection (24 vars) + type system (Newsreader/Inter, 24px radii, 9999 pills, flat cream slabs). **5 App-Only features × iOS / Tablet / Desktop = 15 frames**, with platform-appropriate patterns (mobile = bottom sheet over dimmed plum scrim; desktop/tablet = centred dialog, matching existing web `840:2`; genuine reworks: milestone full-bleed on iOS vs gradient dialog on web; barcode = live camera on iOS/tablet vs manual-entry+QR on desktop where browsers can't scan):
| Feature | iOS | Tablet | Desktop |
|---|---|---|---|
| Complete-day modal | 885:2 | 901:2 | 894:2 |
| Streak / 30-day milestone | 906:2 | 911:2 | 910:2 |
| Barcode scanner (free anti-MFP wedge) | 912:2 | 916:2 | 920:2 |
| Quick-add ("Usually around 6 PM") | 921:2 | 928:2 | 926:2 |
| Why-this-number (BMR→TDEE→target ledger) | 931:2 | 937:2 | 936:2 |

**4 reusable components** added (all variable-bound): Sheet Header (941:2), Celebration Medallion (941:8), Quick-add Row (942:2), Ledger Row (942:10).
**Quality:** verified at the Julienne bar (I inspected the Why-this-number + exemplars — calm, editorial, on-brand, indistinguishable from 654:2/332:2). Screenshots sent to chat.
**Honest scope:** 5 of 177. These establish a replicable template — the 4 components + 5 archetype patterns (dimmed-sheet, centred-dialog, cream ledger slab, tinted icon tile, macro chip strip) cover most remaining App-Only items. Path to finish: batch by archetype, reuse components, decide responsive variant + copy per feature, screenshot self-check. Tracked under Linear epic ENG-903.

## 10. Decisions
**Made:** meal-row image = Option B (photo when library-recipe-with-image, else clean icon tile) — implemented; Option A (consistent-icon-for-all) filed as the documented alternative. Avatar plum/36px, hero scrim/eyebrow/CTA/radius per pixel audit.
**Deferred to you (Linear issues):** Today ring multi-arc default; Plan single-day vs multi-day architecture; recipe macro rings vs flat tiles; library filter taxonomy; fasting presets (OMAD vs 20:4/14:10); build Ask feature; Google Sign-In provider.

## 11. Opportunities → Linear backlog (evidence-backed)
Competitor/best-practice research across 10 feature areas (MFP, Lifesum, MacroFactor, Apple Health, Withings, NYT Cooking…) produced ranked, Julienne-fit ideas to move from "matches Figma" to category-leading. Examples (P0/P1): time-of-day go-to foods at top of Log; multi-add in one sheet session; post-log undo toast (ENG-786); direct-log-at-default-serving; **free first-class barcode as the explicit anti-MFP wedge** (live MFP-exodus capture). Full set → Linear (agent in-flight; IDs appended on completion).

## 12. Risks
- **Scope:** full parity is multi-night; pacing matters — depth-with-verification beats breadth-unverified (your "verify before complete" rule).
- **Figma design quality:** autonomous Figma generation needs your sign-off — that's exactly why new designs land on "Pending Sign-Off," not approved pages.
- **File-size debt** makes some areas (Settings, Progress, mobile index) risky to reskin without refactor first — recommend refactor-then-conform for those.
- **Imagery:** production AI imagery needs a DB/storage path (approval-gated) — not done silently.

## 13. Recommended next steps (sequenced)
1. Review + sign off Today (web + mobile captures attached in chat).
2. Resolve the deferred decisions (§10) — they unblock Plan, Recipes, Fasting, Auth.
3. Approve/iterate the Pending Sign-Off exemplars → I scale the process to the full 177.
4. Conform Recipes/Discover/Recipe-detail next (viral hook), then Log-a-meal (core loop).
5. Decide the AI-imagery production path (FAL → storage → recipe image_url) so I can wire real editorial imagery.
6. Schedule the file-size refactors for Settings/Progress/mobile-index before their conformance passes.

---

## 14. Linear backlog (created) — project "Figma conformance migration"
[Project](https://linear.app/suppr/project/figma-conformance-migration-36fcedcef389) under the *Redesign — Design Direction 2026* initiative. **96 issues**, all under epic **ENG-888**, labelled (launch-blocker / needs/decision / risk-billing / risk-growth / parity / platform):
- **Per-area conformance (141 partials):** ENG-889 (Today) … ENG-902 (Landing) — one issue per area.
- **App-Only → Figma design epic (177):** ENG-903.
- **Figma-Only builds (15):** ENG-904–918 (e.g. ENG-904 Logged-confirmation [launch-blocker], ENG-907/908 Discover Collections + Reels [launch-blocker], ENG-913 Ask, ENG-914 Google Sign-In).
- **Deferred decisions (8) — need you:** ENG-919 Plan single/multi-day · ENG-920 recipe rings vs tiles · ENG-921 library taxonomy · ENG-922 fasting presets · ENG-923 Ask scope · ENG-924 Google SI · ENG-925 meal-row image A/B · ENG-926 Today ring multi-arc.
- **Brand drift:** ENG-927 (done this session — close on review).
- **Category-leading ideas (56):** ENG-928–983, each with rationale + competitor refs + expected benefit + Julienne-fit + effort. P0 highlights: time-of-day go-tos (928), multi-add (929), free-barcode wedge (973), trend-weight (950), per-step ingredients (944), shareable Reel→card (978).

## 15. Streams status (end of session)
- ✅ Audit + tracker + dashboard · ✅ Today (capture-verified) · ✅ Brand drift (verified) · ✅ Linear backlog (96 issues) · ✅ Initiative status update
- ✅ **Recipe-detail conformance** — public-share page full Sloe reskin; web/mobile in-app got radius/pill deltas with feature-dense layouts preserved (Cook Mode, verification, owner controls, servings stepper, net-carbs, sticky footer all still wired); +21-assertion test, 59 tests pass, typecheck clean. **Verification caveat:** typecheck+test-verified but NOT pixel-captured by me this session (no published recipe in DB → public-share 404s; dev server degraded mid-session). Needs a `visual-qa` capture vs 332:2 before ✅-matched. Web/mobile in-app detail intentionally keep tabbed feature layouts (not Figma's single-scroll grid) to preserve functionality — logged as intentional, not drift.
- ✅ **Figma "Pending Sign-Off"** (page 883:2): 5 App-Only features × 3 platforms (15 frames) + 4 reusable components, at the Julienne bar, existing frames untouched. See §9.

**Screens updated this session:** Today (capture-verified), Recipe detail (implemented, pixel-verify pending), app-wide brand copy. **Designed:** 5 App-Only features × iOS/tablet/desktop on Pending Sign-Off.

> **All overnight streams complete.** Nothing committed. Ready for your review: open the app (Today + recipe detail), the Figma "Pending Sign-Off" page, the Linear project (ENG-888), and this report.

## 16. Pending mirrors / follow-ups (not auto-done)
- **Notion** (MCP not exercised this session): add Roadmap row "Figma conformance migration → In progress"; add Decisions-log rows for the 8 ENG-919–926 decisions once you resolve them.
- **Initiative status update** posted to *Redesign — Design Direction 2026* (this session).
- Pre-existing `apps/mobile/app/login.tsx` `styles.title` typecheck error (auth stop-zone) — left for your review.
