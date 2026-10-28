<#
  Local-only ClearWood stack: MySQL + Redis in Docker, the backend from the sibling checkout, the
  admin from this repo. Nothing here reads or writes production.

    .\local-stack\stack.ps1 init          # one-off: generate local secrets (local-stack\secrets.env)
    .\local-stack\stack.ps1 up            # start MySQL (127.0.0.1:3317) and Redis (127.0.0.1:6381)
    .\local-stack\stack.ps1 migrate       # prisma migrate deploy on clearwood_local
    .\local-stack\stack.ps1 seed          # prisma db seed (reference + DEV demo data)
    .\local-stack\stack.ps1 provision     # promote the seeded bootstrap account to the DEV SUPER_ADMIN
    .\local-stack\stack.ps1 dev-data      # DEV admins + enquiries through the real API (backend running)
    .\local-stack\stack.ps1 backend       # API on http://127.0.0.1:7181 (tsx watch)
    .\local-stack\stack.ps1 backend-ratelimit # test-only API on :7185 with a low upload limit (npm run e2e:ratelimit)
    .\local-stack\stack.ps1 admin         # admin on http://localhost:3000, /api proxied to 7181
    .\local-stack\stack.ps1 preview       # static export on http://localhost:7183, /api proxied to 7181
    .\local-stack\stack.ps1 backend-test  # backend test suite against the local MySQL
    .\local-stack\stack.ps1 status | down | reset
#>
[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [ValidateSet('init', 'up', 'down', 'reset', 'status', 'migrate', 'seed', 'provision', 'dev-data', 'backend', 'backend-ratelimit', 'admin', 'preview', 'backend-test', 'print-login')]
  [string]$Command = 'status',
  [Parameter(Position = 1, ValueFromRemainingArguments = $true)]
  [string[]]$Rest = @()
)

# 'Stop' would turn any native stderr line (docker/prisma progress) into a failure under redirection;
# native exit codes are checked explicitly instead.
$ErrorActionPreference = 'Continue'

$Here = $PSScriptRoot
$AdminRoot = Split-Path $Here -Parent
$BackendRoot = if ($env:CLEARWOOD_BACKEND_DIR) { $env:CLEARWOOD_BACKEND_DIR } else { Join-Path (Split-Path $AdminRoot -Parent) 'clearwood-backend-repo\backend' }
$SecretsFile = Join-Path $Here 'secrets.env'
$Compose = @('compose', '--project-directory', $Here, '-f', (Join-Path $Here 'compose.yaml'), '--env-file', $SecretsFile)

$MysqlPort = 3317
$RedisPort = 6381
$ApiPort = 7181
$AdminPort = 3000
$PreviewPort = 7183
$RealE2ePort = 7184
$RateLimitApiPort = 7185
$RateLimitE2ePort = 7186
$ApiOrigin = "http://127.0.0.1:$ApiPort"

function Read-EnvFile([string]$Path) {
  $map = [ordered]@{}
  foreach ($line in Get-Content -LiteralPath $Path -Encoding UTF8) {
    if ($line -match '^\s*([A-Z0-9_]+)\s*=(.*)$') {
      $map[$Matches[1]] = $Matches[2].Trim().Trim('"').Trim("'")
    }
  }
  return $map
}

function New-Secret([int]$Bytes = 24) {
  $buffer = New-Object byte[] $Bytes
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buffer)
  return [Convert]::ToBase64String($buffer).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function Get-Secrets {
  if (-not (Test-Path -LiteralPath $SecretsFile)) { throw "Run '.\local-stack\stack.ps1 init' first." }
  return Read-EnvFile $SecretsFile
}

function Invoke-WithEnv([System.Collections.IDictionary]$Vars, [scriptblock]$Body) {
  $saved = @{}
  foreach ($key in $Vars.Keys) {
    $saved[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
    [Environment]::SetEnvironmentVariable($key, [string]$Vars[$key], 'Process')
  }
  try { & $Body } finally {
    foreach ($key in $saved.Keys) { [Environment]::SetEnvironmentVariable($key, $saved[$key], 'Process') }
  }
}

function Get-BackendEnv {
  $s = Get-Secrets
  $example = Read-EnvFile (Join-Path $BackendRoot '.env.example')
  $vars = [ordered]@{}
  foreach ($key in $example.Keys) { $vars[$key] = $example[$key] }

  $uploads = Join-Path $Here 'data\uploads'
  New-Item -ItemType Directory -Force -Path $uploads | Out-Null

  $local = [ordered]@{
    NODE_ENV                  = 'development'
    HOST                      = '127.0.0.1'
    API_PORT                  = "$ApiPort"
    TRUST_PROXY               = 'false'
    WEB_ORIGIN                = 'http://localhost:3001'
    ADMIN_ORIGIN              = "http://localhost:$AdminPort"
    CORS_ORIGINS              = "http://localhost:$AdminPort,http://localhost:$PreviewPort,http://localhost:$RealE2ePort,http://localhost:3001,http://localhost:3101"
    DATABASE_PROVIDER         = 'mysql'
    DATABASE_URL              = "mysql://clearwood:$($s.MYSQL_PASSWORD)@127.0.0.1:$MysqlPort/clearwood_local"
    SHADOW_DATABASE_URL       = "mysql://root:$($s.MYSQL_ROOT_PASSWORD)@127.0.0.1:$MysqlPort/clearwood_local_shadow"
    CACHE_DRIVER              = 'redis'
    REDIS_URL                 = "redis://127.0.0.1:$RedisPort"
    REDIS_KEY_PREFIX          = 'cwlocal:'
    JWT_ACCESS_SECRET         = $s.JWT_ACCESS_SECRET
    JWT_REFRESH_SECRET        = $s.JWT_REFRESH_SECRET
    ADMIN_JWT_ACCESS_SECRET   = $s.ADMIN_JWT_ACCESS_SECRET
    ADMIN_JWT_REFRESH_SECRET  = $s.ADMIN_JWT_REFRESH_SECRET
    CART_COOKIE_SECRET        = $s.CART_COOKIE_SECRET
    MEDIA_SIGNING_SECRET      = $s.MEDIA_SIGNING_SECRET
    COOKIE_DOMAIN             = 'localhost'
    ADMIN_COOKIE_DOMAIN       = 'localhost'
    AUTH_COOKIE_SECURE        = 'false'
    # Browser test runs sign in many times from 127.0.0.1; the production defaults stay 10 and 120.
    AUTH_RATE_LIMIT_MAX       = '100'
    RATE_LIMIT_MAX            = '600'
    ADMIN_SEED_EMAIL          = 'dev.superadmin@clearwood.local'
    ADMIN_SEED_PASSWORD       = $s.ADMIN_SEED_PASSWORD
    ADMIN_SEED_NAME           = 'DEV Super Admin'
    SEED_DEMO                 = 'true'
    STORAGE_DRIVER            = 'local'
    LOCAL_UPLOAD_DIR          = $uploads
    PUBLIC_MEDIA_BASE_URL     = "http://localhost:$ApiPort/media"
    SITEMAP_BASE_URL          = 'http://localhost:3001'
    SEARCH_DRIVER             = 'sql'
    MAIL_DRIVER               = 'log'
    OTP_DRIVER                = 'log'
    PAYMENT_DRIVER            = 'mock'
    RAZORPAY_ENABLED          = 'false'
    SHIPPING_DRIVER           = 'manual'
    SHIPPING_PROVIDER_VERIFIED = 'false'
    SHIPROCKET_ENABLED        = 'false'
    FEATURE_CUSTOMER_RETURNS  = 'false'
    LOG_LEVEL                 = 'info'
  }
  foreach ($key in $local.Keys) { $vars[$key] = $local[$key] }

  # backend/.env is loaded for every key missing from the process environment, and Windows cannot
  # hold an empty variable. Refuse to start if that file could inject anything we did not choose.
  $dotEnv = Join-Path $BackendRoot '.env'
  if (Test-Path -LiteralPath $dotEnv) {
    $fromFile = Read-EnvFile $dotEnv
    foreach ($key in $fromFile.Keys) {
      if (-not $vars.Contains($key)) { throw "backend/.env defines $key, which the local stack does not set. Add it to Get-BackendEnv." }
      if ([string]::IsNullOrEmpty($vars[$key]) -and $fromFile[$key] -ne '') {
        throw "backend/.env gives $key a value the local stack expects to be empty. Clear it there or set it here."
      }
    }
  }
  return $vars
}

function Wait-Http([string]$Url, [int]$Seconds = 60) {
  $deadline = (Get-Date).AddSeconds($Seconds)
  while ((Get-Date) -lt $deadline) {
    try { Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 3 | Out-Null; return $true } catch { Start-Sleep -Milliseconds 700 }
  }
  return $false
}

switch ($Command) {
  'init' {
    if (Test-Path -LiteralPath $SecretsFile) { Write-Host "secrets.env already exists; keeping it."; break }
    $lines = @(
      "# Generated for the LOCAL stack only. Not used anywhere else. Delete to regenerate (then run reset).",
      "MYSQL_ROOT_PASSWORD=$(New-Secret)",
      "MYSQL_PASSWORD=$(New-Secret)",
      "JWT_ACCESS_SECRET=$(New-Secret 48)",
      "JWT_REFRESH_SECRET=$(New-Secret 48)",
      "ADMIN_JWT_ACCESS_SECRET=$(New-Secret 48)",
      "ADMIN_JWT_REFRESH_SECRET=$(New-Secret 48)",
      "CART_COOKIE_SECRET=$(New-Secret 32)",
      "MEDIA_SIGNING_SECRET=$(New-Secret 32)",
      "ADMIN_SEED_PASSWORD=Dev-$(New-Secret 12)-Oak9",
      "DEV_ADMIN_PASSWORD=Dev-$(New-Secret 12)-Teak7"
    )
    [System.IO.File]::WriteAllLines($SecretsFile, $lines, (New-Object System.Text.UTF8Encoding $false))
    Write-Host "Wrote $SecretsFile"
  }
  'up' {
    Get-Secrets | Out-Null
    & docker @Compose up -d --wait
    if ($LASTEXITCODE -ne 0) { throw 'docker compose up failed' }
    & docker @Compose ps
  }
  'down' { & docker @Compose down }
  'reset' {
    # Deletes ONLY this stack's local volume (clearwood-local_mysql-data).
    & docker @Compose down -v
  }
  'status' {
    if (Test-Path -LiteralPath $SecretsFile) { & docker @Compose ps } else { Write-Host 'Not initialised.' }
    foreach ($url in "$ApiOrigin/health", "$ApiOrigin/ready") {
      try { $r = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 3; Write-Host "$url -> $($r.StatusCode) $($r.Content)" }
      catch { Write-Host "$url -> not reachable" }
    }
  }
  'migrate' {
    $vars = Get-BackendEnv
    Push-Location $BackendRoot
    try {
      Invoke-WithEnv $vars {
        node scripts/sync-prisma-provider.cjs
        npx prisma migrate deploy
        if ($LASTEXITCODE -ne 0) { throw 'prisma migrate deploy failed' }
        npx prisma migrate status
      }
    } finally { Pop-Location }
  }
  'seed' {
    $vars = Get-BackendEnv
    Push-Location $BackendRoot
    try { Invoke-WithEnv $vars { npx prisma db seed; if ($LASTEXITCODE -ne 0) { throw 'prisma db seed failed' } } } finally { Pop-Location }
  }
  'provision' {
    $vars = Get-BackendEnv
    $vars['CLEARWOOD_BACKEND_DIR'] = $BackendRoot
    $vars['DEV_SUPERADMIN_EMAIL'] = 'dev.superadmin@clearwood.local'
    Push-Location $BackendRoot
    try {
      Invoke-WithEnv $vars { npx tsx (Join-Path $Here 'provision-super-admin.ts'); if ($LASTEXITCODE -ne 0) { throw 'provision failed' } }
    } finally { Pop-Location }
  }
  'backend' {
    $vars = Get-BackendEnv
    Push-Location $BackendRoot
    try { Invoke-WithEnv $vars { npx tsx watch src/server.ts } } finally { Pop-Location }
  }
  'backend-ratelimit' {
    # The same local database, but a low upload allowance (3 per 20 s), its own Redis prefix (its
    # counters and caches never touch the main API's) and no reconciler timer.
    $vars = Get-BackendEnv
    $vars['API_PORT'] = "$RateLimitApiPort"
    $vars['CORS_ORIGINS'] = "http://localhost:$RateLimitE2ePort"
    $vars['AUTH_RATE_LIMIT_MAX'] = '3'
    $vars['AUTH_RATE_LIMIT_WINDOW_MS'] = '20000'
    $vars['REDIS_KEY_PREFIX'] = 'cwratelimit:'
    $vars['LISTING_RECONCILE_INTERVAL_SECONDS'] = '0'
    Push-Location $BackendRoot
    try { Invoke-WithEnv $vars { npx tsx src/server.ts } } finally { Pop-Location }
  }
  'dev-data' {
    $s = Get-Secrets
    $vars = [ordered]@{
      CLEARWOOD_API_ORIGIN    = $ApiOrigin
      CLEARWOOD_ADMIN_ORIGIN  = "http://localhost:$AdminPort"
      DEV_SUPERADMIN_EMAIL    = 'dev.superadmin@clearwood.local'
      DEV_SUPERADMIN_PASSWORD = $s.ADMIN_SEED_PASSWORD
      DEV_ADMIN_PASSWORD      = $s.DEV_ADMIN_PASSWORD
    }
    if (-not (Wait-Http "$ApiOrigin/health" 5)) { throw "The backend is not running on $ApiOrigin. Start it with: stack.ps1 backend" }
    Invoke-WithEnv $vars { node (Join-Path $Here 'dev-data.mjs'); if ($LASTEXITCODE -ne 0) { throw 'dev-data failed' } }
  }
  'admin' {
    Push-Location $AdminRoot
    try { Invoke-WithEnv @{ CLEARWOOD_API_ORIGIN = $ApiOrigin; NEXT_TELEMETRY_DISABLED = '1' } { npx next dev -p $AdminPort } } finally { Pop-Location }
  }
  'preview' {
    Push-Location $AdminRoot
    try { Invoke-WithEnv @{ CLEARWOOD_API_ORIGIN = $ApiOrigin; PORT = "$PreviewPort" } { node scripts/serve-static.mjs } } finally { Pop-Location }
  }
  'backend-test' {
    $s = Get-Secrets
    $vars = [ordered]@{
      CLEARWOOD_TEST_DATABASE_URL = "mysql://root:$($s.MYSQL_ROOT_PASSWORD)@127.0.0.1:$MysqlPort/clearwood_test"
      CLEARWOOD_TEST_ALLOWED_HOSTS = "127.0.0.1:$MysqlPort"
    }
    Push-Location $BackendRoot
    try { Invoke-WithEnv $vars { npx vitest run @Rest } } finally { Pop-Location }
  }
  'print-login' {
    $s = Get-Secrets
    Write-Host "Super admin: dev.superadmin@clearwood.local / $($s.ADMIN_SEED_PASSWORD)"
    Write-Host "Other DEV admins (after dev-data): password $($s.DEV_ADMIN_PASSWORD)"
  }
}
