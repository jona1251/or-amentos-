(async()=>{
  const VERSION='premiumtest17';
  const critical=['cloud-sync.js','app-core.js','app-budget.js','app-contract.js','app-users.js','app-users-security.js','app-polish.js','app-isolation.js','app-rate-limit.js','app-2fa-login.js','app-settings.js','app-logout-fix.js','app-cookies.js','app-security-panel.js','app-online-mode.js','app-access-enforcement.js'];
  const deferred=['app-premium.js','app-login-notifications.js','app-suite.js','app-suite-extras.js','app-user-permissions.js','app-dashboard-tools.js','app-budget-payments-unified.js','app-clean-ui.js','app-profile-presets-ui.js','app-admin-dashboard.js'];

  const load=file=>new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src=file+'?v='+VERSION;
    script.onload=resolve;
    script.onerror=()=>reject(new Error('Falha ao carregar '+file));
    document.head.appendChild(script);
  });

  for(const file of critical)await load(file);

  await new Promise(resolve=>{
    if('requestIdleCallback'in window)requestIdleCallback(()=>resolve(),{timeout:450});
    else setTimeout(resolve,120);
  });

  window.__orcaEnhancementsReady=(async()=>{
    for(const file of deferred){
      try{await load(file)}catch(err){console.error(err)}
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    window.dispatchEvent(new CustomEvent('orca:enhancements-ready'));
  })();
})().catch(err=>{
  console.error(err);
  document.body.insertAdjacentHTML('beforeend','<div style="position:fixed;left:16px;right:16px;bottom:16px;background:#b42318;color:#fff;padding:14px;border-radius:12px;z-index:9999;font-family:sans-serif">Não foi possível carregar os módulos essenciais. Atualize a página.</div>');
});
