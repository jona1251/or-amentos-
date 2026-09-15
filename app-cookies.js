(function(){
  const LAST_USER='orca_last_user';
  const NOTICE='orca_cookie_notice';
  const DAYS_365=60*60*24*365;

  function getCookie(name){
    const prefix=name+'=';
    const item=document.cookie.split(';').map(x=>x.trim()).find(x=>x.startsWith(prefix));
    if(!item)return '';
    try{return decodeURIComponent(item.slice(prefix.length))}catch(_){return item.slice(prefix.length)}
  }
  function setCookie(name,value,maxAge=DAYS_365){
    const secure=location.protocol==='https:'?'; Secure':'';
    document.cookie=`${name}=${encodeURIComponent(value)}; Path=/; SameSite=Lax${secure}; Max-Age=${maxAge}`;
  }
  function deleteCookie(name){
    const secure=location.protocol==='https:'?'; Secure':'';
    document.cookie=`${name}=; Path=/; SameSite=Lax${secure}; Max-Age=0`;
  }
  window.orcaCookies={get:getCookie,set:setCookie,remove:deleteCookie};

  function rememberUser(){
    const login=String(window.auth?.login||document.getElementById('loginUser')?.value||'').trim().toLowerCase();
    if(login)setCookie(LAST_USER,login);
  }

  const baseCloudLogin=window.cloudLoginByPin;
  if(typeof baseCloudLogin==='function'){
    window.cloudLoginByPin=async function(){
      const ok=await baseCloudLogin.apply(this,arguments);
      if(ok)rememberUser();
      return ok;
    };
  }

  const baseCreate=window.createAccess;
  if(typeof baseCreate==='function'){
    window.createAccess=async function(){
      const out=await baseCreate.apply(this,arguments);
      if(window.auth)rememberUser();
      return out;
    };
  }

  function prefillLastUser(){
    const input=document.getElementById('loginUser');
    const last=getCookie(LAST_USER);
    if(input && last && !input.value)input.value=last;
  }

  function addCookieNotice(){
    if(getCookie(NOTICE)==='1'||document.getElementById('cookieNotice'))return;
    const el=document.createElement('div');
    el.id='cookieNotice';
    el.className='cookieNotice';
    el.innerHTML=`<div class="cookieIcon">◉</div><div class="cookieCopy"><b>Cookies essenciais</b><span>Usamos cookies para manter sua sessão ativa e lembrar o último usuário neste dispositivo. Seus clientes, produtos, orçamentos e contratos continuam armazenados no banco de dados, não nos cookies.</span></div><button type="button" class="btn primary" id="cookieOk">Entendi</button>`;
    document.body.appendChild(el);
    document.getElementById('cookieOk')?.addEventListener('click',()=>{setCookie(NOTICE,'1');el.remove()});
  }

  function addCookieSettings(){
    const settings=document.getElementById('config');
    const grid=settings?.querySelector('.settingsGrid');
    if(!grid||document.getElementById('cookieSettingsCard'))return;
    const card=document.createElement('div');
    card.id='cookieSettingsCard';
    card.className='card fullCard';
    card.innerHTML=`<div class="sectionLead"><div><span class="eyebrow">Privacidade</span><h3>Cookies e sessão</h3><p>Gerencie os cookies funcionais usados neste dispositivo.</p></div><span class="cookieStatus">Essenciais</span></div><div class="cookieSettingsRows"><div><b>Cookie de sessão</b><small>Protegido e HttpOnly. Mantém sua conta conectada até você sair ou a sessão expirar.</small></div><div><b>Último usuário</b><small>Usado somente para preencher o campo de usuário na tela de login.</small></div></div><div class="row" style="margin-top:14px"><button type="button" class="btn danger" id="clearCookiesBtn">Apagar cookies deste dispositivo</button></div>`;
    grid.appendChild(card);
    document.getElementById('clearCookiesBtn')?.addEventListener('click',()=>{
      if(!confirm('Apagar os cookies e sair da sua conta neste dispositivo?'))return;
      deleteCookie(LAST_USER);deleteCookie(NOTICE);
      window.logout?.();
      window.toast?.('Cookies removidos deste dispositivo');
    });
  }

  const style=document.createElement('style');
  style.textContent=`
    .cookieNotice{position:fixed;left:22px;right:22px;bottom:22px;z-index:99998;max-width:900px;margin:auto;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:14px;padding:15px 16px;background:rgba(255,255,255,.97);border:1px solid #e2e7ef;border-radius:18px;box-shadow:0 22px 65px rgba(15,23,42,.18);backdrop-filter:blur(14px)}
    .cookieIcon{width:40px;height:40px;border-radius:13px;background:#111827;color:#fff;display:grid;place-items:center;font-weight:900}.cookieCopy{display:grid;gap:3px}.cookieCopy b{font-size:13px}.cookieCopy span{color:#6f7a8b;font-size:11.5px;line-height:1.45}.cookieNotice .btn{white-space:nowrap}
    .cookieStatus{font-size:10px;font-weight:900;padding:6px 9px;border-radius:999px;background:#ecfdf3;color:#067647}.cookieSettingsRows{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.cookieSettingsRows>div{border:1px solid #e7eaf0;border-radius:14px;padding:14px;background:#fbfcfe}.cookieSettingsRows b{display:block;font-size:12px}.cookieSettingsRows small{display:block;color:#7b8493;line-height:1.45;margin-top:4px}
    @media(max-width:650px){.cookieNotice{left:12px;right:12px;bottom:12px;grid-template-columns:auto 1fr;padding:13px;border-radius:16px}.cookieNotice .btn{grid-column:1/-1;width:100%}.cookieSettingsRows{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  prefillLastUser();
  addCookieNotice();
  addCookieSettings();
  setTimeout(()=>{prefillLastUser();addCookieSettings();if(window.auth?.login)rememberUser()},300);
})();
