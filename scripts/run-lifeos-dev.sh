#!/usr/bin/env bash
# Keep LifeOS (Next.js) listening on $LIFEOS_PORT (default 3000). Used by LaunchAgent.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

PORT="${LIFEOS_PORT:-3000}"
export PATH="/opt/homebrew/bin:/usr/local/bin:${PATH}"
export PORT

# Anything on the port is not enough. Only LifeOS /api/settings counts as up.
lifeos_up() {
  curl -sf --max-time 2 "http://127.0.0.1:${PORT}/api/settings" 2>/dev/null | grep -q bedtimeTarget \
    || curl -sf -g --max-time 2 "http://[::1]:${PORT}/api/settings" 2>/dev/null | grep -q bedtimeTarget
}

if lifeos_up; then
  echo "[lifeos-dev] LifeOS already on :$PORT — watching until it exits"
  while lifeos_up; do
    sleep 15
  done
  echo "[lifeos-dev] :$PORT went down"
  exit 0
fi

echo "[lifeos-dev] starting next dev on :$PORT"
exec npx next dev --webpack --hostname 127.0.0.1 -p "$PORT"
