let cloudQueue = Promise.resolve();
let cloudSyncing = false;
let cloudReady = false;
let cloudLastStatus = null;
const CLOUD_MUTATION_PREFIX = 'orcafacil_pending_mutations_v2_';
const CLOUD_MUTATION_LIMIT = 500;

function cloudLoginKey() {
  return String(window.auth?.login || 'local').trim().toLowerCase() || 'local';
}
function mutationStorageKey() { return CLOUD_MUTATION_PREFIX + cloudLoginKey(); }
function readPendingMutations() {
  try {
    const rows = JSON.parse(localStorage.getItem(mutationStorageKey()) || '[]');
    return Array.isArray(rows) ? rows.filter(x=>x && x.store && x.id && ['put','delete'].includes(x.op)) : [];
  } catch (_) { return []; }
}
function writePendingMutations(rows) {
  try {
    if (!rows.length) localStorage.removeItem(mutationStorageKey());
    else localStorage.setItem(mutationStorageKey(), JSON.stringify(rows.slice(-CLOUD_MUTATION_LIMIT)));
  } catch (_) {}
  window.dispatchEvent(new CustomEvent('orca:pending-sync',{detail:{count:rows.length}}));
}
function pendingCount() { return readPendingMutations().length; }
window.cloudPendingCount = pendingCount;

function mutationId() {
  return Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,9);
}
function enqueueMutation(op, store, id, record=null) {
  if (!store || !id || store === 'auth') return;
  const key = `${store}:${id}`;
  const rows = readPendingMutations().filter(x=>x.key !== key);
  rows.push({ key, token:mutationId(), op, store, id:String(id), record:op==='put'?record:null, queuedAt:new Date().toISOString() });
  writePendingMutations(rows);
  updatePendingState();
}
function removeMutationIfCurrent(token) {
  const rows = readPendingMutations();
  const next = rows.filter(x=>x.token !== token);
  if (next.length !== rows.length) writePendingMutations(next);
}

function cloudSetState(state, text) {
  let el = document.getElementById('cloudState');
  if (!el) {
    const host = document.querySelector('.topActions');
    if (!host) return;
    el = document.createElement('span');
    el.id = 'cloudState';
    el.style.cssText = 'font-size:12px;font-weight:800;padding:9px 11px;border-radius:999px;border:1px solid #e5e7eb;background:white;white-space:nowrap';
    host.prepend(el);
  }
  el.textContent = text;
  el.dataset.state = state;
  if (state === 'online') { el.style.color = '#067647'; el.style.background = '#ecfdf3'; el.style.borderColor = '#ccebdc'; }
  else if (state === 'sync' || state === 'pending') { el.style.color = '#92400e'; el.style.background = '#fffbeb'; el.style.borderColor = '#fde68a'; }
  else { el.style.color = '#6b7280'; el.style.background = '#fff'; el.style.borderColor = '#e5e7eb'; }
}
function updatePendingState() {
  const n = pendingCount();
  if (n > 0) cloudSetState(navigator.onLine===false?'offline':'pending', `${navigator.onLine===false?'Modo local':'Pendente'} • ${n} alteração${n===1?'':'ões'}`);
  else if (cloudReady && !window.cloudNeedsReauth) cloudSetState('online','Nuvem sincronizada');
  else if (!cloudReady) cloudSetState('offline','Modo local');
}

async function cloudRequest(url, options = {}, token, loginOverride) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  // Compatibilidade temporária: o servidor agora prefere a sessão HttpOnly, mas clientes
  // antigos ainda podem autenticar com estes cabeçalhos durante a migração.
  const key = token || window.auth?.pinHash;
  const login = loginOverride || window.auth?.login;
  if (key) headers['x-orca-auth'] = key;
  if (login) headers['x-orca-user'] = login;
  const res = await fetch(url, { ...options, headers, credentials:'same-origin' });
  let body = {};
  try { body = await res.json(); } catch (_) {}
  if (!res.ok) {
    const e = new Error(body.error || ('HTTP_' + res.status));
    e.status = res.status;
    e.retryAfter = Number(body.retryAfter || res.headers.get('Retry-After') || 0);
    e.attemptsRemaining = body.attemptsRemaining;
    e.permission = body.permission;
    throw e;
  }
  return body;
}
window.cloudRequest = cloudRequest;
window.cloudIsReady = () => cloudReady;

async function cloudStatus() {
  try {
    const r = await cloudRequest('/api/auth', { method:'GET' }, null, null);
    cloudLastStatus = r;
    cloudReady = !!r.online;
    if (window.cloudNeedsReauth) cloudSetState('pending','Nuvem online • autenticação necessária');
    else updatePendingState();
    return r;
  } catch (e) {
    cloudLastStatus = null;
    cloudReady = false;
    cloudSetState('offline', e.message === 'DATABASE_NOT_CONNECTED' ? 'Conectar banco' : 'Modo local');
    return null;
  }
}

async function cloudRegisterCurrent() {
  if (!window.auth?.pinHash) return false;
  const login = (window.auth.login || 'admin').toLowerCase();
  try {
    const r = await cloudRequest('/api/auth', {
      method:'POST',
      body:JSON.stringify({ action:'register', name:window.auth.name || 'Administrador', login, pinHash:window.auth.pinHash })
    }, null, login);
    if (r.user) {
      const next = { ...window.auth, login:r.user.login || login, role:r.user.role || 'admin', name:r.user.name || window.auth.name, serverId:r.user.id || window.auth.serverId || null };
      window.setAppAuth?.(next);
      await window.localPut('auth', next);
    }
    cloudLastStatus = null;
    return true;
  } catch (e) {
    window.cloudLastRegisterError = e.message;
    if (e.message === 'USER_ALREADY_EXISTS') return false;
    throw e;
  }
}

async function cloudVerifyCurrent() {
  if (!window.auth?.pinHash) return false;
  const login = (window.auth.login || 'admin').toLowerCase();
  window.cloudLastVerifyError = null;
  try {
    // Reaproveita primeiro a sessão HttpOnly válida e evita recriar sessão a cada abertura.
    let status = cloudLastStatus;
    if (!status) status = await cloudRequest('/api/auth',{method:'GET'},null,null);
    cloudLastStatus = status;
    if (status?.hasSession && status.sessionUser && String(status.sessionUser.login||'').toLowerCase() === login) {
      const u = status.sessionUser;
      const next = { ...window.auth, login:u.login || login, role:u.role || window.auth.role || 'operador', name:u.name || window.auth.name, serverId:u.id || window.auth.serverId || null };
      window.setAppAuth?.(next);
      await window.localPut('auth',next);
      return true;
    }

    const r = await cloudRequest('/api/auth', {
      method:'POST',
      body:JSON.stringify({ action:'login', login, pinHash:window.auth.pinHash })
    }, null, login);
    if (r.user) {
      const next = { ...window.auth, login:r.user.login || login, role:r.user.role || 'admin', name:r.user.name || window.auth.name, serverId:r.user.id || window.auth.serverId || null };
      window.setAppAuth?.(next);
      await window.localPut('auth', next);
    }
    cloudLastStatus = null;
    return true;
  } catch (e) {
    window.cloudLastVerifyError = e.message;
    window.cloudRetryAfter = Number(e.retryAfter || 0);
    window.cloudAttemptsRemaining = e.attemptsRemaining;
    return false;
  }
}

function requireCloudLogin(message='Entre novamente para sincronizar com a nuvem') {
  try { localStorage.removeItem('orcafacil_active_session_v1'); } catch (_) {}
  const loginEl = document.getElementById('login');
  const setup = document.getElementById('setup');
  const enter = document.getElementById('enter');
  const user = document.getElementById('loginUser');
  const hello = document.getElementById('hello');
  if (setup) setup.classList.add('hide');
  if (enter) enter.classList.remove('hide');
  if (user && !user.value) user.value = window.auth?.login || 'admin';
  if (hello) hello.textContent = message;
  if (loginEl) loginEl.classList.remove('hide');
  window.cloudNeedsReauth = true;
  window.refreshUserAccessUI?.();
}
window.requireCloudLogin = requireCloudLogin;

async function cloudUploadAll() {
  if (!cloudReady || !window.auth?.pinHash) return;
  cloudSetState('sync','Enviando dados iniciais...');
  const order = ['settings','clients','products','budgets','contracts'];
  for (const store of order) {
    const rows = await window.localAll(store);
    for (const record of rows) {
      await cloudRequest('/api/data',{method:'POST',body:JSON.stringify({store,record})});
    }
  }
  cloudSetState('online','Nuvem sincronizada');
}

async function flushPendingMutations() {
  if (!cloudReady || navigator.onLine===false || window.cloudNeedsReauth || !window.auth?.pinHash) return false;
  let rows = readPendingMutations();
  if (!rows.length) { updatePendingState(); return true; }
  cloudSetState('sync',`Sincronizando ${rows.length} alteração${rows.length===1?'':'ões'}...`);
  for (const mutation of rows) {
    // Se uma edição mais nova substituiu esta mutação enquanto aguardávamos, não envia a antiga.
    const current = readPendingMutations().find(x=>x.key===mutation.key);
    if (!current || current.token !== mutation.token) continue;
    try {
      if (mutation.op === 'delete') {
        await cloudRequest('/api/data?store='+encodeURIComponent(mutation.store)+'&id='+encodeURIComponent(mutation.id),{method:'DELETE'});
      } else {
        await cloudRequest('/api/data',{method:'POST',body:JSON.stringify({store:mutation.store,record:mutation.record})});
      }
      removeMutationIfCurrent(mutation.token);
    } catch (e) {
      if (e.status === 401) { requireCloudLogin(); break; }
      if (e.status === 403 || e.status === 400) {
        // Erros permanentes não podem bloquear a fila para sempre.
        console.warn('Alteração descartada pelo servidor:',e.message,mutation.store,mutation.id);
        removeMutationIfCurrent(mutation.token);
        window.toast?.(e.status===403?'Uma alteração não foi sincronizada por falta de permissão':'Uma alteração inválida foi descartada');
        continue;
      }
      cloudSetState('offline',`Pendente • ${pendingCount()} alteração${pendingCount()===1?'':'ões'}`);
      return false;
    }
  }
  updatePendingState();
  return pendingCount() === 0;
}
window.flushCloudPending = flushPendingMutations;

async function cloudPull() {
  if (!cloudReady || !window.auth?.pinHash || window.cloudNeedsReauth) return;
  cloudSetState('sync','Baixando dados...');
  const r = await cloudRequest('/api/data',{method:'GET'});
  const data = r.data || {};
  cloudSyncing = true;
  try {
    for (const store of ['settings','clients','products','budgets','contracts']) {
      const rows = Array.isArray(data[store]) ? data[store] : [];
      if (store !== 'settings') {
        const current = await window.localAll(store);
        const incomingIds = new Set(rows.map(x=>x.id));
        for (const old of current) if (!incomingIds.has(old.id)) await window.localDel(store,old.id);
      }
      for (const record of rows) await window.localPut(store,record);
    }
  } finally { cloudSyncing = false; }
  if (typeof window.refresh === 'function') await window.refresh();
  const newSettings = await window.localGet('settings','main') || window.settings;
  window.setAppSettings?.(newSettings);
  if (typeof window.fillSettings === 'function') window.fillSettings();
  if (typeof window.applyLogoUI === 'function') window.applyLogoUI();
  updatePendingState();
}

async function cloudInitialSync(existingLocalUser) {
  try {
    const allowed = await cloudVerifyCurrent();
    if (!allowed) {
      let status = null;
      try { status = cloudLastStatus || await cloudRequest('/api/auth',{method:'GET'},null,null); } catch (_) {}

      // Upload completo só é permitido no primeiro cadastro de uma nuvem vazia.
      if (status?.online && status.hasUser === false) {
        const registered = await cloudRegisterCurrent();
        if (registered) {
          cloudReady = true;
          if (existingLocalUser) await cloudUploadAll();
          await flushPendingMutations();
          await cloudPull();
          window.cloudNeedsReauth = false;
          window.refreshUserAccessUI?.();
          return true;
        }
      }

      if (status?.online) {
        cloudReady = true;
        cloudSetState('pending','Nuvem online • autenticação necessária');
        requireCloudLogin(
          window.cloudLastVerifyError === 'RATE_LIMITED'
            ? 'Seu acesso está temporariamente bloqueado. Aguarde e entre novamente.'
            : 'Sua sessão local não corresponde à conta da nuvem. Entre novamente com seu usuário e PIN.'
        );
        return false;
      }

      cloudReady = false;
      updatePendingState();
      return false;
    }

    window.cloudNeedsReauth = false;
    // Em contas existentes, a fila é a única fonte de alterações locais pendentes.
    // Isso evita que um snapshot local antigo sobrescreva dados novos da nuvem.
    await flushPendingMutations();
    await cloudPull();
    window.refreshUserAccessUI?.();
    return true;
  } catch (e) {
    console.warn('Cloud sync:',e);
    cloudReady = false;
    updatePendingState();
    return false;
  }
}

window.cloudAfterInit = async function() {
  const status = await cloudStatus();
  if (!status) { window.refreshUserAccessUI?.(); return; }
  const hasLocal = !!window.auth?.pinHash;
  if (hasLocal && !window.auth.login) {
    const next = { ...window.auth, login:'admin', role:window.auth.role || 'admin' };
    window.setAppAuth?.(next);
    await window.localPut('auth',next);
  }
  if (status.hasUser && !hasLocal) {
    document.getElementById('setup')?.classList.add('hide');
    document.getElementById('enter')?.classList.remove('hide');
    const hello = document.getElementById('hello');
    if (hello) hello.textContent = 'Entre com seu usuário e PIN';
    window.setAppAuth?.(null);
    window.refreshUserAccessUI?.();
    return;
  }
  if (hasLocal) await cloudInitialSync(true);
  window.refreshUserAccessUI?.();
};

window.cloudLoginByPin = async function(pin, login='admin', silent=false) {
  try {
    window.cloudLastLoginError = null;
    const normalizedLogin = String(login || 'admin').trim().toLowerCase();
    const pinHash = await window.hash(pin);
    const r = await cloudRequest('/api/auth',{method:'POST',body:JSON.stringify({action:'login',login:normalizedLogin,pinHash})},null,normalizedLogin);
    const newAuth = { id:'admin', serverId:r.user?.id || null, name:r.user?.name || 'Usuário', login:r.user?.login || normalizedLogin, role:r.user?.role || 'operador', pinHash };
    window.setAppAuth?.(newAuth);
    await window.localPut('auth',newAuth);
    window.cloudNeedsReauth = false;
    cloudReady = true;
    cloudLastStatus = null;
    document.getElementById('login')?.classList.add('hide');
    const p = document.getElementById('loginPin'); if (p) p.value='';
    if (typeof window.syncAdminSide === 'function') window.syncAdminSide();
    window.refreshUserAccessUI?.();
    await flushPendingMutations();
    await cloudPull();
    return true;
  } catch (e) {
    window.cloudLastLoginError = e.message;
    window.cloudRetryAfter = Number(e.retryAfter || 0);
    window.cloudAttemptsRemaining = e.attemptsRemaining;
    if (!silent && typeof window.toast === 'function') {
      if (e.message === 'INVALID_CREDENTIALS') window.toast('Usuário ou PIN incorreto');
      else if (e.message === 'RATE_LIMITED') window.toast('Muitas tentativas. Aguarde antes de tentar novamente.');
      else if (e.message === 'TWO_FACTOR_REQUIRED') window.toast('Informe o código da autenticação em duas etapas');
      else window.toast('Não foi possível entrar na nuvem');
    }
    return false;
  }
};

window.cloudAfterLogin = function() {
  cloudQueue = cloudQueue.then(()=>cloudInitialSync(false)).catch(()=>{});
};

window.cloudAfterPut = function(store,record) {
  if (cloudSyncing || store === 'auth' || !window.auth?.pinHash) return;
  const id = String(record?.id || (store==='settings'?'main':'')).trim();
  if (!id) return;
  enqueueMutation('put',store,id,record);
  if (!cloudReady || window.cloudNeedsReauth || navigator.onLine===false) return;
  cloudQueue = cloudQueue.then(flushPendingMutations).catch(e=>{console.warn(e);updatePendingState()});
};

window.cloudAfterDelete = function(store,id) {
  if (cloudSyncing || !window.auth?.pinHash || !['clients','products','budgets','contracts'].includes(store)) return;
  enqueueMutation('delete',store,id,null);
  if (!cloudReady || window.cloudNeedsReauth || navigator.onLine===false) return;
  cloudQueue = cloudQueue.then(flushPendingMutations).catch(e=>{console.warn(e);updatePendingState()});
};

window.addEventListener('online',()=>{
  cloudQueue = cloudQueue.then(async()=>{
    const status = await cloudStatus();
    if (!status || !window.auth?.pinHash || window.cloudNeedsReauth) return;
    const ok = await flushPendingMutations();
    if (ok) await cloudPull();
  }).catch(e=>console.warn('Reconexão:',e));
});
window.addEventListener('offline',updatePendingState);
