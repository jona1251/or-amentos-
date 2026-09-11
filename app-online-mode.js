(function(){
  const CHECK_MS=20000;
  const TIMEOUT_MS=7000;
  let timer=null;
  let lastState='unknown';
  let checking=false;

  function getPill(){
    let el=document.getElementById('cloudState');
    if(!el){
      const host=document.querySelector('.topActions');
      if(!host)return null;
      el=document.createElement('span');
      el.id='cloudState';
      host.prepend(el);
    }
    el.classList.add('connectionPill');
    return el;
  }

  function setState(state,text){
    const el=getPill();
    if(!el)return;
    el.dataset.state=state;
    el.textContent=text;
    el.title=state==='online'?'Servidor e banco de dados conectados':state==='sync'?'Sincronizando dados com a nuvem':'Os dados continuam disponíveis neste dispositivo';
    window.orcaConnectionState=state;
  }

  async function pingServer(){
    if(checking)return lastState;
    checking=true;
    try{
      if(navigator.onLine===false){
        setState('offline','🟠 Modo local');
        lastState='offline';
        return lastState;
      }
      const controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),TIMEOUT_MS);
      let res;
      try{
        res=await fetch('/api/health',{method:'GET',cache:'no-store',headers:{'Accept':'application/json'},signal:controller.signal});
      }finally{clearTimeout(timeout)}
      let body={};try{body=await res.json()}catch(_){}
      if(res.ok&&body.ok){
        const wasOffline=lastState==='offline';
        lastState='online';
        setState('online','🟢 Online');
        if(wasOffline&&window.auth?.pinHash){
          setState('sync','🔄 Sincronizando');
          try{await window.cloudAfterLogin?.()}catch(_){}
          setState('online','🟢 Online');
        }
        return lastState;
      }
      lastState='offline';
      setState('offline','🟠 Modo local');
      return lastState;
    }catch(_){
      lastState='offline';
      setState('offline','🟠 Modo local');
      return lastState;
    }finally{checking=false}
  }

  window.checkOrcaConnection=pingServer;
  window.setOrcaConnectionState=setState;

  window.addEventListener('online',()=>{setState('sync','🔄 Reconectando');pingServer()});
  window.addEventListener('offline',()=>{lastState='offline';setState('offline','🟠 Modo local')});

  const style=document.createElement('style');
  style.textContent=`
    #cloudState.connectionPill{display:inline-flex!important;align-items:center;justify-content:center;min-height:36px;padding:8px 11px!important;border-radius:999px!important;font-size:11px!important;font-weight:900!important;white-space:nowrap;border:1px solid #dfe4ea!important;box-shadow:0 2px 8px rgba(15,23,42,.04)}
    #cloudState.connectionPill[data-state="online"]{color:#067647!important;background:#ecfdf3!important;border-color:#ccebdc!important}
    #cloudState.connectionPill[data-state="sync"]{color:#92400e!important;background:#fffbeb!important;border-color:#fde68a!important}
    #cloudState.connectionPill[data-state="offline"]{color:#9a3412!important;background:#fff7ed!important;border-color:#fed7aa!important}
    @media(max-width:700px){#cloudState.connectionPill{display:inline-flex!important;min-height:32px;padding:6px 9px!important;font-size:10px!important}.topActions{gap:7px!important}}
    @media(max-width:390px){#cloudState.connectionPill{max-width:112px;overflow:hidden;text-overflow:ellipsis}}
  `;
  document.head.appendChild(style);

  setTimeout(()=>pingServer(),250);
  timer=setInterval(pingServer,CHECK_MS);
  window.addEventListener('beforeunload',()=>{if(timer)clearInterval(timer)},{once:true});
})();
