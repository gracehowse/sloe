#!/usr/bin/env bash
# CocoaPods / prebuild sometimes leaves Suppr.xcworkspace pointing only at Pods.
# Xcode then shows "Pods" only — no app target. This restores both project refs.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WS="$ROOT/ios/Suppr.xcworkspace/contents.xcworkspacedata"
if [[ ! -f "$WS" ]]; then
  echo "ensure-suppr-xcworkspace: missing $WS (run npx expo prebuild --platform ios first)" >&2
  exit 1
fi
if ! grep -q 'Suppr.xcodeproj' "$WS"; then
  echo "ensure-suppr-xcworkspace: repairing workspace (Suppr.xcodeproj was missing)"
  cat >"$WS" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<Workspace
   version = "1.0">
   <FileRef
      location = "group:Suppr.xcodeproj">
   </FileRef>
   <FileRef
      location = "group:Pods/Pods.xcodeproj">
   </FileRef>
</Workspace>
EOF
fi
