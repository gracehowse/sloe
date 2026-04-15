#!/usr/bin/env bash
# Physical iPhone often cannot reach the Mac's LAN IP (firewall, AP isolation, VPN).
# This script stops anything on 8081, starts Metro with --tunnel, waits until it is up,
# then runs expo run:ios (no second bundler). Metro keeps running in the background.
set -euo pipefail
cd "$(dirname "$0")/.."

log() { printf '%s\n' "$*"; }

stop_8081() {
  local pids
  pids="$(lsof -ti :8081 -sTCP:LISTEN 2>/dev/null || true)"
  if [ -n "${pids:-}" ]; then
    log "Stopping process(es) on port 8081: $pids"
    kill -9 $pids 2>/dev/null || true
    sleep 1
  fi
}

if [ "${SUPPR_KEEP_METRO:-${PLATEMATE_KEEP_METRO:-}}" = "1" ]; then
  log "SUPPR_KEEP_METRO=1 (or PLATEMATE_KEEP_METRO=1) — not stopping existing Metro on 8081."
else
  stop_8081
fi

if ! curl -sf "http://127.0.0.1:8081/status" >/dev/null 2>&1; then
  log "Starting Metro with tunnel (logs: /tmp/suppr-expo-tunnel.log)…"
  nohup npx expo start --tunnel > /tmp/suppr-expo-tunnel.log 2>&1 &
  METRO_PID=$!
  log "Metro PID: $METRO_PID"
  ok=0
  for i in $(seq 1 120); do
    if curl -sf "http://127.0.0.1:8081/status" >/dev/null 2>&1; then
      ok=1
      break
    fi
    if ! kill -0 "$METRO_PID" 2>/dev/null; then
      log "Metro exited early. Last log lines:"
      tail -30 /tmp/suppr-expo-tunnel.log || true
      exit 1
    fi
    sleep 1
  done
  if [ "$ok" != "1" ]; then
    log "Metro did not become ready on http://127.0.0.1:8081/status in time."
    tail -40 /tmp/suppr-expo-tunnel.log || true
    exit 1
  fi
  log "Metro is up (tunnel). If the app still shows an old LAN URL, force-quit Suppr and open again, or scan the QR in: tail -f /tmp/suppr-expo-tunnel.log"
else
  log "Metro already responding on 8081 — reusing it. For tunnel, stop it first or run without SUPPR_KEEP_METRO=1."
fi

export SENTRY_DISABLE_AUTO_UPLOAD=true
exec npx expo run:ios --no-bundler --device "$@"
