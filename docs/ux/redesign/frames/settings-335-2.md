# Settings — Figma frame `335:2` spec

**Frame PNG (READ FIRST):** `docs/ux/redesign/frames/settings-335-2.png`
Source: Figma `B3UdOFup7ITersgNuoXh0l` node `335:2`.

## Tokens
Cream group cards `#F6F5F2` · plum `#3B2A4D` · body `#6A6072` · clay `#C8794E` · Sloe-Pro banner = soft peach/clay tint. Newsreader for "Settings" + name; Inter for rows.

## Layout (top → bottom)
1. **Top bar:** back chevron (left) + **"Settings"** (Newsreader, centered).
2. **Profile row:** plum circle avatar (initial) + name (Newsreader ~22px) + plan label "Free plan" (grey).
3. **"Sloe Pro" upsell banner** — full-width soft-peach/clay-tint rounded card: sparkle icon + "Sloe Pro" (clay) left, "Manage" (clay) right.
4. **Grouped sections** — each = uppercase grey section header + a single **cream rounded-card** containing rows. Each **row** = circle outline icon + label (Inter ~16px `#221B26`) + optional right-aligned value (grey) + chevron `›`.
   - **GOALS & TARGETS:** Daily goals (flag) › · Nutritional targets (target) ›
   - **DISPLAY:** Units → "kg, kcal" › · Appearance → "Light" ›
   - **CONNECTIONS:** Apple Health → "Connected" (grey) › · Google Fit ›
   - **REMINDERS:** Daily reminder → "08:00" › · Notifications ›
   - **ACCOUNT:** Export data › · Privacy policy ›
5. **"Delete account"** — clay/destructive text, centered, bottom.

## Biggest deltas vs current app
Capture current `/settings` (deep link `suppr:///settings`) and diff. Match: centered serif "Settings" title; the Sloe-Pro peach banner; the iOS-style grouped cards with uppercase section headers + circle-icon rows + right values + chevrons; the section grouping/order above; centered clay "Delete account".

## Preserve (wired — never drop)
All existing settings destinations: daily goals, nutritional targets, units, appearance/theme, Apple Health, (Google Fit if wired — else leave as a row that routes to the existing connections screen), reminders/notifications, export data, privacy policy, delete-account flow (fully wired — see project note), sign-out, plan/manage-subscription. Re-group to match the frame but do not drop any existing row; if the app has extra rows not in the frame, keep them in the closest matching section.
