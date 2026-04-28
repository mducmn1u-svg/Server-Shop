const admin = require('firebase-admin');

function getCredential() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    return admin.credential.cert(parsed);
  }
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (privateKey) privateKey = privateKey.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) throw new Error('Missing Firebase Admin credentials');
  return admin.credential.cert({ projectId, clientEmail, privateKey });
}

admin.initializeApp({ credential: getCredential(), databaseURL: process.env.FIREBASE_DATABASE_URL });
const db = admin.database();
module.exports = { admin, db };
