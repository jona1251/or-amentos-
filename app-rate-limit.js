(function(){
  let cooldownTimer=null;

  function loginButton(){return document.querySelector('#enter .authSubmit')}
  function formatTime(seconds){
    const total=Math.max(0,Math.ceil(Number(seconds||0)));
    const m=Math.floor(total/60),s=total%60;
    return m>0?`${m}:${String(s).padStart(2,'0')}`:`${s}s`;
  }
  function startCooldown(seconds){
    let left=Math.max(1,Math.ceil(Number(seconds||1)));
    const btn=loginButton();
    const user=document.getElementById('loginUser');
    const pin=document.getElementById('loginPin');
    if(cooldownTimer)clearInterval(cooldownTimer);
    const draw=()=>{
      if(btn){btn.disabled=true;btn.textContent=`Tente novamente em ${formatTime(left)}`;btn.style.opacity='.72';btn.style.cursor='not-allowed'}
      if(user)user.setAttribute('aria-disabled','true');
      if(pin)pin.setAttribute('aria-disabled','true');
      left--;
      if(left<0){
        clearInterval(cooldownTimer);cooldownTimer=null;
        if(btn){btn.disabled=false;btn.textContent='Entrar no OrçaFácil';btn.style.opacity='';btn.style.cursor=''}
        user?.removeAttribute('aria-disabled');pin?.removeAttribute('aria-disabled');
      }
    };
    draw();cooldownTimer=setInterval(draw,1000);
  }
  window.startLoginCooldown=startCooldown;

  window.doLogin=async function(){
    const login=String(document.getElementById('loginUser')?.value||window.auth?.login||'admin').trim().toLowerCase();
    const pin=document.getElementById('loginPin')?.value||'';
    if(!login||!pin)return window.toast?.('Informe usuário e PIN');
    if(!/^[a-z0-9._-]{3,30}$/.test(login))return window.toast?.('Informe um usuário válido');
    if(!/^[0-9]{4,8}$/.test(pin))return window.toast?.('Informe seu PIN de 4 a 8 números');

    window.cloudLastLoginError=null;
    window.cloudRetryAfter=0;
    window.cloudAttemptsRemaining=null;

    if(window.cloudLoginByPin){
      const ok=await window.cloudLoginByPin(pin,login,true);
      if(ok)return;

      if(window.cloudLastLoginError==='RATE_LIMITED'){
        const retry=Math.max(1,Number(window.cloudRetryAfter||1));
        startCooldown(retry);
        return window.toast?.(window.formatLoginRateLimit?.(retry)||'Muitas tentativas. Aguarde antes de tentar novamente.');
      }

      if(window.cloudLastLoginError==='INVALID_CREDENTIALS'){
        const remain=Number(window.cloudAttemptsRemaining);
        if(Number.isFinite(remain)&&remain>0)return window.toast?.(`Usuário ou PIN incorreto. Restam ${remain} tentativa${remain===1?'':'s'}.`);
        return window.toast?.('Usuário ou PIN incorreto');
      }
    }

    // O fallback local só é usado quando a nuvem está realmente indisponível.
    // Respostas de credencial inválida ou rate limit nunca podem ser contornadas localmente.
    const localLogin=String(window.auth?.login||'admin').trim().toLowerCase();
    if(window.auth&&localLogin===login&&await window.hash(pin)===window.auth.pinHash){
      document.getElementById('login')?.classList.add('hide');
      const pinInput=document.getElementById('loginPin');if(pinInput)pinInput.value='';
      try{localStorage.setItem('orcafacil_active_session_v1','1')}catch(_){}
      window.refreshUserAccessUI?.();
      window.cloudAfterLogin?.();
      return;
    }
    window.toast?.('Não foi possível entrar. Confira a conexão e tente novamente.');
  };
})();
