/**
 * One-time Google Drive OAuth setup.
 * Run: node scripts/setup-drive-auth.js
 *
 * Prerequisites:
 *  1. Go to https://console.cloud.google.com/
 *  2. Create a project → Enable "Google Drive API"
 *  3. APIs & Services → Credentials → Create OAuth client → Desktop app
 *  4. Download the JSON and save it as credentials/oauth-client.json
 */

const { google } = require('googleapis');
const http       = require('http');
const url        = require('url');
const fs         = require('fs');
const path       = require('path');
const { exec }   = require('child_process');

const credsPath  = path.join(__dirname, '..', 'credentials', 'oauth-client.json');
const tokenPath  = path.join(__dirname, '..', 'credentials', 'drive-token.json');

if (!fs.existsSync(credsPath)) {
  console.error('\n❌  credentials/oauth-client.json not found.');
  console.error('\nSteps:');
  console.error('  1. Visit https://console.cloud.google.com/');
  console.error('  2. Create project → Enable "Google Drive API"');
  console.error('  3. Credentials → Create OAuth 2.0 Client → Desktop app');
  console.error('  4. Download JSON → save as  credentials/oauth-client.json');
  console.error('  5. Re-run this script.\n');
  process.exit(1);
}

const raw    = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));
const creds  = raw.installed || raw.web;
const { client_id, client_secret } = creds;

const REDIRECT = 'http://localhost:3000/oauth-callback';
const oauth2   = new google.auth.OAuth2(client_id, client_secret, REDIRECT);

const authUrl = oauth2.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: ['https://www.googleapis.com/auth/drive.file'],
});

console.log('\n🔗  Opening browser for Google Drive authorization...');
console.log('    If the browser does not open, paste this URL manually:\n');
console.log('   ', authUrl, '\n');

exec(`start "" "${authUrl}"`);

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  if (!parsed.pathname.includes('oauth-callback')) return;

  const { code, error } = parsed.query;
  if (error) {
    res.end('Authorization failed: ' + error);
    server.close();
    console.error('❌  Authorization failed:', error);
    process.exit(1);
  }

  res.end('<h2>Authorization successful! You can close this window.</h2>');
  server.close();

  const { tokens } = await oauth2.getToken(code);
  fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2), 'utf-8');
  console.log('✅  Token saved to credentials/drive-token.json');
  console.log('    Drive uploads are now fully automatic. Run run-sanity.ps1 to test.\n');
  process.exit(0);
});

server.listen(3000, () => {
  console.log('    Waiting for browser callback on http://localhost:3000 ...\n');
});
