# ClearWood Admin — Deployment Plan

**Plan only. Nothing has been deployed and no backend setting has been changed.**

## 1. Target

| Item | Value |
| --- | --- |
| Admin URL | `https://admin.clearwoodfurnitures.shop` |
| API | `https://api.clearwoodfurnitures.shop` (Express behind nginx, PM2 cluster ×4 on `127.0.0.1:7180`) |
| Artifact | static files from `next build` with `output: 'export'` (`out/`) — no Node process for the admin |
| Local dev | `next dev -p 7182` (port reserved by the backend constitution) against `http://localhost:7180/api/v1`; the backend's development `CORS_ORIGINS` already lists `http://localhost:7182`; cookies are port-agnostic, so `cw_adm_csrf` is readable in dev |

## 2. Topology options

### Option A — same origin (recommended)

The admin vhost serves the static build **and** reverse-proxies `/api/`, `/health` and `/ready` to
the same upstream the API vhost uses. The browser only ever talks to `admin.clearwoodfurnitures.shop`.

- No CORS preflights; `Content-Disposition`, `RateLimit`, `Retry-After`, `Idempotent-Replay` are
  readable; CSP `connect-src 'self'`.
- Admin cookies can be scoped to the admin host only.
- Requires the admin vhost on the same server (or a network path to `127.0.0.1:7180`) — **UNKNOWN,
  to confirm**.

Backend `.env` values the owner must set (configuration, not code):

| Key | Value | Why |
| --- | --- | --- |
| `ADMIN_ORIGIN` | `https://admin.clearwoodfurnitures.shop` | realm `allowedOrigins` |
| `CORS_ORIGINS` | include `https://admin.clearwoodfurnitures.shop` | browsers send `Origin` on same-origin POST/PUT/PATCH/DELETE; an unlisted origin gets `403 CORS_ORIGIN_NOT_ALLOWED` |
| `ADMIN_COOKIE_DOMAIN` | `admin.clearwoodfurnitures.shop` | cookies never reach the storefront or API hosts |
| `AUTH_COOKIE_SECURE` | `true` | production refuses to boot otherwise |
| `AUTH_COOKIE_SAMESITE` | `lax` (unchanged) | shared by both realms |
| `TRUST_PROXY` | `loopback` | per-client rate limiting behind nginx (`true` is refused at boot) |

### Option B — cross origin

The SPA calls `https://api.clearwoodfurnitures.shop/api/v1` with `credentials: 'include'`.

| Key | Value | Why |
| --- | --- | --- |
| `CORS_ORIGINS` | include the admin origin | credentialed CORS |
| `ADMIN_COOKIE_DOMAIN` | `clearwoodfurnitures.shop` | `cw_adm_csrf` must be readable by `document.cookie` on the admin host; consequence: `cw_adm_at`/`cw_adm_rt` (path `/api/v1/admin`) are also sent to any `*.clearwoodfurnitures.shop` host under that path |
| `AUTH_COOKIE_SECURE`, `TRUST_PROXY` | as above | |

Limitations: only `X-Request-Id` is exposed by the API's CORS config, so download file names are
generated client-side and 429 messages cannot show `Retry-After`. `admin.*` and `api.*` are
same-site, so `SameSite=Lax` cookies still flow.

## 3. nginx (admin vhost, Option A)

```nginx
server {
  listen 443 ssl http2;
  server_name admin.clearwoodfurnitures.shop;
  # ssl_certificate / ssl_certificate_key: Let's Encrypt (certbot)

  root /srv/clearwood-admin/current;
  index index.html;

  # Static export: /catalog/products/edit -> edit.html; ids travel in the query string.
  location / {
    try_files $uri $uri.html $uri/ =404;
    add_header Cache-Control "no-cache" always;
  }
  location /_next/static/ {
    add_header Cache-Control "public, max-age=31536000, immutable" always;
  }
  error_page 404 /404.html;

  # Same-origin API
  location ~ ^/(api/|health$|ready$) {
    proxy_pass http://127.0.0.1:7180;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffer_size 16k;          # admin JWT carries the permission list; SUPER_ADMIN Set-Cookie exceeds the 4k default -> 502
    proxy_buffers 8 16k;
    client_max_body_size 64m;       # upload batches are capped at 60 MB by the client
    proxy_read_timeout 180s;        # CSV import/commit and image renditions run inside the request
  }

  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header Referrer-Policy "same-origin" always;
  add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
  add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: <MEDIA_HOSTS>; font-src 'self'; connect-src 'self'; frame-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'" always;
}
```

- `<MEDIA_HOSTS>` = the API origin (local storage driver serves `/media/*`) and/or the S3/CDN host
  (`S3_PUBLIC_BASE_URL`, `MEDIA_CDN_BASE_URL`) — **UNKNOWN** until production storage is confirmed.
- `script-src 'unsafe-inline'` is required by Next's inline bootstrap in a static export; the
  hardening phase replaces it with build-time SHA-256 hashes (`scripts/csp-hashes`).
- Source maps are not uploaded to the web root.
- The same `proxy_buffer_size` change is required on the **API** vhost if admins ever sign in
  through it (Option B).

## 4. Build and release

1. CI builds per environment (static export bakes `NEXT_PUBLIC_*` at build time):
   `NEXT_PUBLIC_API_BASE_URL` (`/api/v1` for Option A, absolute `https://api…/api/v1` for B; `/health`
   and `/ready` are derived from it), `NEXT_PUBLIC_APP_ENV` (`production`/`staging`/`development`;
   anything but production shows an environment badge), `NEXT_PUBLIC_STOREFRONT_URL` (UNKNOWN; empty
   hides storefront links). CSP lives in nginx.
2. Artifact `out/` + `release.json` (git SHA, `contracts/manifest.json` backend commit).
3. Upload to `/srv/clearwood-admin/releases/<sha>/`, then atomically repoint
   `/srv/clearwood-admin/current`; keep five releases. Rollback = repoint the symlink.
4. Never copy `node_modules` to the server (nothing runs there).
5. Pre-compress the export (`.br`/`.gz` next to each asset) and serve with `gzip_static on;`
   (and `brotli_static` if the module is present) so nginx never compresses on the fly.
6. `npm run preview` serves `out/` with the same `try_files` rule and, with `CLEARWOOD_API_ORIGIN`,
   the same `/api` proxy — a local rehearsal of this vhost.

## 5. CI pipeline

| Stage | Gate (npm script) |
| --- | --- |
| install | `npm ci` with lockfile; `npm audit --audit-level=high` |
| contracts | `contracts:check` (pinned shared files + route inventory untouched); with a backend checkout, `contracts:check -- --against-backend` (no drift) |
| coverage | `coverage:check` (classification ↔ inventory ↔ endpoint registry, guards, CSRF, idempotency, no on-hold calls), `coverage:doc -- --check` and `matrix:doc -- --check` |
| static | `typecheck`, `lint` (0 warnings), `format:check` |
| test | `test` (Vitest unit + component with MSW + axe) |
| build | `build` (export) then `bundle:report` (JS ≤ 280 KB, CSS ≤ 40 KB gzip per page) |
| e2e | `e2e` (Playwright + axe with colour contrast against the export and a fake API); later also against a local seeded backend (never production) |
| deploy | manual approval, environment-scoped; **not enabled until go-live is authorised** |

`npm run verify` runs every gate except e2e in this order.

## 6. Go-live checklist

1. Production backend `.env` values from §2 confirmed by the owner; `npm run check:production` and
   `npm run preflight` pass on the server.
2. The published placeholder admin account is reset and renamed (infra/README §3).
3. From a browser on the admin origin: preflight/`Origin` accepted, sign-in works, `cw_adm_csrf` is
   readable, a mutation succeeds with `X-CSRF-Token`.
4. **SUPER_ADMIN sign-in through nginx** returns 200 (large `Set-Cookie`), not 502.
5. After 16 minutes idle, the next action renews the session silently; two tabs renewing at once do
   not trigger `TOKEN_REUSE`.
6. A 15 MB image uploads through nginx; a 16 MB one shows the friendly 413 message.
7. A 20,000-row dry-run import completes within the proxy timeout.
8. CSP reports no violations on every route; HSTS present.
9. On-hold integrations show as inactive on System status; no on-hold screen is reachable by URL.
10. Rate-limit behaviour verified with two admins on one network.

## 7. Operations

- Support: every error shows a `traceId` that matches the API log line and `x-request-id`.
- Monitoring: uptime checks on `https://admin.clearwoodfurnitures.shop/` and `/ready`; nginx
  access/error logs for 4xx/5xx spikes on `/api/`.
- No client analytics or third-party scripts.

## 8. Risks

| Risk | Mitigation |
| --- | --- |
| Admin origin missing from `CORS_ORIGINS` | every mutation fails with 403 — checklist item 3 |
| Cookie domain wrong (Option B) | CSRF cookie unreadable → every mutation 403 — checklist item 3 |
| nginx header buffer too small | SUPER_ADMIN login 502 — `proxy_buffer_size 16k`, checklist item 4 |
| Shared-IP rate limit with several admins | request budget design; raise `RATE_LIMIT_MAX` if measured need |
| Long synchronous imports/uploads | client batching, 180 s proxy timeout, progress UI |
| Cross-tab refresh race | Web Lock around refresh (checklist item 5) |
| Backend contract drift | pinned contracts + coverage gate on every sync |
| Production state unverifiable from this workstation (Zscaler 403) | owner-run checks above before go-live |
