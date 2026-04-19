# Decision: Renewal disclosure rewrite — legal-required body-size block on /pricing

**Date:** 2026-04-19

**Decision**
The 11px muted one-liner under paid-tier checkout buttons on `/pricing` was blocked by legal-reviewer as insufficient for California ARL, FTC Negative Option Rule, and EU Consumer Rights Directive; it has been replaced with a body-size disclosure block meeting all three frameworks.

**Rationale**
The old copy ("Billed monthly until cancelled. Cancel anytime.") was rendered in 11px muted text below the CTA. Three regulatory frameworks converge on the same requirement: material subscription terms — price, cadence, auto-renewal mechanism, first-charge timing, cancellation path, and refund policy — must be clearly visible before the user commits, not buried in small print. California ARL and the FTC Negative Option Rule are particularly explicit that disclosures must be "clear and conspicuous". The EU Consumer Rights Directive adds requirements around pre-contractual information. A single muted sentence fails all three. The replacement is a body-size block that includes: price + cadence, explicit auto-renewal wording, first-charge timing, cancel path, refund policy link, and tax-handling note. This change also reduces chargeback and subscription-dispute risk.

**Alternatives considered**
- Increase the font size of the existing one-liner to body size — rejected because the content was also insufficient (missing auto-renewal wording, first-charge timing, cancel path, refund link, and tax note), so a resize alone would not achieve compliance.
- Move full disclosure to the Terms of Service page and link to it from the CTA — rejected because regulators and case law are clear that disclosure by reference (a link) does not satisfy the "clear and conspicuous" standard for negative-option subscriptions.
- Add a mandatory acknowledgement checkbox instead of visible copy — rejected as a design anti-pattern that adds friction without being inherently more compliant; the disclosure still has to be visible even with a checkbox.

**Platforms affected**
Web only (`app/pricing/page.tsx`). Mobile paywall (RevenueCat / App Store / Google Play) is governed by store-side disclosure rules; that path has a separate review and is not in scope here.

**Agents involved**
legal-reviewer (blocker + requirements), monetisation-architect (owns final copy), product-memory (capture).

**Status**
Active — implementation complete; final copy pending sign-off from monetisation-architect. No landing claim or checkout flow should revert to the old one-liner pattern.

**Revisit on**
- Regulatory change: if FTC Negative Option Rule is amended or California ARL enforcement guidance shifts.
- New payment cadence (e.g. annual plans added): disclosure block must be updated to reflect the new cadence and first-charge amount before launch.
- Mobile paywall brings web-style checkout inside the app (in-app browser Stripe flow): disclosure rules from this decision would then apply to that surface too.

**Related**
- `app/pricing/page.tsx` — affected file.
- `docs/product/subscriptions-stripe-and-iap.md` — subscription system overview; mobile paywall disclosure is handled separately under store rules.
- `docs/decisions/2026-04-19-shopping-list-tier-gating.md` — companion decision from same sweep.
- `docs/decisions/2026-04-19-voice-logging-pro-only-server-enforced.md` — companion decision from same sweep.
- `docs/decisions/2026-04-full-sweep-ship-verdict.md` — the broader ship verdict that flagged legal/copy items as a blocker class.
