const admin = require('firebase-admin');
function parseServiceAccount(raw) {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed.startsWith('{')) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON must be raw JSON only, starting with {');
  const parsed = JSON.parse(trimmed);
  if (parsed.private_key) parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
  return parsed;
}
function getCredential() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return admin.credential.cert(parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT_JSON));
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) throw new Error('Missing Firebase Admin credentials');
  return admin.credential.cert({ projectId, clientEmail, privateKey });
}
if (!admin.apps.length) admin.initializeApp({ credential: getCredential(), databaseURL: process.env.FIREBASE_DATABASE_URL });
const db = admin.database();
module.exports = { admin, db };
