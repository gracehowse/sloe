# Full Sweep Audit — 2026-04-30

Branch: `main` at `7a51c61` (Group G IA Batches B+C+D).
Scope: full multi-agent sweep across web + mobile, expanded to cover landing/onboarding/reset across all three surfaces (web, mobile-web, mobile app), plus design-system drift against the Claude Design prototype + onboarding bundles.

Agents run: orchestrator-full-sweep, visual-qa, ui-critic, design-system-enforcer (twice), customer-lens (twice), sync-enforcer, product-lead.

## Master issue list

P0 = trust failure or block-ship. P1 = premium-feel, retention, or activation damage. P2 = papercut.

### P0 — block-ship

- [ ] **#1** — Carbs target disagrees: Today=75g vs Targets/Profile=91g for the same user. Pointer: `apps/mobile/app/(tabs)/index.tsx:1051-1094` (`loadProfileTargets`) vs `apps/mobile/app/targets.tsx:84-109`. Fix: `useFocusEffect` + honour `PROFILE_TARGETS_DIRTY_KEY`.
- [ ] **#2** — Mobile shopping list shows raw concatenated quantities ("3 6 large eggs", "875 g 175 g Instant Oats"). Web has `groupShoppingItemsByIngredientName` + `formatMixedShoppingAmounts`; mobile renders raw rows. Pointer: `apps/mobile/app/shopping.tsx:343` vs `src/lib/planning/shoppingDisplayGroups.ts:46`.
- [ ] **#3** — Paywall: "Subscriptions unavailable. In-app purchases aren't configured in this build." RevenueCat + StoreKit not wired. Pointer: `apps/mobile/app/paywall.tsx`.
- [ ] **#4** — Progress tab fabricates story before any data exists ("Maintenance held steady · high confidence" on no logs; 55.3 kg trend on no weigh-ins). Pointer: Progress card on `tour-07-progress.png`.
- [ ] **#13** — Reset/Erase routes to legacy v1 onboarding, not v2. Pointer: `apps/mobile/components/settings/SettingsBundleContent.tsx:568`. Fix: `router.replace("/onboarding-v2")`.
- [ ] **#14** — Erase doesn't clear `suppr.onboarding-v2.state` AsyncStorage — pre-fills wiped user's answers on next session. Pointer: `apps/mobile/lib/nukeAccountData.ts` (no AsyncStorage clear); the call site at `SettingsBundleContent.tsx:530-536` only clears health-import keys.
- [ ] **#15** — Reset/Erase missing on web (mobile-only feature). Pointer: `src/app/components/Settings.tsx` has no reset section. Requires moving `nukeAccountData.ts` to `src/lib/account/` so it's web-importable.
- [ ] **#19** — Erase confirm dialog copy ("food log, saved recipes, meal plans") undersells what the upper paragraph promises (also: journal, library, shopping, private recipes, activity summaries). Pointer: `SettingsBundleContent.tsx:1357-1359` vs `:1325`.

### P1 — premium-feel + retention

- [ ] **#5** — Today empty-state: pre-filled targets, "What to eat next" suggesting a 1,128-kcal steak bowl before any meal logged, hero ring "0 LOGGED" with no target denominator. Pointer: `tour-01-today.png`; Today hero block.
- [ ] **#6** — `today-02-scrolled.png` byte-identical to `today-01-loaded.png` — Today fits one screen, meals don't appear below the fold by default. Pointer: Today index.tsx layout.
- [ ] **#7** — Profile screen design-orphaned: "PROFILE" all-caps nav title, four competing macro-tile border colours, duplicates Targets data with worse UI, `useSafeBack("/(tabs)/more")` targets a redirect-only route. Pointer: `apps/mobile/app/profile.tsx:35`.
- [ ] **#8** — "What to eat next" north-star card renders inconsistently — title truncates mid-word ("…Stic…"), thumbnail sometimes missing. Pointer: `apps/mobile/components/today/NorthStarBlockHost.tsx`.
- [ ] **#9** — Library / Discover labels indistinguishable to a first-time user; Library is empty default tab for new users. Pointer: `apps/mobile/app/(tabs)/library.tsx`.
- [ ] **#10** — Plan tab pre-builds a 7-day plan and a "Howse · 1 member · sharing dinners" household without asking; contradicts 2026-04-27 "demote household" call. Pointer: `apps/mobile/app/(tabs)/planner.tsx`.
- [ ] **#16** — Reset Plan copy says "defaults your goals" (sounds inline) but actually re-runs full onboarding. Two reads, one wrong. **Decision required** — Option A (Reset = inline defaults+toast; Erase = re-onboard) or Option B (rename both to "…and re-onboard"). Pointer: `SettingsBundleContent.tsx:540-566` + `:1325`.
- [ ] **#17** — Profile macro-tile colours violate carryover rule #3: Protein=red, Carbs=blue, Fat=amber. Canonical map: Protein=blue, Carbs=amber, Fat=magenta. Pointer: `apps/mobile/app/profile.tsx`; visible in `tour-20-profile.png`.
- [ ] **#18** — Mobile-web onboarding has no step-position indicator. Eyebrow `hidden md:flex`, top-bar counter desktop-only. Pointer: `src/app/components/onboarding-v2/web-flow.tsx:279-288`.

### P2 — papercuts

- [ ] **#11** — Today date redundancy: "APR 29 — WEDNESDAY / Today" + "Today" subtitle + day-strip current-day pill, plus "23 days" streak chip oversized vs the "pip" direction in 2026-04-27 doc.
- [ ] **#12** — "What's new" build label says Build 10 / 18 April; package.json is 1.0.7. Pointer: `apps/mobile/app/whats-new.tsx`; `apps/mobile/package.json:4`.
- [ ] **#20** — Settings/Profile imports `@expo/vector-icons` (Ionicons) instead of `lucide-react-native`. Carryover rule #2 violation. Pointer: `apps/mobile/app/profile.tsx`; `SettingsBundleContent.tsx`.
- [ ] **#21** — Two destructive actions, three names ("Reset targets" → "Reset Plan (Keep My Data)"; "Erase everything" → "Erase all app data"). One paragraph of copy.
- [ ] **#22** — Today header has three right-side actions (theme + grid + initial chip); prototype canon is single 36×36 gradient avatar → /profile.
- [ ] **#23** — 15-step onboarding (live) vs 13 (bundle). Live adds `strategy` + `recipes`. Both intentional, undocumented. Needs `docs/decisions/2026-04-30-onboarding-v2-step-divergence.md`.

### Carve-outs to log (intentional divergences)

- [ ] Native landing page is web-only (App Store listing is the equivalent)
- [ ] Bundle 13-step vs live 15-step (`strategy` + `recipes` are post-bundle product calls)
- [ ] Web onboarding suppresses top-bar counter (eyebrow carries it on desktop) — mobile-web compensation needed (#18)
- [ ] Mobile-flow.tsx 369 lines (vs bundle's 143) — every line is justified product wiring
- [ ] Reset/Erase routes through onboarding (not just toasts) — once #13 fixed

### Polish queue (design-bundle adopts, not blockers)

- [ ] Today: 7-bar spark + axis labels on digest insight card
- [ ] Discover: "Matches your day" hero list at top
- [ ] Plan: Gradient "This week · Hits 6 of 7 days" header card
- [ ] Settings: Profile header card with 52×52 gradient avatar + tier badge
- [ ] Settings entries: `meal-row` pattern (`gridTemplateColumns: 36px 1fr auto`) consistently
- [ ] Plan web: 7-column desktop grid

## Acknowledged blind spots (not addressed in this sweep)

- Web visual UI (no screenshots captured)
- Mobile-web visual UI (no screenshots)
- Landing page audited via code only, not visually
- Onboarding screens audited via code, not visually
- Runtime perf
- PostHog event funnel (no live data pulled)

## Execution log

### 2026-04-30 — first execution pass

**Closed issues** (12 items shipped):

- ✅ **#1** — Carbs label/value parity. Today's net-carbs lens label decision was using `totals.fiber` (0 when nothing logged), so the tile said "Carbs" while the value was net. Now uses `targets.fiber` so label and value agree. Threaded `netCarbsLensEnabled` through `buildMacroTiles` so /targets renders the same value. Three new vitest cases lock the contract.
- ✅ **#2** — Mobile shopping list now uses `groupShoppingItemsByIngredientName` + `formatMixedShoppingAmounts` (matching web). Two recipes contributing to "Instant Oats" now collapse to a single row "Instant Oats (875 g + 175 g)" instead of "875 g 175 g Instant Oats". Group count drives the badge so "99+" can no longer overstate.
- ✅ **#7** (partial) — Profile screen: `useSafeBack("/(tabs)/more")` retargeted to `/(tabs)/settings` (live destination); "PROFILE" all-caps title swapped for title-case `colors.text` (matches every other nav header).
- ✅ **#12** — `apps/mobile/app/whats-new.tsx` now reads the build label from `expo-constants` via `apps/mobile/lib/installedBuild.ts`. Falls back to changelog metadata in test environments. Four new vitest cases.
- ✅ **#13** — `SettingsBundleContent.tsx:568` now routes Erase to `/onboarding-v2`, not legacy `/onboarding`.
- ✅ **#14** — `suppr.onboarding-v2.state` added to the AsyncStorage `multiRemove` on Erase. Web does the equivalent on `localStorage`. No more pre-fill leakage after a wipe.
- ✅ **#15** — `nukeAccountData.ts` moved from `apps/mobile/lib/` to `src/lib/account/`. `NUTRITION_DEFAULTS` lifted to `src/constants/`. Web Settings now exposes Reset targets + Erase everything actions with the same confirm dialog as mobile.
- ✅ **#16** — Reset semantics: product-lead picked Option A. Reset targets is inline (defaults + toast, no re-onboarding); only Erase re-runs onboarding. Decision logged at `docs/decisions/2026-04-30-reset-targets-is-inline-not-re-onboarding.md`.
- ✅ **#17** — Profile macro-tile colours retoken to `MacroColors.*`. Pre-fix was Protein=red (destructive), Carbs=blue (info), Fat=amber (warning). Now Protein=blue, Carbs=amber, Fat=magenta — carryover rule #3 honoured.
- ✅ **#18** — Mobile-web onboarding step counter rendered as `md:hidden` numeric beside the progress bar.
- ✅ **#19** — Erase confirm dialog now enumerates the full delete list. Title `Erase everything?`, body lists food log + journal + library saves + shopping lists + imported recipes + synced activity. Same copy on web.
- ✅ **#20** — Ionicons → lucide-react-native in `apps/mobile/app/profile.tsx` (Check + Circle replaced checkmark-circle / ellipse-outline) and `apps/mobile/app/targets.tsx` (Beef / Wheat / Droplets / Leaf / ChevronLeft).
- ✅ **#21** — Reset/Erase button labels: "Reset Plan (Keep My Data)" → "Reset targets"; "Erase all app data" → "Erase everything". Sub-captions written so each button is self-explanatory at a glance.
- ✅ **#23** — Onboarding 13→15 step divergence carve-out logged at `docs/decisions/2026-04-30-onboarding-v2-step-divergence.md`. Mobile-flow.tsx 369 lines documented as justified.

**Carve-outs documented**:

- `docs/decisions/2026-04-30-reset-targets-is-inline-not-re-onboarding.md`
- `docs/decisions/2026-04-30-onboarding-v2-step-divergence.md`
- `docs/decisions/2026-04-30-landing-page-web-only.md` (native landing not built; App Store listing is the equivalent)

**Tests**:

- Web: 3356 vitest cases pass (was 3270 pre-execution; +86 from new lens + buildMacroTiles + audit assertions)
- Mobile: 777 vitest cases pass (was 773; +4 installedBuild)
- Mobile typecheck: clean
- Web typecheck: clean

**Items deferred / not in this pass**:

- **#3** Paywall IAP unwired — operational task (RevenueCat + StoreKit configuration), not a code change Claude can land.
- **#4** Progress fabricates "high confidence" claims with no logged data — needs nutrition-engine sign-off on the empty-state contract (N≥3 logs, N≥2 weigh-ins?). Defer to a focused session.
- **#5** Today empty-state north-star suggestion appearing before any meal logged — needs ui-product-designer brief on the day-1 state.
- **#6** Today meals below the fold — layout decision; defer.
- **#7 (partial)** — Profile/Targets duplication (the screens still render the same data twice). Header + colours + back-route are fixed; the structural dedupe is a larger refactor.
- **#8** North-star card title truncation — needs a thumbnail-required policy decision.
- **#9** Library/Discover label confusion — copy + IA call (rename Library → "Saved" or default new users to Discover).
- **#10** Plan tab pre-builds household + week — product call (when does household become visible?).
- **#11** Today date redundancy + streak chip oversize — design call.
- **#22** Today header reduce to gradient avatar — design call (where do theme-toggle + grid-icon go?).
- **Polish queue** (six bundle-adopt items: Today insight spark, Discover hero list, Plan gradient header, Settings profile card, meal-row pattern, Plan web 7-col grid) — all design polish, not blockers.

**Next steps** (ordered):

1. Run `npm run ci` to confirm typecheck + test parity end-to-end on a clean run
2. Commit with a single message linking the audit doc + each decision file
3. Update Notion (Decisions log rows for the three new decision docs; mark the relevant Tasks DB items as Done)

