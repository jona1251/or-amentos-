(function(){
  const SESSION_KEY='orcafacil_active_session_v1';
  const qs=(s,r=document)=>r.querySelector(s);
  const qsa=(s,r=document)=>[...r.querySelectorAll(s)];
  const currentAuth=()=>window.auth||null;

  function setSession(active){
    try{if(active)localStorage.setItem(SESSION_KEY,'1');else localStorage.removeItem(SESSION_KEY)}catch(_){}
  }
  function hasSession(){try{return localStorage.getItem(SESSION_KEY)==='1'}catch(_){return false}}
  function showLogin(show){const el=document.getElementById('login');if(el)el.classList.toggle('hide',!show)}

  const oldCreateAccess=window.createAccess;
  if(typeof oldCreateAccess==='function')window.createAccess=async function(){
    const result=await oldCreateAccess.apply(this,arguments);
    if(window.auth?.pinHash){setSession(true);showLogin(false)}
    return result;
  };

  const oldDoLogin=window.doLogin;
  if(typeof oldDoLogin==='function')window.doLogin=async function(){
    const result=await oldDoLogin.apply(this,arguments);
    if(window.auth?.pinHash && document.getElementById('login')?.classList.contains('hide')) setSession(true);
    return result;
  };

  const oldLogout=window.logout;
  window.logout=function(){
    setSession(false);
    document.body.classList.remove('mobile-menu-open');
    if(typeof oldLogout==='function')oldLogout.apply(this,arguments);
    else showLogin(true);
  };

  const oldCloudAfterInit=window.cloudAfterInit;
  window.cloudAfterInit=async function(){
    if(hasSession() && window.auth?.pinHash) showLogin(false);
    const out=typeof oldCloudAfterInit==='function' ? await oldCloudAfterInit.apply(this,arguments) : undefined;
    if(hasSession() && window.auth?.pinHash) {
      showLogin(false);
      verifyRememberedSession();
    }
    applyRoleUI();
    return out;
  };

  async function verifyRememberedSession(){
    const a=currentAuth();
    if(!a?.pinHash || !hasSession())return;
    try{
      const res=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'login',login:a.login||'admin',pinHash:a.pinHash})});
      if(res.status===401){setSession(false);showLogin(true);window.toast?.('Seu acesso foi alterado. Entre novamente.');return}
      if(!res.ok)return;
      const body=await res.json();
      if(body?.user){
        const next={...a,id:body.user.id||a.id,name:body.user.name||a.name,login:body.user.login||a.login||'admin',role:body.user.role||a.role||'admin'};
        window.setAppAuth?.(next);
        await window.localPut?.('auth',{...next,id:'admin'});
        window.syncAdminSide?.();
        applyRoleUI();
      }
    }catch(_){}
  }

  function applyRoleUI(){
    const isAdmin=(window.auth?.role||'admin')==='admin';
    const nav=document.getElementById('usersNav');
    if(nav)nav.style.display=isAdmin?'':'none';
    const usersView=document.getElementById('usuarios');
    if(!isAdmin && usersView?.classList.contains('on')) window.go?.('painel');
  }
  window.applyRoleUI=applyRoleUI;

  const authCard=qs('.authCard');
  if(authCard && !qs('.authSessionNote',authCard)){
    const note=document.createElement('div');
    note.className='authSessionNote';
    note.innerHTML='<span>✓</span><div><b>Sessão persistente</b><small>Ao atualizar a página, você continuará conectado neste dispositivo até clicar em Sair.</small></div>';
    authCard.appendChild(note);
  }
  const heroCopy=qs('.authHeroCopy');
  if(heroCopy && !qs('.authPreview',heroCopy)){
    const preview=document.createElement('div');
    preview.className='authPreview';
    preview.innerHTML='<div class="authPreviewTop"><span>ORC-0248</span><b>Aprovado</b></div><strong>R$ 1.850,00</strong><small>Proposta pronta para enviar</small><div class="authPreviewBars"><i></i><i></i><i></i></div>';
    const benefits=qs('.authBenefits',heroCopy);
    if(benefits)heroCopy.insertBefore(preview,benefits); else heroCopy.appendChild(preview);
  }
  qsa('#setupPin,#loginPin').forEach(input=>{
    if(input.parentElement?.classList.contains('pinWrap'))return;
    const wrap=document.createElement('span');wrap.className='pinWrap';
    input.parentNode.insertBefore(wrap,input);wrap.appendChild(input);
    const btn=document.createElement('button');btn.type='button';btn.className='pinToggle';btn.setAttribute('aria-label','Mostrar ou ocultar PIN');btn.textContent='◉';
    btn.addEventListener('click',()=>{input.type=input.type==='password'?'text':'password';btn.classList.toggle('on',input.type==='text')});
    wrap.appendChild(btn);
  });

  const top=qs('.top');
  const nav=document.getElementById('nav');
  if(top && !document.getElementById('mobileMenuBtn')){
    const btn=document.createElement('button');btn.type='button';btn.id='mobileMenuBtn';btn.className='mobileMenuBtn noPrint';btn.setAttribute('aria-label','Abrir menu');btn.innerHTML='<span></span><span></span><span></span>';
    top.insertBefore(btn,top.firstChild);
    btn.addEventListener('click',()=>document.body.classList.toggle('mobile-menu-open'));
  }
  if(nav && !qs('.mobileMenuClose',nav)){
    const close=document.createElement('div');close.className='mobileMenuClose';close.setAttribute('role','button');close.setAttribute('tabindex','0');close.setAttribute('aria-label','Fechar menu');close.textContent='×';
    close.addEventListener('click',()=>document.body.classList.remove('mobile-menu-open'));
    close.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')document.body.classList.remove('mobile-menu-open')});
    nav.prepend(close);
  }
  if(!document.getElementById('mobileMenuBackdrop')){
    const back=document.createElement('div');back.id='mobileMenuBackdrop';back.className='mobileMenuBackdrop noPrint';back.addEventListener('click',()=>document.body.classList.remove('mobile-menu-open'));document.body.appendChild(back);
  }
  nav?.addEventListener('click',e=>{if(e.target.closest('button[data-v]') && window.matchMedia('(max-width:980px)').matches)document.body.classList.remove('mobile-menu-open')});
  window.addEventListener('keydown',e=>{if(e.key==='Escape')document.body.classList.remove('mobile-menu-open')});
  window.addEventListener('resize',()=>{if(window.innerWidth>980)document.body.classList.remove('mobile-menu-open')});

  function headers(){return {'Content-Type':'application/json','x-orca-auth':window.auth?.pinHash||'','x-orca-user':window.auth?.login||'admin'};}
  async function request(url,options={}){
    const res=await fetch(url,{...options,headers:{...headers(),...(options.headers||{})}});
    let body={};try{body=await res.json()}catch(_){}
    if(!res.ok){const e=new Error(body.error||('HTTP_'+res.status));e.status=res.status;throw e}return body;
  }
  const friendly=code=>({LOGIN_TAKEN:'Este usuário de acesso já existe.',INVALID_LOGIN:'Use de 3 a 30 caracteres: letras, números, ponto, traço ou _.',INVALID_EMAIL:'Informe um e-mail válido.',NAME_REQUIRED:'Informe o nome do usuário.',ADMIN_ONLY:'Somente administradores podem gerenciar usuários.',LAST_ADMIN:'É necessário manter pelo menos um administrador.',DATABASE_NOT_CONNECTED:'A nuvem ainda não está conectada.'})[code]||'Não foi possível salvar as alterações.';
  const make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!=null)el.textContent=text;return el};

  if(!document.getElementById('userEditModal')){
    const modal=document.createElement('div');modal.id='userEditModal';modal.className='userEditModal hide';
    modal.innerHTML=`<div class="userEditBackdrop" data-close-user-modal></div><div class="userEditDialog" role="dialog" aria-modal="true" aria-labelledby="userEditTitle"><div class="userEditHeader"><div><span class="eyebrow">Acesso</span><h3 id="userEditTitle">Editar usuário</h3><p>Altere os dados, o perfil ou defina um novo PIN.</p></div><button type="button" class="userEditX" data-close-user-modal>×</button></div><input type="hidden" id="editUserId"><div class="grid userEditGrid"><label>Nome completo<input id="editUserName"></label><label>Usuário de acesso<input id="editUserLogin" maxlength="30"></label><label>E-mail<input id="editUserEmail" type="email"></label><label>Perfil<select id="editUserRole"><option value="operador">Operador</option><option value="admin">Administrador</option></select></label><label>Novo PIN <small class="fieldHint">deixe vazio para manter</small><input id="editUserPin" type="password" inputmode="numeric" maxlength="8" placeholder="4 a 8 números"></label><label>Confirmar novo PIN<input id="editUserPin2" type="password" inputmode="numeric" maxlength="8" placeholder="Repita o novo PIN"></label></div><div class="userEditActions"><button type="button" class="btn soft" data-close-user-modal>Cancelar</button><button type="button" class="btn primary" id="saveUserEditBtn">Salvar alterações</button></div></div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click',e=>{if(e.target.closest('[data-close-user-modal]'))modal.classList.add('hide')});
    document.getElementById('saveUserEditBtn').addEventListener('click',saveUserEdit);
  }

  window.openUserEdit=function(id){
    const u=(window.__orcaUsers||[]).find(x=>String(x.id)===String(id));if(!u)return;
    document.getElementById('editUserId').value=u.id;
    document.getElementById('editUserName').value=u.name||'';
    document.getElementById('editUserLogin').value=u.login||'';
    document.getElementById('editUserEmail').value=u.email||'';
    document.getElementById('editUserRole').value=u.role==='admin'?'admin':'operador';
    document.getElementById('editUserPin').value='';document.getElementById('editUserPin2').value='';
    document.getElementById('userEditModal').classList.remove('hide');
    setTimeout(()=>document.getElementById('editUserName')?.focus(),40);
  };

  async function saveUserEdit(){
    const id=document.getElementById('editUserId').value;
    const name=document.getElementById('editUserName').value.trim();
    const login=document.getElementById('editUserLogin').value.trim().toLowerCase();
    const email=document.getElementById('editUserEmail').value.trim();
    const role=document.getElementById('editUserRole').value;
    const pin=document.getElementById('editUserPin').value;
    const pin2=document.getElementById('editUserPin2').value;
    if(!name)return window.toast?.('Informe o nome do usuário');
    if(!/^[a-z0-9._-]{3,30}$/.test(login))return window.toast?.('Informe um usuário válido');
    if(pin && !/^[0-9]{4,8}$/.test(pin))return window.toast?.('O novo PIN deve ter de 4 a 8 números');
    if(pin!==pin2)return window.toast?.('Os novos PINs não conferem');
    const payload={id,name,login,email,role};if(pin)payload.pinHash=await window.hash(pin);
    const btn=document.getElementById('saveUserEditBtn');btn.disabled=true;btn.textContent='Salvando...';
    try{
      const r=await request('/api/users',{method:'PATCH',body:JSON.stringify(payload)});
      if(r.currentUser && r.user){
        const next={...window.auth,name:r.user.name,login:r.user.login,role:r.user.role};
        if(payload.pinHash)next.pinHash=payload.pinHash;
        window.setAppAuth?.(next);
        await window.localPut?.('auth',{...next,id:'admin'});
        window.syncAdminSide?.();
        applyRoleUI();
      }
      document.getElementById('userEditModal').classList.add('hide');
      window.toast?.('Usuário atualizado com sucesso');
      if((window.auth?.role||'admin')==='admin')await window.loadUsers(); else window.go?.('painel');
    }catch(e){window.toast?.(friendly(e.message))}finally{btn.disabled=false;btn.textContent='Salvar alterações'}
  }

  window.loadUsers=async function(){
    const list=document.getElementById('usersList');if(!list)return;
    if((window.auth?.role||'admin')!=='admin'){list.replaceChildren(make('span','muted','Somente administradores podem visualizar usuários.'));return}
    list.replaceChildren(make('span','muted','Carregando usuários...'));
    try{
      const r=await request('/api/users');window.__orcaUsers=r.users||[];window.__orcaCurrentUserId=r.currentUserId;
      const counter=document.getElementById('usersCount');if(counter)counter.textContent=String(window.__orcaUsers.length);
      list.replaceChildren();
      if(!window.__orcaUsers.length){list.append(make('span','muted','Nenhum usuário cadastrado.'));return}
      window.__orcaUsers.forEach(u=>{
        const current=String(u.id)===String(r.currentUserId);
        const row=make('div','userRow');
        const identity=make('div','userIdentity');
        identity.append(make('div','userAvatar',(u.name||'U').charAt(0).toUpperCase()));
        const meta=make('div','userMeta');
        const title=make('b','',u.name||'Usuário');
        title.append(make('span','userRole '+(u.role==='admin'?'admin':''),u.role==='admin'?'Administrador':'Operador'));
        if(current)title.append(make('span','userCurrent','Você'));
        meta.append(title,make('small','',`@${u.login||''}${u.email?' • '+u.email:''}`));identity.append(meta);row.append(identity);
        const actions=make('div','userActions');
        const edit=make('button','btn soft','Editar');edit.type='button';edit.addEventListener('click',()=>window.openUserEdit(u.id));actions.append(edit);
        if(!current){const del=make('button','btn danger','Excluir');del.type='button';del.addEventListener('click',()=>window.removeUser?.(u.id));actions.append(del)}
        row.append(actions);list.append(row);
      });
    }catch(e){list.replaceChildren(make('span','muted','Não foi possível carregar os usuários. Verifique a conexão com a nuvem.'));window.toast?.(friendly(e.message))}
  };

  const originalGo=window.go;
  if(typeof originalGo==='function')window.go=function(v){const out=originalGo.apply(this,arguments);if(v==='usuarios')setTimeout(()=>window.loadUsers?.(),0);return out};

  const style=document.createElement('style');
  style.textContent=`
    .authCard{position:relative;overflow:hidden}.authCard:before{content:"";position:absolute;left:0;right:0;top:0;height:4px;background:linear-gradient(90deg,#f4b95f,#f3897b,#7069df)}
    .authPreview{width:min(360px,100%);margin:0 0 30px;padding:16px 17px;border:1px solid rgba(255,255,255,.13);border-radius:17px;background:rgba(255,255,255,.07);box-shadow:0 18px 50px rgba(0,0,0,.12);backdrop-filter:blur(10px)}.authPreviewTop{display:flex;justify-content:space-between;align-items:center}.authPreviewTop span{font-size:10px;font-weight:850;color:#9fb0c8}.authPreviewTop b{font-size:9px;color:#b9f6d3;background:rgba(45,212,139,.12);padding:5px 7px;border-radius:999px}.authPreview>strong{display:block;font-size:25px;margin-top:13px;letter-spacing:-.035em}.authPreview>small{display:block;color:#9fb0c8;margin-top:3px}.authPreviewBars{display:flex;gap:5px;margin-top:15px}.authPreviewBars i{height:4px;border-radius:99px;background:rgba(255,255,255,.18);flex:1}.authPreviewBars i:first-child{flex:2;background:rgba(244,185,95,.8)}
    .authSessionNote{display:flex;gap:10px;align-items:flex-start;margin-top:22px;padding-top:18px;border-top:1px solid #edf0f4;color:#718096}.authSessionNote>span{width:25px;height:25px;border-radius:50%;display:grid;place-items:center;background:#ecfdf3;color:#067647;font-weight:900;flex:0 0 auto}.authSessionNote b{display:block;color:#3b4758;font-size:11px}.authSessionNote small{display:block;margin-top:3px;line-height:1.45;font-size:10px}
    .pinWrap{position:relative;display:block}.pinWrap input{padding-right:48px}.pinToggle{position:absolute;right:8px;top:50%;transform:translateY(-50%);width:34px;height:34px;border:0;border-radius:9px;background:#f1f4f8;color:#8993a2;font-weight:900}.pinToggle.on{background:#e9edff;color:#4f46e5}
    .mobileMenuBtn,.mobileMenuClose,.mobileMenuBackdrop{display:none}
    .userEditModal{position:fixed;inset:0;z-index:300;display:grid;place-items:center;padding:18px}.userEditBackdrop{position:absolute;inset:0;background:rgba(5,13,25,.58);backdrop-filter:blur(3px)}.userEditDialog{position:relative;width:min(650px,100%);max-height:min(88vh,760px);overflow:auto;background:#fff;border:1px solid #e6e9ef;border-radius:24px;padding:26px;box-shadow:0 28px 80px rgba(0,0,0,.24)}.userEditHeader{display:flex;justify-content:space-between;gap:18px;margin-bottom:20px}.userEditHeader h3{font-size:22px;margin:7px 0 5px;letter-spacing:-.02em}.userEditHeader p{margin:0;color:#7b8493;font-size:12px}.userEditX{width:38px;height:38px;border:1px solid #e2e6ed;background:#fff;border-radius:11px;font-size:23px;line-height:1;color:#526071}.fieldHint{font-weight:500;color:#9aa3b1}.userEditActions{display:flex;justify-content:flex-end;gap:9px;margin-top:20px;padding-top:18px;border-top:1px solid #edf0f4}
    @media(max-width:980px){
      body.mobile-menu-open{overflow:hidden}.app{padding:18px 15px 34px!important}.top{display:grid!important;grid-template-columns:auto minmax(0,1fr) auto;align-items:center!important;gap:10px!important;max-width:none!important;margin-bottom:18px!important}.mobileMenuBtn{display:inline-flex;width:44px;height:44px;border:1px solid #e1e5ec;border-radius:13px;background:#fff;align-items:center;justify-content:center;flex-direction:column;gap:4px;box-shadow:0 5px 18px rgba(15,23,42,.06)}.mobileMenuBtn span{width:18px;height:2px;border-radius:9px;background:#172033}.pageTitle{min-width:0}.pageTitle h1{font-size:20px!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pageTitle small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.topActions{gap:6px!important}.topActions .btn{min-height:44px!important}.topActions #cloudState{display:none!important}
      .nav{display:flex!important;position:fixed!important;left:0!important;right:auto!important;top:0!important;bottom:0!important;width:min(86vw,320px)!important;height:100dvh!important;border-radius:0 24px 24px 0!important;padding:20px 14px 18px!important;flex-direction:column!important;align-items:stretch!important;justify-content:flex-start!important;gap:7px!important;overflow-y:auto!important;overflow-x:hidden!important;transform:translateX(-105%);transition:transform .24s ease;z-index:220!important;box-shadow:18px 0 60px rgba(5,15,31,.28)!important}.mobile-menu-open .nav{transform:translateX(0)}.nav .sideBrand{display:flex!important;padding-right:42px!important}.nav .sideSpacer{display:block!important;flex:1!important;min-height:20px}.nav .sideFooter{display:block!important}.nav button[data-v]{min-width:0!important;width:100%!important;justify-content:flex-start!important;flex-direction:row!important;gap:12px!important;padding:13px 14px!important}.nav .navText{display:inline!important;max-width:none!important;font-size:14px!important}.nav .navIcon{font-size:15px!important}.mobileMenuClose{display:grid;place-items:center;position:absolute;right:15px;top:24px;width:34px;height:34px;border-radius:10px;background:rgba(255,255,255,.07);color:#d8e1ee;font-size:25px;line-height:1;z-index:2;cursor:pointer}.mobileMenuBackdrop{display:block;position:fixed;inset:0;background:rgba(5,12,23,.48);backdrop-filter:blur(2px);z-index:210;opacity:0;visibility:hidden;transition:.2s}.mobile-menu-open .mobileMenuBackdrop{opacity:1;visibility:visible}
      .usersTopGrid{grid-template-columns:1fr!important}.card{margin-bottom:14px}.dashboardGrid{grid-template-columns:1fr!important}.grid4{grid-template-columns:repeat(2,minmax(0,1fr))!important}
    }
    @media(max-width:700px){
      .app{padding:14px 12px 30px!important}.top{position:sticky;top:0;z-index:80;margin-left:-12px!important;margin-right:-12px!important;padding:10px 12px;background:rgba(245,247,251,.92);backdrop-filter:blur(13px);border-bottom:1px solid rgba(226,231,239,.9)}.pageTitle small{font-size:10px!important}.topActions>.btn.primary{width:44px;min-width:44px;padding:0!important;font-size:0}.topActions>.btn.primary:before{content:"+";font-size:22px;line-height:1}.grid4{grid-template-columns:1fr 1fr!important;gap:10px!important}.metricCard{min-height:104px!important;padding:15px!important;gap:10px!important}.metricIcon{width:38px!important;height:38px!important;border-radius:12px!important}.metricCard .tot{font-size:22px!important}.moneyMetric{font-size:17px!important}.quickGrid{grid-template-columns:1fr!important}.settingsGrid{grid-template-columns:1fr!important}.fullCard{grid-column:auto!important}.userEditModal{padding:10px;align-items:end}.userEditDialog{max-height:92vh;border-radius:22px 22px 16px 16px;padding:20px 16px}.userEditGrid{grid-template-columns:1fr!important}.userEditActions{position:sticky;bottom:-20px;background:#fff;padding-bottom:4px}.userEditActions .btn{flex:1}
      .login{background:linear-gradient(155deg,#07111f 0%,#101d31 50%,#1a2e49 100%)!important}.authPanel{min-height:100dvh!important;padding:max(18px,env(safe-area-inset-top)) 14px max(18px,env(safe-area-inset-bottom))!important;background:radial-gradient(circle at 85% 8%,rgba(244,185,95,.18),transparent 28%),radial-gradient(circle at 8% 88%,rgba(99,102,241,.18),transparent 32%),transparent!important;align-items:center!important}.authCard{padding:24px 19px 20px!important;border-radius:24px!important;border-color:rgba(255,255,255,.15)!important;box-shadow:0 25px 70px rgba(0,0,0,.28)!important}.authMobileBrand{margin-bottom:20px!important;padding-bottom:18px;border-bottom:1px solid #edf0f4}.authMobileBrand .logo{width:48px!important;height:48px!important;border-radius:15px!important}.authMobileBrand b{font-size:16px}.authCard h2{font-size:25px!important}.authForm{gap:13px!important}.authForm input{min-height:52px!important;border-radius:13px!important;background:#f8fafc!important}.authSubmit{min-height:52px!important;border-radius:13px!important}.authSessionNote{margin-top:18px}.authTag{background:#eef2ff!important;color:#4338ca!important}.authHelp{margin-top:15px!important}
    }
    @media(max-width:390px){.grid4{grid-template-columns:1fr!important}.pageTitle small{display:none}.top{grid-template-columns:auto 1fr auto}.authCard{padding:21px 16px 18px!important}.authCard h2{font-size:23px!important}.userActions{width:100%}.userActions .btn{flex:1}}
  `;
  document.head.appendChild(style);
})();