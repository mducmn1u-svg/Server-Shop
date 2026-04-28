const express = require('express');
const { z } = require('zod');
const { db, admin } = require('../firebase');
const { PRODUCTS } = require('../config');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

const purchaseSchema = z.object({ productId: z.string().min(1).max(20) });

async function countStock(type) {
  const s = await db.ref('accounts').get();
  const all = s.val() || {};
  return Object.values(all).filter(a => String(a.type) === String(type) && !a.used && (!a.mode || a.mode === 'direct')).length;
}

router.get('/products', async (req, res, next) => {
  try {
    const products = [];
    for (const p of PRODUCTS) products.push({ ...p, stock: await countStock(p.type) });
    res.json({ ok: true, products });
  } catch (err) { next(err); }
});

router.post('/purchase', requireAuth, async (req, res, next) => {
  try {
    const { productId } = purchaseSchema.parse(req.body);
    const selected = PRODUCTS.find(p => p.id === productId);
    if (!selected) return res.status(404).json({ ok: false, error: 'Product not found' });

    const userRef = db.ref('users/' + req.uid);
    let newBalance = null;
    const tx = await userRef.child('balance').transaction(cur => {
      const bal = Number(cur || 0);
      if (bal < selected.price) return;
      newBalance = bal - selected.price;
      return newBalance;
    }, undefined, false);
    if (!tx.committed) return res.status(400).json({ ok: false, error: 'Không đủ số dư' });

    const accountsSnap = await db.ref('accounts').get();
    const all = accountsSnap.val() || {};
    const entries = Object.entries(all).filter(([id, a]) => String(a.type) === selected.type && !a.used && (!a.mode || a.mode === 'direct'));
    if (!entries.length) {
      await userRef.child('balance').transaction(cur => Number(cur || 0) + selected.price, undefined, false);
      return res.status(409).json({ ok: false, error: 'Hết hàng' });
    }

    const [accId, acc] = entries[Math.floor(Math.random() * entries.length)];
    const accRef = db.ref('accounts/' + accId);
    const accTx = await accRef.transaction(a => {
      if (!a || a.used || String(a.type) !== selected.type) return;
      a.used = true; a.usedBy = req.uid; a.usedAt = admin.database.ServerValue.TIMESTAMP;
      return a;
    }, undefined, false);
    if (!accTx.committed) {
      await userRef.child('balance').transaction(cur => Number(cur || 0) + selected.price, undefined, false);
      return res.status(409).json({ ok: false, error: 'Acc vừa bị mua, thử lại' });
    }

    const pid = db.ref('purchases').push().key;
    const purchase = { uid: req.uid, realname: req.uid, type: selected.type, price: selected.price, productName: selected.name, credentials: acc.credentials || '', timestamp: admin.database.ServerValue.TIMESTAMP };
    await db.ref('purchases/' + pid).set(purchase);
    res.json({ ok: true, balance: newBalance, purchase: { id: pid, productName: selected.name, price: selected.price, credentials: acc.credentials || '' } });
  } catch (err) { next(err); }
});

router.get('/history', requireAuth, async (req, res, next) => {
  try {
    const type = ['purchase', 'topup', 'ekey'].includes(req.query.type) ? req.query.type : 'purchase';
    const refName = type === 'topup' ? 'topups' : type === 'ekey' ? 'ekeys' : 'purchases';
    const s = await db.ref(refName).get();
    const rows = Object.entries(s.val() || {}).map(([id, x]) => ({ id, ...x })).filter(x => x.uid === req.uid || x.realname === req.uid).sort((a, b) => (b.timestamp || b.createdAt || 0) - (a.timestamp || a.createdAt || 0)).slice(0, 80);
    res.json({ ok: true, type, rows });
  } catch (err) { next(err); }
});

module.exports = router;
