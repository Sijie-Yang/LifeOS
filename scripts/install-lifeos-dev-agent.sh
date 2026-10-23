#!/usr/bin/env bash
# macOS only: keep LifeOS running on $LIFEOS_PORT (default 3000) after login.
# launchd cannot read Documents, so it only watches the port and asks Terminal to start Next.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SUPPORT="${HOME}/Library/Application Support/LifeOS"
WATCH="${SUPPORT}/watch-dev.sh"
START="${SUPPORT}/start-dev.command"
LABEL="${LIFEOS_LAUNCHD_PREFIX:-local.lifeos}.dev"
PLIST="${HOME}/Library/LaunchAgents/${LABEL}.plist"
LOG="${HOME}/Library/Logs/lifeos-dev.log"
UID_NUM="$(id -u)"
PORT="${LIFEOS_PORT:-3000}"

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
exec npx next dev --webpack --hostname 127.0.0.1 -p ${PORT}
EOF
chmod +x "$START"

cat > "$WATCH" <<EOF
#!/bin/bash
PORT="${PORT}"
START="${START}"
LOG="${LOG}"
# Anything on the port is not enough. Only LifeOS settings count as up.
lifeos_up() {
  /usr/bin/curl -sf --max-time 2 "http://127.0.0.1:\${PORT}/api/settings" 2>/dev/null | /usr/bin/grep -q bedtimeTarget \\
    || /usr/bin/curl -sf -g --max-time 2 "http://[::1]:\${PORT}/api/settings" 2>/dev/null | /usr/bin/grep -q bedtimeTarget
}
echo "[\$(date)] watch :\$PORT" >> "\$LOG"
if ! lifeos_up; then
  echo "[\$(date)] starting via Terminal" >> "\$LOG"
  /usr/bin/open -gj -a Terminal "\$START"
  for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
    lifeos_up && break
    sleep 2
  done
fi
if ! lifeos_up; then
  echo "[\$(date)] :\$PORT still not LifeOS" >> "\$LOG"
  exit 1
fi
echo "[\$(date)] up — watching" >> "\$LOG"
while lifeos_up; do sleep 15; done
echo "[\$(date)] :\$PORT went down" >> "\$LOG"
exit 0
EOF
chmod +x "$WATCH"

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
    <string>/bin/bash</string>
    <string>${WATCH}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>15</integer>
  <key>ProcessType</key>
  <string>Standard</string>
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
launchctl kickstart -k "gui/${UID_NUM}/${LABEL}"

echo "Installed ${LABEL}"
echo "  http://localhost:${PORT}  登录后自动开，挂了会重启"
echo "  log: ${LOG}"
echo "Unload: launchctl bootout gui/${UID_NUM}/${LABEL}"
