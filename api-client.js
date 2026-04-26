/* Auza API client - NO FIREBASE. Set window.AUZA_API_BASE before this script if API is on another domain. */
(function(){
  const API = (window.AUZA_API_BASE || '').replace(/\/$/, '');
  const tokenKey = 'auza_api_token';
  const adminKey = 'auza_admin_token';
  const S = window.AUZAStorage || window.localStorage;
  const getToken = () => S.getItem(tokenKey) || S.getItem(adminKey) || '';
  async function req(path, opt={}){
    const headers = Object.assign({'Content-Type':'application/json'}, opt.headers || {});
    const t = opt.admin ? S.getItem(adminKey) : getToken();
    if(t) headers.Authorization = 'Bearer ' + t;
    const r = await fetch(API + path, { ...opt, headers, body: opt.body && typeof opt.body !== 'string' ? JSON.stringify(opt.body) : opt.body });
    const j = await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(j.error || 'API_ERROR');
    return j;
  }
  window.AuzaAPI = {
    base: API,
    adminLogin: (username,password)=>req('/api/admin/login',{method:'POST',body:{username,password}}).then(j=>{S.setItem(adminKey,j.token);return j;}),
    login: (email,password)=>req('/api/auth/login',{method:'POST',body:{email,password}}).then(j=>{S.setItem(tokenKey,j.token);return j;}),
    register: (email,password,name)=>req('/api/auth/register',{method:'POST',body:{email,password,name}}).then(j=>{S.setItem(tokenKey,j.token);return j;}),
    public: ()=>req('/api/public'), products:()=>req('/api/products'), categories:()=>req('/api/categories'), settings:()=>req('/api/settings'), banks:()=>req('/api/banks'),
    createOrder: data=>req('/api/orders',{method:'POST',body:data}), myOrders:()=>req('/api/orders/my'), me:()=>req('/api/me'),
    adminGet: name=>req('/api/admin/'+name,{admin:true}), adminCreate:(name,data)=>req('/api/admin/'+name,{method:'POST',body:data,admin:true}), adminUpdate:(name,id,data)=>req('/api/admin/'+name+'/'+id,{method:'PUT',body:data,admin:true}), adminDelete:(name,id)=>req('/api/admin/'+name+'/'+id,{method:'DELETE',admin:true}), adminDb:()=>req('/api/admin/db',{admin:true}), adminImport:data=>req('/api/admin/import',{method:'POST',body:data,admin:true})
  };
  window.FB = null;
})();
