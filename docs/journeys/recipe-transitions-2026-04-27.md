# Recipe shared-element transitions (B5 — Phase 5)

**Status:** Web view-transition naming shipped 2026-04-27.
Mobile shared-element morph **deferred** with a documented gap
(Reanimated 4 dropped `sharedTransitionTag`).
**Authority:** production design spec §1.1 + Surface H.

## What it is

The "demo moment" per spec §1.1 — the recipe card image and title
animate continuous geometry from card to detail. Card 16:10 thumb
grows to 16:9 hero; macro chip row fades out (the image is the
focal point on detail). Reduce-motion fallback: cross-fade only.

## What ships in Phase 5 — web

- `src/app/components/Library.tsx` — Library card image carries
  `style={{ viewTransitionName: \`recipe-${recipe.id}-image\` }}`.
- `src/app/components/RecipeDetail.tsx` — Detail hero image carries
  the matching `viewTransitionName: \`recipe-${recipe.id}-image\``.
- The CSS-side morph fires automatically on browsers that support
  the [View Transitions API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API)
  when the same name appears on the outgoing + incoming views.
- Library navigates to RecipeDetail in-page (not via a route push),
  so the morph is currently dormant until either:
  1. The Library swaps to a route push (`/recipe/[id]`), OR
  2. We wrap the in-page swap in
     `document.startViewTransition(() => setSelectedRecipe(r))`.
- Browsers without VT API (Firefox today) silently ignore
  `viewTransitionName`. **No regression** in current Library /
  Discover navigation.

## What ships in Phase 5 — mobile

**Implementation gap, not implementation default.**

The spec §1.1 calls for `react-native-reanimated` shared-tag
animation:
```tsx
<Image sharedTransitionTag={`recipe-${id}-image`} />
```

**Reanimated 4 dropped `sharedTransitionTag`.** It was a Reanimated 3
feature, exclusively for the legacy renderer + native-stack. The
mobile codebase is on Reanimated 4 (`apps/mobile/package.json:
"react-native-reanimated": "~4.1.1"`).

Three viable replacement paths, none free:

1. **Pin Reanimated to 3.x** — works, but Reanimated 3 is no longer
   the recommended version for Expo SDK 54+ and we lose worklet
   improvements. Tradeoff: regression risk on every other animation.
2. **`react-native-screens` `enableNativeStack` + `screenTransition`**
   — supported on iOS, but Android shared-element coverage is
   thinner and the API is less ergonomic.
3. **Custom layout-animation morph using `react-native-reanimated`'s
   layout-prop API + `LinearTransition`** — same source library,
   different API. Works on both platforms, requires per-component
   `<Animated.Image layout={…} />` migration.

**Decision (per planner-grade pragmatism):** route the choice to
`code-quality` + `ui-product-designer`. Phase 5 ships the spec
language as a **surface intent**, with the **demo-moment morph
landing in a follow-up release**. The fallback cross-fade
(react-navigation's default) is the production behaviour today.

## Reduce-motion fallback

Per spec §1.1 reduce-motion path: **skip the morph; cross-fade screens 150ms.**

- **Web:** `@media (prefers-reduced-motion: reduce)` already disables
  view-transitions globally via the existing
  `src/styles/theme.css`. The browser's internal VT scheduler
  honours the media query.
- **Mobile (deferred):** when the morph lands, its host should
  branch on `useReduceMotion()` and skip the shared-element path.
  The expo-router default cross-fade IS the reduce-motion fallback.

## Tests shipped

- B5 doesn't currently have unit tests — the View Transitions API
  isn't testable in jsdom and the mobile morph is deferred.
- The reduce-motion-fallback test suite
  (`apps/mobile/tests/unit/reduceMotionQAPhase5.test.tsx`) covers
  the broader reduce-motion behaviour as a class.

## Cross-platform parity

- Web ships the `viewTransitionName` annotations.
- Mobile ships the cross-fade fallback (the same as
  reduce-motion would render anyway).
- Intentional divergence noted in
  `docs/specs/2026-04-27-production-design-spec.md` §Cross-platform
  deviations: the spec already acknowledges "Mobile haptics / web no
  haptics" as one platform-specific affordance; the shared-element
  gap on mobile is a temporary state, not a permanent divergence.

## Open follow-ups

1. **Mobile shared-element implementation** — choose between the
   three paths above and ship the demo-moment morph.
2. **Web in-page wrapping** — wrap Library's in-page recipe swap
   in `document.startViewTransition(...)` so the morph fires today
   (currently dormant).
3. **B5 visual-qa sign-off** — once both platforms ship the morph,
   compare against the spec §1.1 timing (350ms `--pm-duration-lg`
   with `--ease-pm`).
