# Web / mobile parity & navigation scope

**Status:** Active product decisions (engineering follows; do not “fix” as unscoped parity bugs).

**Last confirmed:** 2026-04-16

## Discover / Plan / Profile — screen-by-screen audit

- **Discover, Plan (meal planner), and Profile** may still differ between web and mobile in **styling, density, and minor feature placement**.
- Closing those gaps is a **manual product pass** (screen-by-screen review, acceptance criteria, then ticketed work).
- **No standing engineering mandate** to drive repo-wide alignment from an automated audit alone.

## Photo / voice parity and tier gating

- **Photo logging and voice logging** remain **partial parity** where copy and UX naturally overlap other work.
- **No new** subscription **tier gating**, paywall surfaces, or **mobile-only** logging flows are in scope until product runs a dedicated initiative.
- Do not expand scope (e.g. new Pro gates, exclusive mobile entry points) without an explicit product spec.

## Library navigation

- **Library is not a bottom tab** by design.
- Discovery path: **header shortcut** to Library plus the **hidden `view=library` route** (and equivalent deep links where applicable).
- Treat “Library missing from tab bar” as **intentional information architecture**, not a defect, unless product reopens navigation.

## Related

- Maestro and Playwright setup: `apps/mobile/.maestro/README.md`, `tests/e2e/README.md`.
