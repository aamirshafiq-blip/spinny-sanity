# ============================================================
#  Spinny PLP Sanity -- run-sanity.ps1
#  Called by Windows Task Scheduler every 2 hours (8am-8pm)
#  1. Runs Playwright tests (Desktop + Android + iOS)
#  2. Generates HTML report + meta.json
#  Slack is sent separately by Claude Code cron via MCP
# ============================================================

$ErrorActionPreference = "Continue"
$ProjectDir = "C:\Users\Aamir Khan\PLP-sanity"
$LogFile    = "$ProjectDir\logs\sanity-$(Get-Date -Format 'yyyy-MM-dd').log"

New-Item -ItemType Directory -Force -Path "$ProjectDir\logs" | Out-Null
New-Item -ItemType Directory -Force -Path "$ProjectDir\test-results" | Out-Null

function Log($msg) {
    $line = "[$(Get-Date -Format 'HH:mm:ss')] $msg"
    Write-Host $line
    Add-Content -Path $LogFile -Value $line
}

$RunTime  = Get-Date
$RunLabel = $RunTime.ToString("dd MMM yyyy, hh:mm tt")
Log "=== PLP Sanity started: $RunLabel ==="

Set-Location $ProjectDir

# -- step 1: run playwright --
Log "Running Playwright tests..."
& cmd.exe /c "cd /d `"$ProjectDir`" && npx playwright test"
$pwExitCode = $LASTEXITCODE
Log "Playwright exit code: $pwExitCode"

# -- step 2: generate HTML report + meta.json --
Log "Generating HTML report..."
$genOutput = & node "$ProjectDir\scripts\generate-report.js" 2>&1
Log "Report output: $genOutput"

# -- step 3: zip the report folder --
Log "Zipping report..."
$reportDirLine = ($genOutput -split "`n") | Where-Object { $_ -match "^REPORT_DIR=" }
if ($reportDirLine) {
    $reportDir = $reportDirLine -replace "^REPORT_DIR=", ""
    $reportDir = $reportDir.Trim()
    if (Test-Path $reportDir) {
        $zipPath = "$reportDir.zip"
        Compress-Archive -Path "$reportDir\*" -DestinationPath $zipPath -Force
        Log "Zip created: $zipPath"
    } else {
        Log "Report dir not found: $reportDir"
    }
} else {
    Log "Could not extract REPORT_DIR from generate-report output"
}

# -- step 4: upload zip to Google Drive --
Log "Uploading to Google Drive..."
if ($reportDir -and (Test-Path "$reportDir.zip")) {
    $meta = Get-Content "$reportDir\meta.json" -Raw | ConvertFrom-Json
    $driveName = "Spinny PLP Sanity $($meta.runLabel).zip"
    $linkFile  = "$reportDir\drive-link.txt"
    $driveOut  = & node "$ProjectDir\scripts\upload-drive.js" "$reportDir.zip" $driveName $linkFile 2>&1
    $driveLine = ($driveOut -split "`n") | Where-Object { $_ -match "^DRIVE_LINK=" }
    if ($driveLine) {
        $driveLink = ($driveLine -replace "^DRIVE_LINK=", "").Trim()
        Log "Drive upload successful: $driveLink"
    } else {
        Log "Drive upload failed: $driveOut"
    }
} else {
    Log "Zip not found -- skipping Drive upload"
}

Log "=== PLP Sanity complete. Claude cron will send Slack report. ==="
