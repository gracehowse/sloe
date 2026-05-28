# TestFlight feedback — fetching

Pull TestFlight screenshot feedback and crash submissions from App Store Connect
into the repo so we can triage together.

## One-time setup (~3 minutes)

1. **Create an ASC API key**
   - App Store Connect → [Users and Access](https://appstoreconnect.apple.com/access/api) → Integrations tab → Keys
   - Click **Generate API Key** (or the **+** button)
   - Name: `suppr-feedback-reader`
   - Access: **App Manager** (minimum needed to read builds + feedback)
   - Click Generate. Download the `.p8` file — you only get it once.
2. **Copy the credentials**
   - Move the `.p8` file somewhere safe and not checked in, e.g. `~/.keys/AuthKey_XXXXXX.p8`
   - From the Keys list page note:
     - **Key ID** (10 chars, e.g. `ABC1234567`)
     - **Issuer ID** (UUID shown at top of the Keys page)
3. **Add to `.env.local`** at the repo root:
   ```
   ASC_KEY_ID=ABC1234567
   ASC_ISSUER_ID=69a6de70-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   ASC_PRIVATE_KEY=/Users/you/.keys/AuthKey_ABC1234567.p8
   ASC_APP_ID=6762522932
   ```
   (`ASC_PRIVATE_KEY` can be a path to the `.p8` file, or the file contents
   pasted inline — both work.)

## Fetching feedback

```bash
npm run testflight:feedback
```

Writes two files to `docs/testflight-feedback/data/`:

- `feedback-YYYY-MM-DD.json` — deduped summary (read this first)
- `feedback-YYYY-MM-DD-raw.json` — raw ASC API payloads

Both files are gitignored by default to keep tester emails + screenshots out of
the repo. If you want to commit a specific snapshot for planning, force-add it
with `git add -f`.

## Troubleshooting

- **401 UNAUTHORIZED**: key ID / issuer ID wrong, or the key was revoked in ASC.
- **403 FORBIDDEN**: the API key's access role isn't high enough. App Manager
  or higher is needed for TestFlight feedback endpoints.
- **404 on the app**: `ASC_APP_ID` is wrong. Check the URL in ASC — numeric ID
  is in `appstoreconnect.apple.com/apps/NUMBER/...`.
- **Empty `screenshotFeedback` / `crashFeedback` arrays**: no testers have
  submitted anything yet. Builds older than 90 days stop returning feedback.

## Resolved incidents (prod / schema)

Shipped fixes tied to TestFlight threads are logged in **[resolved.md](./resolved.md)** so they survive outside gitignored `data/` exports.

## Centercode (beta program)

For cohort management, release notes to testers, and structured in-app feedback (not screenshot/layout QA), see **[`docs/operations/centercode-beta-feedback.md`](../operations/centercode-beta-feedback.md)**. Centercode can sync with TestFlight external groups; ASC API pulls remain the source for screenshot feedback exports above.

## Related

- [Main App Store Connect API docs](https://developer.apple.com/documentation/appstoreconnectapi)
- [Visual regression (Playwright / Maestro)](../testing/VISUAL_REGRESSION.md)
- [Beta feedback endpoints](https://developer.apple.com/documentation/appstoreconnectapi/list_beta_feedback_screenshot_submissions)
