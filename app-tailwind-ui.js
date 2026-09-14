(function(){
  const TW_ID='orca-tailwind-play';
  let ready=false;
  let observer=null;
  const q=(s,r=document)=>r.querySelector(s);
  const qa=(s,r=document)=>[...r.querySelectorAll(s)];

  function loadTailwind(){
    if(document.getElementById(TW_ID))return Promise.resolve();
    return new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.id=TW_ID;
      script.src='https://cdn.tailwindcss.com';
      script.async=true;
      script.onload=()=>{
        try{
          if(window.tailwind){
            window.tailwind.config={
              corePlugins:{preflight:false},
              theme:{extend:{
                colors:{orca:{950:'#07111f',900:'#0b1424',800:'#142238',700:'#21344f'}},
                boxShadow:{soft:'0 10px 35px rgba(15,23,42,.06)',lift:'0 18px 45px rgba(15,23,42,.10)'}
              }}
            };
          }
        }catch(_){}
        document.documentElement.dataset.tailwind='ready';
        resolve();
      };
      script.onerror=()=>reject(new Error('TAILWIND_CDN_FAILED'));
      document.head.appendChild(script);
    });
  }

  function add(selector,...classes){
    qa(selector).forEach(el=>el.classList.add(...classes));
  }

  function styleBase(){
    document.body.classList.add('bg-slate-50','text-slate-900','antialiased');
    add('.app','min-h-screen');
    add('.top','bg-slate-50/90','backdrop-blur-xl');
    add('.pageTitle h1','font-black','tracking-tight','text-slate-950');
    add('.pageTitle small','text-slate-500');
    add('.card','bg-white','border-slate-200','rounded-2xl','shadow-sm','transition-all','duration-200','hover:shadow-md');
    add('.sectionLead h3','font-extrabold');
    add('.muted','text-slate-500');
    add('.eyebrow','bg-slate-100','text-slate-600','font-extrabold');
    add('.badge','bg-slate-100','text-slate-600');
    add('.tot','text-slate-950','font-black');
  }

  function styleNav(){
    const nav=q('#nav');if(!nav)return;
    nav.classList.add('bg-slate-950','border-r','border-slate-800/80','shadow-2xl','shadow-slate-950/10');
    add('#nav button','transition-all','duration-150');
    add('#nav button[data-v]','hover:bg-white/5','hover:text-white');
    add('.sideBrand','border-white/10');
    add('.sideBrand b','text-white','font-extrabold');
    add('.sideBrand small','text-slate-400');
    add('.sideFooter','border-white/10');
    add('.adminMini','rounded-xl');
    add('.avatar','bg-slate-700','ring-1','ring-white/10');
    add('.sideLogout','hover:bg-white/5','transition-colors');
    add('#budgetPaymentsNav','transition-all','duration-150','hover:bg-white/5');
    add('#systemToolsSidebar','border-white/10');
    add('.systemToolsSearch','bg-white/5','border-white/10','focus-within:border-indigo-400/40','focus-within:ring-2','focus-within:ring-indigo-400/10');
    add('.systemToolButton','transition-all','duration-150','hover:bg-white/5');
    add('.systemToolButton.on','bg-slate-800');
  }

  function styleButtons(){
    add('.btn','rounded-xl','font-extrabold','transition-all','duration-150','active:scale-[.99]');
    add('.btn.primary','bg-slate-900','text-white','shadow-sm','hover:bg-slate-800','hover:shadow-md');
    add('.btn.soft','bg-white','border-slate-200','text-slate-700','hover:bg-slate-50','hover:border-slate-300');
    add('.btn.green','bg-emerald-50','text-emerald-700','border-emerald-200','hover:bg-emerald-100');
    add('.btn.danger','bg-rose-50','text-rose-700','border-rose-200','hover:bg-rose-100');
    add('.quickAction','bg-white','border-slate-200','rounded-2xl','shadow-sm','hover:shadow-md','hover:-translate-y-0.5','transition-all');
    add('.quickAction > span','bg-slate-100','text-slate-700');
  }

  function styleForms(){
    add('input','border-slate-200','bg-white','rounded-xl','transition','focus:border-indigo-400','focus:ring-4','focus:ring-indigo-100','placeholder:text-slate-400');
    add('select','border-slate-200','bg-white','rounded-xl','transition','focus:border-indigo-400','focus:ring-4','focus:ring-indigo-100');
    add('textarea','border-slate-200','bg-white','rounded-xl','transition','focus:border-indigo-400','focus:ring-4','focus:ring-indigo-100','placeholder:text-slate-400');
    add('label','text-slate-700');
  }

  function styleLists(){
    add('.item','bg-white','border-slate-200','rounded-2xl','transition-all','hover:border-slate-300','hover:shadow-sm');
    add('.miniRecent','border-slate-100');
    add('.statusPill','rounded-full','font-extrabold');
    add('.historyItem','overflow-hidden');
    add('.suiteItem','bg-white','border-slate-200','rounded-xl','transition-all','hover:shadow-sm');
    add('.accessUser','bg-white','border-slate-200','rounded-2xl','shadow-sm');
    add('.permissionToggle','bg-white','border-slate-200','rounded-xl','hover:border-indigo-200','transition-colors');
  }

  function styleDashboard(){
    add('.metricCard','rounded-2xl','border-slate-200','shadow-sm','hover:shadow-md','transition-all');
    add('.metricCard:not(.highlight) .metricIcon','bg-slate-100','text-slate-700');
    add('.metricCard.highlight','bg-gradient-to-br','from-slate-900','to-slate-800','border-slate-800','shadow-lg','shadow-slate-900/10');
    add('.dashboardGrid > .card','overflow-hidden');
    add('.budgetUnifiedHero','bg-gradient-to-br','from-slate-950','via-slate-900','to-slate-800','shadow-xl','shadow-slate-900/10');
    add('.budgetUnifiedTabs','bg-slate-200','border-slate-200');
    add('.budgetUnifiedTabs button','bg-white','text-slate-600','hover:bg-slate-50');
    add('.budgetUnifiedTabs button.on','bg-indigo-50','text-indigo-700');
  }

  function styleLogin(){
    add('.login','bg-slate-950');
    add('.cleanLoginShell','bg-white','ring-1','ring-white/10','shadow-2xl');
    add('.cleanLoginAside','bg-gradient-to-br','from-slate-950','via-slate-900','to-slate-800');
    add('.cleanLoginMark','shadow-lg','ring-1','ring-white/20');
    add('.cleanLoginBenefit span','bg-white/10','ring-1','ring-white/10');
    add('.cleanAuthBadge','bg-emerald-50','text-emerald-700','ring-1','ring-emerald-100');
    add('#adminEntrance .adminEntranceCard','bg-white','border-slate-200','shadow-2xl');
    add('.adminEntranceInfo','bg-slate-50','border-slate-200');
    add('.adminEntranceAvatar','bg-gradient-to-br','from-slate-900','to-slate-700','shadow-lg');
  }

  function stylePremium(){
    add('.suiteCard','bg-white','border-slate-200','rounded-2xl','shadow-sm','transition-all','hover:shadow-md');
    add('.suiteFeature','bg-white','border-slate-200','rounded-xl','hover:border-slate-300','hover:shadow-sm','transition-all');
    add('.suiteNotice','rounded-xl','bg-indigo-50','text-indigo-700');
    add('.premiumModalBox','rounded-2xl','shadow-2xl','ring-1','ring-slate-200');
    add('.systemToolFocus','ring-4','ring-indigo-100');
  }

  function styleTables(){
    add('table','border-separate','border-spacing-0');
    add('th','text-slate-500','bg-slate-50','font-extrabold');
    add('td','text-slate-700');
  }

  function apply(){
    if(!ready)return;
    styleBase();styleNav();styleButtons();styleForms();styleLists();styleDashboard();styleLogin();stylePremium();styleTables();
    document.body.classList.add('orca-tailwind-ui');
  }

  function watch(){
    observer?.disconnect();
    let scheduled=false;
    observer=new MutationObserver(()=>{
      if(scheduled)return;scheduled=true;
      requestAnimationFrame(()=>{scheduled=false;apply()});
    });
    observer.observe(document.body,{childList:true,subtree:true});
  }

  async function init(){
    try{
      await loadTailwind();
      ready=true;
      apply();
      watch();
      window.addEventListener('resize',apply);
      window.addEventListener('online',apply);
    }catch(err){
      console.warn('Tailwind visual layer unavailable; keeping base styles.',err);
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,120));else setTimeout(init,120);
})();
