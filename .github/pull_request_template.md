## Summary

<!-- What changed and why (1–3 sentences). -->

## Checklist

- [ ] **Genesis §2 — task completion gate** satisfied for this change scope ([docs/genesis/README.md](../docs/genesis/README.md#2-task-completion-gate-non-negotiable))
- [ ] **Tests** — `npm test` at repo root; `npm test --prefix apps/mobile` when mobile code or shared nutrition paths touched
- [ ] **Typecheck** — `npm run typecheck` and `npm run typecheck --prefix apps/mobile` where applicable
- [ ] **Web / mobile parity** — if behaviour is user-visible on both platforms, both are updated or the gap is documented in [docs/product/web-mobile-parity-scope.md](../docs/product/web-mobile-parity-scope.md)

## Screenshots / clips

<!-- Optional: UI before/after. Delete if N/A. -->

### Today visual changes (Premium program)

If this PR touches **Today** layout, colour, or cold-open chrome on web or mobile:

- [ ] Attach **paired** captures: same state on native sim and mobile-web (e.g. `one-meal-mobile-light.png` + `one-meal-mobile-web-light.png`). See [`docs/ux/captures/today-premium-2026-05-19/README.md`](../docs/ux/captures/today-premium-2026-05-19/README.md).
- [ ] `npm run test -- tests/unit/crossPlatformThemeTokens.test.ts` and `tests/unit/todayPremiumTokenGate.test.ts` pass when tokens changed.
