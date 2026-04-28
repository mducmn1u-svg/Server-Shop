const express = require('express');
const { z } = require('zod');
const { db, admin } = require('../firebase');
const { PLANS } = require('../config');
const { makeEkey } = require('../utils/helpers');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

const buySchema = z.object({ planId: z.string().min(1).max(20) });

router.get('/plans', (req, res) => res.json({ ok: true, plans: PLANS }));

router.post('/buy', requireAuth, async (req, res, next) => {
  try {
    const { planId } = buySchema.parse(req.body);
    const plan = PLANS.find(p => p.id === planId);
    if (!plan) return res.status(404).json({ ok: false, error: 'Plan not found' });
    const userRef = db.ref('users/' + req.uid);
    let newBalance = null;
    const tx = await userRef.child('balance').transaction(cur => {
      const bal = Number(cur || 0);
      if (bal < plan.price) return;
      newBalance = bal - plan.price;
      return newBalance;
    }, undefined, false);
    if (!tx.committed) return res.status(400).json({ ok: false, error: 'Không đủ số dư' });
    const now = Date.now();
    const code = makeEkey();
    const id = db.ref('ekeys').push().key;
    const pid = db.ref('purchases').push().key;
    const updates = {};
    updates['ekeys/' + id] = { key: code, uid: req.uid, plan: plan.id, label: plan.label, price: plan.price, createdAt: now, expiresAt: now + plan.duration, active: true };
    updates['purchases/' + pid] = { uid: req.uid, productName: 'Ekey ' + plan.label, price: plan.price, key: code, timestamp: admin.database.ServerValue.TIMESTAMP };
    await db.ref().update(updates);
    res.json({ ok: true, balance: newBalance, ekey: { id, key: code, label: plan.label, expiresAt: now + plan.duration } });
  } catch (err) { next(err); }
});

module.exports = router;
