# Push Dolls project to https://github.com/Tsinajinnie2/Doll-Supply-Chain
# Requires: Git for Windows (https://git-scm.com/download/win)
# Auth: HTTPS + PAT, or SSH remote

$ErrorActionPreference = "Stop"
# scripts/push-to-github.ps1 -> repo root is parent of scripts/
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

$gitCmd = Get-Command git -ErrorAction SilentlyContinue
$git = if ($gitCmd) { $gitCmd.Source } else { $null }
if (-not $git) {
    foreach ($p in @(
        "${env:ProgramFiles}\Git\bin\git.exe",
        "${env:ProgramFiles}\Git\cmd\git.exe",
        "${env:ProgramFiles(x86)}\Git\bin\git.exe"
    )) {
        if (Test-Path $p) {
            $git = $p
            break
        }
    }
}
if (-not $git) {
    Write-Error "Git not found. Install Git for Windows, then re-run this script."
}

$remoteUrl = "https://github.com/Tsinajinnie2/Doll-Supply-Chain.git"

if (-not (Test-Path ".git")) {
    & $git init
    & $git branch -M main
}

$hasOrigin = & $git remote get-url origin 2>$null
if ($LASTEXITCODE -ne 0) {
    & $git remote add origin $remoteUrl
} else {
    & $git remote set-url origin $remoteUrl
}

# Optional: merge remote LICENSE if repo only had LICENSE on GitHub
& $git fetch origin 2>$null
if ($LASTEXITCODE -eq 0) {
    & $git pull origin main --allow-unrelated-histories --no-edit 2>$null
}

& $git add -A
$status = & $git status --porcelain
if (-not $status) {
    Write-Host "Nothing to commit (working tree clean)."
} else {
    & $git commit -m "Import Doll supply chain: Django API, Vite frontend, seed data"
}

Write-Host "Pushing to origin main..."
& $git push -u origin main
Write-Host "Done. Repo: https://github.com/Tsinajinnie2/Doll-Supply-Chain"
