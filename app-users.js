(function(){
  const loginRoot = document.getElementById('login');
  if (loginRoot) {
    loginRoot.innerHTML = `
      <div class="authShell">
        <aside class="authHero">
          <div class="authHeroBrand">
            <div class="logo authHeroLogo" id="loginLogo">OF</div>
            <div><b>OrçaFácil Pro</b><span>Gestão comercial</span></div>
          </div>
          <div class="authHeroCopy">
            <span class="authEyebrow">SEU NEGÓCIO, ORGANIZADO</span>
            <h1>Orçamentos e contratos em um só lugar.</h1>
            <p>Entre na sua conta para acessar clientes, produtos, propostas, contratos e dados sincronizados.</p>
            <div class="authBenefits">
              <div><i>✓</i><span><b>Dados sincronizados</b><small>Acesse de diferentes dispositivos.</small></span></div>
              <div><i>✓</i><span><b>Acesso por usuário</b><small>Cada pessoa entra com seu próprio PIN.</small></span></div>
              <div><i>✓</i><span><b>Modo local de segurança</b><small>O app continua disponível mesmo sem conexão.</small></span></div>
            </div>
          </div>
          <small class="authHeroFooter">OrçaFácil Pro • Gestão simples e profissional</small>
        </aside>
        <main class="authPanel">
          <div class="authCard">
            <div class="authMobileBrand"><div class="logo">OF</div><div><b>OrçaFácil Pro</b><small>Gestão comercial</small></div></div>
            <div id="setup">
              <span class="authTag">PRIMEIRO ACESSO</span>
              <h2>Crie o acesso administrador</h2>
              <p>Este será o usuário principal para configurar sua equipe.</p>
              <div class="authForm">
                <label>Seu nome<input id="setupName" autocomplete="name" placeholder="Ex.: Jonathan Silva"/></label>
                <label>Usuário<input id="setupLogin" autocomplete="username" placeholder="Ex.: jonathan" maxlength="30"/></label>
                <label>PIN de acesso<input id="setupPin" inputmode="numeric" autocomplete="new-password" type="password" maxlength="8" placeholder="4 a 8 números"/></label>
                <button class="btn primary authSubmit" onclick="createAccess()">Criar acesso</button>
              </div>
            </div>
            <div class="hide" id="enter">
              <span class="authTag">ACESSO SEGURO</span>
              <h2>Bem-vindo de volta</h2>
              <p id="hello">Entre para continuar no OrçaFácil Pro.</p>
              <div class="authForm">
                <label>Usuário<input id="loginUser" autocomplete="username" placeholder="Seu usuário"/></label>
                <label>PIN<input id="loginPin" inputmode="numeric" autocomplete="current-password" type="password" maxlength="8" placeholder="••••" onkeydown="if(event.key==='Enter')doLogin()"/></label>
                <button class="btn primary authSubmit" onclick="doLogin()">Entrar no OrçaFácil</button>
              </div>
              <div class="authHelp">Use o usuário e PIN cadastrados pelo administrador.</div>
            </div>
          </div>
        </main>
      </div>`;
  }

  const nav = document.getElementById('nav');
  const configButton = nav?.querySelector('[data-v="config"]');
  if (configButton && !document.getElementById('usersNav')) {
    configButton.insertAdjacentHTML('beforebegin', `<button data-v="usuarios" id="usersNav"><span class="navIcon">♟</span><span class="navText">Usuários</span></button>`);
  }

  const app = document.querySelector('.app');
  if (app && !document.getElementById('usuarios')) {
    app.insertAdjacentHTML('beforeend', `
      <section class="view" id="usuarios">
        <div class="usersTopGrid">
          <div class="card userCreateCard">
            <div class="sectionLead"><div><span class="eyebrow">Equipe</span><h3>Novo usuário</h3><p>Crie acessos individuais para quem utiliza o OrçaFácil.</p></div><span class="usersShield">Admin</span></div>
            <div class="grid">
              <label>Nome completo<input id="uName" placeholder="Ex.: Maria Souza"/></label>
              <label>Usuário de acesso<input id="uLogin" placeholder="Ex.: maria" maxlength="30"/></label>
              <label>E-mail opcional<input id="uEmail" type="email" placeholder="maria@empresa.com"/></label>
              <label>Perfil<select id="uRole"><option value="operador">Operador</option><option value="admin">Administrador</option></select></label>
              <label>PIN de 4 a 8 números<input id="uPin" type="password" inputmode="numeric" maxlength="8" placeholder="••••"/></label>
              <label>Confirmar PIN<input id="uPin2" type="password" inputmode="numeric" maxlength="8" placeholder="••••"/></label>
            </div>
            <div class="row" style="margin-top:14px"><button class="btn primary" onclick="createNewUser()">+ Criar usuário</button><button class="btn soft" onclick="clearUserForm()">Limpar</button></div>
          </div>
          <div class="card usersInfoCard">
            <span class="eyebrow">Controle de acesso</span>
            <h3>Perfis de usuário</h3>
            <div class="permissionBox"><b>Administrador</b><p>Acesso completo e permissão para cadastrar ou remover usuários.</p></div>
            <div class="permissionBox"><b>Operador</b><p>Pode usar clientes, produtos, orçamentos e contratos, mas não gerencia usuários.</p></div>
            <div class="usersCounter"><span>Usuários cadastrados</span><strong id="usersCount">0</strong></div>
          </div>
        </div>
        <div class="card">
          <div class="sectionLead"><div><span class="eyebrow">Acessos</span><h3>Usuários cadastrados</h3><p>Gerencie quem pode acessar o sistema.</p></div><button class="btn soft" onclick="loadUsers()">↻ Atualizar</button></div>
          <div class="list userList" id="usersList"><span class="muted">Carregando usuários...</span></div>
        </div>
      </section>`);
  }

  const style = document.createElement('style');
  style.textContent = `
    .login{padding:0;background:#f4f6fa;overflow:auto}.authShell{min-height:100vh;width:100%;display:grid;grid-template-columns:minmax(420px,.95fr) minmax(480px,1.05fr);background:#f5f7fb}.authHero{position:relative;overflow:hidden;background:linear-gradient(145deg,#091423 0%,#101d31 60%,#172b46 100%);color:#fff;padding:42px 54px;display:flex;flex-direction:column;justify-content:space-between;min-height:100vh}.authHero:before{content:"";position:absolute;width:420px;height:420px;border-radius:50%;right:-190px;top:-130px;background:rgba(255,255,255,.055)}.authHero:after{content:"";position:absolute;width:300px;height:300px;border-radius:50%;left:-140px;bottom:60px;background:rgba(79,70,229,.12)}.authHero>*{position:relative;z-index:1}.authHeroBrand{display:flex;align-items:center;gap:14px}.authHeroBrand b{display:block;font-size:20px}.authHeroBrand span{display:block;color:#9fb0c8;font-size:12px;margin-top:3px}.authHeroLogo{width:52px;height:52px;border-radius:16px}.authHeroCopy{max-width:540px;margin:auto 0}.authEyebrow{display:inline-block;font-size:11px;font-weight:900;letter-spacing:.12em;color:#b8c7dc;margin-bottom:20px}.authHeroCopy h1{font-size:46px;line-height:1.06;letter-spacing:-.045em;margin:0 0 20px;max-width:520px}.authHeroCopy>p{font-size:16px;line-height:1.7;color:#b7c4d5;max-width:520px;margin:0 0 34px}.authBenefits{display:grid;gap:18px}.authBenefits>div{display:flex;gap:13px;align-items:flex-start}.authBenefits i{font-style:normal;width:27px;height:27px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.1);color:#d9fbe8;font-weight:900;flex:0 0 auto}.authBenefits b{display:block;font-size:13px}.authBenefits small{display:block;color:#91a4bd;margin-top:3px;line-height:1.4}.authHeroFooter{color:#7f93ad}.authPanel{display:grid;place-items:center;padding:42px;background:radial-gradient(circle at 80% 15%,#fff 0,#f5f7fb 48%)}.authCard{width:min(470px,100%);background:#fff;border:1px solid #e4e8ef;border-radius:26px;padding:36px 38px;box-shadow:0 24px 70px rgba(15,23,42,.10)}.authCard h2{margin:9px 0 8px;font-size:28px;letter-spacing:-.03em;color:#101827}.authCard>div>p{margin:0 0 24px;color:#7a8493;line-height:1.5}.authTag{display:inline-flex;padding:6px 9px;border-radius:999px;background:#f3f5f8;color:#526071;font-size:9px;font-weight:900;letter-spacing:.08em}.authForm{display:grid;gap:15px}.authForm label{font-size:12px}.authForm input{min-height:48px;background:#fbfcfe}.authSubmit{width:100%;min-height:50px;margin-top:3px}.authHelp{text-align:center;color:#98a2b2;font-size:11px;margin-top:18px}.authMobileBrand{display:none}.usersTopGrid{display:grid;grid-template-columns:1.35fr .65fr;gap:18px}.usersInfoCard{display:flex;flex-direction:column}.usersShield{font-size:10px;font-weight:900;background:#edf7f1;color:#067647;padding:6px 9px;border-radius:999px}.permissionBox{border:1px solid #e7eaf0;background:#fbfcfe;border-radius:14px;padding:14px;margin-top:11px}.permissionBox b{font-size:13px}.permissionBox p{margin:5px 0 0;color:#7a8493;font-size:12px;line-height:1.5}.usersCounter{margin-top:auto;padding-top:22px;display:flex;align-items:end;justify-content:space-between}.usersCounter span{color:#7a8493;font-size:12px}.usersCounter strong{font-size:34px;letter-spacing:-.04em}.userRow{display:flex;align-items:center;justify-content:space-between;gap:16px;border:1px solid #e7eaf0;border-radius:15px;padding:14px 15px}.userIdentity{display:flex;align-items:center;gap:12px;min-width:0}.userAvatar{width:42px;height:42px;border-radius:50%;background:#eef2f7;color:#142238;display:grid;place-items:center;font-weight:900;flex:0 0 auto}.userMeta{min-width:0}.userMeta b{display:block;color:#172033}.userMeta small{display:block;color:#7d8796;margin-top:3px;overflow:hidden;text-overflow:ellipsis}.userRole{display:inline-flex;margin-left:7px;font-size:9px;font-weight:900;padding:4px 7px;border-radius:999px;background:#f1f4f8;color:#526071;vertical-align:middle}.userRole.admin{background:#eef2ff;color:#4338ca}.userCurrent{font-size:9px;font-weight:900;color:#067647;background:#ecfdf3;padding:4px 7px;border-radius:999px;margin-left:6px}.userActions{display:flex;gap:8px}.userActions .btn{padding:9px 11px;font-size:11px}
    @media(max-width:900px){.authShell{grid-template-columns:1fr}.authHero{display:none}.authPanel{min-height:100vh;padding:22px}.authMobileBrand{display:flex;align-items:center;gap:11px;margin-bottom:26px}.authMobileBrand .logo{width:44px;height:44px}.authMobileBrand b{display:block}.authMobileBrand small{display:block;color:#8a94a4;margin-top:2px}.usersTopGrid{grid-template-columns:1fr}.usersInfoCard{min-height:auto}.usersCounter{margin-top:18px}}
    @media(max-width:600px){.authPanel{padding:14px}.authCard{padding:24px 20px;border-radius:20px}.authCard h2{font-size:24px}.userRow{align-items:flex-start;flex-direction:column}.userActions{width:100%}.userActions .btn{flex:1}}
  `;
  document.head.appendChild(style);

  function normalizeLogin(v){return String(v||'').trim().toLowerCase();}
  function authHeaders(){return {'Content-Type':'application/json','x-orca-auth':window.auth?.pinHash||'','x-orca-user':window.auth?.login||'admin'};}
  async function usersRequest(url, options={}){
    const res=await fetch(url,{...options,headers:{...authHeaders(),...(options.headers||{})}});
    let body={};try{body=await res.json()}catch(_){}
    if(!res.ok){const e=new Error(body.error||('HTTP_'+res.status));e.status=res.status;throw e}return body;
  }
  function friendlyError(code){return ({LOGIN_TAKEN:'Este usuário de acesso já existe.',INVALID_LOGIN:'Use de 3 a 30 caracteres: letras, números, ponto, traço ou _.',ADMIN_ONLY:'Somente administradores podem gerenciar usuários.',CANNOT_DELETE_SELF:'Você não pode excluir o usuário que está conectado.',LAST_ADMIN:'É necessário manter pelo menos um administrador.',DATABASE_NOT_CONNECTED:'A nuvem ainda não está conectada.'})[code]||'Não foi possível concluir esta ação.';}

  window.clearUserForm=function(){['uName','uLogin','uEmail','uPin','uPin2'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=''});const role=document.getElementById('uRole');if(role)role.value='operador'};
  window.loadUsers=async function(){
    const list=document.getElementById('usersList');
    if(!list)return;
    if((window.auth?.role||'admin')!=='admin'){list.innerHTML='<span class="muted">Somente administradores podem visualizar usuários.</span>';return}
    list.innerHTML='<span class="muted">Carregando usuários...</span>';
    try{
      const r=await usersRequest('/api/users');
      document.getElementById('usersCount').textContent=r.users?.length||0;
      list.innerHTML=(r.users||[]).map(u=>{
        const current=String(u.id)===String(r.currentUserId);
        const initial=(u.name||'U').charAt(0).toUpperCase();
        return `<div class="userRow"><div class="userIdentity"><div class="userAvatar">${initial}</div><div class="userMeta"><b>${window.esc?esc(u.name):u.name}<span class="userRole ${u.role==='admin'?'admin':''}">${u.role==='admin'?'Administrador':'Operador'}</span>${current?'<span class="userCurrent">Você</span>':''}</b><small>@${window.esc?esc(u.login):u.login}${u.email?' • '+(window.esc?esc(u.email):u.email):''}</small></div></div><div class="userActions"><button class="btn soft" onclick="resetUserPin('${u.id}','${String(u.name||'Usuário').replace(/'/g,"&#39;")}')">Novo PIN</button>${current?'':`<button class="btn danger" onclick="removeUser('${u.id}','${String(u.name||'Usuário').replace(/'/g,"&#39;")}')">Excluir</button>`}</div></div>`;
      }).join('')||'<span class="muted">Nenhum usuário cadastrado.</span>';
    }catch(e){list.innerHTML='<span class="muted">Não foi possível carregar os usuários. Verifique a conexão com a nuvem.</span>';window.toast?.(friendlyError(e.message))}
  };
  window.createNewUser=async function(){
    const name=document.getElementById('uName').value.trim();
    const login=normalizeLogin(document.getElementById('uLogin').value);
    const email=document.getElementById('uEmail').value.trim();
    const role=document.getElementById('uRole').value;
    const pin=document.getElementById('uPin').value;
    const pin2=document.getElementById('uPin2').value;
    if(!name)return window.toast?.('Informe o nome do usuário');
    if(!/^[a-z0-9._-]{3,30}$/.test(login))return window.toast?.('Informe um usuário válido');
    if(!/^[0-9]{4,8}$/.test(pin))return window.toast?.('O PIN deve ter de 4 a 8 números');
    if(pin!==pin2)return window.toast?.('Os PINs não são iguais');
    try{
      await usersRequest('/api/users',{method:'POST',body:JSON.stringify({name,login,email,role,pinHash:await window.hash(pin)})});
      window.clearUserForm();await window.loadUsers();window.toast?.('Usuário criado com sucesso');
    }catch(e){window.toast?.(friendlyError(e.message))}
  };
  window.resetUserPin=async function(id,name){
    const pin=prompt('Digite o novo PIN para '+name+' (4 a 8 números):');
    if(pin===null)return;if(!/^[0-9]{4,8}$/.test(pin))return window.toast?.('O PIN deve ter de 4 a 8 números');
    try{await usersRequest('/api/users',{method:'PATCH',body:JSON.stringify({id,pinHash:await window.hash(pin)})});window.toast?.('PIN atualizado com sucesso')}catch(e){window.toast?.(friendlyError(e.message))}
  };
  window.removeUser=async function(id,name){
    if(!confirm('Excluir o acesso de '+name+'?'))return;
    try{await usersRequest('/api/users?id='+encodeURIComponent(id),{method:'DELETE'});await window.loadUsers();window.toast?.('Usuário excluído')}catch(e){window.toast?.(friendlyError(e.message))}
  };

  window.refreshUserAccessUI=function(){
    const role=window.auth?.role||'admin';
    const usersNav=document.getElementById('usersNav');if(usersNav)usersNav.style.display=role==='admin'?'':'none';
    const sideSmall=document.querySelector('.adminMini small');if(sideSmall)sideSmall.textContent=role==='admin'?'Administrador':'Operador';
    const loginInput=document.getElementById('loginUser');if(loginInput&&!loginInput.value&&window.auth?.login)loginInput.value=window.auth.login;
  };

  const baseGo=window.go;
  window.go=function(v){
    if(v==='usuarios'&&(window.auth?.role||'admin')!=='admin')return window.toast?.('Acesso disponível apenas para administradores');
    baseGo(v);
    if(v==='usuarios'){
      const title=document.getElementById('pageTitle');const sub=document.getElementById('pageSubtitle');
      if(title)title.textContent='Usuários';if(sub)sub.textContent='Crie e gerencie os acessos da sua equipe.';
      window.loadUsers();
    }
  };

  window.createAccess=async function(){
    const name=document.getElementById('setupName').value.trim();
    const login=normalizeLogin(document.getElementById('setupLogin').value);
    const pin=document.getElementById('setupPin').value;
    if(!name)return window.toast?.('Informe seu nome');
    if(!/^[a-z0-9._-]{3,30}$/.test(login))return window.toast?.('Use um usuário com 3 a 30 caracteres');
    if(!/^[0-9]{4,8}$/.test(pin))return window.toast?.('O PIN deve ter de 4 a 8 números');
    const next={id:'admin',name,login,role:'admin',pinHash:await window.hash(pin)};
    window.setAppAuth?.(next);await window.localPut('auth',next);
    document.getElementById('setup').classList.add('hide');document.getElementById('enter').classList.remove('hide');
    document.getElementById('hello').textContent='Olá, '+name+'. Entre para continuar.';document.getElementById('loginUser').value=login;
    window.syncAdminSide?.();window.refreshUserAccessUI();window.cloudAfterLogin?.();window.toast?.('Acesso administrador criado');
  };

  window.doLogin=async function(){
    const login=normalizeLogin(document.getElementById('loginUser')?.value||window.auth?.login||'admin');
    const pin=document.getElementById('loginPin')?.value||'';
    if(!login||!pin)return window.toast?.('Informe usuário e PIN');
    if(window.cloudLoginByPin){const ok=await window.cloudLoginByPin(pin,login,true);if(ok)return}
    const localLogin=normalizeLogin(window.auth?.login||'admin');
    if(window.auth&&localLogin===login&&await window.hash(pin)===window.auth.pinHash){document.getElementById('login').classList.add('hide');document.getElementById('loginPin').value='';window.refreshUserAccessUI();window.cloudAfterLogin?.();return}
    window.toast?.(window.cloudLastLoginError==='INVALID_CREDENTIALS'?'Usuário ou PIN incorreto':'Não foi possível entrar. Confira usuário, PIN e conexão.');
  };

  window.logout=function(){
    document.getElementById('login')?.classList.remove('hide');
    const p=document.getElementById('loginPin');if(p)p.value='';
    const u=document.getElementById('loginUser');if(u)u.value=window.auth?.login||'';
    document.getElementById('enter')?.classList.remove('hide');document.getElementById('setup')?.classList.add('hide');
  };

  const previousCloudAfterInit=window.cloudAfterInit;
  window.cloudAfterInit=async function(){
    if(previousCloudAfterInit)await previousCloudAfterInit();
    const user=document.getElementById('loginUser');if(user&&!user.value&&window.auth?.login)user.value=window.auth.login;
    window.refreshUserAccessUI();
  };
})();
