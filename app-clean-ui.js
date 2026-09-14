(function(){
  const $=id=>document.getElementById(id);
  let routeSeq=0;
  let loginAnimating=false;
  let welcomeTimer=null;
  let lastActiveView='';
  const reduceMotion=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  function installStyles(){
    if($('cleanUiStyles'))return;
    const s=document.createElement('style');s.id='cleanUiStyles';s.textContent=`
      html{scroll-behavior:smooth}body{overflow-x:hidden}.app{transition:opacity .18s ease,filter .18s ease}.app.uiSoftLoading{opacity:.82;filter:saturate(.94)}
      .top{position:relative}.top:after{content:"";position:absolute;left:0;right:0;bottom:-13px;height:1px;background:linear-gradient(90deg,transparent,#e7ebf1 12%,#e7ebf1 88%,transparent)}
      .pageTitle h1{letter-spacing:-.035em}.pageTitle small{line-height:1.4}.card{box-shadow:0 8px 28px rgba(15,23,42,.045);transition:border-color .18s ease,box-shadow .18s ease,transform .18s ease}.card:hover{border-color:#dfe4eb}.view{opacity:1}.view.uiViewEnter{animation:cleanViewIn .22s cubic-bezier(.2,.75,.25,1)}
      @keyframes cleanViewIn{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}
      #uiRouteBar{position:fixed;z-index:350;left:264px;right:0;top:0;height:2px;pointer-events:none;opacity:0;overflow:hidden;transition:opacity .12s}#uiRouteBar:before{content:"";display:block;width:34%;height:100%;background:linear-gradient(90deg,#4f46e5,#7c3aed);transform:translateX(-110%)}body.uiNavigating #uiRouteBar{opacity:1}body.uiNavigating #uiRouteBar:before{animation:routeSweep .42s ease-out forwards}@keyframes routeSweep{to{transform:translateX(310%)}}
      .login{transition:opacity .24s ease,visibility .24s ease;background:radial-gradient(circle at 15% 20%,rgba(99,102,241,.14),transparent 34%),linear-gradient(135deg,#07111f,#132238 62%,#1a2b46)}.login.uiLoginLeave{opacity:0;visibility:hidden}.login.uiLoginEnter{animation:loginFade .22s ease both}@keyframes loginFade{from{opacity:0}to{opacity:1}}
      .cleanLoginShell{width:min(940px,96vw);display:grid;grid-template-columns:minmax(0,1.1fr) minmax(340px,.9fr);border-radius:28px;overflow:hidden;box-shadow:0 38px 100px rgba(0,0,0,.34);background:#fff}.cleanLoginAside{padding:42px;background:linear-gradient(145deg,#0f1d31,#172943);color:#fff;display:flex;flex-direction:column;justify-content:space-between;min-height:500px;position:relative;overflow:hidden}.cleanLoginAside:before{content:"";position:absolute;width:300px;height:300px;border-radius:50%;right:-130px;top:-100px;background:rgba(99,102,241,.16);filter:blur(4px)}.cleanLoginAside:after{content:"";position:absolute;width:220px;height:220px;border-radius:50%;left:-110px;bottom:-120px;background:rgba(244,185,95,.12)}.cleanLoginBrand{display:flex;align-items:center;gap:12px;position:relative;z-index:1}.cleanLoginMark{width:46px;height:46px;border-radius:14px;display:grid;place-items:center;background:linear-gradient(145deg,#ffcc72,#f58e7d);color:#172033;font-weight:950}.cleanLoginBrand b{display:block;font-size:17px}.cleanLoginBrand small{display:block;color:#9fb0c8;margin-top:3px}.cleanLoginCopy{position:relative;z-index:1;margin:36px 0}.cleanLoginCopy .eyebrow{background:rgba(255,255,255,.08);color:#d7e2ef}.cleanLoginCopy h1{font-size:34px;line-height:1.08;margin:15px 0 12px;letter-spacing:-.045em;max-width:420px}.cleanLoginCopy p{color:#adbbcd;line-height:1.65;margin:0;max-width:440px}.cleanLoginBenefits{display:grid;gap:10px;margin-top:24px}.cleanLoginBenefit{display:flex;align-items:center;gap:10px;color:#dce6f2;font-size:12px}.cleanLoginBenefit span{width:28px;height:28px;border-radius:9px;background:rgba(255,255,255,.08);display:grid;place-items:center}.cleanLoginAsideFoot{position:relative;z-index:1;color:#8295ae;font-size:10px}.cleanLoginShell .loginbox{width:auto;max-width:none;border-radius:0;box-shadow:none;padding:40px 38px;display:flex;flex-direction:column;justify-content:center;min-height:500px}.cleanLoginShell .loginbox:before{display:none}.cleanAuthBadge{display:inline-flex;align-items:center;gap:7px;align-self:flex-start;padding:6px 9px;border-radius:999px;background:#f1f5f9;color:#475569;font-size:10px;font-weight:850;margin-bottom:18px}.cleanAuthBadge i{width:7px;height:7px;border-radius:50%;background:#22c55e}.cleanLoginShell .brand{margin-bottom:20px}.cleanLoginShell .loginbox p{line-height:1.5}.cleanLoginShell .loginbox .btn.primary{width:100%;min-height:46px;margin-top:4px}.cleanAuthHelp{margin-top:18px;padding-top:15px;border-top:1px solid #edf0f4;color:#8a94a4;font-size:10px;line-height:1.5}
      #adminEntrance{position:fixed;inset:0;z-index:340;display:grid;place-items:center;padding:18px;background:rgba(7,17,31,.56);backdrop-filter:blur(12px);opacity:0;pointer-events:none;transition:opacity .22s ease}#adminEntrance.on{opacity:1;pointer-events:auto}.adminEntranceCard{width:min(560px,94vw);background:#fff;border:1px solid rgba(255,255,255,.7);border-radius:26px;padding:28px;box-shadow:0 30px 90px rgba(2,10,23,.28);transform:translateY(12px) scale(.985);transition:transform .25s cubic-bezier(.2,.8,.2,1)}#adminEntrance.on .adminEntranceCard{transform:none}.adminEntranceTop{display:flex;align-items:center;gap:14px}.adminEntranceAvatar{width:54px;height:54px;border-radius:17px;display:grid;place-items:center;background:linear-gradient(145deg,#111827,#26364f);color:#fff;font-size:20px;font-weight:950;box-shadow:0 10px 25px rgba(15,23,42,.18)}.adminEntranceTop h2{margin:0;font-size:22px;letter-spacing:-.035em}.adminEntranceTop p{margin:4px 0 0;color:#7a8493;font-size:12px}.adminEntranceBadge{margin-left:auto;align-self:flex-start;background:#ecfdf3;color:#067647;border:1px solid #ccebdc;border-radius:999px;padding:6px 9px;font-size:9px;font-weight:900}.adminEntranceGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin:22px 0}.adminEntranceInfo{background:#f8fafc;border:1px solid #e7ebf0;border-radius:13px;padding:12px}.adminEntranceInfo small{display:block;color:#8a94a4;font-size:9px;text-transform:uppercase;letter-spacing:.04em}.adminEntranceInfo b{display:block;margin-top:5px;font-size:11px;color:#172033}.adminEntranceProgress{height:4px;border-radius:99px;background:#edf1f5;overflow:hidden}.adminEntranceProgress i{display:block;height:100%;width:0;background:linear-gradient(90deg,#4f46e5,#7c3aed);border-radius:99px}.adminEntranceProgress.run i{animation:adminLoad 1.05s ease forwards}@keyframes adminLoad{to{width:100%}}.adminEntranceFoot{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:13px;color:#7a8493;font-size:10px}.adminEntranceFoot button{border:0;background:transparent;color:#4338ca;font-weight:850;padding:5px 0}
      body.uiClean .item{box-shadow:none}body.uiClean .item:hover{box-shadow:0 7px 20px rgba(15,23,42,.04)}body.uiClean input,body.uiClean select,body.uiClean textarea{background:#fff;border-color:#dfe4ec}body.uiClean .sectionLead{margin-bottom:14px}body.uiClean .muted{line-height:1.45}
      @media(max-width:980px){#uiRouteBar{left:0}.cleanLoginShell{grid-template-columns:1fr;max-width:520px}.cleanLoginAside{display:none}.cleanLoginShell .loginbox{min-height:auto;border-radius:24px;padding:30px}.login{padding:14px}}
      @media(max-width:640px){.adminEntranceCard{padding:21px;border-radius:21px}.adminEntranceGrid{grid-template-columns:1fr}.adminEntranceBadge{display:none}.adminEntranceTop{align-items:flex-start}.cleanLoginShell .loginbox{padding:25px 20px}.card{box-shadow:0 5px 18px rgba(15,23,42,.04)}}
      @media(prefers-reduced-motion:reduce){.view.uiViewEnter,#uiRouteBar:before,.adminEntranceProgress.run i,.login.uiLoginEnter{animation:none!important}.card,.login,#adminEntrance,.adminEntranceCard{transition:none!important}}
    `;document.head.appendChild(s);
  }

  function installRouteBar(){if($('uiRouteBar'))return;const b=document.createElement('div');b.id='uiRouteBar';document.body.appendChild(b)}

  function enhanceLogin(){
    const login=$('login');const box=login?.querySelector('.loginbox');if(!login||!box||login.querySelector('.cleanLoginShell'))return;
    const shell=document.createElement('div');shell.className='cleanLoginShell';
    const aside=document.createElement('aside');aside.className='cleanLoginAside';
    aside.innerHTML=`<div class="cleanLoginBrand"><div class="cleanLoginMark">OF</div><div><b>OrçaFácil Pro</b><small>Gestão comercial inteligente</small></div></div><div class="cleanLoginCopy"><span class="eyebrow">ACESSO SEGURO</span><h1>Seu negócio organizado em um só lugar.</h1><p>Entre para acompanhar clientes, propostas, contratos, operações e resultados com uma experiência mais limpa e rápida.</p><div class="cleanLoginBenefits"><div class="cleanLoginBenefit"><span>✓</span>Dados separados por usuário</div><div class="cleanLoginBenefit"><span>↻</span>Sincronização com a nuvem</div><div class="cleanLoginBenefit"><span>⌘</span>Controle de acesso administrativo</div></div></div><div class="cleanLoginAsideFoot">OrçaFácil Pro • ambiente Premium de testes</div>`;
    login.insertBefore(shell,box);shell.append(aside,box);
    const badge=document.createElement('div');badge.className='cleanAuthBadge';badge.innerHTML='<i></i> Sessão protegida';box.insertBefore(badge,box.firstChild);
    const help=document.createElement('div');help.className='cleanAuthHelp';help.textContent='Use seu usuário e PIN. Contas com autenticação em duas etapas solicitarão o código do autenticador.';box.appendChild(help);
  }

  function installWelcome(){
    if($('adminEntrance'))return;
    const el=document.createElement('div');el.id='adminEntrance';
    el.innerHTML='<div class="adminEntranceCard"><div class="adminEntranceTop"><div class="adminEntranceAvatar" id="adminEntranceAvatar">A</div><div><h2 id="adminEntranceTitle">Acesso liberado</h2><p id="adminEntranceText">Preparando seu painel...</p></div><span class="adminEntranceBadge" id="adminEntranceBadge">ADMINISTRADOR</span></div><div class="adminEntranceGrid"><div class="adminEntranceInfo"><small>Perfil</small><b id="adminEntranceRole">Administrador</b></div><div class="adminEntranceInfo"><small>Acesso</small><b id="adminEntranceAccess">Todos os módulos</b></div><div class="adminEntranceInfo"><small>Status</small><b id="adminEntranceStatus">Conectado</b></div></div><div class="adminEntranceProgress" id="adminEntranceProgress"><i></i></div><div class="adminEntranceFoot"><span>Carregando sua área de trabalho com segurança.</span><button type="button" id="adminEntranceSkip">Entrar agora</button></div></div>';
    document.body.appendChild(el);$('adminEntranceSkip').onclick=hideWelcome;
  }

  function showWelcome(){
    const a=window.auth;if(!a)return;
    const el=$('adminEntrance');if(!el)return;
    if(Date.now()-Number(window.__cleanWelcomeAt||0)<1200)return;
    window.__cleanWelcomeAt=Date.now();
    clearTimeout(welcomeTimer);
    const admin=(a.role||'admin')==='admin';
    $('adminEntranceAvatar').textContent=String(a.name||'A').trim().charAt(0).toUpperCase()||'A';
    $('adminEntranceTitle').textContent=admin?'Bem-vindo ao painel administrativo':'Bem-vindo ao OrçaFácil';
    $('adminEntranceText').textContent=admin?`${a.name||'Administrador'}, seu ambiente de gestão está pronto.`:`${a.name||'Usuário'}, preparando suas ferramentas liberadas.`;
    $('adminEntranceRole').textContent=admin?'Administrador':'Operador';
    $('adminEntranceAccess').textContent=admin?'Acesso total':'Conforme permissões';
    $('adminEntranceStatus').textContent=navigator.onLine===false?'Modo local':'Nuvem online';
    $('adminEntranceBadge').textContent=admin?'ADMINISTRADOR':'USUÁRIO';
    $('adminEntranceBadge').style.display=admin?'':'none';
    const p=$('adminEntranceProgress');p.classList.remove('run');void p.offsetWidth;p.classList.add('run');
    el.classList.add('on');document.body.classList.add('uiSoftWelcome');
    if(reduceMotion())welcomeTimer=setTimeout(hideWelcome,450);else welcomeTimer=setTimeout(hideWelcome,1150);
  }
  window.showOrcaWelcome=showWelcome;

  function hideWelcome(){
    clearTimeout(welcomeTimer);$('adminEntrance')?.classList.remove('on');document.body.classList.remove('uiSoftWelcome');
    try{window.go?.('painel')}catch(_){}
  }

  function animateActiveView(){
    const active=document.querySelector('.view.on');if(!active)return;
    if(active.id===lastActiveView)return;
    lastActiveView=active.id;
    active.classList.remove('uiViewEnter');void active.offsetWidth;active.classList.add('uiViewEnter');
    setTimeout(()=>active.classList.remove('uiViewEnter'),280);
  }

  function normalizeScreen(){
    const ons=[...document.querySelectorAll('.view.on')];
    if(ons.length>1){const keep=ons[ons.length-1];ons.slice(0,-1).forEach(x=>x.classList.remove('on'));keep.classList.add('on')}
    document.body.classList.remove('mobile-menu-open');animateActiveView();
  }

  function wrapNavigation(){
    const original=window.go;if(typeof original!=='function'||original.__cleanUiWrapped)return;
    const wrapped=function(){
      const seq=++routeSeq;document.body.classList.add('uiNavigating');
      const out=original.apply(this,arguments);
      requestAnimationFrame(()=>{if(seq!==routeSeq)return;normalizeScreen();requestAnimationFrame(()=>document.body.classList.remove('uiNavigating'))});
      return out;
    };
    wrapped.__cleanUiWrapped=true;wrapped.__cleanUiOriginal=original;window.go=wrapped;
  }

  function wrapLoginFlow(){
    const cloud=window.cloudLoginByPin;
    if(typeof cloud==='function'&&!cloud.__cleanUiWrapped){
      const wrapped=async function(){const loginWasVisible=!$('login')?.classList.contains('hide');const ok=await cloud.apply(this,arguments);if(ok&&loginWasVisible)setTimeout(showWelcome,90);return ok};wrapped.__cleanUiWrapped=true;window.cloudLoginByPin=wrapped;
    }
    const oldDo=window.doLogin;
    if(typeof oldDo==='function'&&!oldDo.__cleanUiWrapped){
      const wrapped=async function(){const visible=!$('login')?.classList.contains('hide');const out=await oldDo.apply(this,arguments);if(visible&&$('login')?.classList.contains('hide'))setTimeout(showWelcome,100);return out};wrapped.__cleanUiWrapped=true;window.doLogin=wrapped;
    }
  }

  function watchLogin(){
    const login=$('login');if(!login||login.__cleanObserved)return;login.__cleanObserved=true;
    new MutationObserver(()=>{
      if(loginAnimating)return;
      if(login.classList.contains('hide')){
        loginAnimating=true;login.classList.remove('hide');login.classList.add('uiLoginLeave');
        setTimeout(()=>{login.classList.add('hide');login.classList.remove('uiLoginLeave');loginAnimating=false},reduceMotion()?0:230);
      }else if(!login.classList.contains('uiLoginLeave')){
        login.classList.add('uiLoginEnter');setTimeout(()=>login.classList.remove('uiLoginEnter'),260);
      }
    }).observe(login,{attributes:true,attributeFilter:['class']});
  }

  function watchViews(){
    const views=[...document.querySelectorAll('.view')];views.forEach(v=>new MutationObserver(()=>{if(v.classList.contains('on'))normalizeScreen()}).observe(v,{attributes:true,attributeFilter:['class']}));
  }

  function cleanTopActions(){
    const b=document.querySelector('.topActions .btn.primary');if(b){b.textContent='＋ Novo orçamento';b.setAttribute('aria-label','Criar novo orçamento')}
  }

  function periodic(){wrapNavigation();wrapLoginFlow();cleanTopActions()}
  function init(){
    document.body.classList.add('uiClean');installStyles();installRouteBar();enhanceLogin();installWelcome();wrapNavigation();wrapLoginFlow();watchLogin();watchViews();cleanTopActions();normalizeScreen();
    setInterval(periodic,2200);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,350));else setTimeout(init,350);
})();
