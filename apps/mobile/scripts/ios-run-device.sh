#!/usr/bin/env bash
# Physical device: Metro must be running or you get "No script URL provided".
# This script starts Metro on 8081 if needed, then installs/runs the native app.
#
# Expo CLI quirk: it still resolves "default simulator" before matching your UDID.
# If you see "No iOS devices available in Simulator.app" with a physical UDID,
# install any iOS Simulator runtime (Xcode → Settings → Platforms) and add one
# iPhone simulator — you do not have to run the app on it; it just must exist.
#
# Device: set EXPO_IOS_DEVICE=<UDID> or pass UDID as args (after -- when using npm).
# Metro: defaults to --tunnel so the phone can load JS without LAN reachability to your Mac.
#        Use EXPO_IOS_LAN=1 for plain "expo start" (same Wi‑Fi as Mac; may fail with AP isolation).
#        When EXPO_IOS_LAN=1, an existing Metro on 8081 is restarted without --tunnel so the dev
#        client does not keep a stale exp.direct URL (tunnel died → "Could not connect").
# SUPPR_SKIP_METRO_RESTART=1 — keep Metro already on 8081 (e.g. `npx expo start --tunnel` in another tab).
# SUPPR_KEEP_METRO=1 — never stop/restart Metro (use if you intentionally started Metro yourself).
# List devices: xcrun xctrace list devices
#
# Hangs on "Connecting to: <iPhone>" + flaky dev server: Expo uses USB first, then devicectl (often
# broken with newer Xcode JSON). Unplug Apple Watch / other USB Apple devices, USB-C data cable only,
# phone unlocked → `npm run ios:usb-devices` → retry. Or build here then Product → Run from Xcode
# while Metro stays on 8081. Dev Client empty list → shake → Enter URL from Metro terminal / log tail.
set -euo pipefail
cd "$(dirname "$0")/.."
export SENTRY_DISABLE_AUTO_UPLOAD=true

log() { printf '%s\n' "$*"; }

metro_up() {
  curl -sf "http://127.0.0.1:8081/status" >/dev/null 2>&1
}

stop_metro_8081() {
  local pids
  pids="$(lsof -ti :8081 -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "${pids:-}" ]]; then
    log "Stopping process(es) on port 8081: $pids"
    kill -9 $pids 2>/dev/null || true
    sleep 1
  fi
}

ensure_metro() {
  local want_tunnel=1
  if [[ "${EXPO_IOS_LAN:-}" == "1" ]]; then
    want_tunnel=0
  fi

  if metro_up; then
    if [[ "${SUPPR_SKIP_METRO_RESTART:-}" == "1" ]]; then
      log "Metro already on 8081 — SUPPR_SKIP_METRO_RESTART=1, reusing existing process."
      return 0
    fi
    if [[ "${SUPPR_KEEP_METRO:-}" == "1" ]]; then
      log "Metro already responding on http://127.0.0.1:8081 — SUPPR_KEEP_METRO=1, reusing."
      return 0
    fi
    if [[ "$want_tunnel" == "1" ]]; then
      log "Metro is already on 8081 — restarting with --tunnel so your phone does not rely on LAN 192.168.x.x."
      stop_metro_8081
    else
      log "Metro is already on 8081 — restarting without --tunnel (LAN packager) so the dev client is not stuck on an old exp.direct URL."
      stop_metro_8081
    fi
  fi

  if [[ "${SUPPR_IOS_SKIP_METRO:-}" == "1" ]]; then
    log "SUPPR_IOS_SKIP_METRO=1 but nothing is listening on 8081." >&2
    log "In another terminal run:  cd apps/mobile && npx expo start --tunnel" >&2
    log "LAN-only:  cd apps/mobile && npx expo start   then EXPO_IOS_LAN=1 npm run ios" >&2
    exit 1
  fi

  local logfile="/tmp/suppr-expo-metro-ios-device.log"
  if [[ "$want_tunnel" == "0" ]]; then
    log "Starting Metro on LAN (log: $logfile). Phone must reach this Mac on port 8081 (same Wi‑Fi, no AP isolation)."
    nohup npx expo start >"$logfile" 2>&1 &
  else
    log "Starting Metro with --tunnel (log: $logfile)…"
    nohup npx expo start --tunnel >"$logfile" 2>&1 &
  fi
  METRO_PID=$!
  log "Metro PID: $METRO_PID"
  local ok=0
  for _ in $(seq 1 120); do
    if metro_up; then
      ok=1
      break
    fi
    if ! kill -0 "$METRO_PID" 2>/dev/null; then
      log "Metro exited early. Last log lines:" >&2
      tail -40 "$logfile" >&2 || true
      exit 1
    fi
    sleep 1
  done
  if [[ "$ok" != "1" ]]; then
    log "Metro did not become ready on 8081 in time." >&2
    tail -40 "$logfile" >&2 || true
    exit 1
  fi
  # Tunnel/ngrok needs a moment after /status passes; without this, expo run:ios often races and the
  # Dev Client shows "No development servers found" while install sits on "Connecting…".
  if [[ "$want_tunnel" == "1" ]]; then
    log "Waiting 12s for tunnel registration before Xcode install…"
    sleep 12
    if [[ -n "${EXPO_IOS_DEVICE:-}" ]] || [[ "${SUPPR_SHOW_METRO_LOG:-}" == "1" ]]; then
      log "--- Metro log (last 35 lines; copy exp+ / https URL into Dev Client → Enter URL manually) ---"
      tail -35 "$logfile" 2>/dev/null || true
      log "--- end Metro log excerpt ---"
    fi
  fi

  # Tunnel/ngrok can pass /status briefly then exit when ngrok is down — don't hand off to Xcode with dead Metro.
  if ! metro_up; then
    local ok2=0
    log "Metro not responding right after startup wait — retrying /status for up to 45s…"
    for _ in $(seq 1 45); do
      if metro_up; then
        ok2=1
        break
      fi
      sleep 1
    done
    if [[ "$ok2" != "1" ]]; then
      log "Metro never stayed up on http://127.0.0.1:8081 (tunnel start often fails when ngrok is unreachable)." >&2
      log "Last log lines from $logfile:" >&2
      tail -60 "$logfile" >&2 || true
      log "" >&2
      log "Fix: same Wi‑Fi as this Mac →  EXPO_IOS_LAN=1 npm run ios   (skips tunnel)" >&2
      log "Or: wait for ngrok / Expo tunnel recovery → https://status.ngrok.com/" >&2
      log "Or: Terminal 1:  cd apps/mobile && npx expo start --tunnel   then Terminal 2:  SUPPR_SKIP_METRO_RESTART=1 npm run ios" >&2
      exit 1
    fi
  fi
}

ensure_metro
log "If Dev Client shows 'No development servers found': keep Metro running, then shake phone → Enter URL manually (packager host from Metro table, or tail -40 /tmp/suppr-expo-metro-ios-device.log)."

DEVICE_ARGS=(--device)
if [[ -n "${EXPO_IOS_DEVICE:-}" ]]; then
  DEVICE_ARGS=(--device "$EXPO_IOS_DEVICE")
elif [[ $# -gt 0 ]]; then
  DEVICE_ARGS=(--device "$@")
fi

# Re-check Metro: tunnel can briefly pass /status then flap; expo "Waiting on localhost:8081" otherwise.
if ! metro_up; then
  log "ERROR: Metro is not responding on http://127.0.0.1:8081 before install. Check /tmp/suppr-expo-metro-ios-device.log or start Metro manually." >&2
  exit 1
fi

exec npx expo run:ios --no-bundler "${DEVICE_ARGS[@]}"
