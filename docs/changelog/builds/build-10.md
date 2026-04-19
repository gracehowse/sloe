# Build 10 (1.0.0 #10) — 2026-04-19

This is the human-readable source for the in-app "What's new in Suppr"
entry rendered from `src/lib/changelog/entries.ts`. If you change
bullets here, update the matching entry in `entries.ts` in the same
commit — the app does **not** read this markdown at runtime.

## Fixed

- Apple Sign-In now works for everyone.
- Food search now shows natural servings for branded and restaurant
  items (e.g. 1 sandwich, 230 g).
- Create custom food now captures serving size, sugar, saturated fat,
  sodium, and barcode.
- Keyboard no longer covers the submit button on Login, Signup,
  Weight tracker, and others.
- Imported recipes now show their source at the bottom of the page.
- Household no longer fails to load with a multiple-rows error.
- Recipe instructions placeholder now renders a real newline between
  steps.

## New

- Weekly recap push notifications are now live (delivered on Saturday
  and Sunday evenings).
- Activity level can now be changed in Settings with a live TDEE
  preview.

## Coming soon

- Paywall clearly says "Trial unavailable in this build" until IAP
  provisioning lands.

---

Shaped by TestFlight feedback from 8 testers.
