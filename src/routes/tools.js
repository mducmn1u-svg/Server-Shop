const express = require('express');
const { z } = require('zod');
const { db } = require('../firebase');
const { TOOLS } = require('../config');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();
const openSchema = z.object({ toolId: z.enum(['sunwin', 'lc79']), key: z.string().min(5).max(80) });
router.get('/list', (req, res) => res.json({ ok: true, tools: Object.values(TOOLS) }));
router.post('/open', requireAuth, async (req, res, next) => {
  try {
    const body = openSchema.parse(req.body);
    const val = body.key.trim().toUpperCase();
    const s = await db.ref('ekeys').get();
    const ent = Object.entries(s.val() || {}).find(([id, k]) => String(k.key || '').toUpperCase() === val);
    if (!ent) return res.status(404).json({ ok: false, error: 'Ekey không tồn tại' });
    const [kid, k] = ent;
    if (k.uid !== req.uid) return res.status(403).json({ ok: false, error: 'Ekey không thuộc tài khoản này' });
    const expires = Number(k.expiresAt || 0);
    if (!k.active || Date.now() > expires) { await db.ref('ekeys/' + kid).update({ active: false }); return res.status(400).json({ ok: false, error: 'Ekey đã hết hạn' }); }
    const cfg = (await db.ref('toolFiles/' + body.toolId).get()).val() || {};
    const url = cfg.url || cfg.file || '';
    if (!url) return res.status(404).json({ ok: false, error: 'Admin chưa cấu hình file tool' });
    res.json({ ok: true, tool: TOOLS[body.toolId], url, expiresAt: expires, keyId: kid });
  } catch (e) { next(e); }
});
module.exports = router;
