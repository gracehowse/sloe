# Sloe email templates

EMAIL-01 (audit 2026-04-28) — kills the Phase 6 P0 finding that "default
Supabase emails are scammy on first signup." Rebranded Suppr → Sloe
2026-07-01 (ENG-1289); brand drift is guarded by
`tests/unit/brandDriftSloe.test.ts`. The deliverable splits in two:

1. **Supabase Auth templates** (`supabase-auth/`) — Welcome / Confirm /
   Reset / Magic-link / Change-email / Invite. The canonical source is
   `supabase/templates/*.html` + the `[auth.email.template.*]` subjects
   in `supabase/config.toml`, applied with `supabase config push
   --project-ref fnfgxsignmuepshbebrl`; this directory is a byte-identical
   human-reference mirror. Variables follow Supabase's documented
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
- Brand ink: Sloe plum `#3B2A4D` — the literal hex mirrors
  `--foreground-brand` in `src/styles/theme.css` (email HTML can't use
  CSS vars). Wordmark text, primary button fill, and link colour. The
  pre-rebrand blue→magenta gradient (`#4c6ce0` → `#e04888`) is retired.
- Wordmark: lowercase `sloe` in a serif stack (`'Fraunces', Georgia,
  'Times New Roman', serif`) — mail clients don't load webfonts, so
  Georgia stands in for the Fraunces logotype.
- Single 600px-wide content column. Renders correctly on Gmail
  desktop, Apple Mail desktop, and Apple Mail iOS down to 320px.
- No tracking pixels, no analytics beacons in the templates
  themselves. Open-rate signal is acceptable to lose.

## Installation

Templates + subjects apply from the repo:

```
supabase config push --project-ref fnfgxsignmuepshbebrl
```

The Dashboard (Authentication → Email Templates) reflects the pushed
state. Manual fallback: copy each HTML body from `supabase-auth/` into
the matching Dashboard template and set the subject from the comment at
the top of the file.

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
- Real Sloe wordmark (plum logotype) — improves brand-recognition spam
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
