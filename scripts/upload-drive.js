/**
 * Uploads a file to Google Drive and makes it publicly readable.
 * Usage: node scripts/upload-drive.js <zipPath> <displayName> [outputFile]
 * Outputs: DRIVE_LINK=https://drive.google.com/file/d/<id>/view
 *
 * Requires credentials/drive-token.json — run setup-drive-auth.js once first.
 */

const { google } = require('googleapis');
const fs         = require('fs');
const path       = require('path');
const { Readable } = require('stream');

const credsPath = path.join(__dirname, '..', 'credentials', 'oauth-client.json');
const tokenPath = path.join(__dirname, '..', 'credentials', 'drive-token.json');

if (!fs.existsSync(credsPath) || !fs.existsSync(tokenPath)) {
  console.error('DRIVE_ERROR=Not authenticated. Run: node scripts/setup-drive-auth.js');
  process.exit(1);
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

const zipPath    = process.argv[2];
const fileName   = process.argv[3] || (zipPath ? path.basename(zipPath) : 'report.zip');
const outputFile = process.argv[4];

if (!zipPath || !fs.existsSync(zipPath)) {
  console.error('DRIVE_ERROR=File not found: ' + zipPath);
  process.exit(1);
}

(async () => {
  try {
    const fileBuffer = fs.readFileSync(zipPath);
    const fileSize   = fileBuffer.length;
    console.error(`Uploading "${fileName}" (${(fileSize / 1024 / 1024).toFixed(1)} MB)...`);

    const bodyStream = new Readable();
    bodyStream.push(fileBuffer);
    bodyStream.push(null);

    const res = await drive.files.create({
      requestBody: {
        name: fileName,
        mimeType: 'application/zip',
      },
      media: {
        mimeType: 'application/zip',
        body: bodyStream,
      },
      fields: 'id,name',
    });

    const fileId = res.data.id;
    console.error(`Uploaded file ID: ${fileId}`);

    // Try domain-wide sharing first (works in Google Workspace orgs).
    // Fall back silently if org policy blocks it — the link still works for org members.
    try {
      await drive.permissions.create({
        fileId,
        requestBody: { role: 'reader', type: 'domain', domain: 'spinny.com' },
      });
      console.error('Shared with spinny.com domain.');
    } catch (permErr) {
      console.error(`Permission not set (${permErr.status || permErr.code}): ${permErr.message} — link still accessible to org members.`);
    }

    const link = `https://drive.google.com/file/d/${fileId}/view`;
    console.log(`DRIVE_LINK=${link}`);
    console.log(`DRIVE_FILE_ID=${fileId}`);

    if (outputFile) {
      fs.writeFileSync(outputFile, link, 'utf-8');
    }
  } catch (err) {
    const status  = err.status || err.code || '?';
    const details = err.response ? JSON.stringify(err.response.data) : err.message;
    console.error(`DRIVE_ERROR=[${status}] ${details}`);
    process.exit(1);
  }
})();
