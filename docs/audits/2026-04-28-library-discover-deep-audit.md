# Library + Discover deep audit — 3 platforms

**Phase 6 expanded scope.** Mobile native, mobile-web, desktop-web.
**Source:** customer-lens, 2026-04-28.

---

## Top 5 most damaging issues (impact-per-effort)

1. **No way to switch Library↔Discover on mobile-web.** Native has `RecipesSubTabHeader` segmented control; mobile-web bottom nav routes to Library default and there is NO surfaced path to Discover. The only paths are URL `?view=discover` or the buried "From your sources → My Library" CTA which is the *wrong direction*.
2. **Library "remove" is hidden long-press with zero visual cue on native; missing entirely on web.** Trash icon was removed at P2-32 in favour of long-press confirm. Sighted users get no signal. Web has no removal affordance at all on either grid — desktop-web user must open the recipe and tap bookmark to unsave.
3. **Discover desktop-web subtitle lies.** `DiscoverFeed.tsx:449-454` renders "sorted by recent" — there is no sort control. Decorative truth-fiction.
4. **Mobile-web has duplicate "From your sources / My Library" CTAs that desktop hides.** On a screen titled "Discover", a chunky tile says "go elsewhere".
5. **"Following" filter does different things on phone vs web.** Mobile native predicate (`discover.tsx:242`) only matches `creatorId`. Web predicate (`DiscoverFeed.tsx:360-366`) matches `creatorId` OR `authorId`. **Silent data drift — same UI, different result set.** P0 trust hit.

---

## Library audit

| ID | Where | Issue | Severity | Platforms | Fix |
|---|---|---|---|---|---|
| L1 | `library.tsx:96` | Tab-root back chevron is decorative on cold-start, navigational from recipe-detail. Same chevron, two meanings. | P1 | native | Hide chevron when `useSafeBack` would no-op to `/(tabs)`. |
| L2 | `library.tsx:473` / `Library.tsx:201` | Three-state sort cycle button — user must tap and observe. No menu. | P2 | all | Convert to dropdown. |
| L3 | `library.tsx:539` | Search-empty has no "clear search" / "try Discover". Web has copy but no clear button. | P2 | all | Reset button matching `DiscoverFeed.tsx:891-902`. |
| L4 | `Library.tsx:434-528` | Mobile-web cards visually different from native (no fit %, asymmetric badges, P/C/F as muted blocks). Comment at line 254 acknowledges. | P1 | mobile-web | Port native card visuals; share `LibraryCard` component. |
| L5 | `Library.tsx:144-149` | No sub-tab pill bar to swap to Discover on mobile-web. (See §7 recommendation.) | **P0** | mobile-web | Mirror `RecipesSubTabHeader` as web component on `<md`. |
| L6 | `library.tsx:297-307` | Bookmark dot rendered on every saved card but NOT tappable to unsave. Tapping it opens the recipe. Decoy. | P1 | native | Make dot tappable with `e.stopPropagation` or remove. |
| L7 | `Library.tsx:321-333` | Desktop card overlay shows BOTH bookmark dot for saved AND `{kcal}` pill for non-saved. Imported users see kcal twice. | P2 | desktop-web | Drop overlay kcal pill. |
| L8 | `Library.tsx:393-427` | "Go public" / "Create your own version" chips inside card body rely on `e.stopPropagation()`. One missed guard → opens recipe instead. Async duplication can double-fire. | P1 | desktop+mw | Move actions outside card press target. |
| L9 | `library.tsx:534-544` | Empty state claims meal-plan integration without a path to it. | P3 | native | Specify (Plan tab) or drop the claim. |
| L10 | `Library.tsx:144-149` | Mobile-web header pill ("3 recipes") repeats grid count. | P3 | mobile-web | Remove pill. |
| L11 | `library.tsx:435-443` / `Library.tsx:386-388` | TrustChip uses `recipeLevelTrust({ source: item.isVerified ? "USDA" : null })` — collapses FatSecret/OFF/Edamam to USDA. **Inflates trust.** | P1 | all | Pass real source via recipe model, not binary `isVerified`. |
| L12 | `Library.tsx:165-211` | Filter pills + sort button + search wrap unpredictably on narrow desktop. | P2 | desktop-web | Move sort to its own row at `<lg`. |
| L13 | (entire screen) | Pull-to-refresh on native; web has no manual refresh after creating a recipe in another tab. | P2 | mobile-web + desktop | Refresh button or focus listener. |

---

## Discover audit

| ID | Where | Issue | Severity | Platforms | Fix |
|---|---|---|---|---|---|
| D1 | `discover.tsx:242` vs `DiscoverFeed.tsx:360-366` | **Following pill matches different fields on each platform.** Native: `creatorId` only. Web: `creatorId` OR `authorId`. Silent data divergence. | **P0** | native vs web | Mobile must add `authorId` match. Pin with parity test. |
| D2 | `discover.tsx:167` | Eating-out row appears at search ≥3 chars; user typing 2 then pausing sees nothing then a row appears 350ms after 3rd char. Feels like a bug. | P3 | all | Show dimmed "Type 3+ chars for restaurant matches" placeholder. |
| D3 | `discover.tsx:593` vs `DiscoverFeed.tsx:544` | **Eating-out tap goes to different destinations.** Native pushes `/(tabs)?search=...`; web calls `onViewTracker?.()` with no search context. Same affordance, different behaviour. | **P0** | native vs web | Pick one; eating-out should land in tracker with food prefilled on both. |
| D4 | `DiscoverFeed.tsx:449-454` | "sorted by recent" hard-coded — no sort control. Decorative truth-fiction. | P1 | desktop-web | Implement sort or drop the half-line. |
| D5 | `DiscoverFeed.tsx:601-731` vs `737-877` | Desktop flat 3-col grid; mobile-web "Matches your day / More ideas" sectioned with compact list. Returning user's mental model breaks. | P2 | mw vs desktop | Commit to grid everywhere or sectioned everywhere. |
| D6 | `DiscoverFeed.tsx:919-940` | Mobile-web Import CTA uses `window.history.pushState` + `dispatchEvent(new PopStateEvent)` — routing hack. | P1 | mobile-web | Use Next router (mirror `discover.tsx:701` `router.push`). |
| D7 | `DiscoverFeed.tsx:309-319` | `storyCreators` state is computed but **never rendered** in JSX. Dead code. | P3 | desktop+mw | Render or delete. |
| D8 | `DiscoverFeed.tsx:161-343` | `addToCollection`, `createCollection`, `copyShareLink` defined but **never wired to UI**. Dead handlers + state. | P1 | desktop+mw | Wire or delete. |
| D9 | `discover.tsx:200-208` | On focus reads clipboard → `Alert.alert("Import recipe?")` 900ms after open. Unsolicited modal for users who copied an unrelated URL. | P1 | native | Move behind explicit "Import from clipboard" tap. |
| D10 | `discover.tsx:541` | Placeholder "Search 48,000+ recipes & foods" — foods are NOT searched from Discover (only via eating-out at ≥3 chars). **Trust concern.** | P1 | all | Change copy to "Search recipes" or wire food search. |
| D11 | `DiscoverFeed.tsx:455-466` | Round search button removed on native at P2-34, **still rendered on web at `<md`**. | P2 | mobile-web | Drop the round search button. |
| D12 | `DiscoverFeed.tsx:367-411` | **"For You" filter is `return true`** — pill is decorative, does nothing different to no-pill. | P2 | all | Make it actually rank (use `computeRecipeFitPercent`) or rename to "All". |
| D13 | `discover.tsx:77` | Saved recipes appear in BOTH Library AND Discover. No "you already saved this" hint. | P2 | all | Show small saved-bookmark dot on Discover cards. |
| D14 | `discover.tsx:346-361` | Tappable byline (when `creatorId` exists) is **visually identical** to plain-text byline. User can't tell which are tappable. | P1 | native + web | Consistent underline + chevron. |
| D15 | (mobile-web pill row) | Tapping "Quick" while on "Following" leaves `feedScope === "following"` — silent state retention. | P1 | mobile-web + desktop | Make Following exclusive — tap any other pill resets `feedScope: "forYou"`. |
| D16 | `DiscoverFeed.tsx:171-276` | `newFromFollowsCount` is set; **no JSX uses it.** Banner state set, never rendered. | P2 | desktop+mw | Render banner or delete. |
| D17 | `discover.tsx:435-487` | `renderMoreIdeaRow` exists, **never called** (acknowledged in comment 670-679). Dead code. | P3 | native | Delete. |

---

## Recipe detail audit

| ID | Where | Issue | Severity | Platforms | Fix |
|---|---|---|---|---|---|
| RD1 | `recipe/[id].tsx:1097-1110` | `headerBtn` style now uses `colors.card` (03bf765 fix) but the actual top bar at line 1305-1340 uses `topBarIconBtn` (different style). `headerBtn` is **dead style**. | P3 | native | Delete or use. |
| RD2 | `recipe/[id].tsx:1305-1340` | Three icon buttons 40×40 with no visible bg. On long titles (`numberOfLines={1}`) the centred title can collide with action icons. | P2 | native | minWidth gutter or left-align title. |
| RD3 | `recipe/[id].tsx:1318-1329` | Save button mobile uses `Accent.success` (green) when saved; web uses primary. Cross-platform divergence on what "saved" looks like. | P2 | native vs web | Pick one. |
| RD4 | `RecipeDetail.tsx:209-243` | Go Public is web-only by design (`project_recipe_go_public_web_only.md`). Mobile user who created a recipe and wants to publish has **no path on phone**. | P1 functional | native | Expose on native or add note "Open on web to publish". |
| RD5 | `recipe/[id].tsx:1290-1300` | `fitPercent` computed but not visibly rendered (placeholder check). Web `RecipeDetail.tsx:280-289` does render the % pill. Possible drift. | P2 | native vs web | Verify and align. |
| RD6 | `recipe/[id].tsx:1342-1344` | Hero `<Image>` with no `defaultSource`, no shimmer. Loads as flat grey then snaps. | P3 | native | Use `expo-image` with `transition` prop. |
| RD7 | `recipe/[id].tsx:1280-1288` | `handleShare` uses `Constants.expoConfig?.extra?.supprApiUrl` then falls back to `https://suppr-club.com`. Dev silently uses prod. | P3 | native | Throw in dev when `extra` is missing. |
| RD8 | `RecipeDetail.tsx:265-345` | Massive useEffect re-fetches creator/author/save count/follower count on every mount — no cache. Visible flicker on follower count. | P2 | desktop+mw | SWR / context cache. |
| RD9 | `RecipeDetail.tsx:60-83` | Clipboard fallback toast at line 77-81 — link in 15s toast, but mobile-web Safari often can't long-press-select toast text. | P1 | mobile-web | Render in `<input readOnly>` or open modal. |
| RD10 | `recipe/[id].tsx:163-167` | `activeTab` defaults `"ingredients"`. User opening from Cook Mode entry expects Steps. No `?tab=` plumbing. | P2 | native + web | Accept tab query param. |
| RD11 | `RecipeDetail.tsx` (mw) | No separate mobile-web layout — renders identically across widths. At 375px viewport macro hero + ingredient table feels squished. | P2 | mobile-web | `<md` overrides matching native proportions. |
| RD12 | `recipe/[id].tsx:204` | `autoLog` query param — fires regardless of saved/owned state. Unsaved recipe still triggers log sheet. | P2 | native | Gate on saved/owned. |

---

## Cook mode interaction gaps (beyond visual-qa redesign spec)

| ID | Issue | Severity | Platforms | Fix |
|---|---|---|---|---|
| CM1 | `cook.tsx:39` `JSON.parse(steps)` — **screen crashes on malformed JSON** (no try/catch). | **P0** | native | try/catch with fallback empty array + error state. |
| CM2 | `cook.tsx:108-111` `stopTimer` resets `timerElapsed` to 0 — accidental tap loses elapsed count. No pause state. | P1 | native | Pause vs Reset. |
| CM3 | `cook.tsx:84-86` `goNext` — no haptic, no animation. | P2 | native | `Haptics.selectionAsync` on step transition. |
| CM4 | `CookMode.tsx:50-81` `playChime` synthesised tone via AudioContext. iOS Safari may silently fail (no autoplay). | P1 | mobile-web | Visible "Timer done" banner that doesn't depend on chime. |
| CM5 | `cook.tsx` does **NOT auto-log a meal** on done state; web `CookMode.tsx:84` has `addLoggedMeal` + `logged` state. **Cook on phone: no log nudge. Cook on web: meal gets logged.** Cross-platform behaviour drift in a write path. | **P0** | native vs web | Add log nudge on mobile cook completion. |
| CM6 | `cook.tsx:54-60` fires `cook_mode_opened` only; web fires `_opened`, `_started`, `_first_step_advanced` (lines 113-125). Funnel divergence. | P1 | native | Add dual emit. |
| CM7 | `CookMode.tsx:128-168` web Wake Lock; mobile `useKeepAwake()`. Both fine. But manual phone-lock returns to a stopped timer. | P2 | native | Persist timer end-time across visibility changes. |
| CM8 | `cook.tsx:33` `useLocalSearchParams<{ recipeId, title, steps }>` — title via URL. If title contains `&` or `?`, encoding breaks. | P1 | native | Pass via context/router state, not query string. |

---

## Cross-platform parity matrix

| Interaction | Native | Mobile-web | Desktop-web |
|---|---|---|---|
| Sub-tab pill bar (Library↔Discover) | ✓ | **MISSING** | n/a (sidebar) |
| Library remove (long-press) | ✓ | **drift (no UI)** | **drift (no UI)** |
| Library remove (swipe / button) | missing | missing | missing |
| Library card layout | hero+meta+TrustChip | **drift (legacy)** | hero+meta+TrustChip |
| Library "Go public" chip | n/a | ✓ | ✓ |
| Library pull-to-refresh | ✓ | missing | missing |
| Discover Following pill match | creatorId only | creator+author | creator+author |
| Discover For-You does anything | no | no | no |
| Discover round search button | removed | **present (drift)** | n/a |
| Discover "sorted by recent" subtitle | n/a | n/a | **decorative lie** |
| Discover sectioned vs grid | sections | sections | flat grid |
| Discover Eating-out tap destination | recipe-search nav | viewTracker (no context) | viewTracker (no context) |
| Discover collections UI | n/a | **dead handlers** | **dead handlers** |
| Discover stories / new-from-follows | n/a | **state set, never rendered** | **state set, never rendered** |
| Discover clipboard import alert | ✓ (intrusive) | n/a | n/a |
| Recipe Go Public | missing | ✓ | ✓ |
| Recipe save accent colour | green | varies | varies |
| Cook mode auto-log on finish | **missing** | ✓ | ✓ |
| Cook timer behaviour | count-up stopwatch | countdown | countdown |
| Cook analytics events | 1 event | 3 events | 3 events |
| Cook chime | n/a | AudioContext | AudioContext |

---

## Recommendation: mobile-web Library/Discover sub-tab pill bar

**Add it. P0.** Reasoning:

- Bottom-nav "Recipes" tab (`App.tsx:472`) has `defaultLeaf: "library"`. Once on Library, no surfaced path to Discover.
- Asking a mobile-web user to type `?view=discover` or find the buried "From your sources → My Library" CTA is unreasonable cognitive load.
- The 4-tab bottom nav was a Phase 2 collapse (`App.tsx:460` comment). Adding a sub-tab pill is logical completion of that phase, NOT a new feature.
- Cost: trivial. Port `apps/mobile/components/tabs/RecipesSubTabHeader.tsx` to a Tailwind component, render at `<md` inside `Library` and `DiscoverFeed`.

**This is drift, not deferred.**

---

## Synthesis

A first-time mobile-web user opens Suppr at <768px. Taps "Recipes" → Library (empty). Sees "Go to Discover" CTA → taps → Discover. Saves a recipe → taps back → Library. Wants to return to Discover. **There is no button.** They scroll. The only visible exit is "From your sources → My Library" (already there) or "Import a recipe" (wrong direction). They tap bottom-nav "Recipes" again → nothing (already there). They give up and use the URL bar.

Combined with Library remove being long-press-only with no visual cue, and Following pill silently doing different things on phone vs web, Library/Discover on mobile-web feels half-finished compared to the polished native experience one OS-keyboard tap away.

**Fix the pill bar first. The rest is per-issue cleanup.**

---

## Trust concerns highlighted

1. "Search 48,000+ recipes & foods" placeholder when foods aren't actually searched from Discover (D10).
2. "sorted by recent" Discover desktop subtitle when there's no sort (D4).
3. TrustChip USDA-collapsing every `isVerified` source (L11).
4. **Following filter showing different results across platforms (D1) — silent data divergence is the worst kind of trust break.**

---

## Functional / measurement-affecting drifts (priority for parity sweep)

D1, D3, L4, RD3, RD4, **CM5** (write-path divergence), CM6 (analytics funnel divergence), CM8.
