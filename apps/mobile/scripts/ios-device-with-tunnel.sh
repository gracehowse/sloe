#!/usr/bin/env bash
# Physical iPhone often cannot reach the Mac's LAN IP (firewall, AP isolation, VPN).
# This script stops anything on 8081, starts Metro with --tunnel, waits until it is up,
# waits for ngrok/Expo tunnel + stabilization (Metro /status alone is not enough for Dev Client),
# prints the exp+suppr URL, then runs expo run:ios (no second bundler). Metro keeps running in the background.
set -euo pipefail
cd "$(dirname "$0")/.."

# Must match app.json ios.bundleIdentifier
IOS_BUNDLE_ID="com.supprclub.supprapp"

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

tunnel_https_url() {
  local out
  out="$(curl -sf "http://127.0.0.1:4040/api/tunnels" 2>/dev/null | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    for t in d.get('tunnels', []):
        if t.get('proto') == 'https':
            u = (t.get('public_url') or '').strip()
            if u:
                print(u, end='')
                break
except Exception:
    pass
" 2>/dev/null || true)"
  printf '%s' "$out"
  return 0
}

wait_tunnel_and_print_dev_url() {
  local tunnel_https=""
  log "Waiting for Expo tunnel (ngrok https on inspector :4040, max 90s)…"
  for _ in $(seq 1 90); do
    tunnel_https="$(tunnel_https_url || true)"
    if [ -n "${tunnel_https:-}" ]; then
      break
    fi
    sleep 1
  done
  if [ -z "${tunnel_https:-}" ]; then
    log "WARN: No https tunnel from ngrok (http://127.0.0.1:4040). Metro may not be in --tunnel mode."
    log "Fix: stop whatever is on 8081, then re-run this script (or run: cd apps/mobile && npx expo start --tunnel)."
    EXPO_DEV_CLIENT_URL=""
    return 1
  fi
  log "Tunnel HTTPS: $tunnel_https"
  log "Stabilizing tunnel (12s) before Xcode install (avoids Dev Client 'no servers found')…"
  sleep 12
  export TUNNEL_HTTPS="$tunnel_https"
  EXPO_DEV_CLIENT_URL="$(python3 -c "import os, urllib.parse; u=os.environ['TUNNEL_HTTPS']; print('exp+suppr://expo-development-client/?url=' + urllib.parse.quote(u, safe=''))")"
  export EXPO_DEV_CLIENT_URL
  log ""
  log "━━ Paste into Suppr → Enter URL (or scan from Metro) if needed ━━"
  log "$EXPO_DEV_CLIENT_URL"
  log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  printf '%s\n' "$EXPO_DEV_CLIENT_URL" >/tmp/suppr-expo-devclient-url.txt
  if command -v pbcopy >/dev/null 2>&1; then
    printf '%s' "$EXPO_DEV_CLIENT_URL" | pbcopy
    log "(Also copied to clipboard on this Mac.)"
  fi
  return 0
}

open_dev_url_on_device_if_udid() {
  local udid="${1:-}"
  if [ -z "${EXPO_DEV_CLIENT_URL:-}" ] || [ -z "${udid:-}" ]; then
    return 0
  fi
  log "Opening dev server URL on device (devicectl payload-url)…"
  if xcrun devicectl device process launch \
    --device "$udid" \
    --terminate-existing \
    --activate \
    --payload-url "$EXPO_DEV_CLIENT_URL" \
    "$IOS_BUNDLE_ID" 2>/dev/null; then
    log "Sent URL to $IOS_BUNDLE_ID on device."
  else
    log "devicectl could not open URL (device locked, Xcode pairing, or CLI quirk). Paste the URL above manually."
  fi
}

if [ "${SUPPR_KEEP_METRO:-}" = "1" ]; then
  log "SUPPR_KEEP_METRO=1 — not stopping existing Metro on 8081."
else
  stop_8081
fi

if ! curl -sf "http://127.0.0.1:8081/status" >/dev/null 2>&1; then
  log "Starting Metro with tunnel (logs: /tmp/suppr-expo-tunnel.log)…"
  # EXPO_NO_FAST_REFRESH avoids DevLauncher RemoteAppLoader SIGSEGV when the
  # tunnel drops mid-fetch (physical device crash Suppr-2026-06-11-183604.ips).
  nohup env EXPO_NO_FAST_REFRESH=1 npx expo start --tunnel >/tmp/suppr-expo-tunnel.log 2>&1 &
  METRO_PID=$!
  log "Metro PID: $METRO_PID"
  ok=0
  for _ in $(seq 1 120); do
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
  log "Metro is up on 8081 (tunnel mode)."
else
  log "Metro already responding on 8081 — reusing it. For a fresh tunnel, stop 8081 or unset SUPPR_KEEP_METRO=1."
fi

wait_tunnel_and_print_dev_url || true

export SENTRY_DISABLE_AUTO_UPLOAD=true
set +e
npx expo run:ios --no-bundler --device "$@"
RUN_EXIT=$?
set -e

# If Dev Client missed discovery, push the URL again after a successful install.
if [ "$RUN_EXIT" -eq 0 ] && [ -n "${1:-}" ]; then
  set +e
  open_dev_url_on_device_if_udid "$1"
  set -e
fi

exit "$RUN_EXIT"
