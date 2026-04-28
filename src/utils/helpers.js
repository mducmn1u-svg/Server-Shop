const crypto = require('crypto');
function safeName(v) { return String(v || '').trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '_').slice(0, 40); }
function publicUser(uid, u = {}) { return { uid, realname: u.realname || uid, name: u.name || uid, balance: Number(u.balance || 0), role: u.role || 'user' }; }
function makeEkey() { return 'EKEY-' + crypto.randomBytes(3).toString('hex').toUpperCase() + '-' + Date.now().toString(36).slice(-5).toUpperCase(); }
function makeBillCode(uid) { return 'NAP' + Date.now().toString().slice(-6) + String(uid || '').slice(0, 4).toUpperCase(); }
function now() { return Date.now(); }
function todayKey() { return new Date().toISOString().slice(0, 10); }
function clientIp(req) { return String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim(); }
function assertUrlOrEmpty(v) { const s = String(v || '').trim(); if (!s) return ''; try { new URL(s); return s; } catch { const e = new Error('URL không hợp lệ'); e.status = 400; throw e; } }
module.exports = { safeName, publicUser, makeEkey, makeBillCode, now, todayKey, clientIp, assertUrlOrEmpty };
