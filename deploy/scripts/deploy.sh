#!/usr/bin/env bash
# One admin release: clone -> npm ci -> checks -> static build -> switch `current` -> health check,
# switching back automatically when the new release is not served. Nothing keeps running
# afterwards: nginx serves the files. Run as the deploy user (not root).
#   ADMIN_HOST=admin.example.com bash deploy/scripts/deploy.sh [branch]
set -Eeuo pipefail

: "${ADMIN_HOST:?set ADMIN_HOST, e.g. admin.example.com}"
APP_DIR="${APP_DIR:-/var/www/clearwood-admin}"
REPO_URL="${REPO_URL:-https://github.com/Monis-70/admin_clearwood_furniture.git}"
BRANCH="${1:-${BRANCH:-main}}"
API_PORT="${API_PORT:-7180}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"
# Empty hides the "View on storefront" links (set it once the storefront's product pages exist).
STOREFRONT_URL="${STOREFRONT_URL:-}"
# 0 skips the type check and unit tests (they add about two minutes).
RUN_CHECKS="${RUN_CHECKS:-1}"

# shellcheck source=deploy/scripts/use-node.sh
source "$(dirname "${BASH_SOURCE[0]}")/use-node.sh"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BUILD="$APP_DIR/build/$STAMP"
RELEASE="$APP_DIR/releases/$STAMP"
PREVIOUS="$(readlink -f "$APP_DIR/current" 2>/dev/null || true)"

log() { printf '\n==> %s\n' "$*"; }

switch_to() {
  ln -sfn "$1" "$APP_DIR/current.next"
  mv -Tf "$APP_DIR/current.next" "$APP_DIR/current"
}

if ! curl -fsS -o /dev/null "http://127.0.0.1:${API_PORT}/ready"; then
  echo "The API is not ready on 127.0.0.1:${API_PORT}; the admin would have nothing to talk to." >&2
  exit 1
fi
mkdir -p "$APP_DIR/build" "$APP_DIR/releases"

trap 'echo "Deploy failed; the live admin was not touched." >&2; rm -rf "$BUILD"' ERR

log "Cloning ${BRANCH}"
git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$BUILD"
cd "$BUILD"
COMMIT="$(git rev-parse HEAD)"
log "Commit ${COMMIT:0:7}: $(git log -1 --pretty=%s)"

log "Installing dependencies from the lockfile"
npm ci --no-audit --no-fund

if [[ "$RUN_CHECKS" == "1" ]]; then
  log "Type check and unit tests"
  npm run typecheck
  npm test
fi

log "Building the static export"
NEXT_PUBLIC_APP_ENV=production \
  NEXT_PUBLIC_API_BASE_URL=/api/v1 \
  NEXT_PUBLIC_STOREFRONT_URL="$STOREFRONT_URL" \
  NEXT_TELEMETRY_DISABLED=1 \
  npm run build
npm run bundle:report
test -f out/index.html && test -f out/login.html && test -f out/404.html

node -e '
  const m = require("./contracts/manifest.json");
  require("fs").writeFileSync("out/release.json", JSON.stringify({
    commit: process.argv[1], branch: process.argv[2], builtAt: new Date().toISOString(),
    backendContract: m.backend.commit,
  }, null, 2));
' "$COMMIT" "$BRANCH"

mv out "$RELEASE"
cd "$APP_DIR"
rm -rf "$BUILD"
trap - ERR

log "Switching current -> ${STAMP}"
switch_to "$RELEASE"

SITE=/etc/nginx/sites-enabled/clearwood-admin.conf
if ! grep -qs 'listen 443' "$SITE"; then
  log "Release ${STAMP} is in place. nginx has no HTTPS config yet: run render-nginx.sh full next."
  exit 0
fi

log "Health check on https://${ADMIN_HOST}"
check() {
  curl -fsS --max-time 10 --resolve "${ADMIN_HOST}:443:127.0.0.1" "https://${ADMIN_HOST}$1"
}
served="$(check /release.json || true)"
if [[ "$served" == *"$COMMIT"* ]] && check /login >/dev/null && check /ready >/dev/null; then
  log "Pruning old releases (keeping ${KEEP_RELEASES})"
  ls -1dt "$APP_DIR"/releases/*/ | sed 's:/*$::' | grep -vxF "$RELEASE" |
    tail -n +"$KEEP_RELEASES" | xargs -r rm -rf
  log "Released ${STAMP} (${COMMIT:0:7}) at https://${ADMIN_HOST}"
  exit 0
fi

echo "https://${ADMIN_HOST} does not serve the new release (or /ready failed)." >&2
if [[ -n "$PREVIOUS" && -d "$PREVIOUS" ]]; then
  log "Switching back to $(basename "$PREVIOUS")"
  switch_to "$PREVIOUS"
  rm -rf "$RELEASE"
fi
exit 1
