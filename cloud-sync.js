let cloudQueue = Promise.resolve();
let cloudSyncing = false;
let cloudReady = false;

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
  else if (state === 'sync') { el.style.color = '#92400e'; el.style.background = '#fffbeb'; el.style.borderColor = '#fde68a'; }
  else { el.style.color = '#6b7280'; el.style.background = '#fff'; el.style.borderColor = '#e5e7eb'; }
}

async function cloudRequest(url, options = {}, token) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const key = token || window.auth?.pinHash;
  if (key) headers['x-orca-auth'] = key;
  const res = await fetch(url, { ...options, headers });
  let body = {};
  try { body = await res.json(); } catch (_) {}
  if (!res.ok) {
    const e = new Error(body.error || ('HTTP_' + res.status));
    e.status = res.status;
    throw e;
  }
  return body;
}

async function cloudStatus() {
  try {
    const r = await cloudRequest('/api/auth', { method: 'GET' }, null);
    cloudReady = !!r.online;
    cloudSetState('online', 'Nuvem conectada');
    return r;
  } catch (e) {
    cloudReady = false;
    cloudSetState('offline', e.message === 'DATABASE_NOT_CONNECTED' ? 'Conectar banco' : 'Modo local');
    return null;
  }
}

async function cloudRegisterCurrent() {
  if (!window.auth?.pinHash) return false;
  try {
    await cloudRequest('/api/auth', {
      method: 'POST',
      body: JSON.stringify({ action: 'register', name: window.auth.name || 'Administrador', pinHash: window.auth.pinHash })
    }, null);
    return true;
  } catch (e) {
    if (e.message === 'USER_ALREADY_EXISTS') return false;
    throw e;
  }
}

async function cloudVerifyCurrent() {
  if (!window.auth?.pinHash) return false;
  try {
    await cloudRequest('/api/auth', {
      method: 'POST',
      body: JSON.stringify({ action: 'login', pinHash: window.auth.pinHash })
    }, null);
    return true;
  } catch (_) { return false; }
}

async function cloudUploadAll() {
  if (!cloudReady || !window.auth?.pinHash) return;
  cloudSetState('sync', 'Sincronizando...');
  const order = ['settings', 'clients', 'products', 'budgets', 'contracts'];
  for (const store of order) {
    const rows = await window.localAll(store);
    for (const record of rows) {
      await cloudRequest('/api/data', { method:'POST', body:JSON.stringify({ store, record }) });
    }
  }
  cloudSetState('online', 'Nuvem sincronizada');
}

async function cloudPull() {
  if (!cloudReady || !window.auth?.pinHash) return;
  cloudSetState('sync', 'Baixando dados...');
  const r = await cloudRequest('/api/data', { method:'GET' });
  const data = r.data || {};
  cloudSyncing = true;
  try {
    for (const store of ['settings','clients','products','budgets','contracts']) {
      const rows = Array.isArray(data[store]) ? data[store] : [];
      if (store !== 'settings') {
        const current = await window.localAll(store);
        const incomingIds = new Set(rows.map(x => x.id));
        for (const old of current) if (!incomingIds.has(old.id)) await window.localDel(store, old.id);
      }
      for (const record of rows) await window.localPut(store, record);
    }
  } finally {
    cloudSyncing = false;
  }
  if (typeof window.refresh === 'function') await window.refresh();
  const newSettings = await window.localGet('settings','main') || window.settings;
  window.setAppSettings?.(newSettings);
  if (typeof window.fillSettings === 'function') window.fillSettings();
  if (typeof window.applyLogoUI === 'function') window.applyLogoUI();
  cloudSetState('online', 'Nuvem sincronizada');
}

async function cloudInitialSync(existingLocalUser) {
  try {
    let allowed = await cloudVerifyCurrent();
    if (!allowed) allowed = await cloudRegisterCurrent();
    if (!allowed) { cloudSetState('offline','PIN da nuvem diferente'); return; }
    if (existingLocalUser) await cloudUploadAll();
    await cloudPull();
  } catch (e) {
    console.warn('Cloud sync:', e);
    cloudSetState('offline', 'Modo local');
  }
}

window.cloudAfterInit = async function() {
  const status = await cloudStatus();
  if (!status) return;
  const hasLocal = !!window.auth?.pinHash;
  if (status.hasUser && !hasLocal) {
    document.getElementById('setup')?.classList.add('hide');
    document.getElementById('enter')?.classList.remove('hide');
    const hello = document.getElementById('hello');
    if (hello) hello.textContent = 'Acesso online • digite seu PIN';
    window.setAppAuth?.(null);
    return;
  }
  if (hasLocal) await cloudInitialSync(true);
};

window.cloudLoginByPin = async function(pin) {
  try {
    const pinHash = await window.hash(pin);
    const r = await cloudRequest('/api/auth', { method:'POST', body:JSON.stringify({ action:'login', pinHash }) }, null);
    const newAuth = { id:'admin', name:r.user?.name || 'Administrador', pinHash };
    window.setAppAuth?.(newAuth);
    await window.localPut('auth', newAuth);
    document.getElementById('login')?.classList.add('hide');
    const p = document.getElementById('loginPin'); if (p) p.value='';
    if (typeof window.syncAdminSide === 'function') window.syncAdminSide();
    await cloudPull();
    return true;
  } catch (e) {
    if (typeof window.toast === 'function') window.toast(e.message === 'INVALID_PIN' ? 'PIN incorreto' : 'Não foi possível entrar na nuvem');
    return false;
  }
};

window.cloudAfterLogin = function() {
  cloudQueue = cloudQueue.then(() => cloudInitialSync(false)).catch(() => {});
};

window.cloudAfterPut = function(store, record) {
  if (cloudSyncing || !cloudReady || !window.auth?.pinHash || store === 'auth') return;
  cloudQueue = cloudQueue.then(async () => {
    cloudSetState('sync','Sincronizando...');
    await cloudRequest('/api/data', { method:'POST', body:JSON.stringify({ store, record }) });
    cloudSetState('online','Nuvem sincronizada');
  }).catch(e => { console.warn(e); cloudSetState('offline','Modo local'); });
};

window.cloudAfterDelete = function(store, id) {
  if (cloudSyncing || !cloudReady || !window.auth?.pinHash || !['clients','products','budgets','contracts'].includes(store)) return;
  cloudQueue = cloudQueue.then(async () => {
    cloudSetState('sync','Sincronizando...');
    await cloudRequest('/api/data?store='+encodeURIComponent(store)+'&id='+encodeURIComponent(id), { method:'DELETE' });
    cloudSetState('online','Nuvem sincronizada');
  }).catch(e => { console.warn(e); cloudSetState('offline','Modo local'); });
};
