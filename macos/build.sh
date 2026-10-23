#!/usr/bin/env bash
# Build macos/build/LifeOS.app from macos/Sources with swiftc (no Xcode project).
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/.." && pwd)"
APP="$HERE/build/LifeOS.app"

rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

swiftc -O -swift-version 5 \
  -target "$(uname -m)-apple-macos13.0" \
  -framework AppKit -framework WebKit -framework ServiceManagement \
  "$HERE"/Sources/*.swift \
  -o "$APP/Contents/MacOS/LifeOS"

sed "s#__REPO_PATH__#${REPO}#" "$HERE/Info.plist" > "$APP/Contents/Info.plist"

codesign --force --sign - "$APP"
echo "Built $APP"
