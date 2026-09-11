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

async function cloudRequest(url, options = {}, token, loginOverride) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const key = token || window.auth?.pinHash;
  const login = loginOverride || window.auth?.login;
  if (key) headers['x-orca-auth'] = key;
  if (login) headers['x-orca-user'] = login;
  const res = await fetch(url, { ...options, headers });
  let body = {};
  try { body = await res.json(); } catch (_) {}
  if (!res.ok) {
    const e = new Error(body.error || ('HTTP_' + res.status));
    e.status = res.status;
    e.retryAfter = Number(body.retryAfter || res.headers.get('Retry-After') || 0);
    e.attemptsRemaining = body.attemptsRemaining;
    throw e;
  }
  return body;
}
window.cloudRequest = cloudRequest;
window.cloudIsReady = () => cloudReady;

async function cloudStatus() {
  try {
    const r = await cloudRequest('/api/auth', { method: 'GET' }, null, null);
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
  const login = (window.auth.login || 'admin').toLowerCase();
  try {
    const r = await cloudRequest('/api/auth', {
      method: 'POST',
      body: JSON.stringify({ action: 'register', name: window.auth.name || 'Administrador', login, pinHash: window.auth.pinHash })
    }, null, login);
    if (r.user) {
      const next = { ...window.auth, login:r.user.login || login, role:r.user.role || 'admin', name:r.user.name || window.auth.name, serverId:r.user.id || window.auth.serverId || null };
      window.setAppAuth?.(next);
      await window.localPut('auth', next);
    }
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
    const r = await cloudRequest('/api/auth', {
      method: 'POST',
      body: JSON.stringify({ action: 'login', login, pinHash: window.auth.pinHash })
    }, null, login);
    if (r.user) {
      const next = { ...window.auth, login:r.user.login || login, role:r.user.role || 'admin', name:r.user.name || window.auth.name, serverId:r.user.id || window.auth.serverId || null };
      window.setAppAuth?.(next);
      await window.localPut('auth', next);
    }
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
    const allowed = await cloudVerifyCurrent();
    if (!allowed) {
      let status = null;
      try { status = await cloudRequest('/api/auth', { method:'GET' }, null, null); } catch (_) {}

      // Só registra automaticamente quando a nuvem ainda não possui nenhum usuário.
      // Se já há usuários, nunca sobrescreve a conta da nuvem com credenciais locais antigas.
      if (status?.online && status.hasUser === false) {
        const registered = await cloudRegisterCurrent();
        if (registered) {
          if (existingLocalUser) await cloudUploadAll();
          await cloudPull();
          window.cloudNeedsReauth = false;
          window.refreshUserAccessUI?.();
          return true;
        }
      }

      if (status?.online) {
        cloudReady = true;
        cloudSetState('online','Nuvem online • autenticação necessária');
        requireCloudLogin(
          window.cloudLastVerifyError === 'RATE_LIMITED'
            ? 'Seu acesso está temporariamente bloqueado. Aguarde e entre novamente.'
            : 'Sua sessão local não corresponde à conta da nuvem. Entre novamente com seu usuário e PIN.'
        );
        return false;
      }

      cloudReady = false;
      cloudSetState('offline','Modo local');
      return false;
    }

    window.cloudNeedsReauth = false;
    if (existingLocalUser) await cloudUploadAll();
    await cloudPull();
    window.refreshUserAccessUI?.();
    return true;
  } catch (e) {
    console.warn('Cloud sync:', e);
    cloudReady = false;
    cloudSetState('offline', 'Modo local');
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
    await window.localPut('auth', next);
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
    const r = await cloudRequest('/api/auth', { method:'POST', body:JSON.stringify({ action:'login', login:normalizedLogin, pinHash }) }, null, normalizedLogin);
    const newAuth = { id:'admin', serverId:r.user?.id || null, name:r.user?.name || 'Usuário', login:r.user?.login || normalizedLogin, role:r.user?.role || 'operador', pinHash };
    window.setAppAuth?.(newAuth);
    await window.localPut('auth', newAuth);
    window.cloudNeedsReauth = false;
    cloudReady = true;
    document.getElementById('login')?.classList.add('hide');
    const p = document.getElementById('loginPin'); if (p) p.value='';
    if (typeof window.syncAdminSide === 'function') window.syncAdminSide();
    window.refreshUserAccessUI?.();
    await cloudPull();
    return true;
  } catch (e) {
    window.cloudLastLoginError = e.message;
    window.cloudRetryAfter = Number(e.retryAfter || 0);
    window.cloudAttemptsRemaining = e.attemptsRemaining;
    if (!silent && typeof window.toast === 'function') {
      if (e.message === 'INVALID_CREDENTIALS') window.toast('Usuário ou PIN incorreto');
      else if (e.message === 'RATE_LIMITED') window.toast('Muitas tentativas. Aguarde antes de tentar novamente.');
      else window.toast('Não foi possível entrar na nuvem');
    }
    return false;
  }
};

window.cloudAfterLogin = function() {
  cloudQueue = cloudQueue.then(() => cloudInitialSync(false)).catch(() => {});
};

window.cloudAfterPut = function(store, record) {
  if (cloudSyncing || !cloudReady || window.cloudNeedsReauth || !window.auth?.pinHash || store === 'auth') return;
  cloudQueue = cloudQueue.then(async () => {
    cloudSetState('sync','Sincronizando...');
    await cloudRequest('/api/data', { method:'POST', body:JSON.stringify({ store, record }) });
    cloudSetState('online','Nuvem sincronizada');
  }).catch(e => { console.warn(e); cloudSetState('offline','Modo local'); });
};

window.cloudAfterDelete = function(store, id) {
  if (cloudSyncing || !cloudReady || window.cloudNeedsReauth || !window.auth?.pinHash || !['clients','products','budgets','contracts'].includes(store)) return;
  cloudQueue = cloudQueue.then(async () => {
    cloudSetState('sync','Sincronizando...');
    await cloudRequest('/api/data?store='+encodeURIComponent(store)+'&id='+encodeURIComponent(id), { method:'DELETE' });
    cloudSetState('online','Nuvem sincronizada');
  }).catch(e => { console.warn(e); cloudSetState('offline','Modo local'); });
};
