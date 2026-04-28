const express = require('express');
const { z } = require('zod');
const { db, admin } = require('../firebase');
const { PRODUCTS } = require('../config');
const router = express.Router();

const balanceSchema = z.object({ balance: z.number().int().min(0).max(999999999) });
const approveSchema = z.object({ amount: z.number().int().min(1000).max(50000000).optional() });
const addAccSchema = z.object({ type: z.enum(['19k', '29k', '39k', '49k']), lines: z.array(z.string().min(1).max(500)).min(1).max(1000) });
const toolSchema = z.object({ sunwin: z.string().url().optional().or(z.literal('')), lc79: z.string().url().optional().or(z.literal('')) });

router.get('/topups', async (req, res, next) => {
  try {
    const s = await db.ref('topups').get();
    const rows = Object.entries(s.val() || {}).map(([id, x]) => ({ id, ...x })).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 200);
    res.json({ ok: true, rows });
  } catch (err) { next(err); }
});

router.post('/topups/:id/approve', async (req, res, next) => {
  try {
    const body = approveSchema.parse(req.body || {});
    const id = req.params.id;
    const topRef = db.ref('topups/' + id);
    const snap = await topRef.get();
    if (!snap.exists()) return res.status(404).json({ ok: false, error: 'Topup not found' });
    const top = snap.val() || {};
    if (top.status === 'approved') return res.status(409).json({ ok: false, error: 'Already approved' });
    const uid = String(top.uid || top.realname || '').trim();
    const amount = Number(body.amount || top.amount || 0);
    if (!uid || amount < 1000) return res.status(400).json({ ok: false, error: 'Invalid topup' });
    await db.ref('users/' + uid + '/balance').transaction(cur => Number(cur || 0) + amount, undefined, false);
    await topRef.update({ status: 'approved', approvedAt: admin.database.ServerValue.TIMESTAMP, approvedAmount: amount });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/topups/:id/reject', async (req, res, next) => {
  try {
    const id = req.params.id;
    const ref = db.ref('topups/' + id);
    const snap = await ref.get();
    if (!snap.exists()) return res.status(404).json({ ok: false, error: 'Topup not found' });
    await ref.update({ status: 'rejected', rejectedAt: admin.database.ServerValue.TIMESTAMP });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.get('/users', async (req, res, next) => {
  try {
    const s = await db.ref('users').get();
    const rows = Object.entries(s.val() || {}).map(([uid, u]) => ({ uid, realname: u.realname || uid, name: u.name || uid, balance: Number(u.balance || 0), role: u.role || 'user', createdAt: u.createdAt || 0 })).sort((a, b) => a.uid.localeCompare(b.uid));
    res.json({ ok: true, rows });
  } catch (err) { next(err); }
});

router.post('/users/:uid/balance', async (req, res, next) => {
  try {
    const { balance } = balanceSchema.parse(req.body);
    const uid = req.params.uid.replace(/[^a-z0-9_.-]/g, '_').slice(0, 40);
    await db.ref('users/' + uid).update({ balance });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.get('/stock', async (req, res, next) => {
  try {
    const s = await db.ref('accounts').get();
    const all = Object.values(s.val() || {});
    const stock = {};
    for (const p of PRODUCTS) stock[p.type] = all.filter(a => a.type === p.type && !a.used).length;
    res.json({ ok: true, stock });
  } catch (err) { next(err); }
});

router.post('/accounts', async (req, res, next) => {
  try {
    const body = addAccSchema.parse(req.body);
    const updates = {};
    for (const line of body.lines) {
      const key = db.ref('accounts').push().key;
      updates['accounts/' + key] = { type: body.type, credentials: line.trim(), used: false, mode: 'direct', createdAt: admin.database.ServerValue.TIMESTAMP };
    }
    await db.ref().update(updates);
    res.json({ ok: true, added: body.lines.length });
  } catch (err) { next(err); }
});

router.post('/tool-files', async (req, res, next) => {
  try {
    const body = toolSchema.parse(req.body);
    await db.ref('toolFiles').update({ sunwin: { url: body.sunwin || '' }, lc79: { url: body.lc79 || '' } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
