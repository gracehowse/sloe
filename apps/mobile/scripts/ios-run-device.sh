#!/usr/bin/env bash
# Physical device: Metro must be running or you get "No script URL provided".
# This script starts Metro on 8081 if needed, then installs/runs the native app.
#
# Device: set EXPO_IOS_DEVICE=<UDID> or pass UDID as args (after -- when using npm).
# Metro: defaults to --tunnel so the phone can load JS without LAN reachability to your Mac.
#        Use EXPO_IOS_LAN=1 for plain "expo start" (same Wi‑Fi as Mac; may fail with AP isolation).
# List devices: xcrun xctrace list devices
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
    if [[ "$want_tunnel" == "1" ]] && [[ "${SUPPR_KEEP_METRO:-}" != "1" ]]; then
      log "Metro is already on 8081 — restarting with --tunnel so your phone does not rely on LAN 192.168.x.x (override with SUPPR_KEEP_METRO=1)."
      stop_metro_8081
    else
      log "Metro already responding on http://127.0.0.1:8081 — reusing."
      return 0
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
}

ensure_metro

DEVICE_ARGS=(--device)
if [[ -n "${EXPO_IOS_DEVICE:-}" ]]; then
  DEVICE_ARGS=(--device "$EXPO_IOS_DEVICE")
elif [[ $# -gt 0 ]]; then
  DEVICE_ARGS=(--device "$@")
fi

exec npx expo run:ios --no-bundler "${DEVICE_ARGS[@]}"
