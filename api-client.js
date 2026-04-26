/* Auza Secure API Client - thay cho assets/firebase.js de khong lo Firebase config tren web */
(function(){
  'use strict';
  const API_BASE = (window.AUZA_API_BASE || '').replace(/\/$/, '');
  const Store = window.AUZAStorage || window.localStorage;
  const TOKEN_KEY = 'auza_api_token';
  const map = {
    nx_u:'users', nx_p:'products', nx_o:'orders', nx_d:'deposits', nx_b:'banks', nx_c:'coupons',
    nx_keys:'keys', nx_tickets:'tickets', nx_categories:'categories', nx_chats:'chats', nx_settings:'settings', nx_mini_spin:'mini'
  };
  const rev = Object.fromEntries(Object.entries(map).map(([k,v]) => [v,k]));
  const getToken = () => { try { return Store.getItem(TOKEN_KEY) || ''; } catch { return ''; } };
  const setToken = t => { try { t ? Store.setItem(TOKEN_KEY, t) : Store.removeItem(TOKEN_KEY); } catch {} };
  const jget = (k,d) => { try { const v=Store.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
  const jset = (k,v) => { try { Store.setItem(k, JSON.stringify(v)); } catch {} };
  async function api(path, opt={}){
    const headers = { 'Content-Type':'application/json', ...(opt.headers || {}) };
    const token = getToken();
    if (token) headers.Authorization = 'Bearer ' + token;
    const res = await fetch(API_BASE + path, { ...opt, headers, body: opt.body && typeof opt.body !== 'string' ? JSON.stringify(opt.body) : opt.body });
    const data = await res.json().catch(() => ({ ok:false, error:'BAD_JSON' }));
    if (!res.ok || data.ok === false) throw new Error(data.error || ('HTTP_' + res.status));
    return data;
  }
  function emitStatus(patch){
    window.AUZA_FIREBASE_STATUS = { connected:true, ready:true, via:'secure-api', ...(window.AUZA_FIREBASE_STATUS||{}), ...patch, lastChange:Date.now() };
    try { window.dispatchEvent(new CustomEvent('auza:firebase-status', { detail: window.AUZA_FIREBASE_STATUS })); } catch {}
  }
  function cacheBootstrap(data){
    Object.entries(data || {}).forEach(([kind,val]) => { const k = rev[kind]; if(k) jset(k, val); });
    try { window.auzaRefreshCurrentPage && window.auzaRefreshCurrentPage(); } catch {}
  }
  async function sync(){
    const r = await api('/api/bootstrap');
    cacheBootstrap(r.data || {});
    emitStatus({ error:null });
    return r.data;
  }
  async function adminSave(kind, item){ const r = await api('/api/admin/' + kind, { method:'POST', body:item }); await sync().catch(()=>{}); return r.data; }
  async function adminUpdate(kind, id, item){ const r = await api('/api/admin/' + kind + '/' + encodeURIComponent(id), { method:'PUT', body:item }); await sync().catch(()=>{}); return r.data; }
  async function adminDelete(kind, id){ const r = await api('/api/admin/' + kind + '/' + encodeURIComponent(id), { method:'DELETE' }); await sync().catch(()=>{}); return r; }
  async function saveByKind(kind, data){
    if (Array.isArray(data)) {
      const old = jget(rev[kind] || '', []);
      const oldIds = new Set((old || []).map(x => String(x && x.id)));
      const newIds = new Set((data || []).map(x => String(x && x.id)));
      for (const item of data) await adminUpdate(kind, item.id, item);
      for (const id of oldIds) if (id && id !== 'undefined' && !newIds.has(id)) await adminDelete(kind, id);
      return data;
    }
    return adminSave(kind, data);
  }
  window.AuzaAPI = { api, sync, login: async (email,password)=>{ const r=await api('/api/auth/login',{method:'POST',body:{email,password}}); setToken(r.token); await sync().catch(()=>{}); return r; }, adminLogin: async (username,password)=>{ const r=await api('/api/auth/admin-login',{method:'POST',body:{username,password}}); setToken(r.token); await sync().catch(()=>{}); return r; }, logout:()=>setToken(''), token:getToken };
  window.FB = {
    ready:true, via:'secure-api', sync,
    saveUser:u=>adminUpdate('users', u.id, u), saveUsers:a=>saveByKind('users', a), updateBalance:(id, bl)=>adminUpdate('users', id, { bl }),
    saveProduct:p=>adminUpdate('products', p.id, p), saveProducts:a=>saveByKind('products', a),
    saveOrder:o=>adminUpdate('orders', o.id, o), saveOrders:a=>saveByKind('orders', a),
    saveDeposit:d=>adminUpdate('deposits', d.id, d), saveDeposits:a=>saveByKind('deposits', a),
    saveBank:b=>adminUpdate('banks', b.id, b), saveBanks:a=>saveByKind('banks', a),
    saveCoupon:c=>adminUpdate('coupons', c.id, c), saveCoupons:a=>saveByKind('coupons', a),
    saveKey:k=>adminUpdate('keys', k.id, k), saveKeys:a=>saveByKind('keys', a),
    saveTicket:t=>adminUpdate('tickets', t.id, t), saveTickets:a=>saveByKind('tickets', a),
    saveCategories:a=>api('/api/admin/settings/categories', { method:'PUT', body:a }).then(sync),
    set:(path,val)=>api('/api/admin/settings/' + encodeURIComponent(String(path).replace(/^nx_settings\/?/,'')), { method:'PUT', body:val }).then(sync),
    remove:(kind,id)=>adminDelete(map[kind] || kind, id)
  };
  window.addEventListener('load', () => sync().catch(e => emitStatus({ connected:false, ready:false, error:e.message })) );
  setInterval(() => sync().catch(()=>{}), 15000);
})();
