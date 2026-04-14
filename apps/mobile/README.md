# Platemate mobile (Expo)

Run all commands from **`apps/mobile`** (or use `npm run mobile:dev` from the repo root).

## Everyday dev

```bash
cd apps/mobile
npm install
npx expo start
```

Then open the **development build** (simulator, device, or Xcode) from the Expo CLI menu. For a one-shot iOS run (starts Metro and installs/launches):

```bash
npx expo run:ios
# Physical device:
npx expo run:ios --device
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

## More

- [Expo dev builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [Expo Router](https://docs.expo.dev/router/introduction/)
