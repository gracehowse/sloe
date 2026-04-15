# Suppr mobile (Expo)

Run all commands from **`apps/mobile`** (or use `npm run mobile:dev` from the repo root).

## Everyday dev

```bash
cd apps/mobile
npm install
npx expo start
```

Then open the **development build** (simulator, device, or Xcode) from the Expo CLI menu.

### Xcode and `ios/` (native project)

The **`ios/`** folder is **gitignored** — it only exists after you generate it on your machine:

```bash
cd apps/mobile
npx expo prebuild --platform ios
```

After prebuild, open **`ios/Suppr.xcworkspace`** (always the **workspace**, not `Suppr.xcodeproj` alone, so CocoaPods resolves). The main app target is **Suppr**.

If Xcode says **`mobile.xcodeproj` couldn’t be opened**, or **Failed to load container for document at url: …/mobile…** (path truncated in the banner), you have a stale **`ios/mobile.xcworkspace`** that points at a missing **`mobile.xcodeproj`**. Quit Xcode, run **`rm -rf ios/mobile.xcworkspace`**, then open **`ios/Suppr.xcworkspace`** (or **`npm run ios:xcode`**, which removes that folder first).

**`PhaseScriptExecution` failed** on **hermes-engine**, **ReactNativeDependencies**, or **`EXConstants` → “Generate app.config for prebuilt Constants.manifest”:** (1) Xcode’s script phases often don’t see `node` on `PATH` — **`npx expo prebuild --platform ios`** refreshes **`ios/.xcode.env`** / **`.xcode.env.local`** (see `withXcodeNodeBinary.js`). (2) If the log shows **`PluginError: Failed to resolve plugin … withXcodeNodeBinary`**, local Expo config plugins must be **`.js`** (not `.ts`) so Xcode’s config step can load them. In Xcode: **Report navigator** (⌘9) → failed build → expand the red **Run script** row for the real stderr. Turn **User Script Sandboxing** **off** for **Debug** if it’s on (it blocks some RN/CocoaPods scripts).

### Physical iPhone (USB)

1. Plug in the phone, unlock it, tap **Trust** if asked.
2. **Free Apple ID (“Personal Team”)** — Apple will **not** provision **Sign in with Apple** or **Push Notifications** for that team. Use one of:
   - **Paid [Apple Developer Program](https://developer.apple.com/programs/)** ($99/yr) to keep every capability, or
   - **Personal-team dev build**: regenerate iOS with entitlements stripped:

     ```bash
     cd apps/mobile
     npm run prebuild:ios:personal
     ```

     Then use email / magic link sign-in (Apple button stays hidden). **Apple Sign-In, remote push, and HealthKit** are omitted from the dev entitlements until you use a paid team and prebuild **without** `EXPO_IOS_PERSONAL_TEAM`.

     If a build still fails, scroll to the **bottom** of the Xcode log — the long “Target … in project Pods” block is normal; the real error is usually the last `error:` line (often provisioning vs entitlements).

### Apple Developer Program (paid team)

Use this once you are on the **$99/year** Apple Developer Program so **Sign in with Apple**, **Push Notifications**, and **HealthKit** can be provisioned.

1. **Apple Developer** — Sign in at [developer.apple.com](https://developer.apple.com), accept any pending **Agreements** (Programs / Paid Applications).
2. **Xcode account** — **Xcode → Settings → Accounts** → **+** → add your Apple ID → select your **Team** (the paid org, not “Personal Team”).
3. **App ID & capabilities** — [Certificates, Identifiers & Profiles → Identifiers](https://developer.apple.com/account/resources/identifiers/list) → **App IDs** → find or create **`com.supprclub.suppr`** (must match `app.json` `ios.bundleIdentifier` / `android.package` and your Apple Developer portal). Enable at least:
   - **Sign In with Apple**
   - **Push Notifications**
   - **HealthKit** (and **Background Modes** in Xcode later if you add HealthKit background delivery)
4. **Regenerate native iOS without the Personal Team stripper** — Do **not** set `EXPO_IOS_PERSONAL_TEAM`. From **`apps/mobile`**:

   ```bash
   npx expo prebuild --clean --platform ios
   ```

   This applies `expo-apple-authentication`, `expo-notifications`, HealthKit from `app.json`, and the Sentry plugin.
5. **Xcode signing** — Open **`ios/Suppr.xcworkspace`** → target **Suppr** → **Signing & Capabilities**:
   - **Team**: your paid team  
   - **Automatically manage signing**: on  
   - Confirm capabilities listed (Sign in with Apple, Push, HealthKit, etc.). Fix any red errors (usually enable the capability on the App ID in step 3, then **Download Manual Profiles** or toggle signing off/on).
   - **HealthKit “Usage Description” placeholders in Xcode:** Suppr only **reads** Apple Health (see `app.json` → `NSHealthShareUsageDescription` / `NSHealthUpdateUsageDescription`). After changing those strings, run **`npx expo prebuild --platform ios`** so `Info.plist` updates. In **Signing & Capabilities → HealthKit**, turn **off** **Clinical Health Records** and **HealthKit Background Delivery** unless you explicitly need them (they are off in our config).
6. **Install on device** — `npm run ios:device` / `npm run mobile:ios:device`, or **Run** from Xcode. If Metro over Wi‑Fi fails, use **`npm run ios:device:tunnel`** (see below).

**Backend / services (outside Xcode)**

- **Sign in with Apple (Supabase / web)** — In the [Supabase Auth Apple provider](https://supabase.com/docs/guides/auth/social-login/auth-apple) and Apple Developer **Services IDs**, configure the **Services ID**, **redirect URL**, and **key** Apple expects. The mobile app only needs the native entitlement; the **same** Apple app configuration often ties to your backend.
- **Remote push (APNs)** — For production tokens you need an **APNs Auth Key** (or certificates) in Apple Developer → **Keys**, and your push provider (e.g. Expo Push if you use `expo-notifications` with EAS, or your own server) must use that key. Local dev builds can still receive pushes once capabilities and provisioning are correct.

**Personal Team only:** after `npm run prebuild:ios:personal`, open Xcode → **Signing & Capabilities** → choose your **Personal Team** so the app installs.

**Install on device (any team):** from **`apps/mobile`**, `npm run ios:device`, or from the repo root `npm run mobile:ios:device`. Prefer **`npm run ios:device:tunnel`** / **`npm run mobile:ios:device:tunnel`** if you hit “Could not connect to development server”. On the phone, **Settings → Suppr → Local Network → On** when using LAN Metro; see the section below for tunnel vs Wi‑Fi.

### “Could not connect to development server” (real device)

The app is trying to load JS from something like `http://192.168.x.x:8081/...` and the **phone cannot reach your Mac** on that port.

**One command (recommended): tunnel + install/run on device**

From **`apps/mobile`**:

```bash
npm run ios:device:tunnel
```

From the **repo root**:

```bash
npm run mobile:ios:device:tunnel
```

This stops whatever is on port **8081**, starts **`expo start --tunnel`** in the background (log: `/tmp/suppr-expo-tunnel.log`), waits until Metro answers, then runs **`expo run:ios --device --no-bundler`**. After install, **force-quit** Suppr once if it still shows an old LAN URL, then reopen.

**Manual tunnel (same idea)**

1. Stop any existing Metro (quit the terminal running `expo start`, or kill whatever is using port **8081**).
2. From **`apps/mobile`**: `npm run start:tunnel` — or from the **repo root**: `npm run mobile:dev:tunnel`.
3. Wait until the log shows **`Tunnel ready`**.
4. Reconnect the dev client: in a **normal interactive terminal** (Terminal.app / iTerm), Expo prints a **QR code** and/or an **“Open in development build”** link—use that so the phone stops using a stale LAN URL.
5. **Force-quit** Suppr on the phone and open it again (or **Reload** from the dev menu).

**If you want to stay on LAN (same Wi‑Fi as the Mac)**

1. **Metro must be running** on the Mac in **`apps/mobile`**: `npm start` or `npx expo start` (leave that terminal open).

2. **Same network** — iPhone Wi‑Fi and Mac Wi‑Fi on the **same LAN** (not iPhone on cellular only; avoid **guest** Wi‑Fi / **client isolation** / captive portals). Disconnect VPN on **both** while testing.

3. **Local Network** — **Settings → Suppr → Local Network → On**. If you never saw a prompt, toggle off/on once or reinstall the dev build after enabling.

4. **Private Wi‑Fi address** — **Settings → Wi‑Fi → (your network) → Private Wi‑Fi Address**: try **Off** for that network while debugging (reduces odd routing on some routers).

5. **Mac firewall** — **System Settings → Network → Firewall**: allow **Node** (or **node**) for **incoming** connections, or add a rule for port **8081**, or temporarily disable the firewall to confirm.

6. **Sanity check** — On the iPhone, open **Safari** and visit `http://<IP-from-error>:8081` (example: `http://192.168.108.177:8081`). If the page does not load, fix network/firewall before changing app code.

7. **Stale IP** — If your Mac’s Wi‑Fi IP changed, restart `expo start` and reconnect via QR/link (tunnel or LAN) so the dev client picks up the new address.

**React Native dev menu (optional manual host)**

Shake the device → **Dev Settings** (or Expo dev menu) → **Configure bundler** / **Debug server host & port for device** — only if your tooling exposes it; prefer QR + tunnel when unsure.

### Simulator (one command)

```bash
npm run ios
```

## “No script URL provided” / `unsanitizedScriptURLString = (null)`

The native app is running in **debug** but **cannot see Metro** (or the JS bundle was never embedded in **Release**).

1. **Start the bundler first**  
   Leave `npx expo start` running in a terminal, then launch the app (don’t open the app from Xcode alone without Metro).

2. **Physical iPhone**  
   - **Settings → Suppr → Local Network → On** (Metro uses the LAN; iOS may not prompt until the app tries to connect).  
   - If the Mac and phone are on different networks or discovery fails, use a tunnel:  
     `npx expo start --tunnel`  
     (or `npm run start:tunnel` from `apps/mobile`.)

3. **Xcode scheme**  
   - **Debug** → expects Metro (steps above).  
   - **Release** → must embed the bundle at build time. If Release shows this error, the “Bundle React Native code and images” phase failed or was skipped; fix the iOS project (often after upgrading RN / Sentry).

4. **Stale native project + Sentry**  
   Regenerate iOS so the Sentry config plugin can refresh the bundle script (RN 0.81 + `@sentry/react-native` is picky):

   ```bash
   cd apps/mobile
   npx expo prebuild --clean --platform ios
   ```

   Then `npx expo run:ios` again.

5. **Still stuck**  
   In Xcode, select the project → **Build Phases** → **Bundle React Native code and images**. Compare with a fresh `expo prebuild` project or [Sentry’s RN docs](https://docs.sentry.io/platforms/react-native/manual-setup/metro/) / [issue #5168](https://github.com/getsentry/sentry-react-native/issues/5168) (wrong shell script paths break the bundle and produce this exact error).

## `xcodebuild` exit code 65 — Sentry / `sentry-cli`

If you see **`An organization ID or slug is required (provide with --org)`** during **Bundle React Native code and images**, local builds are trying to upload source maps without Sentry org/token.

- Prefer **`npm run ios`** / **`npm run ios:device`** / **`npm run android`** (they set `SENTRY_DISABLE_AUTO_UPLOAD=true`).
- Or run **`npx expo prebuild --platform ios`** so `ios/.xcode.env.local` gets `SENTRY_DISABLE_AUTO_UPLOAD=true` (skipped when `EAS_BUILD=true` so cloud builds can still upload if you add secrets).
- Or export **`SENTRY_ALLOW_FAILURE=true`** so upload failures do not fail the build.

## More

- [Expo dev builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [Expo Router](https://docs.expo.dev/router/introduction/)
