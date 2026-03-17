# ── Opoclaw Installer (Windows PowerShell) ──────────────────────────────────

$RepoUrl = "https://github.com/oponic/opoclaw.git"
$InstallDir = "$HOME\Documents\opoclaw"
$BinDir = "$HOME\.local\bin"

function Write-Info($msg)  { Write-Host "[opoclaw] $msg" -ForegroundColor Cyan }
function Write-Ok($msg)    { Write-Host "[✓] $msg" -ForegroundColor Green }
function Write-Header($msg){ Write-Host "`n═══ $msg ═══`n" -ForegroundColor White -BackgroundColor DarkBlue }

# ── Check for Winget / Scoop ────────────────────────────────────────────────

function Ensure-PackageManager {
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        return "winget"
    }
    if (Get-Command scoop -ErrorAction SilentlyContinue) {
        return "scoop"
    }
    Write-Info "No package manager found. Installing Scoop..."
    Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
    irm get.scoop.sh | iex
    return "scoop"
}

# ── Install Git ─────────────────────────────────────────────────────────────

function Ensure-Git {
    if (Get-Command git -ErrorAction SilentlyContinue) {
        Write-Ok "Git already installed"
        return
    }
    Write-Info "Installing Git..."
    $pm = Ensure-PackageManager
    switch ($pm) {
        "winget" { winget install Git.Git --accept-source-agreements --accept-package-agreements }
        "scoop"  { scoop install git }
    }
    Write-Ok "Git installed"
}

# ── Install Bun ─────────────────────────────────────────────────────────────

function Ensure-Bun {
    if (Get-Command bun -ErrorAction SilentlyContinue) {
        Write-Ok "Bun already installed ($(bun --version))"
        return
    }
    Write-Info "Installing Bun..."
    $pm = Ensure-PackageManager
    switch ($pm) {
        "winget" { winget install Oven-sh.Bun }
        "scoop"  { scoop install bun }
    }
    # Refresh PATH for this session
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","User") + ";" + [System.Environment]::GetEnvironmentVariable("Path","Machine")
    Write-Ok "Bun installed"
}

# ── Clone Repo ──────────────────────────────────────────────────────────────

function Clone-Repo {
    if (Test-Path $InstallDir) {
        Write-Ok "opoclaw already exists at $InstallDir — pulling latest"
        Set-Location $InstallDir
        git pull --rebase
        return
    }
    Write-Info "Cloning opoclaw to $InstallDir..."
    git clone $RepoUrl $InstallDir
    Write-Ok "Repo cloned"
}

# ── Install Dependencies ────────────────────────────────────────────────────

function Install-Dependencies {
    Write-Info "Installing dependencies..."
    Set-Location $InstallDir
    bun install
    Write-Ok "Dependencies installed"
}

# ── Create Bin Symlink ──────────────────────────────────────────────────────

function Create-Symlink {
    New-Item -ItemType Directory -Force -Path $BinDir | Out-Null
    $target = Join-Path $InstallDir "installers\onboard.ts"
    $link = Join-Path $BinDir "opoclaw.cmd"
    # Create a cmd wrapper
    "@echo off`nbun run `"$target`" %*" | Out-File -Encoding ascii $link
    Write-Ok "Created $link"

    # Check PATH
    $paths = $env:Path -split ";"
    if ($paths -contains $BinDir) {
        Write-Ok "$BinDir is in PATH"
    } else {
        Write-Host ""
        Write-Host "⚠ Add this to your PATH:" -ForegroundColor Yellow
        Write-Host "  $BinDir"
        Write-Host ""
    }
}

# ── Main ────────────────────────────────────────────────────────────────────

Write-Header "opoclaw installer (Windows)"
Ensure-Git
Ensure-Bun

Write-Header "Setting up opoclaw"
Clone-Repo
Install-Dependencies
Create-Symlink

Write-Header "Launching onboard wizard"
Set-Location $InstallDir
bun run installers\onboard.ts
