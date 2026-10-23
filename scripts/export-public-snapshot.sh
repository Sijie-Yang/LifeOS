#!/usr/bin/env bash
# Build a publishable copy of the committed tree with a fresh, single-commit history.
# The private history is never copied. Nothing is pushed and no remote is added.
# Usage: scripts/export-public-snapshot.sh <target-dir> [ref]
set -euo pipefail

TARGET="${1:?usage: export-public-snapshot.sh <target-dir> [ref]}"
REF="${2:-HEAD}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -e "$TARGET" ]]; then
  echo "Target $TARGET already exists; choose a new directory." >&2
  exit 1
fi

mkdir -p "$TARGET"
git archive "$REF" | tar -x -C "$TARGET"

# Scan the exported files (not the working tree) with this checkout's denylist.
node scripts/privacy-scan.mjs "$TARGET"

git -C "$TARGET" init -q -b main
git -C "$TARGET" add -A
git -C "$TARGET" \
  -c user.name="${PUBLIC_AUTHOR_NAME:-LifeOS contributors}" \
  -c user.email="${PUBLIC_AUTHOR_EMAIL:-lifeos@users.noreply.github.com}" \
  commit -q -m "Initial public release of LifeOS"

echo "Public snapshot ready at $TARGET ($(git -C "$TARGET" ls-files | wc -l | tr -d ' ') files, 1 commit)."
echo "Review it, then add a remote and push yourself when ready."
