(function(){
  const SESSION_KEY='orcafacil_active_session_v1';
  const baseLogout=window.logout;

  function clearSession(){
    try{localStorage.removeItem(SESSION_KEY)}catch(_){}
    try{sessionStorage.removeItem(SESSION_KEY)}catch(_){}
  }

  window.logout=function(){
    const lastLogin=window.auth?.login||'admin';
    clearSession();
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

  // Captura o clique antes do manipulador genérico do menu, garantindo que
  // o botão Sair nunca seja tratado como uma opção de navegação.
  document.addEventListener('click',function(e){
    const button=e.target.closest?.('.sideLogout');
    if(!button)return;
    e.preventDefault();
    e.stopImmediatePropagation();
    window.logout();
  },true);
})();
