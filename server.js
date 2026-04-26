'use strict';
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_ME_LONG_RANDOM_SECRET';
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || '123456';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = process.env.DB_FILE || path.join(DATA_DIR, 'db.json');

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN.split(',').map(s => s.trim()), credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(morgan('tiny'));
app.use(rateLimit({ windowMs: 60 * 1000, limit: 160, standardHeaders: true, legacyHeaders: false }));
app.use('/assets', express.static(path.join(__dirname, 'public/assets')));

function ensureDb(){
  if(!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if(!fs.existsSync(DB_FILE)) {
    const seed = { users: [], products: [], orders: [], deposits: [], banks: [], coupons: [], keys: [], tickets: [], categories: ['TikTok','Instagram','YouTube','Facebook','Discord','Khác'], settings: { siteName: 'Auza Store', announcement: { t:'Thông báo', m:'Chào mừng đến với Auza Store!', v:true } }, chats: [], audit: [] };
    fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2));
  }
}
function readDb(){ ensureDb(); return JSON.parse(fs.readFileSync(DB_FILE, 'utf8') || '{}'); }
function writeDb(db){ ensureDb(); const tmp = DB_FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(db, null, 2)); fs.renameSync(tmp, DB_FILE); }
function gid(prefix='id'){ return prefix + crypto.randomBytes(8).toString('hex'); }
function now(){ return new Date().toISOString(); }
function safeUser(u){ if(!u) return null; const { passHash, password, ...rest } = u; return rest; }
function tokenFor(payload, exp='7d'){ return jwt.sign(payload, JWT_SECRET, { expiresIn: exp }); }
function auth(req,res,next){ const h = req.headers.authorization || ''; const t = h.startsWith('Bearer ') ? h.slice(7) : ''; if(!t) return res.status(401).json({ error:'NO_TOKEN' }); try{ req.auth = jwt.verify(t, JWT_SECRET); next(); }catch(e){ return res.status(401).json({ error:'BAD_TOKEN' }); } }
function admin(req,res,next){ auth(req,res,()=>{ if(req.auth && req.auth.role === 'admin') return next(); res.status(403).json({ error:'ADMIN_ONLY' }); }); }
function audit(db, req, action, detail){ db.audit = db.audit || []; db.audit.unshift({ id: gid('log_'), at: now(), ip: req.ip, user: req.auth?.sub || req.auth?.user || 'guest', action, detail }); db.audit = db.audit.slice(0, 1000); }
function listName(k){ return { nx_u:'users', nx_p:'products', nx_o:'orders', nx_d:'deposits', nx_b:'banks', nx_c:'coupons', nx_keys:'keys', nx_tickets:'tickets', nx_categories:'categories', nx_chats:'chats' }[k] || k; }
function normalizePublicDb(db){ return { products: db.products || [], categories: db.categories || [], settings: db.settings || {}, banks: (db.banks || []).filter(b=>b.active!==false) }; }

app.get('/health', (req,res)=>res.json({ ok:true, mode:'NO_FIREBASE', time:now() }));

app.post('/api/admin/login', async (req,res)=>{
  const { username, password } = req.body || {};
  const ok = String(username || '') === ADMIN_USER && String(password || '') === ADMIN_PASS;
  if(!ok) return res.status(401).json({ error:'Sai tài khoản hoặc mật khẩu' });
  res.json({ ok:true, token: tokenFor({ role:'admin', user:ADMIN_USER }), user:{ username: ADMIN_USER, role:'admin' } });
});

app.post('/api/auth/register', async (req,res)=>{
  const db = readDb(); db.users = db.users || [];
  const em = String(req.body?.em || req.body?.email || '').trim().toLowerCase();
  const pw = String(req.body?.pw || req.body?.password || '');
  const nm = String(req.body?.nm || req.body?.name || em.split('@')[0] || 'User').trim();
  if(!em || !pw) return res.status(400).json({ error:'Thiếu email hoặc mật khẩu' });
  if(db.users.some(u => String(u.em || u.email).toLowerCase() === em)) return res.status(409).json({ error:'Email đã tồn tại' });
  const u = { id: gid('u_'), em, email: em, nm, name:nm, bl:0, role:'user', bn:false, passHash: await bcrypt.hash(pw, 10), createdAt: now() };
  db.users.unshift(u); audit(db, req, 'USER_REGISTER', em); writeDb(db);
  res.json({ ok:true, token: tokenFor({ role:'user', uid:u.id }), user:safeUser(u) });
});

app.post('/api/auth/login', async (req,res)=>{
  const db = readDb();
  const em = String(req.body?.em || req.body?.email || '').trim().toLowerCase();
  const pw = String(req.body?.pw || req.body?.password || '');
  const u = (db.users || []).find(x => String(x.em || x.email).toLowerCase() === em && !x.bn);
  if(!u || !(await bcrypt.compare(pw, u.passHash || ''))) return res.status(401).json({ error:'Sai email hoặc mật khẩu' });
  res.json({ ok:true, token: tokenFor({ role:'user', uid:u.id }), user:safeUser(u) });
});

app.get('/api/me', auth, (req,res)=>{
  if(req.auth.role === 'admin') return res.json({ user:{ username:ADMIN_USER, role:'admin' } });
  const db=readDb(); const u=(db.users||[]).find(x=>x.id===req.auth.uid); if(!u) return res.status(404).json({ error:'USER_NOT_FOUND' }); res.json({ user:safeUser(u) });
});

app.get('/api/public', (req,res)=>res.json(normalizePublicDb(readDb())));
app.get('/api/products', (req,res)=>res.json((readDb().products || []).filter(p => p.st !== 'off' && p.active !== false)));
app.get('/api/categories', (req,res)=>res.json(readDb().categories || []));
app.get('/api/settings', (req,res)=>res.json(readDb().settings || {}));
app.get('/api/banks', (req,res)=>res.json((readDb().banks || []).filter(b=>b.active!==false)));

app.post('/api/orders', auth, (req,res)=>{
  const db=readDb(); db.orders=db.orders||[]; const u=(db.users||[]).find(x=>x.id===req.auth.uid); if(!u) return res.status(401).json({ error:'USER_NOT_FOUND' });
  const o = { ...(req.body || {}), id: gid('ord_'), uid:u.id, un:u.nm||u.em, st:'pending', pg:0, cr:now(), createdAt:now() };
  db.orders.unshift(o); audit(db, req, 'ORDER_CREATE', o.id); writeDb(db); res.json({ ok:true, order:o });
});
app.get('/api/orders/my', auth, (req,res)=>{ const db=readDb(); res.json((db.orders||[]).filter(o=>o.uid===req.auth.uid)); });

app.get('/api/admin/db', admin, (req,res)=>res.json(readDb()));
app.post('/api/admin/import', admin, (req,res)=>{ const db = { ...readDb(), ...(req.body || {}) }; audit(db, req, 'DB_IMPORT', 'full'); writeDb(db); res.json({ ok:true }); });
app.post('/api/admin/export', admin, (req,res)=>res.json(readDb()));

['products','users','orders','deposits','banks','coupons','keys','tickets','categories','chats'].forEach(name=>{
  app.get(`/api/admin/${name}`, admin, (req,res)=>res.json(readDb()[name] || []));
  app.post(`/api/admin/${name}`, admin, (req,res)=>{ const db=readDb(); db[name]=db[name]||[]; const item = typeof req.body === 'object' && !Array.isArray(req.body) ? { ...req.body } : req.body; if(name === 'categories'){ if(!db.categories.includes(String(req.body.name || req.body))) db.categories.push(String(req.body.name || req.body)); audit(db, req, 'CREATE_'+name, req.body.name || req.body); writeDb(db); return res.json({ ok:true, data:db.categories }); } item.id = item.id || gid(name.slice(0,3)+'_'); item.createdAt = item.createdAt || now(); db[name].unshift(item); audit(db, req, 'CREATE_'+name, item.id); writeDb(db); res.json({ ok:true, data:item }); });
  app.put(`/api/admin/${name}/:id`, admin, (req,res)=>{ const db=readDb(); db[name]=db[name]||[]; const i=db[name].findIndex(x=>String(x.id||x._id)===String(req.params.id)); if(i<0) return res.status(404).json({ error:'NOT_FOUND' }); db[name][i] = { ...db[name][i], ...(req.body||{}), updatedAt:now() }; audit(db, req, 'UPDATE_'+name, req.params.id); writeDb(db); res.json({ ok:true, data:db[name][i] }); });
  app.delete(`/api/admin/${name}/:id`, admin, (req,res)=>{ const db=readDb(); db[name]=db[name]||[]; const before=db[name].length; db[name]=db[name].filter(x=>String(x.id||x._id)!==String(req.params.id)); audit(db, req, 'DELETE_'+name, req.params.id); writeDb(db); res.json({ ok:true, deleted: before - db[name].length }); });
});

app.put('/api/admin/settings', admin, (req,res)=>{ const db=readDb(); db.settings = { ...(db.settings||{}), ...(req.body||{}) }; audit(db, req, 'UPDATE_settings', 'settings'); writeDb(db); res.json({ ok:true, settings:db.settings }); });
app.post('/api/admin/legacy/:key', admin, (req,res)=>{ const name=listName(req.params.key); const db=readDb(); db[name] = req.body; audit(db, req, 'LEGACY_SET_'+name, req.params.key); writeDb(db); res.json({ ok:true, key:req.params.key, mapped:name }); });
app.get('/api/admin/audit', admin, (req,res)=>res.json(readDb().audit || []));

app.use((req,res)=>res.status(404).json({ error:'NOT_FOUND' }));
app.listen(PORT, () => console.log(`Auza API no Firebase running on :${PORT}`));
