$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $projectRoot ".env.local"

if (-not (Test-Path -LiteralPath $envFile)) {
  throw ".env.local is missing. Run: npm run setup:local"
}

Set-Location -LiteralPath $projectRoot
npm run dev
