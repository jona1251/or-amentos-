(function(){
  const STORES=['settings','clients','products','budgets','contracts'];
  async function clearCurrentScope(){for(const s of STORES){let rows=[];try{rows=await window.localAll(s)}catch(_){}for(const r of rows)if(r?.id)await window.localDel(s,r.id)}}
  async function restoreContext(auth){
    window.setAppAuth?.(auth||null);
    if(auth)await window.localPut('auth',{...auth,id:'admin'});
    const set=await window.localGet('settings','main').catch(()=>null);
    if(set)window.setAppSettings?.(set);
    await window.refresh?.();window.fillSettings?.();window.applyLogoUI?.();window.syncAdminSide?.();window.refreshUserAccessUI?.();window.applyRoleUI?.();
  }
  async function authCall(login,pinHash,twoFactorCode){
    const res=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({action:'login',login,pinHash,twoFactorCode:twoFactorCode||undefined})});
    let body={};try{body=await res.json()}catch(_){}if(!res.ok){const e=new Error(body.error||('HTTP_'+res.status));e.retryAfter=Number(body.retryAfter||res.headers.get('Retry-After')||0);e.attemptsRemaining=body.attemptsRemaining;throw e}return body
  }
  async function pull(){
    const res=await fetch('/api/data',{headers:{'Content-Type':'application/json'},credentials:'same-origin',cache:'no-store'});
    let body={};try{body=await res.json()}catch(_){}if(!res.ok)throw new Error(body.error||('HTTP_'+res.status));
    await clearCurrentScope();
    for(const s of STORES){const rows=Array.isArray(body.data?.[s])?body.data[s]:[];for(const r of rows)if(r?.id)await window.localPut(s,r)}
    const set=(body.data?.settings||[])[0];if(set)window.setAppSettings?.(set);await window.refresh?.();window.fillSettings?.();window.applyLogoUI?.()
  }

  window.cloudLoginByPin=async function(pin,login='admin',silent=false){
    const normalized=String(login||'admin').trim().toLowerCase();window.cloudLastLoginError=null;window.cloudRetryAfter=0;window.cloudAttemptsRemaining=null;
    if(!/^[a-z0-9._-]{3,30}$/.test(normalized)){if(!silent)window.toast?.('Informe um usuário válido');return false}
    if(!/^[0-9]{4,8}$/.test(String(pin||''))){if(!silent)window.toast?.('Informe seu PIN de 4 a 8 números');return false}
    const oldAuth=window.auth?{...window.auth}:null,pinHash=await window.hash(pin);
    try{
      let body;
      try{body=await authCall(normalized,pinHash,'')}catch(e){
        if(e.message==='TWO_FACTOR_REQUIRED'){
          const code=prompt('Autenticação em duas etapas\nDigite o código de 6 dígitos do seu aplicativo autenticador:');
          if(code===null){window.cloudLastLoginError='TWO_FACTOR_REQUIRED';return false}
          if(!/^\d{6}$/.test(String(code).trim())){window.cloudLastLoginError='INVALID_2FA_CODE';if(!silent)window.toast?.('Código 2FA inválido');return false}
          body=await authCall(normalized,pinHash,String(code).trim());
        }else throw e;
      }
      document.body.classList.add('switching-user');
      const next={id:'admin',serverId:body.user?.id||null,name:body.user?.name||'Usuário',login:body.user?.login||normalized,role:body.user?.role||'operador',pinHash};
      window.setAppAuth?.(next);await window.localPut('auth',next);
      // Cada usuário possui seu próprio namespace local. O pull limpa apenas o namespace
      // do usuário recém-autenticado; o cache dos demais usuários permanece isolado.
      await pull();
      document.getElementById('login')?.classList.add('hide');const p=document.getElementById('loginPin');if(p)p.value='';window.cloudNeedsReauth=false;window.syncAdminSide?.();window.refreshUserAccessUI?.();window.applyRoleUI?.();window.setOrcaConnectionState?.('online','🟢 Online');return true;
    }catch(e){
      window.cloudLastLoginError=e.message;window.cloudRetryAfter=Number(e.retryAfter||0);window.cloudAttemptsRemaining=e.attemptsRemaining;
      await restoreContext(oldAuth);
      if(!silent){if(e.message==='INVALID_2FA_CODE')window.toast?.('Código 2FA inválido');else if(e.message==='INVALID_CREDENTIALS')window.toast?.('Usuário ou PIN incorreto');else if(e.message==='RATE_LIMITED')window.toast?.('Muitas tentativas. Aguarde antes de tentar novamente.');else window.toast?.('Não foi possível entrar na nuvem')}return false
    }finally{document.body.classList.remove('switching-user')}
  };

  window.doLogin=async function(){
    const login=String(document.getElementById('loginUser')?.value||window.auth?.login||'admin').trim().toLowerCase();const pin=document.getElementById('loginPin')?.value||'';
    if(!login||!pin)return window.toast?.('Informe usuário e PIN');if(!/^[a-z0-9._-]{3,30}$/.test(login))return window.toast?.('Informe um usuário válido');if(!/^[0-9]{4,8}$/.test(pin))return window.toast?.('Informe seu PIN de 4 a 8 números');
    const ok=await window.cloudLoginByPin(pin,login,true);if(ok)return;
    if(window.cloudLastLoginError==='RATE_LIMITED'){const retry=Math.max(1,Number(window.cloudRetryAfter||1));window.startLoginCooldown?.(retry);return window.toast?.(window.formatLoginRateLimit?.(retry)||'Muitas tentativas. Aguarde.')}
    if(window.cloudLastLoginError==='INVALID_CREDENTIALS'){const n=Number(window.cloudAttemptsRemaining);return window.toast?.(Number.isFinite(n)&&n>0?`Usuário ou PIN incorreto. Restam ${n} tentativa${n===1?'':'s'}.`:'Usuário ou PIN incorreto')}
    if(window.cloudLastLoginError==='TWO_FACTOR_REQUIRED')return window.toast?.('O código 2FA é obrigatório para esta conta');
    if(window.cloudLastLoginError==='INVALID_2FA_CODE')return window.toast?.('Código 2FA inválido');
    const localLogin=String(window.auth?.login||'admin').trim().toLowerCase();if(window.auth&&localLogin===login&&await window.hash(pin)===window.auth.pinHash){document.getElementById('login')?.classList.add('hide');const p=document.getElementById('loginPin');if(p)p.value='';try{localStorage.setItem('orcafacil_active_session_v1','1')}catch(_){}window.refreshUserAccessUI?.();window.cloudAfterLogin?.();return}
    window.toast?.('Não foi possível entrar. Confira a conexão e tente novamente.')
  };
})();
