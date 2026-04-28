# App-wide states + accessibility + emails + cross-cutting audit

**Phase 6 comprehensive scope.** Error boundaries, offline, loading, empty, toasts, cookies, first-run, emails, a11y, reduced-motion, dynamic type, i18n, dark mode, diversity.
**Source:** customer-lens, 2026-04-28.

---

## Top 5

### ERR-01 [P0] — Mobile has NO production error boundary

`apps/mobile/app/_layout.tsx:401-411`. No `<ErrorBoundary>` wraps any tree; no `componentDidCatch`; no Expo Router `ErrorBoundary` export.

In a production TestFlight build, an uncaught component throw will **crash the JS bundle**. User sees splash, then blank white, then OS may kill the app. Sentry captures it (per `errorTracking.ts`), but **user sees nothing.** No "Try again", no "Reload", no "Go to Today".

Web has `app/error.tsx` and `FeatureErrorBoundary` with retry + reload + Sentry hand-off. Mobile has Sentry but no UI fallback.

**Fix:** Add Expo Router `ErrorBoundary` export to `_layout.tsx` AND `Sentry.ErrorBoundary` wrapping `<RootLayoutInner />` with fallback mirroring web `app/error.tsx`.

### EMAIL-01 [P0 trust] — Zero email templates exist in repo

No `src/email-templates/`, no `app/email/*`, no `react-email`, no `resend`/`sendgrid`/`postmark`. Only "email-shaped" surface is `app/api/push/weekly-recap/route.ts` — push notification, NOT email.

**Suppr's first impression is the bare Supabase default confirmation email.** Un-branded, ugly default link button. Welcome email, trial-ending warning, subscription confirmation, password reset, weekly digest — none owned by this repo.

For a paid product, this reads as scammy on first signup. Trust hit before user has even logged a meal.

**Fix:** Stand up `src/email-templates/` with React Email or MJML for: welcome, verify, reset, trial-ending, subscription receipt, subscription cancelled, weekly digest. Wire Supabase Auth template overrides + transactional sender. Footer must include unsubscribe + business address per CAN-SPAM / PECR / UK GDPR.

### OFF-01 / OFF-02 [P1] — Zero offline indicator + no retry queue anywhere

No `NetInfo` listener, no `navigator.onLine` watcher, no banner. Only network-error string is `formatAuthError` in `apps/mobile/app/login.tsx`.

Most surfaces just spin forever or fail with raw fetch error. **For a meal-logger, "did my log make it?" is the core trust question.**

Optimistic insert with retry queue doesn't exist. Network failure on `nutrition_entries` insert leaves partial UI state — meal may appear until refresh, then disappear.

**Fix:** Global `OfflineBanner` (web + mobile) listening to `navigator.onLine` / `NetInfo`. Optimistic insert with local `pending` queue keyed by mealId; "queued" pill until server ack. Persist queued mutations through reconnect.

### A11Y-04 [P1 trust] — Cookie banner is non-modal, can be tabbed past

`CookieConsent.tsx:47-73`. `pointer-events-none` overlay with `pointer-events-auto` inner card. **Tab order continues into the page underneath.** Keyboard user can interact with app without ever giving consent — and their interactions still trigger PostHog if loaded before banner mounts.

**This is a UK/EU PECR signal failure.** Default no-choice state likely already loaded PostHog.

**Fix:** Either (a) make consent a true modal with focus trap and `aria-modal="true"`, or (b) hard-block analytics from initialising until `getConsentChoice() === "accepted"`.

### EMAIL-02 [P1 parity] — Web-only paying users receive NO Sunday recap

`app/api/push/weekly-recap/route.ts:231-235` filters profiles by `expo_push_token IS NOT NULL`. Web-push fan-out only iterates same `composed` set. **A user without mobile token never enters `composed` and thus never receives web push either.** Comment line 696 acknowledges the gap.

A web-only Pro user gets nothing on Sunday. They paid the same price.

**Fix:** Either (a) add email-recap path fan-out via real email sender, or (b) broaden eligibility query to include users with `web_push_subscriptions` rows.

---

## Other findings

### Error boundaries
- ERR-02 [P1]: `app/not-found.tsx` does NOT exist. Hitting `/recipe/zzzzzzz` shows bare Next 15 default 404 page — no Suppr brand, no recovery CTA.
- ERR-03 [P2]: `app/error.tsx` "Try again" has no escape hatch after repeated failures. After 2 resets, surface "Sign out and reload".
- ERR-04 [P1]: Mobile `+not-found.tsx` silently redirects to `/`. User has zero idea why their tap didn't land.

### Accessibility
- A11Y-01 [P1]: Mobile FAB / toast / sheets don't announce on open. No `accessibilityViewIsModal`, no focus management. VoiceOver continues reading Today underneath the sheet.
- A11Y-02 [P1]: Charts have no screen-reader summary. Macro ring, Progress charts, Burn detail — un-described `<svg>` / `<View>` without `accessibilityLabel`.
- A11Y-03 [P1]: No focus-visible ring on web buttons in `app/error.tsx`, `FeatureErrorBoundary`, `CookieConsent`, `FirstRunChecklist`. Keyboard users lose track of focus.
- A11Y-05 [P2]: `prefers-reduced-motion` not honoured. No CSS media query, no `AccessibilityInfo.isReduceMotionEnabled` check on mobile. Animations always play full intensity.
- A11Y-06 [P2]: `FirstRunChecklist` close button is 24×24px — touch target violation (spec: ≥36px web, ≥44pt mobile).
- A11Y-07 [P2]: Dynamic Type unreviewed. EmptyState `title: 13`, `description: 12` will overflow at 130%+ iOS Larger Text.

### Email / push
- EMAIL-03 [P2]: Recap push body has no unsubscribe / settings deep-link. From lock screen no path to manage.

### i18n
- I18N-01 [P3]: Mixed UK/US English. `target_fiber_g` (US) vs UK English elsewhere. Lint rule for `/\bfavorit/i`, `/\bcolor/i`, `/\bfiber\b/i`.
- I18N-02 [P1 trust]: Currency `£` hardcoded. US visitor sees `£` not `$`. UK/EU VAT-inclusive posture per memo requires inclusive display, but no per-region check.

### Diversity / inclusion
- DI-01 [P3]: `FirstRunChecklist` "You're all set!" toast borders on cheerleader tone — inconsistent with weeklyRecapPushBody rules ("no exclamation marks, no 'great job'").
- DI-02 [P2]: Sex-at-birth assumption in maintenance resolver. `sex: row.sex as never` cast suggests stringly-typed column. Verify non-binary / prefer-not-to-say handling.

---

## Trust concerns ranked

1. **A11Y-04**: Cookie banner can be ignored; analytics may load pre-consent. UK/EU PECR risk.
2. **EMAIL-01**: No real email infrastructure. Bare Supabase defaults.
3. **EMAIL-02**: Web-only users silently get no recap.
4. **ERR-01**: Mobile prod crashes are invisible. Sentry knows; user does not.
