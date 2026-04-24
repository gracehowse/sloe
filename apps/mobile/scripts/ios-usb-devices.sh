#!/usr/bin/env bash
# Lists physical iOS devices attached via USB (from `xcrun xcdevice list`).
# Use the printed "identifier" as EXPO_IOS_DEVICE when running `npm run ios:device`.
#
# If `expo run:ios` hangs on "Connecting to: …your iPhone", Expo fell back to devicectl
# (often flaky on newer Xcode). Unplug other USB Apple devices (especially Apple Watch),
# use a data-capable USB-C cable, keep the phone unlocked, then retry—or install from Xcode.
set -euo pipefail
echo "USB-connected physical iOS devices (use \"identifier\" as EXPO_IOS_DEVICE):"
echo ""
python3 << 'PY'
import json, subprocess, sys

try:
    out = subprocess.check_output(["xcrun", "xcdevice", "list"], text=True, stderr=subprocess.STDOUT)
except subprocess.CalledProcessError as e:
    print(e.output or str(e), file=sys.stderr)
    sys.exit(1)

try:
    devices = json.loads(out)
except json.JSONDecodeError:
    print("Could not parse xcdevice JSON. Run: xcode-select -p", file=sys.stderr)
    sys.exit(1)

found = False
for d in devices:
    if d.get("simulator"):
        continue
    plat = (d.get("platform") or "").lower()
    if "iphone" not in plat and "ipad" not in plat:
        continue
    if d.get("interface") != "usb":
        continue
    found = True
    print(d.get("name", "(unnamed)"))
    print("  identifier:", d.get("identifier"))
    print("  available: ", d.get("available"))
    print()

if not found:
    print("No USB-connected iPhone/iPad found.")
    print("Use a data USB cable, unlock the device, tap Trust, and disconnect other USB Apple gear (e.g. Apple Watch).")
PY
