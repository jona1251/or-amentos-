(function(){
  const POLL_MS=20000;
  let timer=null;
  let visibleForPrimary=false;
  let current=[];
  let unread=0;

  async function request(method='GET',body){
    const res=await fetch('/api/notifications',{
      method,
      headers:{'Content-Type':'application/json'},
      credentials:'same-origin',
      body:body?JSON.stringify(body):undefined,
      cache:'no-store'
    });
    let data={};try{data=await res.json()}catch(_){}
    if(!res.ok){const e=new Error(data.error||('HTTP_'+res.status));e.status=res.status;throw e}
    return data;
  }

  function ensureUI(){
    let btn=document.getElementById('loginNotifyButton');
    if(!btn){
      const host=document.querySelector('.topActions');
      if(host){
        btn=document.createElement('button');
        btn.id='loginNotifyButton';
        btn.type='button';
        btn.className='btn soft loginNotifyButton hide';
        btn.innerHTML='<span class="notifyBell">🔔</span><span class="notifyLabel">Acessos</span><span class="notifyBadge hide" id="loginNotifyBadge">0</span>';
        btn.onclick=togglePanel;
        host.prepend(btn);
      }
    }

    if(!document.getElementById('loginNotifyPanel')){
      const panel=document.createElement('div');
      panel.id='loginNotifyPanel';
      panel.className='loginNotifyPanel hide';
      panel.innerHTML=`
        <div class="notifyHead">
          <div><span class="eyebrow">Segurança</span><h3>Acessos de usuários</h3></div>
          <button class="notifyClose" type="button" onclick="closeLoginNotifyPanel()">×</button>
        </div>
        <div class="notifyToolbar">
          <span id="loginNotifySummary">Nenhuma notificação</span>
          <button class="btn soft notifyTiny" type="button" onclick="markAllLoginNotificationsRead()">Marcar como lidas</button>
        </div>
        <div id="loginNotifyPermission" class="notifyPermission hide"></div>
        <div id="loginNotifyList" class="notifyList"><span class="muted">Carregando...</span></div>`;
      document.body.appendChild(panel);
    }

    if(!document.getElementById('loginNotifyStyles')){
      const style=document.createElement('style');
      style.id='loginNotifyStyles';
      style.textContent=`
        .loginNotifyButton{position:relative;display:inline-flex;align-items:center;gap:6px}.loginNotifyButton.hide{display:none!important}.notifyBadge{min-width:19px;height:19px;border-radius:999px;background:#dc2626;color:#fff;font-size:10px;font-weight:900;display:inline-grid;place-items:center;padding:0 5px}.notifyBadge.hide{display:none}.loginNotifyPanel{position:fixed;z-index:100001;right:22px;top:78px;width:min(92vw,410px);max-height:min(72vh,640px);overflow:auto;background:#fff;border:1px solid #e4e8ef;border-radius:20px;box-shadow:0 26px 80px rgba(15,23,42,.22);padding:18px}.loginNotifyPanel.hide{display:none}.notifyHead{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;border-bottom:1px solid #edf0f4;padding-bottom:13px}.notifyHead h3{margin:5px 0 0;font-size:18px}.notifyClose{border:0;background:#f1f5f9;width:34px;height:34px;border-radius:50%;cursor:pointer;font-size:22px}.notifyToolbar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 0;font-size:11px;color:#64748b}.notifyTiny{padding:7px 9px!important;font-size:10px!important}.notifyList{display:grid;gap:9px}.notifyItem{border:1px solid #e7eaf0;border-radius:14px;padding:12px;background:#fff;cursor:pointer}.notifyItem.unread{background:#f5f8ff;border-color:#cfd8ff}.notifyItemTop{display:flex;justify-content:space-between;gap:12px}.notifyItem b{display:block;font-size:12px;color:#172033}.notifyItem p{margin:5px 0 0;font-size:12px;line-height:1.45;color:#526071}.notifyItem small{display:block;margin-top:7px;color:#8a94a4;font-size:10px}.notifyPermission{padding:10px 11px;background:#fffbeb;border:1px solid #fde68a;color:#92400e;border-radius:12px;font-size:11px;margin-bottom:10px}.notifyPermission.hide{display:none}.notifyPermission button{margin-top:7px}.notifyDot{width:8px;height:8px;border-radius:50%;background:#4f46e5;flex:0 0 auto;margin-top:4px}@media(max-width:700px){.loginNotifyPanel{left:12px;right:12px;top:70px;width:auto;max-height:76vh}.notifyLabel{display:none}}
      `;
      document.head.appendChild(style);
    }
  }

  function fmtDate(v){
    if(!v)return '';
    try{return new Date(v).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}catch(_){return String(v)}
  }

  function escapeHtml(v){
    return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  }

  function shortDevice(ua){
    const s=String(ua||'');
    if(!s)return '';
    if(/Android/i.test(s))return 'Android';
    if(/iPhone|iPad/i.test(s))return 'iPhone/iPad';
    if(/Windows/i.test(s))return 'Windows';
    if(/Macintosh|Mac OS/i.test(s))return 'Mac';
    if(/Linux/i.test(s))return 'Linux';
    return 'Navegador';
  }

  function render(){
    ensureUI();
    const btn=document.getElementById('loginNotifyButton');
    if(btn)btn.classList.toggle('hide',!visibleForPrimary);
    const badge=document.getElementById('loginNotifyBadge');
    if(badge){badge.textContent=String(Math.min(unread,99));badge.classList.toggle('hide',unread<1)}
    const summary=document.getElementById('loginNotifySummary');
    if(summary)summary.textContent=unread?`${unread} não lida${unread===1?'':'s'}`:'Tudo lido';
    const list=document.getElementById('loginNotifyList');
    if(list){
      list.innerHTML=current.length?current.map(n=>{
        const details=n.details||{};
        const device=shortDevice(details.userAgent);
        const meta=[fmtDate(n.createdAt),device,details.ip?`IP ${details.ip}`:''].filter(Boolean).join(' • ');
        return `<div class="notifyItem ${n.readAt?'':'unread'}" onclick="markLoginNotificationRead('${escapeHtml(n.id)}')"><div class="notifyItemTop"><div style="display:flex;gap:8px"><span class="notifyDot" style="${n.readAt?'opacity:.18':''}"></span><div><b>${escapeHtml(n.title||'Novo acesso')}</b><p>${escapeHtml(n.message||'')}</p><small>${escapeHtml(meta)}</small></div></div></div></div>`;
      }).join(''):'<span class="muted">Nenhum acesso novo registrado.</span>';
    }
    renderPermission();
  }

  function renderPermission(){
    const el=document.getElementById('loginNotifyPermission');if(!el)return;
    if(!('Notification' in window)||Notification.permission==='granted')return el.classList.add('hide');
    if(Notification.permission==='denied'){
      el.innerHTML='As notificações do navegador estão bloqueadas. As notificações dentro do OrçaFácil continuam funcionando.';
      return el.classList.remove('hide');
    }
    el.innerHTML='Quer receber um aviso do navegador quando outro usuário entrar?<br><button class="btn soft notifyTiny" onclick="enableBrowserLoginNotifications()">Ativar notificações</button>';
    el.classList.remove('hide');
  }

  function maybeAlert(data){
    if(!data?.notifications?.length||!data.unread)return;
    const newest=data.notifications.find(n=>!n.readAt);if(!newest)return;
    const key='orcafacil_last_login_notification_'+String(window.auth?.login||'admin');
    const previous=localStorage.getItem(key);
    if(String(newest.id)===String(previous))return;
    localStorage.setItem(key,String(newest.id));
    window.toast?.(data.unread>1?`${data.unread} novos acessos de usuários`:newest.message||'Novo acesso de usuário');
    if('Notification' in window&&Notification.permission==='granted'&&document.visibilityState!=='visible'){
      try{new Notification('OrçaFácil Pro • Novo acesso',{body:newest.message||'Um usuário entrou no sistema.'})}catch(_){}
    }
  }

  async function load(){
    if(!window.auth){visibleForPrimary=false;render();return}
    try{
      const data=await request('GET');
      visibleForPrimary=!!data.isPrimaryAdmin;
      current=Array.isArray(data.notifications)?data.notifications:[];
      unread=Number(data.unread||0);
      render();
      maybeAlert(data);
    }catch(e){
      if(e.status===403){visibleForPrimary=false;current=[];unread=0;render();return}
      if(e.status===401){visibleForPrimary=false;render();return}
      console.warn('Login notifications:',e);
    }
  }

  function togglePanel(){
    const panel=document.getElementById('loginNotifyPanel');if(!panel)return;
    panel.classList.toggle('hide');
    if(!panel.classList.contains('hide'))load();
  }

  window.closeLoginNotifyPanel=()=>document.getElementById('loginNotifyPanel')?.classList.add('hide');
  window.markAllLoginNotificationsRead=async function(){
    try{await request('POST',{action:'mark_all_read'});await load()}catch(e){console.warn(e)}
  };
  window.markLoginNotificationRead=async function(id){
    const n=current.find(x=>String(x.id)===String(id));if(n)n.readAt=new Date().toISOString();
    unread=current.filter(x=>!x.readAt).length;render();
    try{await request('POST',{action:'mark_read',id});await load()}catch(e){console.warn(e)}
  };
  window.enableBrowserLoginNotifications=async function(){
    if(!('Notification' in window))return;
    try{await Notification.requestPermission()}catch(_){}
    renderPermission();
  };
  window.reloadLoginNotifications=load;

  document.addEventListener('click',e=>{
    const panel=document.getElementById('loginNotifyPanel');const btn=document.getElementById('loginNotifyButton');
    if(panel&&!panel.classList.contains('hide')&&!panel.contains(e.target)&&!btn?.contains(e.target))panel.classList.add('hide');
  });

  ensureUI();
  setTimeout(load,1500);
  timer=setInterval(load,POLL_MS);
  window.addEventListener('focus',()=>load());
  window.addEventListener('beforeunload',()=>{if(timer)clearInterval(timer)},{once:true});
})();
