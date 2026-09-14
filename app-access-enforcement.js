(function(){
  const CACHE='orcafacil_effective_permissions_';
  const DEFAULT={dashboard:true,clientes:true,produtos:true,orcamentos:true,contratos:true,financeiro:true,operacoes:true,crm:true,relatorios:true,custos:true,configuracoes:true,excluir:true,usuarios:false,seguranca:false};
  let permissions={...DEFAULT},primary=false,adminFull=false,wrapped=false;
  const headers=()=>({'Content-Type':'application/json','x-orca-auth':window.auth?.pinHash||'','x-orca-user':window.auth?.login||'admin'});
  const cacheKey=()=>CACHE+String(window.auth?.login||'local').toLowerCase();
  function isAdmin(){return adminFull||String(window.auth?.role||'').toLowerCase()==='admin'}
  function allowed(key){return isAdmin()||primary||permissions[key]!==false}
  window.orcaHasAccess=allowed;

  async function fetchAccess(){
    try{
      const r=await fetch('/api/my-permissions',{headers:headers(),cache:'no-store'});let b={};try{b=await r.json()}catch(_){}if(!r.ok)throw new Error(b.error||'HTTP_'+r.status);
      permissions={...DEFAULT,...(b.permissions||{})};primary=!!b.primaryAdmin;adminFull=!!b.adminFull||String(b.role||'').toLowerCase()==='admin'||String(window.auth?.role||'').toLowerCase()==='admin';
      if(adminFull)Object.keys(permissions).forEach(k=>permissions[k]=true);
      try{localStorage.setItem(cacheKey(),JSON.stringify({permissions,primary,adminFull}))}catch(_){}
    }catch(e){
      adminFull=String(window.auth?.role||'').toLowerCase()==='admin';
      try{const c=JSON.parse(localStorage.getItem(cacheKey())||'null');if(c){permissions={...DEFAULT,...(c.permissions||{})};primary=!!c.primary;adminFull=adminFull||!!c.adminFull}}catch(_){}
      if(adminFull)Object.keys(permissions).forEach(k=>permissions[k]=true);
    }
    window.orcaPermissions=permissions;window.orcaPrimaryAdmin=primary;window.orcaAdminFull=adminFull;apply();window.refreshDashboardTools?.();return {permissions,primary,adminFull};
  }
  window.refreshAccessPermissions=fetchAccess;

  function toggleNav(selector,on){document.querySelectorAll(selector).forEach(el=>{el.style.display=on?'':'none'})}
  function apply(){
    toggleNav('#nav [data-v="painel"]',allowed('dashboard'));
    toggleNav('#nav [data-v="clientes"]',allowed('clientes'));
    toggleNav('#nav [data-v="produtos"]',allowed('produtos'));
    toggleNav('#nav [data-v="orcamento"],#nav [data-v="historico"]',allowed('orcamentos'));
    toggleNav('#nav [data-v="contrato"]',allowed('contratos'));
    toggleNav('#nav [data-v="financeiro"]',allowed('financeiro'));
    toggleNav('#nav [data-v="config"]',allowed('configuracoes'));
    toggleNav('#nav [data-v="usuarios"],#usersNav',allowed('usuarios'));
    toggleNav('#nav [data-v="seguranca"],#nav [data-v="security"],#securityNav',allowed('seguranca'));
    const anyPremium=allowed('operacoes')||allowed('crm')||allowed('relatorios')||allowed('financeiro')||allowed('seguranca');
    toggleNav('#nav [data-v="suite"]',anyPremium);

    const cost=document.getElementById('pCost');if(cost?.closest('label'))cost.closest('label').style.display=allowed('custos')?'':'none';
    document.body.classList.toggle('orcaNoDelete',!allowed('excluir'));
    installDeleteStyle();
    protectCurrentView();
  }

  function installDeleteStyle(){if(document.getElementById('accessEnforcementStyles'))return;const s=document.createElement('style');s.id='accessEnforcementStyles';s.textContent=`body.orcaNoDelete #productList .btn.danger,body.orcaNoDelete #clientList .btn.danger,body.orcaNoDelete #contractList .btn.danger,body.orcaNoDelete #budgetList .btn.danger{display:none!important}.accessDeniedCard{margin:28px auto;width:min(92%,620px);background:#fff;border:1px solid #e5e7eb;border-radius:20px;padding:26px;text-align:center}.accessDeniedCard .lock{font-size:42px}.accessDeniedCard h2{margin:10px 0 7px}.accessDeniedCard p{color:#7a8493;line-height:1.5}`;document.head.appendChild(s)}

  const viewPermission={painel:'dashboard',clientes:'clientes',produtos:'produtos',orcamento:'orcamentos',historico:'orcamentos',contrato:'contratos',financeiro:'financeiro',config:'configuracoes',usuarios:'usuarios',seguranca:'seguranca',security:'seguranca'};
  function canView(v){if(isAdmin())return true;const p=viewPermission[v];if(p)return allowed(p);if(v==='suite')return allowed('operacoes')||allowed('crm')||allowed('relatorios')||allowed('financeiro')||allowed('seguranca');return true}
  function firstAllowed(){for(const v of ['painel','orcamento','clientes','produtos','contrato','financeiro','suite','config'])if(canView(v))return v;return null}
  function protectCurrentView(){const active=document.querySelector('.view.on');if(active&&!canView(active.id)){const v=firstAllowed();if(v&&window.__orcaOriginalGo)window.__orcaOriginalGo(v);else showDenied()}}
  function showDenied(){document.querySelectorAll('.view').forEach(x=>x.classList.remove('on'));let sec=document.getElementById('accessDeniedView');if(!sec){sec=document.createElement('section');sec.id='accessDeniedView';sec.className='view on';sec.innerHTML='<div class="accessDeniedCard"><div class="lock">🔒</div><h2>Acesso restrito</h2><p>Seu usuário não possui nenhum módulo liberado. Fale com o administrador para solicitar acesso.</p></div>';document.querySelector('.app')?.appendChild(sec)}sec.classList.add('on');const t=document.getElementById('pageTitle');if(t)t.textContent='Acesso restrito'}

  function wrapNavigation(){if(window.__orcaOriginalGo)return;const original=window.go;if(typeof original!=='function')return;window.__orcaOriginalGo=original;window.go=function(v){if(!canView(v)){window.toast?.('Seu usuário não tem acesso a esta área');return}return original(v)} }
  function deny(name,permission){const original=window[name];if(typeof original!=='function'||original.__accessWrapped)return;const wrapped=async function(...args){if(!allowed(permission)){window.toast?.('Seu usuário não tem permissão para esta ação');return}return original.apply(this,args)};wrapped.__accessWrapped=true;window[name]=wrapped}
  function wrapActions(){if(wrapped)return;wrapped=true;
    deny('saveClient','clientes');deny('editClient','clientes');deny('saveProduct','produtos');deny('editProduct','produtos');deny('saveBudget','orcamentos');deny('updateBudgetStatus','orcamentos');deny('duplicateBudget','orcamentos');deny('saveContract','contratos');deny('previewContract','contratos');deny('saveSettings','configuracoes');deny('backup','relatorios');deny('restoreBackup','relatorios');
    ['deleteClient','deleteProduct','deleteBudget','deleteContract','removeUser'].forEach(n=>deny(n,'excluir'));
    deny('createNewUser','usuarios');deny('resetUserPin','usuarios');
  }

  function wrapSuiteTabs(){const old=window.suiteTab;if(typeof old!=='function'||old.__accessWrapped)return;const fn=async function(id){const map={ops:'operacoes',sales:'crm',manage:'relatorios',ai:'relatorios',security:'seguranca'};const p=map[id];if(p&&!allowed(p)){window.toast?.('Seu usuário não tem acesso a esta área');return}return old(id)};fn.__accessWrapped=true;window.suiteTab=fn}

  function hookLogin(){const old=window.cloudLoginByPin;if(typeof old==='function'&&!old.__accessWrapped){const fn=async function(...args){const ok=await old.apply(this,args);if(ok)await fetchAccess();return ok};fn.__accessWrapped=true;window.cloudLoginByPin=fn}}
  function periodic(){wrapNavigation();wrapActions();wrapSuiteTabs();hookLogin();if(String(window.auth?.role||'').toLowerCase()==='admin')adminFull=true;apply()}
  async function init(){wrapNavigation();wrapActions();wrapSuiteTabs();hookLogin();await fetchAccess();setInterval(periodic,2500);setInterval(()=>{if(navigator.onLine!==false&&window.auth)fetchAccess()},30000);window.addEventListener('online',fetchAccess)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,1100));else setTimeout(init,1100);
})();
