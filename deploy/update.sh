#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

git fetch origin main

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
  echo "$(date -Iseconds) No update needed (HEAD=$LOCAL)"
  exit 0
fi

echo "$(date -Iseconds) Updating $LOCAL -> $REMOTE"
git pull --ff-only

npm ci
npm run build
npm test

systemctl --user restart auto-translate
echo "$(date -Iseconds) Deployed $REMOTE successfully"
