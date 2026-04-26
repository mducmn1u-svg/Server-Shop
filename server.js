import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import admin from 'firebase-admin';

const PORT = Number(process.env.PORT || 10000);
const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_ME_LONG_SECRET';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123456';
const ALLOW_REGISTER = String(process.env.ALLOW_REGISTER || 'true') === 'true';
const DATABASE_URL = process.env.FIREBASE_DATABASE_URL || 'https://shopnew-d9579-default-rtdb.firebaseio.com';
const ORIGINS = (process.env.CORS_ORIGIN || '*').split(',').map(s => s.trim()).filter(Boolean);

function loadCredential() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    const json = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8');
    return admin.credential.cert(JSON.parse(json));
  }
  return admin.credential.applicationDefault();
}

admin.initializeApp({ credential: loadCredential(), databaseURL: DATABASE_URL });
const db = admin.database();
const app = express();
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '2mb' }));
app.use(morgan('tiny'));
app.use(cors({
  origin(origin, cb) {
    if (!origin || ORIGINS.includes('*') || ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error('CORS blocked: ' + origin));
  },
  credentials: true
}));
app.use(rateLimit({ windowMs: 60_000, limit: 180, standardHeaders: true, legacyHeaders: false }));
app.use('/api/auth', rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false }));

const PATHS = {
  users: 'nx_users', products: 'nx_products', orders: 'nx_orders', deposits: 'nx_deposits',
  banks: 'nx_banks', coupons: 'nx_coupons', keys: 'nx_keys', tickets: 'nx_tickets',
  categories: 'nx_categories', chats: 'nx_chats', settings: 'nx_settings', mini: 'nx_mini_spin'
};
const PUBLIC_READ = new Set(['products', 'categories', 'settings', 'banks', 'mini']);
const USER_OWNED = new Set(['orders', 'deposits', 'tickets', 'chats']);
const ADMIN_ONLY = new Set(['users', 'keys']);

const now = () => Date.now();
const clean = v => JSON.parse(JSON.stringify(v ?? null));
const toArr = v => Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.entries(v).map(([id, val]) => typeof val === 'object' ? ({ id: val.id || id, _id: id, ...val }) : val) : []);
const toObj = a => Array.isArray(a) ? Object.fromEntries(a.filter(x => x && (x.id || x._id)).map((x, i) => [String(x.id || x._id || i), x])) : (a || {});
const pickUser = u => u ? ({ id: u.id, em: u.em, email: u.email || u.em, nm: u.nm || u.name || '', bl: Number(u.bl || 0), role: u.role || 'user', bn: !!u.bn, createdAt: u.createdAt || 0 }) : null;
const isAdmin = req => req.user?.role === 'admin' || req.user?.role === 'owner';

function sign(payload) { return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' }); }
function authOptional(req, _res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (token) { try { req.user = jwt.verify(token, JWT_SECRET); } catch { req.user = null; } }
  next();
}
function authRequired(req, res, next) { authOptional(req, res, () => req.user ? next() : res.status(401).json({ ok:false, error:'UNAUTHORIZED' })); }
function adminRequired(req, res, next) { authRequired(req, res, () => isAdmin(req) ? next() : res.status(403).json({ ok:false, error:'ADMIN_ONLY' })); }
async function read(path, fallback=null) { const s = await db.ref(path).get(); return s.exists() ? s.val() : fallback; }
async function write(path, val) { await db.ref(path).set(clean(val)); return val; }
async function patch(path, val) { await db.ref(path).update(clean(val)); return val; }
async function listKey(kind) { return toArr(await read(PATHS[kind], {})); }
async function saveList(kind, list) { return write(PATHS[kind], toObj(list)); }
async function getUserById(id) { return read(`${PATHS.users}/${id}`, null); }
async function getUserByEmail(email) {
  const users = await listKey('users');
  return users.find(u => String(u.em || u.email || '').toLowerCase() === String(email || '').toLowerCase()) || null;
}
async function saveUser(u) { await write(`${PATHS.users}/${u.id}`, u); return u; }
function normalizeProduct(p) {
  const out = { ...p };
  out.id = out.id || 'p' + now() + nanoid(5);
  out.n = String(out.n || out.name || 'Sản phẩm').slice(0, 120);
  out.dc = String(out.dc || out.desc || '').slice(0, 2000);
  out.pl = String(out.pl || out.category || 'Khác').slice(0, 60);
  out.pr = Number(out.pr || out.price || 0);
  out.st = out.st === 'off' || out.st === 'inactive' ? 'off' : 'active';
  out.type = String(out.type || 'normal');
  if (out.type === 'rental' || out.type === 'rent') { out.type = 'rental'; out.noStock = true; out.stock = 999999; out.pr = 0; }
  else { out.stock = Math.max(0, Math.min(999999, Number(out.stock ?? 1))); delete out.noStock; }
  out.updatedAt = now();
  return out;
}

app.get('/health', (_req, res) => res.json({ ok:true, time: new Date().toISOString() }));

app.post('/api/auth/admin-login', async (req, res) => {
  const { username, password } = req.body || {};
  const okUser = String(username || '') === ADMIN_USERNAME;
  const okPass = String(password || '') === ADMIN_PASSWORD;
  if (!okUser || !okPass) return res.status(401).json({ ok:false, error:'Sai tài khoản hoặc mật khẩu admin' });
  const token = sign({ id:'server-admin', role:'admin', em:ADMIN_USERNAME, nm:'Admin' });
  res.json({ ok:true, token, user:{ id:'server-admin', role:'admin', em:ADMIN_USERNAME, nm:'Admin' } });
});

app.post('/api/auth/register', async (req, res) => {
  if (!ALLOW_REGISTER) return res.status(403).json({ ok:false, error:'Đã tắt đăng ký' });
  const email = String(req.body?.email || req.body?.em || '').trim().toLowerCase();
  const password = String(req.body?.password || req.body?.pw || '');
  const name = String(req.body?.name || req.body?.nm || email.split('@')[0] || 'User').slice(0, 60);
  if (!email || password.length < 6) return res.status(400).json({ ok:false, error:'Email/mật khẩu không hợp lệ' });
  if (await getUserByEmail(email)) return res.status(409).json({ ok:false, error:'Email đã tồn tại' });
  const u = { id:'u' + nanoid(12), em:email, nm:name, bl:0, role:'user', passHash: await bcrypt.hash(password, 10), createdAt:now(), bn:false };
  await saveUser(u);
  const token = sign({ id:u.id, role:'user', em:u.em, nm:u.nm });
  res.json({ ok:true, token, user:pickUser(u) });
});

app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body?.email || req.body?.em || '').trim().toLowerCase();
  const password = String(req.body?.password || req.body?.pw || '');
  const u = await getUserByEmail(email);
  if (!u || u.bn) return res.status(401).json({ ok:false, error:'Tài khoản không tồn tại hoặc bị khóa' });
  if (!u.passHash) return res.status(401).json({ ok:false, error:'Tài khoản cũ chưa có mật khẩu server' });
  const ok = await bcrypt.compare(password, u.passHash);
  if (!ok) return res.status(401).json({ ok:false, error:'Sai mật khẩu' });
  const token = sign({ id:u.id, role:u.role || 'user', em:u.em, nm:u.nm });
  res.json({ ok:true, token, user:pickUser(u) });
});

app.get('/api/auth/me', authRequired, async (req, res) => {
  if (isAdmin(req)) return res.json({ ok:true, user:req.user });
  const u = await getUserById(req.user.id);
  if (!u || u.bn) return res.status(401).json({ ok:false, error:'SESSION_EXPIRED' });
  res.json({ ok:true, user:pickUser(u) });
});

app.get('/api/data/:kind', authOptional, async (req, res) => {
  const kind = req.params.kind;
  if (!PATHS[kind]) return res.status(404).json({ ok:false, error:'UNKNOWN_KIND' });
  if (ADMIN_ONLY.has(kind) && !isAdmin(req)) return res.status(403).json({ ok:false, error:'ADMIN_ONLY' });
  let data = await read(PATHS[kind], kind === 'settings' ? {} : []);
  if (kind !== 'settings' && kind !== 'mini') data = toArr(data);
  if (USER_OWNED.has(kind) && !isAdmin(req)) data = toArr(data).filter(x => String(x.uid || x.userId || '') === String(req.user?.id || ''));
  if (!PUBLIC_READ.has(kind) && !USER_OWNED.has(kind) && !isAdmin(req)) return res.status(401).json({ ok:false, error:'LOGIN_REQUIRED' });
  res.json({ ok:true, data });
});

app.get('/api/bootstrap', authOptional, async (req, res) => {
  const out = {};
  for (const k of ['products','categories','settings','banks','mini']) out[k] = k === 'settings' || k === 'mini' ? await read(PATHS[k], {}) : toArr(await read(PATHS[k], []));
  if (req.user) {
    for (const k of ['orders','deposits','tickets','chats']) {
      const arr = toArr(await read(PATHS[k], []));
      out[k] = isAdmin(req) ? arr : arr.filter(x => String(x.uid || x.userId || '') === String(req.user.id));
    }
    if (isAdmin(req)) { out.users = toArr(await read(PATHS.users, [])).map(pickUser); out.keys = toArr(await read(PATHS.keys, [])); }
  }
  res.json({ ok:true, data:out, serverTime:now() });
});

app.post('/api/admin/:kind', adminRequired, async (req, res) => {
  const kind = req.params.kind;
  if (!PATHS[kind]) return res.status(404).json({ ok:false, error:'UNKNOWN_KIND' });
  let item = { ...(req.body || {}) };
  if (kind === 'products') item = normalizeProduct(item);
  else item.id = item.id || kind.slice(0,2) + now() + nanoid(5), item.updatedAt = now();
  if (kind === 'users' && item.password) { item.passHash = await bcrypt.hash(String(item.password), 10); delete item.password; }
  await write(`${PATHS[kind]}/${item.id}`, item);
  res.json({ ok:true, data:item });
});

app.put('/api/admin/:kind/:id', adminRequired, async (req, res) => {
  const { kind, id } = req.params;
  if (!PATHS[kind]) return res.status(404).json({ ok:false, error:'UNKNOWN_KIND' });
  let item = { ...(req.body || {}), id, updatedAt:now() };
  if (kind === 'products') item = normalizeProduct(item);
  if (kind === 'users' && item.password) { item.passHash = await bcrypt.hash(String(item.password), 10); delete item.password; }
  await patch(`${PATHS[kind]}/${id}`, item);
  res.json({ ok:true, data:item });
});

app.delete('/api/admin/:kind/:id', adminRequired, async (req, res) => {
  const { kind, id } = req.params;
  if (!PATHS[kind]) return res.status(404).json({ ok:false, error:'UNKNOWN_KIND' });
  await db.ref(`${PATHS[kind]}/${id}`).remove();
  res.json({ ok:true });
});

app.put('/api/admin/settings/:name', adminRequired, async (req, res) => {
  await write(`${PATHS.settings}/${req.params.name}`, req.body || {});
  res.json({ ok:true, data:req.body || {} });
});

app.post('/api/order', authRequired, async (req, res) => {
  if (isAdmin(req)) return res.status(400).json({ ok:false, error:'Admin server không đặt đơn' });
  const u = await getUserById(req.user.id);
  if (!u || u.bn) return res.status(401).json({ ok:false, error:'Tài khoản bị khóa' });
  const body = req.body || {};
  const productId = String(body.productId || body.pid || body.sp || '');
  const p = toArr(await read(PATHS.products, [])).find(x => String(x.id) === productId);
  if (!p || p.st === 'off') return res.status(404).json({ ok:false, error:'Sản phẩm không tồn tại' });
  const qty = Math.max(1, Math.min(9999, Number(body.qty || 1)));
  const total = Number(p.pr || 0) * qty;
  if (Number(u.bl || 0) < total) return res.status(400).json({ ok:false, error:'Số dư không đủ' });
  await patch(`${PATHS.users}/${u.id}`, { bl: Number(u.bl || 0) - total });
  const o = { id:'o' + now() + nanoid(6), uid:u.id, un:u.nm || u.em, productId:p.id, sp:p.id, sv:p.n, qty, tot:total, st:'pending', pg:0, cr:new Date().toISOString(), data:body.data || body.note || '' };
  await write(`${PATHS.orders}/${o.id}`, o);
  res.json({ ok:true, data:o, balance:Number(u.bl || 0) - total });
});

app.post('/api/deposit', authRequired, async (req, res) => {
  if (isAdmin(req)) return res.status(400).json({ ok:false, error:'Admin server không nạp tiền' });
  const amount = Math.max(0, Number(req.body?.amount || req.body?.money || 0));
  if (amount < 1000) return res.status(400).json({ ok:false, error:'Số tiền quá nhỏ' });
  const d = { id:'d' + now() + nanoid(6), uid:req.user.id, amount, bankId:req.body?.bankId || '', note:req.body?.note || '', st:'pending', cr:new Date().toISOString() };
  await write(`${PATHS.deposits}/${d.id}`, d);
  res.json({ ok:true, data:d });
});

app.post('/api/admin/deposits/:id/approve', adminRequired, async (req, res) => {
  const id = req.params.id;
  const d = await read(`${PATHS.deposits}/${id}`, null);
  if (!d) return res.status(404).json({ ok:false, error:'Không thấy lệnh nạp' });
  if (d.st === 'completed') return res.json({ ok:true, data:d });
  const u = await getUserById(d.uid);
  if (!u) return res.status(404).json({ ok:false, error:'Không thấy user' });
  const amount = Number(d.amount || d.money || 0);
  await patch(`${PATHS.users}/${u.id}`, { bl:Number(u.bl || 0) + amount });
  await patch(`${PATHS.deposits}/${id}`, { st:'completed', approvedAt:now(), approvedBy:req.user.id });
  res.json({ ok:true, balance:Number(u.bl || 0) + amount });
});

app.post('/api/admin/orders/:id/status', adminRequired, async (req, res) => {
  const patchData = { st:req.body?.status || req.body?.st || 'pending', pg:Number(req.body?.pg ?? req.body?.progress ?? 0), resultContent:req.body?.resultContent || req.body?.result || '', updatedAt:now() };
  await patch(`${PATHS.orders}/${req.params.id}`, patchData);
  res.json({ ok:true, data:patchData });
});

app.use('/api/*', (_req, res) => res.status(404).json({ ok:false, error:'NOT_FOUND' }));
app.listen(PORT, () => console.log(`Auza secure API running on :${PORT}`));
