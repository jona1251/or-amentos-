(async()=>{
  const parts=['cloud-sync.js','app-core.js','app-budget.js','app-contract.js','app-users.js','app-users-security.js','app-polish.js','app-isolation.js','app-rate-limit.js','app-settings.js','app-logout-fix.js','app-cookies.js','app-security-panel.js','app-online-mode.js','app-premium.js','app-login-notifications.js'];
  for(const file of parts){
    await new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=file+'?v=premiumtest2';
      script.onload=resolve;
      script.onerror=()=>reject(new Error('Falha ao carregar '+file));
      document.head.appendChild(script);
    });
  }
})().catch(err=>{
  console.error(err);
  document.body.insertAdjacentHTML('beforeend','<div style="position:fixed;left:16px;right:16px;bottom:16px;background:#b42318;color:#fff;padding:14px;border-radius:12px;z-index:9999;font-family:sans-serif">Não foi possível carregar a atualização. Atualize a página.</div>');
});
