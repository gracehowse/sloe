# Full-app Figma conformance — program plan

**Owner:** Claude (implements web **and** mobile directly, owns all commits; Cursor not involved for this program).
**Goal:** every app surface (iOS-primary, web parity) matches the canonical Figma file, with no loss of wired functionality.
**Figma source of truth:** `https://www.figma.com/design/B3UdOFup7ITersgNuoXh0l` (page `0:1 · Sloe · Screens`). Canonical Today = `654:2` (flat borderless `#F6F5F2`, no resting shadow — see `docs/decisions/2026-06-04-figma-flat-borderless-slab.md`).

## Non-negotiable rules (Grace, 2026-06-07)
1. **Never remove wired functionality.** If a feature is wired on iOS/web but absent from Figma, KEEP it and add a task to prototype it in Figma (so we can converge later). Track under "Figma backfill".
2. **New prototypes pipeline:** Stitch (generate) → Mobbin (research/reference) → **Figma** (final source of truth, all components/screens mapped).
3. **Web + mobile parity** on every change.
4. **Verify on rendered captures** (web-drive at `127.0.0.1:3000`; iOS sim via simctl screenshots + idb gestures) BEFORE claiming a screen matches. No "matched" off code or thumbnails alone.

## Phases
- **P1 · Audit (in progress):** one agent per screen pulls the exact Figma spec (`get_design_context`) and diffs the real app code → structured mismatch list + app-only-features. Core 11 first, then drill-downs/states.
- **P2 · Implement (Today first):** screen by screen, web+mobile, fix to Figma, re-capture, verify.
- **P3 · Figma backfill:** for each wired app-only feature, Stitch→Mobbin→Figma prototype.

## Figma frame index (95 frames on `0:1`)

### Core app (mobile)
| Node | Frame | Web target | Mobile target | Status |
|---|---|---|---|---|
| 654:2 | 01 · Today (canonical) | NutritionTracker + suppr/today-* | (tabs)/index + components/today/* | P2 next |
| 332:2 | 02 · Recipe detail | app/recipe/[id] | app/recipe/[id].tsx | audit |
| 527:2 | 03 · Cookbook | (product)/recipes,library + Library.tsx | (tabs)/recipes,library | audit |
| 309:2 | 04 · Plan | (product)/plan + MealPlanner | (tabs)/planner | audit |
| 492:2 | 05 · Progress | (product)/progress | (tabs)/progress | audit |
| 177:2 | 06 · Import | (product)/import | cookbook-import, plan-import | audit |
| 189:2 | 07 · Onboarding (goal) | app/onboarding | app/onboarding | audit |
| 284:2 | 08 · Paywall | pricing + paywall dialog | app/paywall | audit |
| 335:2 | 09 · Settings | (product)/settings | (tabs)/settings | audit |
| 185:2 | 10 · Ask | (locate) | (locate) | audit |
| 336:2 | 11 · Log a meal | suppr/log-sheet | (tabs)/index log sheet | audit |

### Drill-downs (D1–D14)
148:2 D1 Macro detail · 149:2 D2 Energy out · 150:2 D3 Meal nutrition · 151:2 D4 Weight metric · 305:2 D5 Fasting · 291:2 D6 Cook mode · 156:2 D7 Weekly recap · 289:2 D8 Shopping list · 158:2 D9 Targets · 160:2 D10 Household · 162:2 D11 New recipe · 163:2 D12 Verify recipe · 528:2 D13 Discover · 165:2 D14 Creator

### Today deep-dive (TD1–TD5)
459:2 TD1 Activity & energy · 463:2 TD2 Hydration & stimulants · 480:2 TD3 Weekly insight & planned · 481:2 TD4 Meal log · 523:2 TD5 Plan — Week view

### Keep features (K1–K4, designed 2026-06-03)
514:2 K1 Nutrients all-micros · 513:2 K2 Log Favourites/Go-Tos · 497:2 K3 Targets why-this-number · 498:2 K4 Today fasting entry

### States (S1–S15)
285:2 S1 Welcome · 190:2 S2 About you · 191:2 S3 Pace · 192:2 S4 Plan ready · 360:2 S5 Today (empty) · 357:2 S6 Today (over) · 529:2 S7 Recipes (empty) · 321:2 S8 Plan (empty) · 322:2 S9 Progress (empty) · 199:2 S10 Search food · 200:2 S11 Photo log · 201:2 S12 Voice log · 202:2 S13 Logged · 269:2 S14 Diet preferences · 273:2 S15 Allergies

### Loading / Error / Dark (L1–L6)
326:2 L1 Today loading · 324:2 L2 Recipes loading · 320:2 L3 Offline · 207:2 L4 Import error · 314:2 L5 Today dark · 530:2 L6 Recipes dark

### Account / Auth / More (M1–M6)
296:2 M1 Login/Signup · 297:2 M2 Reminders · 298:2 M3 Search results · 334:2 M4 Account & plan · 302:2 M5 Streak win · 304:2 M6 Import success

### Web responsive (W) + Web onboarding (WO) + Landing (LP)
337/847 W1 Today desktop · 338/857 W2 tablet · 339/862 W3 mobile · 834 W Activity Summary · 825 W TD1 Net energy · 840 W Where-this-comes-from · 275–281 WO1–WO7 web onboarding · 345/346/347 LP1–LP3 landing

## Known fix already identified
- **Meal-row thumbnail (Today):** `today-meals-figma-layout.tsx` renders an empty `bg-muted` box when a meal has no image (MFP/barcode/manual). Figma `654:2` shows photos for library recipes only. Fix rule TBD against audit (photo for library-recipe-with-image; clean fallback otherwise — no empty box). Mirror on mobile.

## Verification assets
- Web: `WEB_DRIVE_BASE_URL=http://127.0.0.1:3000 node scripts/web-drive.mjs shot <route> --auth --vp 390x2800` (auth cookie is scoped to 127.0.0.1, not localhost).
- iOS: sim `C348952F-E8DB-4067-A3F2-E8599BF464BB` (iPhone 17 Pro, iOS 26.5), `com.supprclub.supprapp`, Metro on 8081; `xcrun simctl io <udid> screenshot` + `idb ui swipe … --duration 0.6`.
