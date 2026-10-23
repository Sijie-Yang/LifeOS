#!/usr/bin/env bash
# Send LifeOS emails from local SQLite + Resend (Next.js not required).
# Usage: run-deadline-email.sh [morning|evening|auto] [--force]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

export PATH="/opt/homebrew/bin:/usr/local/bin:${PATH}"
export EMAIL_REMINDERS_ENABLED="${EMAIL_REMINDERS_ENABLED:-1}"

SLOT="${1:-auto}"
if [[ "$SLOT" == --* ]]; then
  SLOT="auto"
  exec npx tsx scripts/daily-digest.ts "$SLOT" "$@"
fi
shift || true
exec npx tsx scripts/daily-digest.ts "$SLOT" "$@"
