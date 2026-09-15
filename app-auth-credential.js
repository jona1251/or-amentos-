(function(){
  const SESSION_KEY='orcafacil_active_session_v1';
  const normalize=v=>String(v||'admin').trim().toLowerCase();

  async function offlineFromServerHash(login,serverHash){
    return window.hash('orcafacil-offline-v2|'+String(serverHash||''));
  }
  async function legacyOfflineFromServerHash(login,serverHash){
    return window.hash('orcafacil-offline-v1|'+normalize(login)+'|'+String(serverHash||''));
  }
  window.orcaOfflineFromServerHash=offlineFromServerHash;

  window.orcaCredentialsFromPin=async function(login,pin){
    const serverHash=await window.hash(String(pin||''));
    const offlinePinHash=await offlineFromServerHash(login,serverHash);
    return {serverHash,offlinePinHash,offlinePinVersion:2};
  };

  window.orcaVerifyOfflinePin=async function(pin,auth=window.auth){
    if(!auth?.offlinePinHash)return false;
    const serverHash=await window.hash(String(pin||''));
    const current=await offlineFromServerHash(auth.login||'admin',serverHash);
    if(current===auth.offlinePinHash)return true;
    if(!auth.offlinePinVersion||Number(auth.offlinePinVersion)<2){
      const legacy=await legacyOfflineFromServerHash(auth.login||'admin',serverHash);
      if(legacy===auth.offlinePinHash){
        const upgraded={...auth,offlinePinHash:current,offlinePinVersion:2};
        setTimeout(()=>window.orcaPersistAuth?.(upgraded),0);
        return true;
      }
    }
    return false;
  };

  async function sanitizeAuth(record){
    if(!record)return record;
    const next={...record,id:'admin'};
    if(next.pinHash){
      next.offlinePinHash=await offlineFromServerHash(next.login||'admin',next.pinHash);
      next.offlinePinVersion=2;
      if(!next.serverId&&!next.pendingRegistrationPinHash)next.pendingRegistrationPinHash=next.pinHash;
      delete next.pinHash;
    }
    return next;
  }
  window.orcaSanitizeAuthRecord=sanitizeAuth;

  const baseLocalPut=window.localPut;
  if(typeof baseLocalPut==='function'){
    window.localPut=async function(store,record){
      if(store!=='auth')return baseLocalPut(store,record);
      const next=await sanitizeAuth(record);
      const out=await baseLocalPut(store,next);
      if(next)window.setAppAuth?.(next);
      return out;
    };
  }

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
      const res=await fetch('/api/auth',{method:'GET',cache:'no-store'});
      let body={};try{body=await res.json()}catch(_){}
      if(res.ok&&body.hasSession&&body.sessionUser){
        const u=body.sessionUser;
        const next=await sanitizeAuth({...window.auth,id:'admin',serverId:u.id||window.auth?.serverId||null,name:u.name||window.auth?.name||'Usuário',login:u.login||window.auth?.login||'admin',role:u.role||window.auth?.role||'operador'});
        window.setAppAuth?.(next);await window.localPut?.('auth',next);
        try{localStorage.setItem(SESSION_KEY,'1')}catch(_){}
        document.getElementById('login')?.classList.add('hide');
        window.syncAdminSide?.();window.applyRoleUI?.();
      }else if(res.ok&&!body.hasSession){
        try{localStorage.removeItem(SESSION_KEY)}catch(_){}
        if(body.hasUser)document.getElementById('login')?.classList.remove('hide');
      }
    }catch(_){}
    return out;
  };
})();
