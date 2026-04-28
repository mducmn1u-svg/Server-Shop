const rateLimit = require('express-rate-limit');
const make = (windowMs, limit, message) => rateLimit({ windowMs, limit, standardHeaders: true, legacyHeaders: false, message: { ok: false, error: message } });
module.exports = {
  generalLimiter: make(60000, 240, 'Too many requests'),
  authLimiter: make(900000, 30, 'Too many auth attempts'),
  moneyLimiter: make(60000, 30, 'Too many money actions'),
  adminLimiter: make(60000, 120, 'Too many admin actions')
};
