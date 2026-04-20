<wizard-report>
# PostHog post-wizard report

The wizard has completed a targeted integration extending Suppr's already mature PostHog setup. The project had `posthog-js` installed, an `AnalyticsProvider`, a comprehensive event registry (`src/lib/analytics/events.ts`), and server-side tracking (`serverTrack.ts`) — all in good shape. The gaps were: no user identification on auth state changes, no signup/signin events, no `checkout_started` being fired at the button level, and no `onboarding_step_completed` events wiring the new v2 onboarding flow.

## Changes made

| Event | Description | File |
|---|---|---|
| `posthog.identify()` | Called on every auth state change (page reload, session restore, sign-out reset) so all anonymous events are stitched to the Supabase user ID | `src/context/AuthSessionContext.tsx` |
| `user_signed_up` | Fires after successful email+password signup or Apple SSO intent; calls `posthog.identify()` with the new user ID + email | `app/login/ui.tsx` |
| `user_signed_in` | Fires after successful email+password signin or Apple SSO intent; calls `posthog.identify()` | `app/login/ui.tsx` |
| `checkout_started` | Fires when the Stripe checkout URL is received and the user is about to be redirected. Payload: `{ tier, period }` | `app/pricing/CheckoutButton.tsx` |
| `onboarding_step_completed` | Fires on every Continue press in the v2 onboarding web flow. Payload: `{ step_id, step_index, step_total, goal? }` | `src/app/components/onboarding-v2/web-flow.tsx` |
| Registry additions | Added `user_signed_up` and `user_signed_in` to `AnalyticsEvents` with JSDoc | `src/lib/analytics/events.ts` |
| Env vars | Set `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, and `POSTHOG_HOST` in `.env.local` | `.env.local` |

## Next steps

We've built a dashboard and five insights to keep an eye on user behaviour based on the events instrumented:

**Dashboard**
- [Analytics basics](https://us.posthog.com/project/389168/dashboard/1486716)

**Insights**
- [Signup → Onboarding → First food log (Activation funnel)](https://us.posthog.com/project/389168/insights/13ZR3uMK) — 7-day window funnel from account creation through onboarding to first food logged
- [Pricing → Checkout started → Checkout completed (Revenue funnel)](https://us.posthog.com/project/389168/insights/VaMd8xK2) — 3-day window funnel measuring checkout conversion
- [New signups per day](https://us.posthog.com/project/389168/insights/PBeRsykF) — daily signup volume trend over the last 30 days
- [Onboarding v2 step drop-off](https://us.posthog.com/project/389168/insights/kIHceFao) — completion count per step, broken down by `step_id`, to surface which steps lose the most users
- [Pace safety floor warning rate](https://us.posthog.com/project/389168/insights/tVKhtr32) — `shown` vs `advanced` breakdown for the soft-warn pace policy; feeds the legal/product review gate

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/integration-nextjs-app-router/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
