# Creator / trainer monetization — backlog (not scheduled)

**Status:** Backlog · **Coming soon** (user-facing teaser only)  
**Linear:** [ENG-666](https://linear.app/suppr/issue/ENG-666/creator-marketplace-paid-recipes-and-meal-plans-backlog)  
**Date:** 2026-05-24  
**Related:** Plan Import (wholesale plans), Library, Discover creators, paywall / IAP

## Problem

Coaches, meal-prep creators, and recipe authors already distribute PDFs, Notion plans, and Instagram content off-platform. Suppr can import those plans (Plan Import) but creators have no way to **earn** from distribution inside the app today.

## Direction (explore, not committed)

Allow trainers and creators to **monetise recipes and meal plans** through Suppr:

| Surface | Idea |
|---------|------|
| **Paid recipes** | Save to Library requires purchase (IAP or Stripe — TBD). Creator sets price; Suppr takes a platform fee. |
| **Paid plans** | Same for imported / published week plans — pay once, get template + optional recipe bundle. |
| **Free quota** | Mandate a minimum number of **free** recipes (and/or plan days) so discovery isn’t paywalled-only — e.g. “2 free recipes + 1 free sample day before paywall.” Exact numbers TBD with `monetisation-architect` + `legal-reviewer`. |
| **Alternatives** | If hard quotas feel punitive: rev-share on Suppr Pro referrals, tip jar, bundled coaching link-out, or “first week free / rest paid.” |

## Open questions (for `[G]` product pass)

1. **Who is a “creator”?** Verified humans only vs any user publishing?
2. **Payment rail:** Apple IAP (30%) vs web Stripe for plan PDFs already imported on web?
3. **Free minimum:** Fixed count vs % of catalog vs time-limited trial of full plan?
4. **Discover vs Library:** Paid items discoverable with preview, or link-only / invite?
5. **Plan Import overlap:** Imported third-party PDFs stay user-private; **published** creator plans are a separate SKU?
6. **Trust:** Nutrition verification bar for paid content — match Plan Import “Verified” vs “Published” modes.

## Not in scope now

- No schema, IAP products, or UI beyond **What's new → Coming soon** bullet.
- No Linear epic until product shape is chosen. Track as [ENG-666](https://linear.app/suppr/issue/ENG-666/creator-marketplace-paid-recipes-and-meal-plans-backlog).

## When to pick up

After Plan Import Sprint 1 ships and creator profile / publish flows have baseline usage data.
