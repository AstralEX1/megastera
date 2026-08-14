param(
  [ValidateSet('All', 'Database')]
  [string]$ResumeFrom = 'All'
)

$ErrorActionPreference = 'Stop'

function Read-RequiredValue {
  param([string]$Prompt)

  do {
    $value = (Read-Host $Prompt).Trim()
    if (-not $value) { Write-Host 'A value is required.' -ForegroundColor Yellow }
  } while (-not $value)
  return $value
}

function Read-OptionalValue {
  param([string]$Prompt)
  return (Read-Host $Prompt).Trim()
}

function Read-SecretValue {
  param([string]$Prompt)

  $secure = Read-Host $Prompt -AsSecureString
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  }
  finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  }
}

function Assert-HttpsUrl {
  param(
    [string]$Name,
    [string]$Value,
    [switch]$AllowPostgres
  )

  $uri = $null
  if (-not [Uri]::TryCreate($Value, [UriKind]::Absolute, [ref]$uri)) {
    throw "$Name must be an absolute URL."
  }
  $validScheme = $uri.Scheme -eq 'https' -or ($AllowPostgres -and $uri.Scheme -in @('postgres', 'postgresql'))
  if (-not $validScheme) { throw "$Name must use HTTPS or PostgreSQL URL format." }
  if ($uri.Scheme -eq 'https' -and $uri.Host -match 'sepolia|testnet') {
    throw "$Name points to a testnet host. Use a Base mainnet endpoint."
  }
  return $uri
}

function Assert-RpcUrl {
  param([string]$Name, [string]$Value)
  [void](Assert-HttpsUrl -Name $Name -Value $Value)
}

function Assert-DatabaseUrl {
  param(
    [string]$Name,
    [string]$Value,
    [int]$ExpectedPort
  )

  $uri = Assert-HttpsUrl -Name $Name -Value $Value -AllowPostgres
  if ($uri.Scheme -notin @('postgres', 'postgresql')) { throw "$Name must be a PostgreSQL URL." }
  if ($uri.Port -ne $ExpectedPort) { throw "$Name must use port $ExpectedPort, received $($uri.Port)." }
  if ($uri.Query -match '(^|[?&])sslmode=([^&]+)') {
    if ($Matches[2] -ne 'require') { throw "$Name must use sslmode=require." }
  }
  return $Value
}

function Add-QueryParameter {
  param(
    [string]$Url,
    [string]$Name,
    [string]$Value
  )

  if ($Url -match "(^|[?&])$Name=") { return $Url }
  $separator = if ($Url.Contains('?')) {
    if ($Url.EndsWith('?') -or $Url.EndsWith('&')) { '' } else { '&' }
  } else {
    '?'
  }
  return "$Url$separator$Name=$Value"
}

function Read-RpcFallbacks {
  param([string]$Name)
  $raw = Read-OptionalValue "$Name (comma-separated, optional)"
  if (-not $raw) { return '' }
  $urls = $raw.Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ }
  foreach ($url in $urls) { Assert-RpcUrl -Name $Name -Value $url }
  return ($urls -join ',')
}

function Mask-Value {
  param([string]$Value)
  if (-not $Value) { return '(empty)' }
  if ($Value.Length -le 8) { return '********' }
  return "$($Value.Substring(0, 4))...$($Value.Substring($Value.Length - 4))"
}

function Read-SetupDraft {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) { return $null }
  try {
    return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
  }
  catch {
    return $null
  }
}

function Save-SetupDraft {
  param(
    [string]$Path,
    [string]$ViteRpc,
    [string]$ViteFallbacks,
    [string]$WalletConnect,
    [string]$BaseRpc,
    [string]$BaseFallbacks
  )

  $draft = [ordered]@{
    viteRpc = $ViteRpc
    viteFallbacks = $ViteFallbacks
    walletConnect = $WalletConnect
    baseRpc = $BaseRpc
    baseFallbacks = $BaseFallbacks
  }
  $draft | ConvertTo-Json | Set-Content -LiteralPath $Path -Encoding utf8
}

Write-Host ''
Write-Host 'Megastera Base mainnet environment setup' -ForegroundColor Cyan
Write-Host 'Secrets are hidden while typing and are written only to .env.local.' -ForegroundColor DarkGray
Write-Host ''

$draftPath = Join-Path $env:TEMP 'megastera-mainnet-setup-draft.json'
$draft = Read-SetupDraft -Path $draftPath
$publicRpc = 'https://mainnet.base.org'
$publicFallback = 'https://base-rpc.publicnode.com'

if ($ResumeFrom -eq 'Database') {
  Write-Host 'Resuming before DATABASE_URL. Non-secret RPC values are restored from the setup draft when available.' -ForegroundColor Cyan
  if ($draft) {
    $viteRpc = [string]$draft.viteRpc
    $viteFallbacks = [string]$draft.viteFallbacks
    $walletConnect = [string]$draft.walletConnect
    $baseRpc = [string]$draft.baseRpc
    $baseFallbacks = [string]$draft.baseFallbacks
    Write-Host 'Recovered the previously entered non-secret values.' -ForegroundColor DarkGray
  }
  else {
    $viteRpc = $publicRpc
    $viteFallbacks = $publicFallback
    $walletConnect = ''
    $baseRpc = $publicRpc
    $baseFallbacks = $publicFallback
    Write-Host 'No draft was found. Using Base mainnet public RPC defaults for the skipped fields.' -ForegroundColor Yellow
  }
  Assert-RpcUrl -Name 'VITE_RPC_URL' -Value $viteRpc
  if ($viteFallbacks) {
    foreach ($url in ($viteFallbacks -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ })) {
      Assert-RpcUrl -Name 'VITE_RPC_FALLBACK_URLS' -Value $url
    }
  }
  Assert-RpcUrl -Name 'BASE_RPC_URL' -Value $baseRpc
  if ($baseFallbacks) {
    foreach ($url in ($baseFallbacks -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ })) {
      Assert-RpcUrl -Name 'BASE_RPC_FALLBACK_URLS' -Value $url
    }
  }
}
else {
  $viteRpc = Read-RequiredValue 'VITE_RPC_URL (Base mainnet HTTPS RPC)'
  Assert-RpcUrl -Name 'VITE_RPC_URL' -Value $viteRpc
  $viteFallbacks = Read-RpcFallbacks 'VITE_RPC_FALLBACK_URLS'
  $walletConnect = Read-OptionalValue 'VITE_WALLETCONNECT_PROJECT_ID (optional; Enter to skip)'
  $baseRpc = Read-RequiredValue 'BASE_RPC_URL (server-side Base mainnet HTTPS RPC)'
  Assert-RpcUrl -Name 'BASE_RPC_URL' -Value $baseRpc
  $baseFallbacks = Read-RpcFallbacks 'BASE_RPC_FALLBACK_URLS'
  Save-SetupDraft -Path $draftPath -ViteRpc $viteRpc -ViteFallbacks $viteFallbacks -WalletConnect $walletConnect -BaseRpc $baseRpc -BaseFallbacks $baseFallbacks
}

$apiKey = Read-SecretValue 'MEGAPOT_API_KEY (mpk_live_*)'
if ($apiKey -notmatch '^mpk_live_[A-Za-z0-9_-]+$') {
  throw 'MEGAPOT_API_KEY must start with mpk_live_. The value was not written.'
}

$databaseUrl = Read-SecretValue 'DATABASE_URL (Supabase transaction pooler :6543; hidden)'
Assert-DatabaseUrl -Name 'DATABASE_URL' -Value $databaseUrl -ExpectedPort 6543
$databaseUrl = Add-QueryParameter -Url $databaseUrl -Name 'sslmode' -Value 'require'
$databaseUrl = Add-QueryParameter -Url $databaseUrl -Name 'pgbouncer' -Value 'true'
$directUrl = Read-SecretValue 'DIRECT_URL (Supabase direct/session pooler :5432; hidden)'
Assert-DatabaseUrl -Name 'DIRECT_URL' -Value $directUrl -ExpectedPort 5432
$directUrl = Add-QueryParameter -Url $directUrl -Name 'sslmode' -Value 'require'

$confirmationRaw = Read-OptionalValue 'MEGAPLANETS_CONFIRMATIONS (default 6)'
$confirmations = if ($confirmationRaw) { $confirmationRaw } else { '6' }
$confirmationNumber = 0
if (-not [int]::TryParse($confirmations, [ref]$confirmationNumber) -or $confirmationNumber -lt 0) {
  throw 'MEGAPLANETS_CONFIRMATIONS must be a non-negative integer. The file was not written.'
}

$workspace = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$envPath = Join-Path $workspace '.env.local'
if (Test-Path -LiteralPath $envPath) {
  $answer = (Read-Host '.env.local already exists. Back it up to TEMP and overwrite it? [Y/n]').Trim()
  if ($answer -and $answer -notmatch '^(y|yes)$') {
    Write-Host 'Cancelled. No files were changed.' -ForegroundColor Yellow
    exit 0
  }
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $backupPath = Join-Path $env:TEMP "megastera-env-local-$stamp.backup"
  Copy-Item -LiteralPath $envPath -Destination $backupPath -Force
  Write-Host "Existing .env.local backed up to: $backupPath" -ForegroundColor DarkGray
}

$lines = @(
  '# Generated by scripts/setup-mainnet-env.ps1. This file is ignored by git.'
  'VITE_APP_NAME=Megastera'
  "VITE_RPC_URL=$viteRpc"
  "VITE_RPC_FALLBACK_URLS=$viteFallbacks"
  "VITE_WALLETCONNECT_PROJECT_ID=$walletConnect"
  'VITE_API_BASE_URL=/api/megapot'
  'VITE_BACKEND_API_BASE_URL='
  "MEGAPOT_API_KEY=$apiKey"
  "BASE_RPC_URL=$baseRpc"
  "BASE_RPC_FALLBACK_URLS=$baseFallbacks"
  "DATABASE_URL=$databaseUrl"
  "DIRECT_URL=$directUrl"
  "MEGAPLANETS_CONFIRMATIONS=$confirmations"
)
Set-Content -LiteralPath $envPath -Value $lines -Encoding utf8
Remove-Item -LiteralPath $draftPath -Force -ErrorAction SilentlyContinue

Write-Host ''
Write-Host 'Mainnet .env.local created successfully.' -ForegroundColor Green
Write-Host "Path: $envPath"
Write-Host "VITE_RPC_URL: $viteRpc"
Write-Host "BASE_RPC_URL: $baseRpc"
Write-Host "MEGAPOT_API_KEY: $(Mask-Value $apiKey)"
Write-Host 'DATABASE_URL: configured (secret hidden)'
Write-Host 'DIRECT_URL: configured (secret hidden)'
Write-Host ''
Write-Host 'Next steps:' -ForegroundColor Cyan
Write-Host '1. Run pnpm db:generate and pnpm db:deploy from a trusted terminal.'
Write-Host '2. Add the same values to Vercel Production/Preview/Development env scopes.'
Write-Host '3. Keep DIRECT_URL out of Vercel unless migrations are intentionally run there.'
Write-Host '4. Rotate any credentials that were previously placed in .env.example.'
Write-Host ''
Read-Host 'Press Enter to close this setup window'
