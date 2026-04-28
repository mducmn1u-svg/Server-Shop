const rateLimit = require('express-rate-limit');
const generalLimiter = rateLimit({ windowMs: 60000, limit: 180, standardHeaders: true, legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 900000, limit: 25, standardHeaders: true, legacyHeaders: false, message: { ok: false, error: 'Too many auth attempts' } });
const moneyLimiter = rateLimit({ windowMs: 60000, limit: 20, standardHeaders: true, legacyHeaders: false, message: { ok: false, error: 'Too many money actions' } });
const adminLimiter = rateLimit({ windowMs: 60000, limit: 80, standardHeaders: true, legacyHeaders: false, message: { ok: false, error: 'Too many admin actions' } });
module.exports = { generalLimiter, authLimiter, moneyLimiter, adminLimiter };
