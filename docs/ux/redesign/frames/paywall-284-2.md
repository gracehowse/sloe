# Paywall — Figma frame `284:2` spec

**Frame PNG (READ FIRST):** `docs/ux/redesign/frames/paywall-284-2.png`
Source: Figma `B3UdOFup7ITersgNuoXh0l` node `284:2`.

## Tokens
Cream `#F6F5F2` · plum `#3B2A4D` · body `#6A6072` · clay `#C8794E` (CTA, selected plan, BEST VALUE) · PRO column highlight = lilac. Newsreader headline; Inter body.

## Layout (top → bottom)
1. **Hero** — full-bleed food **photo** + close X (top-right). Soft fade into content.
2. **"SLOE PRO"** eyebrow (clay, uppercase, tracked) + **headline** "Cook what you love. / *Still* reach your goals." (Newsreader, "Still" italic) overlaid on the fade.
3. **2×2 feature grid** (cream rounded cards): each = icon + title + one-line desc:
   - **Unlimited saves** — "Keep every recipe you love." *(ENG-1444/LEGAL-012, 2026-07-16: was "Unlimited imports" — recipe import has never been tier-gated; the real Free-vs-Pro differentiator is the save limit. Corrected to match the shipped `PAYWALL_VALUE_PROPS` SSOT so this prototype can't reseed the false claim in a future conformance pass.)*
   - **Macro fitting** — "Auto-fit any recipe to your day."
   - **AI coach** — "Personalised, guilt-free nudges."
   - **Cloud sync** — "Your journal, safe on every device."
4. **Comparison table** — two columns **FREE** / **PRO** (PRO column lilac-highlighted), rows with ✓ / – : Log meals & macros (✓/✓) · Browse community recipes (✓/✓) · Unlimited saves (–/✓) · AI macro fitting (–/✓).
5. **Plan selector:**
   - **Annual** — "BEST VALUE" clay badge, "Save 28%", "£19.99/yr · just £1.66/mo", SELECTED (clay border + clay radio).
   - **Monthly** — "£2.99/mo".
6. **Trust row** — "🔒 Secure checkout · 🗓 Cancel anytime".
7. **CTA** — "Start free 7-day trial →" (clay fill, white).
8. **Fine print** — "Subscription auto-renews unless cancelled 24h before period end. Restore · Terms".

## Biggest deltas vs current app
Capture current `/paywall` (deep link `suppr:///paywall`) and diff. Match: photo hero + SLOE PRO/positioning headline; the 2×2 value-prop grid; the FREE/PRO comparison table with lilac PRO column; the Annual(BEST VALUE, selected)/Monthly selector with the £ pricing + per-month math; the trust row; the trial CTA; the fine print + Restore/Terms. **Pricing must stay region-aware** (don't hard-code £ if the app already resolves currency) and **VAT-inclusive** on UK/EU per the consumer-VAT posture — use the app's existing price/currency resolver, only restyle.

## Preserve (wired — never drop)
Plan selection (annual/monthly), the real price/currency/trial values from the billing layer, checkout/trial start, restore purchases, Terms link, close/dismiss, any entitlement gating. Do NOT invent prices — bind to the existing pricing source.
