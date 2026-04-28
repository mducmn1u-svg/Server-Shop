const express = require('express');
const { z } = require('zod');
const { db, admin } = require('../firebase');
const { PRODUCTS } = require('../config');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();
const purchaseSchema = z.object({ productId: z.string().min(1).max(20) });
async function getAccounts() { const s = await db.ref('accounts').get(); return s.val() || {}; }
function availableEntries(all, type) { return Object.entries(all).filter(([id, a]) => String(a.type) === String(type) && !a.used && (!a.mode || a.mode === 'direct')); }
async function countStock(type) { return availableEntries(await getAccounts(), type).length; }
router.get('/products', async (req, res, next) => { try { const products = []; for (const p of PRODUCTS) products.push({ ...p, stock: await countStock(p.type) }); res.json({ ok: true, products }); } catch (e) { next(e); } });
router.get('/stock', async (req, res, next) => { try { const all = await getAccounts(); const stock = {}; for (const p of PRODUCTS) stock[p.type] = availableEntries(all, p.type).length; res.json({ ok: true, stock }); } catch (e) { next(e); } });
router.post('/purchase', requireAuth, async (req, res, next) => {
  try {
    const { productId } = purchaseSchema.parse(req.body);
    const selected = PRODUCTS.find(p => p.id === productId);
    if (!selected) return res.status(404).json({ ok: false, error: 'Không thấy sản phẩm' });
    const all = await getAccounts();
    let entries = availableEntries(all, selected.type);
    if (!entries.length) return res.status(409).json({ ok: false, error: 'Hết hàng' });
    const userRef = db.ref('users/' + req.uid);
    let newBalance = 0;
    const balTx = await userRef.child('balance').transaction(cur => {
      const bal = Number(cur || 0);
      if (bal < selected.price) return;
      newBalance = bal - selected.price;
      return newBalance;
    }, undefined, false);
    if (!balTx.committed) return res.status(400).json({ ok: false, error: 'Không đủ số dư' });
    let chosen = null, accId = null, acc = null;
    for (let i = 0; i < Math.min(entries.length, 10); i++) {
      [accId, acc] = entries[Math.floor(Math.random() * entries.length)];
      const tx = await db.ref('accounts/' + accId).transaction(a => {
        if (!a || a.used || String(a.type) !== selected.type) return;
        a.used = true; a.usedBy = req.uid; a.usedAt = admin.database.ServerValue.TIMESTAMP;
        return a;
      }, undefined, false);
      if (tx.committed) { chosen = acc; break; }
      entries = entries.filter(([id]) => id !== accId);
      if (!entries.length) break;
    }
    if (!chosen) { await userRef.child('balance').transaction(cur => Number(cur || 0) + selected.price, undefined, false); return res.status(409).json({ ok: false, error: 'Acc vừa bị mua, thử lại' }); }
    const pid = db.ref('purchases').push().key;
    const purchase = { uid: req.uid, realname: req.uid, type: selected.type, price: selected.price, productName: selected.name, credentials: chosen.credentials || '', accountId: accId, timestamp: admin.database.ServerValue.TIMESTAMP };
    await db.ref('purchases/' + pid).set(purchase);
    await db.ref('securityLogs').push({ uid: req.uid, action: 'purchase', productId, price: selected.price, at: admin.database.ServerValue.TIMESTAMP });
    res.json({ ok: true, balance: newBalance, purchase: { id: pid, ...purchase } });
  } catch (e) { next(e); }
});
router.get('/history', requireAuth, async (req, res, next) => {
  try {
    const type = ['purchase', 'ekey', 'topup'].includes(req.query.type) ? req.query.type : 'purchase';
    const ref = type === 'topup' ? 'topups' : type === 'ekey' ? 'ekeys' : 'purchases';
    const s = await db.ref(ref).get();
    const rows = Object.entries(s.val() || {}).map(([id, x]) => ({ id, ...x })).filter(x => x.uid === req.uid || x.realname === req.uid).sort((a,b)=>(b.timestamp||b.createdAt||0)-(a.timestamp||a.createdAt||0)).slice(0, 80);
    res.json({ ok: true, rows });
  } catch (e) { next(e); }
});
module.exports = router;
