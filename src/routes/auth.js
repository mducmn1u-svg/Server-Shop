const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { db, admin } = require('../firebase');
const { safeName, publicUser } = require('../utils/helpers');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const loginSchema = z.object({ realname: z.string().min(1).max(40), password: z.string().min(1).max(100) });
const regSchema = z.object({ name: z.string().min(1).max(60), realname: z.string().min(1).max(40), password: z.string().min(4).max(100) });

function sign(uid) { return jwt.sign({ uid }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }); }
function isHash(p) { return typeof p === 'string' && p.startsWith('$2'); }

router.post('/register', async (req, res, next) => {
  try {
    const body = regSchema.parse(req.body);
    const uid = safeName(body.realname);
    if (!uid) return res.status(400).json({ ok: false, error: 'Invalid realname' });
    const ref = db.ref('users/' + uid);
    const snap = await ref.get();
    if (snap.exists()) return res.status(409).json({ ok: false, error: 'Realname already exists' });
    const passwordHash = await bcrypt.hash(body.password, 12);
    await ref.set({ realname: uid, name: body.name.trim(), passwordHash, balance: 0, role: 'user', createdAt: admin.database.ServerValue.TIMESTAMP });
    res.json({ ok: true, token: sign(uid), user: publicUser(uid, { name: body.name, balance: 0 }) });
  } catch (err) { next(err); }
});

router.post('/login', async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const uid = safeName(body.realname);
    const ref = db.ref('users/' + uid);
    const snap = await ref.get();
    if (!snap.exists()) return res.status(401).json({ ok: false, error: 'Realname không tồn tại' });
    const u = snap.val() || {};
    let ok = false;
    if (u.passwordHash) ok = await bcrypt.compare(body.password, u.passwordHash);
    else if (u.password) ok = String(u.password) === String(body.password);
    if (!ok) return res.status(401).json({ ok: false, error: 'Sai mật khẩu' });
    const patch = { lastLogin: admin.database.ServerValue.TIMESTAMP };
    if (!u.passwordHash) { patch.passwordHash = await bcrypt.hash(body.password, 12); patch.password = null; }
    await ref.update(patch);
    res.json({ ok: true, token: sign(uid), user: publicUser(uid, u) });
  } catch (err) { next(err); }
});

router.get('/me', requireAuth, (req, res) => res.json({ ok: true, user: publicUser(req.uid, req.user) }));
module.exports = router;
