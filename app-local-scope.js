(function(){
  const DATA_STORES=new Set(['settings','clients','products','budgets','contracts']);
  const raw={
    all:window.localAll,
    get:window.localGet,
    put:window.localPut,
    del:window.localDel
  };
  if(!raw.all||!raw.get||!raw.put||!raw.del)return;

  const MIGRATION_PREFIX='orcafacil_scoped_storage_v1_';
  const migrationTasks=new Map();
  let scopeTransition=Promise.resolve();

  const clean=v=>String(v||'').trim().toLowerCase().replace(/[^a-z0-9._:-]/g,'_').slice(0,120)||'local';
  function scopeFromAuth(a){
    if(a?.serverId)return 'user:'+clean(a.serverId);
    if(a)return 'login:'+clean(a.login||'admin');
    return 'local';
  }
  async function resolveScope(){
    if(window.auth)return scopeFromAuth(window.auth);
    try{
      const saved=await raw.get('auth','admin');
      if(saved)return scopeFromAuth(saved);
    }catch(_){}
    return 'local';
  }
  const physicalId=(scope,id)=>scope+'::'+String(id);
  function encode(scope,record){
    const logicalId=String(record?.id||'');
    return {...record,id:physicalId(scope,logicalId),__orcaScope:scope,__orcaLocalId:logicalId};
  }
  function decode(record){
    if(!record)return record;
    const out={...record};
    if(out.__orcaLocalId!=null)out.id=out.__orcaLocalId;
    delete out.__orcaScope;delete out.__orcaLocalId;
    return out;
  }

  async function moveScope(fromScope,toScope){
    if(!fromScope||!toScope||fromScope===toScope)return;
    for(const store of DATA_STORES){
      const rows=await raw.all(store);
      const mine=rows.filter(r=>r?.__orcaScope===fromScope);
      for(const row of mine){
        const logicalId=String(row.__orcaLocalId??row.id);
        const targetId=physicalId(toScope,logicalId);
        const existing=await raw.get(store,targetId);
        if(!existing)await raw.put(store,encode(toScope,decode(row)));
        await raw.del(store,row.id);
      }
    }
    try{localStorage.setItem(MIGRATION_PREFIX+toScope,'1')}catch(_){}
  }

  async function ensureLegacyMigrated(scope){
    if(migrationTasks.has(scope))return migrationTasks.get(scope);
    const task=(async()=>{
      try{if(localStorage.getItem(MIGRATION_PREFIX+scope)==='1')return}catch(_){}
      for(const store of DATA_STORES){
        const rows=await raw.all(store);
        for(const row of rows){
          if(!row||row.__orcaScope)continue;
          const logicalId=String(row.id||'');
          if(!logicalId)continue;
          const targetId=physicalId(scope,logicalId);
          const existing=await raw.get(store,targetId);
          if(!existing)await raw.put(store,encode(scope,row));
          await raw.del(store,logicalId);
        }
      }
      try{localStorage.setItem(MIGRATION_PREFIX+scope,'1')}catch(_){}
    })();
    migrationTasks.set(scope,task);
    try{await task}finally{migrationTasks.set(scope,Promise.resolve())}
  }

  async function scopedAll(store){
    if(!DATA_STORES.has(store))return raw.all(store);
    await scopeTransition;
    const scope=await resolveScope();
    await ensureLegacyMigrated(scope);
    const rows=await raw.all(store);
    return rows.filter(r=>r?.__orcaScope===scope).map(decode);
  }
  async function scopedGet(store,id){
    if(!DATA_STORES.has(store))return raw.get(store,id);
    await scopeTransition;
    const scope=await resolveScope();
    await ensureLegacyMigrated(scope);
    return decode(await raw.get(store,physicalId(scope,id)));
  }
  async function scopedPut(store,record){
    if(!DATA_STORES.has(store))return raw.put(store,record);
    if(!record?.id)throw new Error('LOCAL_ID_REQUIRED');
    await scopeTransition;
    const scope=await resolveScope();
    await ensureLegacyMigrated(scope);
    await raw.put(store,encode(scope,record));
    return record;
  }
  async function scopedDel(store,id){
    if(!DATA_STORES.has(store))return raw.del(store,id);
    await scopeTransition;
    const scope=await resolveScope();
    await ensureLegacyMigrated(scope);
    return raw.del(store,physicalId(scope,id));
  }

  window.localAll=scopedAll;window.localGet=scopedGet;window.localPut=scopedPut;window.localDel=scopedDel;
  window.all=scopedAll;window.get=scopedGet;
  window.put=function(store,record){return scopedPut(store,record).then(v=>{window.cloudAfterPut?.(store,record);return v})};
  window.del=function(store,id){return scopedDel(store,id).then(v=>{window.cloudAfterDelete?.(store,id);return v})};

  const originalSetAuth=window.setAppAuth;
  if(typeof originalSetAuth==='function'){
    window.setAppAuth=function(next){
      const previous=window.auth?{...window.auth}:null;
      const from=scopeFromAuth(previous);
      const to=scopeFromAuth(next);
      originalSetAuth(next);
      const firstIdentity=!previous&&!!next;
      const upgradedIdentity=!!previous&&!!next&&!previous.serverId&&!!next.serverId&&clean(previous.login||'admin')===clean(next.login||'admin');
      if((firstIdentity||upgradedIdentity)&&from!==to){
        scopeTransition=scopeTransition.then(()=>moveScope(from,to)).catch(err=>console.warn('Migração do espaço local:',err));
      }
      return next;
    };
  }

  window.orcaLocalScopeInfo=async function(){
    await scopeTransition;
    const scope=await resolveScope();
    const counts={};
    for(const store of DATA_STORES)counts[store]=(await scopedAll(store)).length;
    return {scope,counts,isolated:true};
  };
})();
