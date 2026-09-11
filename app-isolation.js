(function(){
  const DATA_STORES=['settings','clients','products','budgets','contracts'];
  const SESSION_KEY='orcafacil_active_session_v1';

  async function captureActiveData(){
    const snap={};
    for(const store of DATA_STORES){
      try{snap[store]=await window.localAll(store)}catch(_){snap[store]=[]}
    }
    return snap;
  }

  async function clearActiveData(){
    for(const store of DATA_STORES){
      let rows=[];try{rows=await window.localAll(store)}catch(_){}
      for(const row of rows){if(row?.id)await window.localDel(store,row.id)}
    }
  }

  async function restoreActiveData(snapshot){
    await clearActiveData();
    for(const store of DATA_STORES){
      for(const row of (snapshot?.[store]||[])){if(row?.id)await window.localPut(store,row)}
    }
    const restored=(snapshot?.settings||[])[0]||{id:'main',companyName:'',companyDoc:'',companyOwner:'',companyPhone:'',companyEmail:'',companyAddress:'',companyCity:'',companyLogo:'',companySlogan:'',pixKey:'',budgetPrefix:'ORC',budgetSeq:1,contractPrefix:'CTR',contractSeq:1};
    window.setAppSettings?.(restored);
    await window.refresh?.();
    window.fillSettings?.();
    window.applyLogoUI?.();
  }

  async function pullForCurrentUser(){
    const res=await fetch('/api/data',{
      method:'GET',
      headers:{
        'Content-Type':'application/json',
        'x-orca-auth':window.auth?.pinHash||'',
        'x-orca-user':window.auth?.login||'admin'
      }
    });
    let body={};try{body=await res.json()}catch(_){}
    if(!res.ok)throw new Error(body.error||('HTTP_'+res.status));
    const data=body.data||{};
    for(const store of DATA_STORES){
      const rows=Array.isArray(data[store])?data[store]:[];
      for(const row of rows){if(row?.id)await window.localPut(store,row)}
    }
    const nextSettings=(data.settings||[])[0]||{id:'main',companyName:'',companyDoc:'',companyOwner:'',companyPhone:'',companyEmail:'',companyAddress:'',companyCity:'',companyLogo:'',companySlogan:'',pixKey:'',budgetPrefix:'ORC',budgetSeq:1,contractPrefix:'CTR',contractSeq:1};
    window.setAppSettings?.(nextSettings);
    await window.refresh?.();
    window.fillSettings?.();
    window.applyLogoUI?.();
  }

  window.cloudLoginByPin=async function(pin,login='admin',silent=false){
    const normalizedLogin=String(login||'admin').trim().toLowerCase();
    if(!/^[a-z0-9._-]{3,30}$/.test(normalizedLogin)){
      if(!silent)window.toast?.('Informe um usuário válido');
      return false;
    }
    if(!/^[0-9]{4,8}$/.test(String(pin||''))){
      if(!silent)window.toast?.('Informe seu PIN de 4 a 8 números');
      return false;
    }

    const oldAuth=window.auth?{...window.auth}:null;
    const oldData=await captureActiveData();
    const pinHash=await window.hash(pin);
    try{
      const authRes=await fetch('/api/auth',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({action:'login',login:normalizedLogin,pinHash})
      });
      let authBody={};try{authBody=await authRes.json()}catch(_){}
      if(!authRes.ok)throw new Error(authBody.error||('HTTP_'+authRes.status));

      document.body.classList.add('switching-user');
      await clearActiveData();
      const newAuth={
        id:'admin',
        serverId:authBody.user?.id||null,
        name:authBody.user?.name||'Usuário',
        login:authBody.user?.login||normalizedLogin,
        role:authBody.user?.role||'operador',
        pinHash
      };
      window.setAppAuth?.(newAuth);
      await window.localPut('auth',newAuth);
      await pullForCurrentUser();

      const loginEl=document.getElementById('login');
      if(loginEl)loginEl.classList.add('hide');
      const pinEl=document.getElementById('loginPin');if(pinEl)pinEl.value='';
      try{localStorage.setItem(SESSION_KEY,'1')}catch(_){}
      window.syncAdminSide?.();
      window.refreshUserAccessUI?.();
      window.applyRoleUI?.();
      return true;
    }catch(e){
      await restoreActiveData(oldData);
      window.setAppAuth?.(oldAuth);
      if(oldAuth)await window.localPut('auth',{...oldAuth,id:'admin'});
      window.syncAdminSide?.();
      if(!silent)window.toast?.(e.message==='INVALID_CREDENTIALS'?'Usuário ou PIN incorreto':'Não foi possível carregar os dados deste usuário');
      return false;
    }finally{
      document.body.classList.remove('switching-user');
    }
  };

  const style=document.createElement('style');
  style.textContent=`
    body.switching-user:after{content:'Carregando seu espaço...';position:fixed;inset:0;z-index:99999;background:rgba(9,20,35,.94);color:#fff;display:grid;place-items:center;font-size:14px;font-weight:850;letter-spacing:.01em}
  `;
  document.head.appendChild(style);
})();
