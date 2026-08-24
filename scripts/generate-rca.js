/**
 * Calls Claude API for each unique failing test and writes RCA back to meta.json.
 * Usage: node scripts/generate-rca.js <report-dir>
 * Requires: ANTHROPIC_API_KEY env var
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const API_KEY   = process.env.ANTHROPIC_API_KEY;
const reportDir = process.argv[2];

if (!API_KEY) {
  console.log('ANTHROPIC_API_KEY not set — skipping RCA');
  process.exit(0);
}

if (!reportDir) {
  console.error('Usage: node generate-rca.js <report-dir>');
  process.exit(1);
}

const metaPath = path.join(reportDir, 'meta.json');
if (!fs.existsSync(metaPath)) {
  console.error('meta.json not found at', metaPath);
  process.exit(1);
}

const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));

if (!meta.failures || meta.failures.length === 0) {
  console.log('No failures — skipping RCA');
  process.exit(0);
}

function callClaude(testId, title, devices, error) {
  return new Promise((resolve) => {
    const prompt =
      `You are analyzing a Playwright test failure from Spinny's PLP (Product Listing Page) sanity suite.\n\n` +
      `Test ID: ${testId}\nTest name: ${title}\nDevice(s): ${devices}\nError: ${error}\n\n` +
      `In 1-2 plain sentences, explain what likely went wrong on the Spinny website and what the QA team should manually verify. Be specific and actionable. No markdown.`;

    const body = JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 120,
      messages: [{ role: 'user', content: prompt }],
    });

    const req = https.request({
      hostname: 'api.anthropic.com',
      path:     '/v1/messages',
      method:   'POST',
      headers: {
        'x-api-key':         API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
        'content-length':    Buffer.byteLength(body),
      },
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.content?.[0]?.text?.trim() || 'RCA unavailable');
        } catch (_) {
          resolve('RCA unavailable');
        }
      });
    });
    req.on('error', () => resolve('RCA unavailable'));
    req.write(body);
    req.end();
  });
}

(async () => {
  // Group failures by testId to avoid duplicate API calls
  const grouped = {};
  for (const f of meta.failures) {
    if (!grouped[f.testId]) grouped[f.testId] = { title: f.title, devices: [], error: f.error || '' };
    if (!grouped[f.testId].devices.includes(f.device)) grouped[f.testId].devices.push(f.device);
  }

  const rcaMap = {};
  for (const [testId, info] of Object.entries(grouped)) {
    const firstLine = info.error.split('\n')[0].trim().slice(0, 300);
    console.log(`Generating RCA for ${testId}...`);
    rcaMap[testId] = await callClaude(testId, info.title, info.devices.join(', '), firstLine);
    console.log(`  → ${rcaMap[testId]}`);
  }

  meta.rca = rcaMap;
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
  console.log(`RCA written to meta.json (${Object.keys(rcaMap).length} entries)`);
})();
