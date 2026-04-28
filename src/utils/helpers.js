function safeName(v) { return String(v || '').trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '_').slice(0, 40); }
function makeEkey() { return 'EKEY-' + Math.random().toString(36).slice(2, 6).toUpperCase() + '-' + Date.now().toString(36).slice(-5).toUpperCase(); }
function makeBillCode(uid) { return 'NAP' + Date.now().toString().slice(-6) + String(uid || '').slice(0, 4).toUpperCase(); }
function publicUser(uid, u = {}) { return { uid, realname: u.realname || uid, name: u.name || uid, balance: Number(u.balance || 0), role: u.role || 'user' }; }
module.exports = { safeName, makeEkey, makeBillCode, publicUser };
