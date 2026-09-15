const CACHE='orcafacil-premium-test-v6';
const ASSETS=[
  '/','/index.html','/app.css','/app.js','/manifest.webmanifest',
  '/app-api-session.js','/cloud-sync.js','/app-core.js','/app-local-scope.js','/app-budget.js','/app-contract.js','/app-users.js','/app-users-security.js',
  '/app-polish.js','/app-auth-credential.js','/app-isolation.js','/app-rate-limit.js','/app-2fa-login.js','/app-settings.js','/app-logout-fix.js',
  '/app-cookies.js','/app-security-panel.js','/app-online-mode.js','/app-access-enforcement.js','/app-premium.js',
  '/app-login-notifications.js','/app-suite.js','/app-suite-extras.js','/app-user-permissions.js','/app-dashboard-tools.js',
  '/app-budget-payments-unified.js','/app-clean-ui.js','/app-profile-presets-ui.js','/app-admin-dashboard.js'
];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>Promise.allSettled(ASSETS.map(asset=>cache.add(asset)))));
  self.skipWaiting();
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==location.origin||url.pathname.startsWith('/api/'))return;

  if(req.mode==='navigate'){
    event.respondWith(fetch(req).then(res=>{
      if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put('/index.html',copy)).catch(()=>{})}
      return res;
    }).catch(()=>caches.match('/index.html')));
    return;
  }

  event.respondWith(fetch(req).then(res=>{
    if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy)).catch(()=>{})}
    return res;
  }).catch(()=>caches.match(req)));
});
