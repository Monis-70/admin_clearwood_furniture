#!/usr/bin/env bash
# Renders the admin's nginx config from deploy/nginx/*.template, tests it and reloads nginx.
#   sudo ADMIN_HOST=admin.example.com bash deploy/scripts/render-nginx.sh bootstrap
#   sudo ADMIN_HOST=admin.example.com MEDIA_HOSTS="https://api.example.com" \
#     bash deploy/scripts/render-nginx.sh full
set -Eeuo pipefail

MODE="${1:-full}"
: "${ADMIN_HOST:?set ADMIN_HOST, e.g. admin.example.com}"
APP_DIR="${APP_DIR:-/var/www/clearwood-admin}"
API_PORT="${API_PORT:-7180}"
# Origins the API's media URLs point at (CSP img-src); 'self' is always allowed.
MEDIA_HOSTS="${MEDIA_HOSTS:-}"
TEMPLATES="$(cd "$(dirname "${BASH_SOURCE[0]}")/../nginx" && pwd)"
SITE=/etc/nginx/sites-available/clearwood-admin.conf

render() {
  sed -e "s|__ADMIN_HOST__|${ADMIN_HOST}|g" \
    -e "s|__APP_DIR__|${APP_DIR}|g" \
    -e "s|__API_PORT__|${API_PORT}|g" \
    -e "s|__MEDIA_HOSTS__|${MEDIA_HOSTS}|g" "$1"
}

mkdir -p /var/www/certbot /etc/nginx/snippets
case "$MODE" in
  bootstrap)
    render "$TEMPLATES/admin-bootstrap.conf.template" > "$SITE"
    ;;
  full)
    if [[ ! -f "/etc/letsencrypt/live/${ADMIN_HOST}/fullchain.pem" ]]; then
      echo "No certificate for ${ADMIN_HOST} yet: run the bootstrap config and certbot first." >&2
      exit 1
    fi
    render "$TEMPLATES/tls.conf.template" > /etc/nginx/snippets/clearwood-admin-tls.conf
    render "$TEMPLATES/headers.conf.template" > /etc/nginx/snippets/clearwood-admin-headers.conf
    render "$TEMPLATES/admin.conf.template" > "$SITE"
    ;;
  *)
    echo "usage: render-nginx.sh bootstrap|full" >&2
    exit 2
    ;;
esac

ln -sfn "$SITE" /etc/nginx/sites-enabled/clearwood-admin.conf
nginx -t
systemctl reload nginx
echo "nginx: '${MODE}' admin config is live for ${ADMIN_HOST}"
