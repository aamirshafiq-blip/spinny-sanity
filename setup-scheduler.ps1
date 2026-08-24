# ============================================================
#  setup-scheduler.ps1
#  Registers the PLP Sanity task in Windows Task Scheduler.
#  Run ONCE as Administrator.
#  Schedule: daily Mon-Sun, 8am / 10am / 12pm / 2pm / 4pm / 6pm / 8pm
#  Option 2: "Run as soon as possible after a scheduled start is missed"
# ============================================================

$TaskName   = "Spinny-PLP-Sanity"
$ProjectDir = "C:\Users\Aamir Khan\PLP-sanity"
$Script     = "$ProjectDir\run-sanity.ps1"
$LogDir     = "$ProjectDir\logs"

# ── prereq check ─────────────────────────────────────────────
if (-not (Test-Path $Script)) {
    Write-Error "run-sanity.ps1 not found at $Script"
    exit 1
}
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

# ── remove existing task if present ──────────────────────────
if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "Removed existing task '$TaskName'"
}

# ── action: run PowerShell with run-sanity.ps1 ───────────────
$Action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NonInteractive -ExecutionPolicy Bypass -File `"$Script`"" `
    -WorkingDirectory $ProjectDir

# ── 7 daily triggers at 08:00 10:00 12:00 14:00 16:00 18:00 20:00 ──
$TriggerTimes = @("08:00","10:00","12:00","14:00","16:00","18:00","20:00")
$Triggers = $TriggerTimes | ForEach-Object {
    $t = New-ScheduledTaskTrigger -Daily -At $_
    # "Run task as soon as possible after a scheduled start is missed" = StartWhenAvailable
    $t.StartBoundary = (Get-Date).Date.ToString("yyyy-MM-dd") + "T${_}:00"
    $t
}

# ── settings ─────────────────────────────────────────────────
$Settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 30) `
    -MultipleInstances IgnoreNew

# ── principal: run as current user, only when logged on ──────
$Principal = New-ScheduledTaskPrincipal `
    -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) `
    -LogonType Interactive `
    -RunLevel Highest

# ── register ─────────────────────────────────────────────────
Register-ScheduledTask `
    -TaskName    $TaskName `
    -Action      $Action `
    -Trigger     $Triggers `
    -Settings    $Settings `
    -Principal   $Principal `
    -Description "Spinny PLP automated sanity - UI + API - Desktop / Android / iOS - reports to core-consumer-qa" | Out-Null

Write-Host ""
Write-Host "✅ Task '$TaskName' registered successfully."
Write-Host ""
Write-Host "Schedule: Mon-Sun, every 2 hours from 8:00 AM to 8:00 PM"
Write-Host "Option 2 (run on missed trigger): ENABLED via -StartWhenAvailable"
Write-Host ""
Write-Host "To verify:"
Write-Host "  Get-ScheduledTask -TaskName '$TaskName' | Get-ScheduledTaskInfo"
Write-Host ""
Write-Host "To run manually right now:"
Write-Host "  Start-ScheduledTask -TaskName '$TaskName'"
Write-Host ""
Write-Host "To remove:"
Write-Host "  Unregister-ScheduledTask -TaskName '$TaskName' -Confirm:`$false"
