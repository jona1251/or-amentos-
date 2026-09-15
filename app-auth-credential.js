(function(){
  const SESSION_KEY='orcafacil_active_session_v1';
  const normalize=v=>String(v||'admin').trim().toLowerCase();

  async function offlineFromServerHash(login,serverHash){
    return window.hash('orcafacil-offline-v1|'+normalize(login)+'|'+String(serverHash||''));
  }

  window.orcaCredentialsFromPin=async function(login,pin){
    const serverHash=await window.hash(String(pin||''));
    const offlinePinHash=await offlineFromServerHash(login,serverHash);
    return {serverHash,offlinePinHash};
  };

  window.orcaVerifyOfflinePin=async function(pin,auth=window.auth){
    if(!auth?.offlinePinHash)return false;
    const {offlinePinHash}=await window.orcaCredentialsFromPin(auth.login||'admin',pin);
    return offlinePinHash===auth.offlinePinHash;
  };

  async function sanitizeAuth(record){
    if(!record)return record;
    const next={...record,id:'admin'};
    if(next.pinHash){
      if(!next.offlinePinHash)next.offlinePinHash=await offlineFromServerHash(next.login||'admin',next.pinHash);
      if(!next.serverId&&!next.pendingRegistrationPinHash)next.pendingRegistrationPinHash=next.pinHash;
      delete next.pinHash;
    }
    return next;
  }
  window.orcaSanitizeAuthRecord=sanitizeAuth;

  async function persistAuth(record){
    const next=await sanitizeAuth(record);
    window.setAppAuth?.(next||null);
    if(next)await window.localPut?.('auth',next);
    return next;
  }
  window.orcaPersistAuth=persistAuth;

  const baseCreate=window.createAccess;
  if(typeof baseCreate==='function'){
    window.createAccess=async function(){
      const out=await baseCreate.apply(this,arguments);
      if(window.auth){
        await persistAuth(window.auth);
        try{localStorage.setItem(SESSION_KEY,'1')}catch(_){}
        window.cloudAfterLogin?.();
      }
      return out;
    };
  }

  const baseCloudAfterInit=window.cloudAfterInit;
  window.cloudAfterInit=async function(){
    if(window.auth)await persistAuth(window.auth);
    const out=typeof baseCloudAfterInit==='function'?await baseCloudAfterInit.apply(this,arguments):undefined;
    try{
      const active=localStorage.getItem(SESSION_KEY)==='1';
      if(active){
        const res=await fetch('/api/auth',{method:'GET',cache:'no-store'});
        let body={};try{body=await res.json()}catch(_){}
        if(res.ok&&body.hasSession&&body.sessionUser){
          const u=body.sessionUser;
          const next=await sanitizeAuth({...window.auth,id:'admin',serverId:u.id||window.auth?.serverId||null,name:u.name||window.auth?.name||'Usuário',login:u.login||window.auth?.login||'admin',role:u.role||window.auth?.role||'operador'});
          window.setAppAuth?.(next);await window.localPut?.('auth',next);
          document.getElementById('login')?.classList.add('hide');
          window.syncAdminSide?.();window.applyRoleUI?.();
        }else if(res.ok&&!body.hasSession){
          localStorage.removeItem(SESSION_KEY);
          document.getElementById('login')?.classList.remove('hide');
        }
      }
    }catch(_){}
    return out;
  };
})();
