#!/usr/bin/env bash
# 07:00 / 20:00 emails. launchd cannot read Documents, so Terminal runs the send.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SUPPORT="${HOME}/Library/Application Support/LifeOS"
START="${SUPPORT}/run-email.command"
LABEL="${LIFEOS_LAUNCHD_PREFIX:-local.lifeos}.deadline-email"
PLIST="${HOME}/Library/LaunchAgents/${LABEL}.plist"
LOG="${HOME}/Library/Logs/lifeos-deadline-email.log"
UID_NUM="$(id -u)"

mkdir -p "$SUPPORT" "${HOME}/Library/LaunchAgents" "${HOME}/Library/Logs"

cat > "$START" <<EOF
#!/bin/bash
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
cd "${ROOT}" || exit 1
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi
export EMAIL_REMINDERS_ENABLED="\${EMAIL_REMINDERS_ENABLED:-1}"
npx tsx scripts/daily-digest.ts auto >> "${LOG}" 2>&1
EOF
chmod +x "$START"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>WorkingDirectory</key>
  <string>${HOME}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/open</string>
    <string>-gj</string>
    <string>-a</string>
    <string>Terminal</string>
    <string>${START}</string>
  </array>
  <key>StartCalendarInterval</key>
  <array>
    <dict>
      <key>Hour</key>
      <integer>7</integer>
      <key>Minute</key>
      <integer>0</integer>
    </dict>
    <dict>
      <key>Hour</key>
      <integer>20</integer>
      <key>Minute</key>
      <integer>0</integer>
    </dict>
  </array>
  <key>StandardOutPath</key>
  <string>${LOG}</string>
  <key>StandardErrorPath</key>
  <string>${LOG}</string>
</dict>
</plist>
EOF

if launchctl print "gui/${UID_NUM}/${LABEL}" >/dev/null 2>&1; then
  launchctl bootout "gui/${UID_NUM}/${LABEL}" || true
fi
launchctl bootstrap "gui/${UID_NUM}" "$PLIST"

echo "Installed ${LABEL}"
echo "  07:00 早间 · 20:00 收工"
echo "  log: ${LOG}"
echo "Unload: launchctl bootout gui/${UID_NUM}/${LABEL}"
