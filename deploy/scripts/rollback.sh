#!/usr/bin/env bash
# Points `current` at the previous release (or the one named). nginx picks it up on the next request.
#   bash deploy/scripts/rollback.sh [release-folder-name]
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/var/www/clearwood-admin}"
CURRENT="$(readlink -f "$APP_DIR/current")"

if [[ -n "${1:-}" ]]; then
  TARGET="$APP_DIR/releases/$1"
else
  TARGET="$(ls -1dt "$APP_DIR"/releases/*/ | sed 's:/*$::' | grep -vxF "$CURRENT" | head -n 1 || true)"
fi
if [[ -z "$TARGET" || ! -d "$TARGET" ]]; then
  echo "No release to roll back to. Available:" >&2
  ls -1t "$APP_DIR/releases" >&2
  exit 1
fi

ln -sfn "$TARGET" "$APP_DIR/current.next"
mv -Tf "$APP_DIR/current.next" "$APP_DIR/current"
commit="$(grep -o '"commit": "[0-9a-f]*' "$TARGET/release.json" 2>/dev/null | cut -c12-18 || true)"
echo "current -> $(basename "$TARGET") ${commit:+(commit $commit)}"
