# Platemate mobile (Expo)

Run all commands from **`apps/mobile`** (or use `npm run mobile:dev` from the repo root).

## Everyday dev

```bash
cd apps/mobile
npm install
npx expo start
```

Then open the **development build** (simulator, device, or Xcode) from the Expo CLI menu.

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

3. In Xcode (after prebuild): **Signing & Capabilities** → pick your **Team** so the dev build installs.
4. From **`apps/mobile`**:

   ```bash
   npm run ios:device
   ```

   From the **repo root**:

   ```bash
   npm run mobile:ios:device
   ```

   That runs `expo run:ios --device`, builds, installs, and starts Metro.

5. On the phone: **Settings → Platemate → Local Network → On** so Metro on your Mac is reachable. If it still won’t load JS, start Metro with a tunnel:

   ```bash
   npm run start:tunnel
   ```

   Then open the app again (or re-run `ios:device`).

### “Could not connect to development server” (real device)

The app is trying to load JS from something like `http://192.168.x.x:8081/...` and the **phone cannot reach your Mac** on that port.

1. **Metro must be running** on the Mac in **`apps/mobile`**: `npm start` or `npx expo start` (leave that terminal open). `npm run ios:device` starts it in some setups; if you closed that process, start Metro again.

2. **Same network** — iPhone Wi‑Fi and Mac Wi‑Fi should be the **same LAN** (not iPhone on cellular only; avoid **guest** Wi‑Fi / AP isolation). Disconnect VPN on **both** while testing.

3. **Local Network** — **Settings → Platemate → Local Network → On**. If you never saw a prompt, toggle off/on once or reinstall the dev build after enabling.

4. **Mac firewall** — **System Settings → Network → Firewall** (or Security): allow **Node** / **incoming** for port **8081**, or temporarily turn the firewall off to confirm.

5. **Quick check** — On the iPhone, open **Safari** and visit `http://192.168.108.177:8081` (use the IP shown in your error). If it doesn’t connect, it’s network/firewall, not the app.

6. **Tunnel (works across networks)** — Stop Metro, then:

   ```bash
   npm run start:tunnel
   ```

   In the Expo CLI, open the project on the device again (link / QR / `i`). The bundle URL will **not** use your LAN IP; the phone reaches Metro via Expo’s tunnel.

7. **Stale IP** — If your Mac’s Wi‑Fi IP changed, fully **kill and reopen** the app or use the dev menu **Reload** after restarting `expo start` so it picks up the current address.

### Simulator (one command)

```bash
npm run ios
```

## “No script URL provided” / `unsanitizedScriptURLString = (null)`

The native app is running in **debug** but **cannot see Metro** (or the JS bundle was never embedded in **Release**).

1. **Start the bundler first**  
   Leave `npx expo start` running in a terminal, then launch the app (don’t open the app from Xcode alone without Metro).

2. **Physical iPhone**  
   - **Settings → Platemate → Local Network → On** (Metro uses the LAN; iOS may not prompt until the app tries to connect).  
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
