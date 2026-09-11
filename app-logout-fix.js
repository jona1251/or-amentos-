(function(){
  const SESSION_KEY='orcafacil_active_session_v1';
  const baseLogout=window.logout;

  function clearSession(){
    try{localStorage.removeItem(SESSION_KEY)}catch(_){}
    try{sessionStorage.removeItem(SESSION_KEY)}catch(_){}
  }

  function clearServerCookie(){
    try{
      fetch('/api/auth',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({action:'logout'}),
        credentials:'same-origin',
        keepalive:true
      }).catch(()=>{});
    }catch(_){}
  }

  window.logout=function(){
    const lastLogin=window.auth?.login||'admin';
    clearSession();
    clearServerCookie();
    document.body.classList.remove('mobile-menu-open');

    try{
      if(typeof baseLogout==='function')baseLogout.apply(this,arguments);
    }catch(_){}

    const login=document.getElementById('login');
    const setup=document.getElementById('setup');
    const enter=document.getElementById('enter');
    const user=document.getElementById('loginUser');
    const pin=document.getElementById('loginPin');

    if(login)login.classList.remove('hide');
    if(setup)setup.classList.add('hide');
    if(enter)enter.classList.remove('hide');
    if(user && !user.value)user.value=lastLogin;
    if(pin)pin.value='';

    setTimeout(()=>{
      if(login)login.classList.remove('hide');
      if(pin)pin.focus();
    },0);
  };

  document.addEventListener('click',function(e){
    const button=e.target.closest?.('.sideLogout');
    if(!button)return;
    e.preventDefault();
    e.stopImmediatePropagation();
    window.logout();
  },true);
})();
