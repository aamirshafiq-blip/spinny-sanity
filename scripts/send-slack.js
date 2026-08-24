/**
 * Reads the latest report folder, builds the Slack message, and posts to both channels.
 * Usage: node scripts/send-slack.js
 * Requires: SLACK_TOKEN env var (Bot User OAuth Token)
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const SLACK_TOKEN = process.env.SLACK_TOKEN;
if (!SLACK_TOKEN) { console.error('SLACK_TOKEN env var is required'); process.exit(1); }

const CHANNELS = [
  { id: 'C097JUWCPEU', prefix: '' },
  { id: 'C05GVHETJRM', prefix: '<@U02KH6AJCTV> <@U0A7LEA1P0Q>\n' },
];

// ── find latest report ───────────────────────────────────────────────────────

const reportsDir = path.join(__dirname, '..', 'reports');
const folders = fs.readdirSync(reportsDir)
  .filter(f => !f.endsWith('.zip') && fs.statSync(path.join(reportsDir, f)).isDirectory())
  .sort()
  .reverse();

if (folders.length === 0) { console.error('No report folders found'); process.exit(1); }

const latestDir   = path.join(reportsDir, folders[0]);
const meta        = JSON.parse(fs.readFileSync(path.join(latestDir, 'meta.json'), 'utf-8'));
const driveLinkFile = path.join(latestDir, 'drive-link.txt');
const driveLink   = fs.existsSync(driveLinkFile) ? fs.readFileSync(driveLinkFile, 'utf-8').trim() : null;

// ── helpers ──────────────────────────────────────────────────────────────────

const cell = (status, ms) => `${status === 'passed' ? '✅' : '❌'} ${ms ? (ms/1000).toFixed(1)+'s' : '-'}`;

function buildTable(rows) {
  const lines = ['| Test | 🖥️ Desktop | 📱 Android | 🍎 iOS |', '|---|---|---|---|'];
  for (const r of rows) {
    const d = r.devices;
    lines.push(`| ${r.title} | ${cell(d.Desktop.status, d.Desktop.durationMs)} | ${cell(d.Android.status, d.Android.durationMs)} | ${cell(d.iOS.status, d.iOS.durationMs)} |`);
  }
  return lines.join('\n');
}

// ── build message ────────────────────────────────────────────────────────────

const overallEmoji = meta.totalFailed === 0 ? '✅' : '❌';
const uiRows     = meta.testRows.filter(r => r.category === 'ui');
const filterRows = meta.testRows.filter(r => r.category === 'filter');
const cityRows   = meta.testRows.filter(r => r.category === 'city');
const apiRows    = meta.testRows.filter(r => r.category === 'api');

let msg = `${overallEmoji} *PLP Sanity — ${meta.runLabel} IST*\n`;
msg += `*URL tested:* spinny.com/used-cars/delhi/ | *${meta.totalPassed}/${meta.totalTests} tests passed*\n`;
if (driveLink) msg += `📎 *Full Report (with screenshots):* <${driveLink}|Download ZIP>\n`;
msg += `\n---\n\n`;

if (uiRows.length)     msg += `*📋 UI Tests*\n${buildTable(uiRows)}\n\n`;
if (filterRows.length) msg += `*🔍 Filter Tests*\n${buildTable(filterRows)}\n\n`;
if (cityRows.length)   msg += `*🏙️ City Tests*\n${buildTable(cityRows)}\n\n`;
if (apiRows.length)    msg += `*🔌 API Tests (api.spinny.com/listing/v7)*\n${buildTable(apiRows)}`;

if (meta.failures && meta.failures.length > 0) {
  msg += `\n\n---\n🚨 *Failures — Action Required*\n\n`;
  for (const f of meta.failures) {
    msg += `❌ *[${f.device}] ${f.testId}: ${f.title}*\nError: ${f.error.slice(0, 300)}\n\n`;
  }
}

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
