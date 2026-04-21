# Delete legacy onboarding — scheduled 2026-04-27

- **Status:** scheduled (deletion window opens 2026-04-27)
- **Area:** onboarding
- **Owner:** Grace

## What to delete

1. `app/onboarding/legacy-form.tsx` — legacy web onboarding form, preserved
   as one-week emergency rollback after onboarding-v2 hit 100% rollout
   (PostHog flag `648164`, rolled out 2026-04-20).
2. The `?legacy=1` escape hatch in `app/onboarding/page.tsx` — simplify to
   an unconditional `redirect("/onboarding/v2")`.
3. Any orphan helpers this removes, specifically:
   - `subscribeToFlags` / `isOnboardingV2Enabled` in
     `src/lib/analytics/track.ts` — audit for other call sites before
     removing. Only drop if no other surface depends on them.

## Why

Onboarding-v2 has been at 100% rollout since 2026-04-20. A 1-week validation
window was agreed to catch any regression before the legacy path is removed.
Keeping a parallel legacy form beyond that window is dead code that invites
drift and confusion.

See:
- `docs/decisions/2026-04-19-onboarding-redesign-scope.md`
- File header comment in `app/onboarding/legacy-form.tsx`

## Do NOT delete

- `apps/mobile/app/onboarding.tsx` — still the active mobile onboarding
  route (not a stub). Mobile onboarding-v2 rollout is a separate track.
- `apps/mobile/app/onboarding-v2.tsx` — active screen mounting the real
  `MobileFlow`; not a stub.

## Checklist (run on or after 2026-04-27)

- [ ] Confirm no TestFlight / web regressions attributed to onboarding-v2
      in the validation window.
- [ ] Delete `app/onboarding/legacy-form.tsx`.
- [ ] Simplify `app/onboarding/page.tsx` to unconditional redirect.
- [ ] Grep for `legacy=1`, `isOnboardingV2Enabled`, `subscribeToFlags` and
      drop if orphaned.
- [ ] Update `docs/product-roadmap.md` if onboarding redesign row needs
      closing.
- [ ] Mirror to Notion Decisions log (Resolved) once deletion PR lands.
