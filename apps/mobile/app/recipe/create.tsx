/**
 * `/recipe/create` — first-class wizard route for "create from scratch".
 *
 * This is a static route co-located with `recipe/[id].tsx`. Expo Router
 * resolves static segments before dynamic ones, so `recipe/create`
 * cannot collide with `recipe/[id]` even though they share a parent.
 *
 * The route is registered in `apps/mobile/app/_layout.tsx` with its
 * stack header hidden — the wizard renders its own top bar with a
 * progress indicator + step counter (see `CreateRecipeWizard.tsx`).
 *
 * Why this route exists alongside `/create-recipe`:
 *   - `/create-recipe` is a long single-screen form, reachable from
 *     More → Settings (Settings bundle row) and the share-extension
 *     handoff. It's optimised for fast in-place editing of an
 *     already-known shape.
 *   - `/recipe/create` is the guided, first-time-creator path.
 *     Linked from Library tab. Optimised for confidence (one decision
 *     per screen, explicit validation gates).
 *
 * See `docs/audits/2026-04-28-recipe-creation-audit.md` (CR series)
 * for the customer-lens findings that motivated the wizard.
 */
import CreateRecipeWizard from "@/components/recipe/CreateRecipeWizard";

export default function CreateRecipeRouteScreen() {
  return <CreateRecipeWizard />;
}
