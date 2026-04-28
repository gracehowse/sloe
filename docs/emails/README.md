# Suppr email templates

EMAIL-01 (audit 2026-04-28) — kills the Phase 6 P0 finding that "default
Supabase emails are scammy on first signup." The deliverable splits in
two:

1. **Supabase Auth templates** (`supabase-auth/`) — Welcome / Confirm /
   Reset / Magic-link / Change-email / Invite. These are configured in
   the Supabase Dashboard (`Authentication → Email Templates`). The
   HTML files in this directory are the canonical source; copy-paste
   into the dashboard. Variables follow Supabase's documented
   templating syntax (`{{ .ConfirmationURL }}`, `{{ .Email }}`, etc.).

2. **Custom transactional emails** (trial-ending / subscription /
   weekly digest / etc.) — **NOT YET BUILT.** Requires a vendor
   selection (Resend / SendGrid / SES / Postmark) which is a separate
   monetisation-architect + integration-manager call. Templates land
   here once that's chosen.

## Voice

Per `docs/ux/brand-guidelines.md` §6 — "knowledgeable but never
preachy, precise but never clinical, confident but never loud." Body
copy is short, action is explicit, footer is honest.

## Visual constraints

- Inline CSS only. Mail clients reject `<style>` blocks unpredictably.
- Suppr brand gradient: `linear-gradient(135deg, #4c6ce0 0%, #e04888
  100%)`. Used on the primary button background.
- Single 600px-wide content column. Renders correctly on Gmail
  desktop, Apple Mail desktop, and Apple Mail iOS down to 320px.
- No tracking pixels, no analytics beacons in the templates
  themselves. Open-rate signal is acceptable to lose.

## Installation

For each `.html` file in `supabase-auth/`:

1. Open Supabase Dashboard → Authentication → Email Templates
2. Pick the matching template (e.g. "Confirm signup", "Magic link")
3. Open the file, copy the HTML body, paste into the dashboard
4. Set the subject line from the comment at the top of each file
5. Save

The `Site URL` in `Authentication → URL Configuration` must match the
domain Supabase emits in `{{ .ConfirmationURL }}`. For production this
is `https://suppr-club.com`.

## Template variables

Supabase Auth templates use Go-style templating. Each template only
references variables it needs; missing variables render as empty
strings (not as the raw `{{ .Foo }}` placeholder).

| Variable | When set | What it carries |
|---|---|---|
| `{{ .ConfirmationURL }}` | Confirm signup, Reset, Magic link, Invite | Full URL to the confirmation endpoint |
| `{{ .Token }}` | All | The OTP / one-time token (if you'd rather show a code than a link) |
| `{{ .Email }}` | All | The recipient's email |
| `{{ .RedirectTo }}` | Some | Post-confirm redirect URL (rarely needed in body copy) |
| `{{ .SiteURL }}` | All | Configured site URL — used for the logo link / footer |
| `{{ .NewEmail }}` | Change email confirmation | The user's new email address |

## Spam-rate / deliverability

The templates avoid common spam triggers:
- No "URGENT", "ACT NOW", "FREE" in subject lines
- Plaintext fallback link below every primary button
- Footer carries the company contact + privacy email (not a `noreply@`
  trap)
- Single `<a>` per call-to-action (no link soup)
- Real Suppr logo (gradient mark) — improves brand-recognition spam
  score

Once Supabase is configured to use a custom SMTP provider (vs the
default Supabase relay), set up SPF + DKIM + DMARC for the sending
domain. The default Supabase relay limits to ~30 emails/hour and is
not appropriate for production; flip to custom SMTP before any
beta-tester scale-up.

## Outstanding (not in this batch)

- Vendor selection for custom transactional emails (trial-ending,
  subscription, weekly digest, plan-build-failed)
- React Email or MJML build pipeline if templates start needing
  shared components (header / footer / brand button)
- Localisation strategy (English-only for v1)
- Unsubscribe machinery for the digest / trial-ending streams
- Open / click tracking decision (currently: deliberately none)

These are deferred to a follow-up that pairs the brand-manager (voice)
+ legal-reviewer (footer, unsubscribe wording, GDPR posture) +
integration-manager (vendor) + executor (code).
