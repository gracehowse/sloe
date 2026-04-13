# Decision: RevenueCat empty offerings (2026-04)

## Context

`getOfferings()` can return an empty package list when:

- RevenueCat is not configured (`EXPO_PUBLIC_REVENUECAT_*` missing or wrong),
- The dashboard has no **current** offering or no packages attached,
- Network or SDK errors occur (handled by returning `[]`).

## Decision

1. **Configuration is required** for real IAP: keys and RevenueCat project must be correct in each build channel (dev, preview, production).
2. **Product UX:** The paywall **must not** silently fail. If there are no packages, show a clear alert and allow continuing onboarding (current behavior on `PaywallScreen`: “Subscriptions unavailable” with a path forward).

## Follow-up (optional)

- Add a non-blocking dev-only log when `getOfferings()` returns `[]` and keys are present (suggests dashboard misconfiguration).
- Document RevenueCat offering identifiers expected by the app (`$rc_annual`, etc.) in `docs/environment.md` or mobile README when stabilized.

## References

- `apps/mobile/lib/purchases.ts` — `getOfferings`
- `apps/mobile/app/paywall.tsx` — empty `packages` handling
