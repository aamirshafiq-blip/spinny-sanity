/**
 * Reads the latest report folder, builds a compact Slack message, and posts to both channels.
 * Usage: node scripts/send-slack.js
 * Requires: SLACK_TOKEN env var (Bot User OAuth Token)
 * Optional: ARTIFACT_URL env var — used as fallback link when Drive upload failed
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const SLACK_TOKEN = process.env.SLACK_TOKEN;
if (!SLACK_TOKEN) { console.error('SLACK_TOKEN env var is required'); process.exit(1); }

const CHANNELS = [
  { id: 'C097JUWCPEU', prefix: '' },
];

// ── find latest report ───────────────────────────────────────────────────────

const reportsDir = path.join(__dirname, '..', 'reports');
const folders = fs.readdirSync(reportsDir)
  .filter(f => !f.endsWith('.zip') && fs.statSync(path.join(reportsDir, f)).isDirectory())
  .sort()
  .reverse();

if (folders.length === 0) { console.error('No report folders found'); process.exit(1); }

const latestDir     = path.join(reportsDir, folders[0]);
const meta          = JSON.parse(fs.readFileSync(path.join(latestDir, 'meta.json'), 'utf-8'));
const driveLinkFile = path.join(latestDir, 'drive-link.txt');
const driveLink     = fs.existsSync(driveLinkFile) ? fs.readFileSync(driveLinkFile, 'utf-8').trim() : null;
const artifactUrl   = process.env.ARTIFACT_URL || null;
const reportLink    = driveLink || artifactUrl;

// ── stats ────────────────────────────────────────────────────────────────────

const CATS = [
  { key: 'ui',     emoji: '📋', label: 'UI' },
  { key: 'filter', emoji: '🔍', label: 'Filter' },
  { key: 'city',   emoji: '🏙️', label: 'City' },
  { key: 'api',    emoji: '🔌', label: 'API' },
];
const DEVS = ['Desktop', 'Android', 'iOS'];

function computeStats() {
  const out = {};
  for (const { key } of CATS) {
    out[key] = {};
    const rows = meta.testRows.filter(r => r.category === key);
    for (const dev of DEVS) {
      const passed = rows.filter(r => r.devices[dev]?.status === 'passed').length;
      const failed = rows.filter(r => r.devices[dev]?.status === 'failed').length;
      out[key][dev] = { passed, failed, total: rows.length };
    }
  }
  return out;
}

const stats = computeStats();

// ── failures (grouped by testId) ─────────────────────────────────────────────

function buildFailures() {
  if (!meta.failures || meta.failures.length === 0) return '';

  const grouped = {};
  for (const f of meta.failures) {
    if (!grouped[f.testId]) grouped[f.testId] = { title: f.title, devices: [], error: f.error || '' };
    if (!grouped[f.testId].devices.includes(f.device)) grouped[f.testId].devices.push(f.device);
  }

  let out = `\n---\n🚨 *${meta.totalFailed} failure${meta.totalFailed !== 1 ? 's' : ''} — action required*\n\n`;
  for (const [testId, info] of Object.entries(grouped)) {
    const devStr   = info.devices.join(', ');
    const firstLine = info.error.split('\n')[0].trim();
    const shortErr  = firstLine.slice(0, 200);
    out += `*${testId}: ${info.title}* _(${devStr})_\n\`${shortErr}\`\n\n`;
  }
  return out;
}

// ── build message ────────────────────────────────────────────────────────────

const overallEmoji = meta.totalFailed === 0 ? '✅' : '❌';

let msg = `${overallEmoji} *PLP Sanity — ${meta.runLabel} IST*\n`;
msg += `*${meta.totalPassed}/${meta.totalTests} passed* | spinny.com/used-cars/delhi/\n`;
if (reportLink) {
  const label = driveLink ? 'Full Report (screenshots & video)' : 'GitHub Actions Run';
  msg += `📎 <${reportLink}|${label}>\n`;
}
msg += '\n';

// Results table
msg += `| Category | 🖥️ Desktop | 📱 Android | 🍎 iOS |\n`;
msg += `|---|---|---|---|\n`;
for (const { key, emoji, label } of CATS) {
  const total = meta.testRows.filter(r => r.category === key).length;
  if (total === 0) continue;
  const cells = DEVS.map(dev => {
    const { passed, failed } = stats[key][dev];
    const ok = failed === 0 ? '✅' : '❌';
    return `${passed}/${total} ${ok}`;
  });
  msg += `| ${emoji} ${label} (${total}) | ${cells.join(' | ')} |\n`;
}

msg += buildFailures();

// ── post to Slack ────────────────────────────────────────────────────────────

function postSlack(channelId, text) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ channel: channelId, text, mrkdwn: true });
    const req  = https.request({
      hostname: 'slack.com',
      path:     '/api/chat.postMessage',
      method:   'POST',
      headers: {
        'Authorization':  `Bearer ${SLACK_TOKEN}`,
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        const parsed = JSON.parse(data);
        if (!parsed.ok) reject(new Error(parsed.error));
        else resolve(parsed);
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

(async () => {
  for (const ch of CHANNELS) {
    try {
      await postSlack(ch.id, ch.prefix + msg);
      console.log(`✅ Sent to ${ch.id}`);
    } catch (err) {
      console.error(`❌ Failed ${ch.id}: ${err.message}`);
      process.exitCode = 1;
    }
  }
})();
