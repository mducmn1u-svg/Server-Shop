const jwt = require('jsonwebtoken');
const { db } = require('../firebase');
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return res.status(401).json({ ok: false, error: 'Missing token' });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const uid = String(payload.uid || '');
    const snap = await db.ref('users/' + uid).get();
    if (!snap.exists()) return res.status(401).json({ ok: false, error: 'User not found' });
    req.uid = uid;
    req.user = snap.val() || {};
    next();
  } catch (_) { res.status(401).json({ ok: false, error: 'Invalid token' }); }
}
function requireAdminSecret(req, res, next) {
  const secret = req.headers['x-admin-secret'];
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) return res.status(403).json({ ok: false, error: 'Admin denied' });
  next();
}
module.exports = { requireAuth, requireAdminSecret };
