# PLP Sanity — Setup Guide

## One-time setup steps

### 1. Add Slack Bot Token to config.json

Open `config.json` and replace `YOUR_SLACK_BOT_TOKEN_HERE` with your Slack bot token.

To get your bot token:
1. Go to https://api.slack.com/apps
2. Select the Spinny bot (or create one)
3. Go to "OAuth & Permissions" → copy the "Bot User OAuth Token" (starts with `xoxb-`)
4. Paste it in config.json

### 2. Register the Task Scheduler job (run once as Admin)

Open PowerShell as Administrator and run:

```powershell
cd "C:\Users\Aamir Khan\PLP-sanity"
.\setup-scheduler.ps1
```

This creates the task with 7 daily triggers (8am, 10am, 12pm, 2pm, 4pm, 6pm, 8pm).
"Run as soon as possible after a missed trigger" is enabled automatically.

### 3. Verify the task was registered

```powershell
Get-ScheduledTask -TaskName "Spinny-PLP-Sanity" | Get-ScheduledTaskInfo
```

### 4. Test it manually

```powershell
Start-ScheduledTask -TaskName "Spinny-PLP-Sanity"
```

Then check `C:\Users\Aamir Khan\PLP-sanity\logs\` for the log file.

---

## Running tests manually

```bash
# All 3 devices
npx playwright test

# Single device
npx playwright test --project=Desktop
npx playwright test --project=Android
npx playwright test --project=iOS
```

Reports are saved to: `C:\Users\Aamir Khan\PLP-sanity\reports\<timestamp>\report.html`

---

## Slack report format

```
✅ PLP Sanity — 21 Aug 2026, 10:00 AM IST

📊 Results (45/45 passed)
  ✅ 🖥️ Desktop   UI: 10/10  |  API: 5/5
  ✅ 📱 Android   UI: 10/10  |  API: 5/5
  ✅ 🍎 iOS       UI: 10/10  |  API: 5/5

📁 Report: C:\Users\Aamir Khan\PLP-sanity\reports\2026-08-21_10-00\report.html
```

---

## File structure

```
PLP-sanity/
├── tests/plp.spec.js          # All UI + API tests (15 per device = 45 total)
├── playwright.config.js        # Device profiles (Desktop, Android, iOS)
├── scripts/
│   └── generate-report.js     # HTML report generator
├── run-sanity.ps1             # Main run script (called by Task Scheduler)
├── setup-scheduler.ps1        # Task Scheduler registration (run once as Admin)
├── config.json                # Slack token + channel
├── reports/                   # HTML reports (per-run subfolders)
├── logs/                      # Daily log files
└── test-results/              # Playwright raw output + screenshots
```
