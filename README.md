# ClearWood Admin

Operations dashboard for ClearWood Furnitures. A static Next.js export that talks only to the
existing ClearWood API (Express); it has no server, database or secrets of its own.

Design and scope: [docs/ADMIN_ARCHITECTURE.md](docs/ADMIN_ARCHITECTURE.md) and the other
`docs/ADMIN_*.md` files. The API coverage table is generated: [docs/ADMIN_API_COVERAGE.md](docs/ADMIN_API_COVERAGE.md).

## Requirements

- Node.js 24+, npm 11
- For contract syncing: a checkout of the backend with its dependencies installed
  (default location `../clearwood-backend-repo`)
- On a machine behind a TLS-inspecting proxy, install with `NODE_OPTIONS=--use-system-ca`

## Everyday commands

| Command                 | What it does                                                                                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run dev`           | Dev server on http://localhost:7182; `/api`, `/health` and `/ready` are proxied to `CLEARWOOD_API_ORIGIN` (default `http://localhost:7180`), same-origin like production |
| `npm run build`         | Static export into `out/` (runs `contracts:check` and `coverage:check` first)                                                                                            |
| `npm run preview`       | Serves `out/` like the production nginx vhost on :7183 (set `CLEARWOOD_API_ORIGIN` to proxy a real API)                                                                  |
| `npm run verify`        | Everything CI runs: contracts, coverage, coverage doc, types, lint, format, unit tests, build, bundle budgets                                                            |
| `npm test`              | Unit and component tests (Vitest, Testing Library, MSW, axe)                                                                                                             |
| `npm run e2e`           | Browser tests (Playwright) against the built export with a fake API; uses the installed Edge (`PW_CHANNEL=chrome` for Chrome)                                            |
| `npm run bundle:report` | Initial JS/CSS per page after a build, against budgets                                                                                                                   |

## Complete local stack (real backend, local only)

`local-stack/` runs MySQL and Redis in Docker, and the backend and admin on this machine. It never
touches production: it refuses database hosts other than `127.0.0.1:3317`, generates its own
throwaway secrets into `local-stack/secrets.env` (git-ignored) and never reads production values.

| Service      | Address                                               |
| ------------ | ----------------------------------------------------- |
| MySQL 8.0    | `127.0.0.1:3317` (`clearwood_local`)                  |
| Redis 7      | `127.0.0.1:6381`                                      |
| Backend API  | `http://127.0.0.1:7181`                               |
| Admin (dev)  | `http://localhost:3000`                               |
| Admin export | `http://localhost:7183` (preview), `:7184` (real e2e) |

First time (from this folder, PowerShell):

```powershell
.\local-stack\stack.ps1 init        # generate local secrets
.\local-stack\stack.ps1 up          # MySQL + Redis containers (waits for healthy)
.\local-stack\stack.ps1 migrate     # prisma migrate deploy
.\local-stack\stack.ps1 seed        # reference data, catalog, bootstrap admin
.\local-stack\stack.ps1 provision   # make dev.superadmin@clearwood.local a Super Admin (local only)
.\local-stack\stack.ps1 backend     # terminal 1: API on :7181 (watch mode)
.\local-stack\stack.ps1 dev-data    # DEV admins per role + DEV enquiries, through the real API
.\local-stack\stack.ps1 admin       # terminal 2: admin on http://localhost:3000
.\local-stack\stack.ps1 print-login # sign-in details
```

Later days: `up`, `backend`, `admin`. Other commands: `status`, `down`, `reset` (drops the local
volume), `preview`, `backend-test` (backend suite against a local test database).
`npm run e2e:real` (after `npm run build`, with the backend running) drives the real API in Edge.
`npm run e2e:ratelimit` (after `npm run build`) starts its own test-only API on :7185 with a low upload
limit (`stack.ps1 backend-ratelimit`) and checks that uploads wait for a real `429 Retry-After`.

## Contracts with the backend

The backend is the source of truth. Its `shared/src` (Zod schemas, enums, DTO types) is pinned into
`src/contracts/shared/` and its mounted routes into `contracts/route-inventory.json` (plus its OpenAPI
debt list, `contracts/openapi-debt.json`), all recorded in
`contracts/manifest.json` with the backend commit.

```sh
npm run contracts:sync -- --backend ../clearwood-backend-repo   # after a backend change
npm run coverage:check                                           # classify any new/changed route
npm run coverage:doc                                             # regenerate docs/ADMIN_API_COVERAGE.md
npm run matrix:doc                                               # regenerate docs/ADMIN_CAPABILITY_MATRIX.md
npm run contracts:check -- --against-backend                     # fail on silent drift (CI with a backend checkout)
```

Never edit `src/contracts/shared/` or `contracts/` by hand; `contracts:check` fails if they differ
from the manifest.

## Rules that the tooling enforces

- All HTTP goes through `src/lib/api/client.ts`; endpoints are declared once in `src/lib/api/endpoints.ts`
  and checked against the backend guard (auth, permissions, CSRF, idempotency) on every build.
- Routes of on-hold integrations (payments, refunds, returns, courier, email, OTP) can never be called
  from the UI: the coverage gate fails if the registry references one.
- No tokens or business data in browser storage; `localStorage` is reachable only through
  `src/lib/preferences.ts` for UI preferences, saved list filters and a capped, per-admin
  "recently viewed" list (ids, URLs and non-identifying labels; never customer names or emails).

## Configuration

See [.env.example](.env.example). `NEXT_PUBLIC_*` values are inlined at build time and are public.
