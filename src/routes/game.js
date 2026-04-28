const express = require('express');
const { db, admin } = require('../firebase');
const { requireAuth } = require('../middleware/auth');
const { todayKey } = require('../utils/helpers');
const router = express.Router();
router.post('/spin', requireAuth, async (req, res, next) => {
  try {
    const today = todayKey();
    if (req.user.spinDate === today) return res.status(409).json({ ok: false, error: 'Hôm nay đã quay rồi' });
    const prize = Math.floor(Math.random() * 1001);
    const ref = db.ref('users/' + req.uid);
    let newBalance = 0;
    const tx = await ref.transaction(u => {
      if (!u) return;
      if (u.spinDate === today) return;
      newBalance = Number(u.balance || 0) + prize;
      u.balance = newBalance; u.spinDate = today; u.lastPrize = prize;
      return u;
    }, undefined, false);
    if (!tx.committed) return res.status(409).json({ ok: false, error: 'Hôm nay đã quay rồi' });
    await db.ref('purchases').push({ uid: req.uid, productName: 'Mini game daily', price: 0, note: 'Nhận ' + prize + 'đ', timestamp: admin.database.ServerValue.TIMESTAMP });
    res.json({ ok: true, prize, balance: newBalance });
  } catch(e){ next(e); }
});
module.exports = router;
