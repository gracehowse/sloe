# TestFlight build-57 smoke checklist (ENG-1060)

**Build:** 1.0.7 (57) · **Session:** 2026-06-12 · **Device:** iPhone18_1, iOS 26.6  
**Tracker:** [`docs/testflight-feedback/tracker.md`](../testflight-feedback/tracker.md) (F-158–F-179)

Grace-owned device pass. Code/automation prep is done when this checklist exists + Maestro/unit paths are green; **Pass/Fail** columns require a physical TestFlight binary.

## Critical path (must pass before viral push)

| # | Flow | Steps | Pass | Notes |
|---|------|-------|------|-------|
| S1 | Cold open → Today | Kill app → launch TestFlight build | | |
| S2 | Log food | LogSheet → search → log → ring updates | | |
| S3 | Barcode (free) | LogSheet loud **Scan barcode** CTA → scan → log | | ENG-932/973 |
| S4 | Import → save | Share Reel URL → import → save to library | | |
| S5 | Plan → shop | Plan day → shopping list opens | | |
| S6 | Health sync probe | More → Health Sync → **Check meal import** | | ENG-874 prep |
| S7 | Paywall | Settings → Upgrade → trust chips incl. barcode-free | | |
| S8 | Sign out / in | Session survives; Today reloads | | |

## Build-57 styling threads (F-158–F-179)

Log each as **Pass / Fail / Won't fix (launch)** with screenshot ID from tracker.

| F# | Theme | Disposition |
|----|-------|-------------|
| F-158 | Complete Day button styling | |
| F-159–F-170 | Spacing / ring stroke / cohesion | |
| F-171 | Library tab regression | 🟡 fixes merged — re-verify TF58+ |
| F-161–F-162 | OFF search micros preview | 🟡 ENG-1062 — re-verify TF58+ |
| F-173 | Verify swap pill | 🟡 ENG-1066 — sim PASS, device confirm |
| F-177–F-179 | Planned card styling | |

## Automation already in repo

- Maestro: `apps/mobile/.maestro/validation/`
- Health matrix: [`health-sync-functionality-matrix.md`](./health-sync-functionality-matrix.md)
- Web Playwright journeys: `tests/e2e/journeys/`
