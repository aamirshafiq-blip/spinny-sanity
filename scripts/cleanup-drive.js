/**
 * Deletes Google Drive files named "Spinny PLP Sanity *.zip" older than N days.
 * Usage: node scripts/cleanup-drive.js [days]
 * Default: 7 days
 */

const { google } = require('googleapis');
const fs   = require('fs');
const path = require('path');

const credsPath = path.join(__dirname, '..', 'credentials', 'oauth-client.json');
const tokenPath = path.join(__dirname, '..', 'credentials', 'drive-token.json');

if (!fs.existsSync(credsPath) || !fs.existsSync(tokenPath)) {
  console.error('Drive credentials not found — skipping cleanup.');
  process.exit(0);
}

const raw    = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));
const creds  = raw.installed || raw.web;
const tokens = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));

const oauth2 = new google.auth.OAuth2(creds.client_id, creds.client_secret, 'http://localhost:3000/oauth-callback');
oauth2.setCredentials(tokens);

oauth2.on('tokens', (refreshed) => {
  const merged = { ...tokens, ...refreshed };
  fs.writeFileSync(tokenPath, JSON.stringify(merged, null, 2), 'utf-8');
});

const drive = google.drive({ version: 'v3', auth: oauth2 });

const retainDays = parseInt(process.argv[2] || '7', 10);
const cutoff = new Date(Date.now() - retainDays * 24 * 60 * 60 * 1000);

(async () => {
  try {
    const res = await drive.files.list({
      q: `name contains 'Spinny PLP Sanity' and name contains '.zip' and trashed = false`,
      fields: 'files(id, name, createdTime)',
      orderBy: 'createdTime desc',
      pageSize: 100,
    });

    const files = res.data.files || [];
    console.log(`Found ${files.length} Spinny PLP Sanity ZIP(s) on Drive.`);

    const toDelete = files.filter(f => new Date(f.createdTime) < cutoff);
    console.log(`Deleting ${toDelete.length} file(s) older than ${retainDays} days (before ${cutoff.toISOString()}).`);

    for (const f of toDelete) {
      await drive.files.delete({ fileId: f.id });
      console.log(`  Deleted: ${f.name} (${f.createdTime})`);
    }

    console.log('Drive cleanup complete.');
  } catch (err) {
    const details = err.response ? JSON.stringify(err.response.data) : err.message;
    console.error(`Cleanup failed: ${details}`);
    process.exit(1);
  }
})();
