(function(){
  const $=id=>document.getElementById(id);
  const normalize=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  let dashboardObserver=null;

  function money(v){return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0))}
  function can(permission){return typeof window.orcaHasAccess==='function'?window.orcaHasAccess(permission):true}

  function currentBudgetStats(){
    let list=[];
    try{list=Array.isArray(budgets)?budgets:[]}catch(_){list=[]}
    const approved=list.filter(b=>String(b.status||'').toLowerCase()==='aprovado').length;
    const total=list.reduce((s,b)=>s+Number(b.total||0),0);
    return {count:list.length,approved,total};
  }

  function installSidebar(){
    const nav=$('nav');if(!nav)return;
    const oldNew=nav.querySelector('[data-v="orcamento"]');
    const oldHistory=nav.querySelector('[data-v="historico"]');
    if(!$('budgetPaymentsNav')){
      const btn=document.createElement('button');
      btn.id='budgetPaymentsNav';btn.type='button';btn.className='budgetPaymentsNav';
      btn.innerHTML='<span class="navIcon">▤</span><span class="navText">Orçamentos & pagamentos</span>';
      btn.onclick=()=>window.openBudgetPayments?.('new');
      const ref=oldNew||oldHistory||nav.querySelector('[data-v="contrato"]');
      nav.insertBefore(btn,ref||null);
    }
    oldNew?.remove();oldHistory?.remove();
    const unified=$('budgetPaymentsNav');if(unified)unified.style.display=can('orcamentos')?'':'none';
  }

  function tabHtml(active){
    const finance=can('financeiro');
    return `<div class="budgetUnifiedTabs noPrint">
      <button type="button" class="${active==='new'?'on':''}" onclick="openBudgetPayments('new')"><span>＋</span><b>Novo orçamento</b></button>
      <button type="button" class="${active==='history'?'on':''}" onclick="openBudgetPayments('history')"><span>▤</span><b>Histórico e aprovação</b></button>
      ${finance?`<button type="button" class="${active==='receivables'?'on':''}" onclick="openBudgetPayments('receivables')"><span>R$</span><b>Recebimentos</b></button>`:''}
    </div>`;
  }

  function ensureTab(viewId,active){
    const view=$(viewId);if(!view)return;
    let holder=view.querySelector(':scope > .budgetUnifiedTop');
    if(!holder){holder=document.createElement('div');holder.className='budgetUnifiedTop';view.insertBefore(holder,view.firstChild)}
    const stats=currentBudgetStats();
    holder.innerHTML=`<div class="budgetUnifiedHero">
      <div class="budgetUnifiedHeroMain"><span class="budgetHeroIcon">▤</span><div><span class="eyebrow">ORÇAMENTOS & PAGAMENTOS</span><h2>Central de orçamentos</h2><p>Crie propostas, acompanhe aprovações e organize recebimentos em um único lugar.</p></div></div>
      <div class="budgetUnifiedStats"><div><small>Orçamentos</small><b>${stats.count}</b></div><div><small>Aprovados</small><b>${stats.approved}</b></div><div><small>Total orçado</small><b>${money(stats.total)}</b></div></div>
    </div>${tabHtml(active)}`;
  }

  function updateActiveNav(){
    const btn=$('budgetPaymentsNav');if(!btn)return;
    const active=['orcamento','historico','financeiro'].some(id=>$(id)?.classList.contains('on'));
    btn.classList.toggle('on',active);
  }

  window.openBudgetPayments=function(which='new'){
    if(!can('orcamentos'))return window.toast?.('Seu usuário não tem acesso a orçamentos');
    if(which==='receivables'){
      if(!can('financeiro'))return window.toast?.('Seu usuário não tem acesso ao financeiro');
      window.go?.('financeiro');window.premiumReloadFinance?.();ensureTab('financeiro','receivables');
    }else if(which==='history'){
      window.go?.('historico');ensureTab('historico','history');
    }else{
      window.go?.('orcamento');ensureTab('orcamento','new');
    }
    const t=$('pageTitle'),s=$('pageSubtitle');if(t)t.textContent='Orçamentos & pagamentos';if(s)s.textContent='Propostas, aprovações e recebimentos em uma única área.';
    updateActiveNav();
  };

  function removePixPaymentButtons(){
    const roots=['#budgetList','.premiumHistoryActions','.advancedToolGrid'];
    roots.forEach(sel=>document.querySelectorAll(sel+' button, '+sel+' .advancedToolCard').forEach(el=>{
      const txt=normalize(el.textContent);
      if(txt.includes('pix')||txt.includes('link de pagamento')||txt==='pagamento'||txt.includes(' pagamento')){
        if(txt.includes('receber')||txt.includes('recebimento'))return;
        el.remove();
      }
    }));
  }

  function beautifyDashboardBudgetGroup(){
    const host=$('dashboardToolGroups');if(!host)return;
    const group=[...host.querySelectorAll('.advancedToolGroup')].find(g=>normalize(g.querySelector('.advancedGroupHead h3')?.textContent)==='orcamentos e pagamentos');
    if(!group)return;
    const stats=currentBudgetStats();
    group.classList.add('budgetDashboardGroup');
    const head=group.querySelector('.advancedGroupHead');if(head){head.querySelector('span')?.remove();head.querySelector('h3').textContent='Orçamentos & pagamentos'}
    const grid=group.querySelector('.advancedToolGrid');if(!grid)return;
    grid.className='budgetUnifiedDashboard';
    grid.innerHTML=`<div class="budgetDashboardHero">
      <div class="budgetDashboardIntro"><span class="budgetDashboardIcon">▤</span><div><b>Gerencie todo o ciclo do orçamento</b><small>Criação, histórico, aprovação do cliente e recebimentos reunidos em uma única área.</small></div></div>
      <div class="budgetDashboardNumbers"><div><small>Orçamentos</small><strong>${stats.count}</strong></div><div><small>Aprovados</small><strong>${stats.approved}</strong></div><div><small>Total</small><strong>${money(stats.total)}</strong></div></div>
      <div class="budgetDashboardActions">
        <button type="button" class="budgetPrimaryAction" onclick="openBudgetPayments('new')"><span>＋</span><div><b>Novo orçamento</b><small>Criar uma nova proposta</small></div></button>
        <button type="button" onclick="openBudgetPayments('history')"><span>▤</span><div><b>Histórico e aprovação</b><small>Acompanhar propostas enviadas</small></div></button>
        ${can('financeiro')?`<button type="button" onclick="openBudgetPayments('receivables')"><span>R$</span><div><b>Recebimentos</b><small>Contas a receber e vencimentos</small></div></button>`:''}
      </div>
    </div>`;
  }

  function installStyles(){if($('budgetUnifiedStyles'))return;const s=document.createElement('style');s.id='budgetUnifiedStyles';s.textContent=`
    .budgetPaymentsNav{border:0;background:transparent;color:#c8d3e3;border-radius:12px;padding:13px 14px;text-align:left;font-weight:700;display:flex;align-items:center;gap:12px;width:100%}.budgetPaymentsNav:hover{background:rgba(255,255,255,.055);color:#fff}.budgetPaymentsNav.on{background:#1a2a42;color:#fff;box-shadow:inset 0 0 0 1px rgba(255,255,255,.025)}
    .budgetUnifiedTop{margin-bottom:18px}.budgetUnifiedHero{background:linear-gradient(135deg,#101827 0%,#17243a 62%,#21334d 100%);color:#fff;border-radius:22px 22px 0 0;padding:22px 24px;display:flex;align-items:center;justify-content:space-between;gap:20px;box-shadow:0 14px 34px rgba(15,23,42,.11)}.budgetUnifiedHeroMain{display:flex;align-items:center;gap:15px;min-width:0}.budgetHeroIcon{width:50px;height:50px;border-radius:16px;background:rgba(255,255,255,.1);display:grid;place-items:center;font-size:22px;flex:0 0 auto}.budgetUnifiedHero .eyebrow{background:rgba(255,255,255,.1);color:#cbd8e8}.budgetUnifiedHero h2{margin:7px 0 4px;font-size:23px}.budgetUnifiedHero p{margin:0;color:#aebdd1;font-size:12px}.budgetUnifiedStats{display:grid;grid-template-columns:repeat(3,minmax(95px,1fr));gap:8px}.budgetUnifiedStats>div{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.09);border-radius:13px;padding:10px 12px}.budgetUnifiedStats small{display:block;color:#aebdd1;font-size:9px;text-transform:uppercase;letter-spacing:.04em}.budgetUnifiedStats b{display:block;margin-top:4px;font-size:14px;white-space:nowrap}
    .budgetUnifiedTabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1px;background:#e7ebf0;border:1px solid #e1e6ec;border-top:0;border-radius:0 0 18px 18px;overflow:hidden}.budgetUnifiedTabs button{border:0;background:#fff;color:#64748b;padding:13px 16px;display:flex;align-items:center;justify-content:center;gap:8px;font-weight:800}.budgetUnifiedTabs button:hover{background:#f8fafc;color:#172033}.budgetUnifiedTabs button.on{background:#eef2ff;color:#3730a3;box-shadow:inset 0 -3px 0 #6366f1}.budgetUnifiedTabs button span{font-size:16px}
    #orcamento>.card:not(#budgetDocCard){border-color:#e3e8ef;box-shadow:0 8px 28px rgba(15,23,42,.045)}#orcamento>.card:first-of-type{border-radius:18px}#historico>.card{border-radius:18px;box-shadow:0 8px 28px rgba(15,23,42,.045)}
    .budgetDashboardGroup{padding:20px 22px 22px!important;background:linear-gradient(180deg,#fff,#fbfcff)!important}.budgetDashboardGroup .advancedGroupHead{margin-bottom:14px}.budgetDashboardGroup .advancedGroupHead h3{font-size:17px}.budgetUnifiedDashboard{display:block}.budgetDashboardHero{border:1px solid #e3e8ef;border-radius:18px;background:linear-gradient(135deg,#f8faff 0%,#fff 52%,#f8fafc 100%);padding:17px;display:grid;grid-template-columns:1.25fr .85fr;gap:14px}.budgetDashboardIntro{display:flex;align-items:center;gap:13px}.budgetDashboardIcon{width:52px;height:52px;border-radius:16px;background:#111827;color:#fff;display:grid;place-items:center;font-size:21px;box-shadow:0 8px 20px rgba(15,23,42,.13)}.budgetDashboardIntro b{display:block;font-size:15px;color:#172033}.budgetDashboardIntro small{display:block;margin-top:5px;color:#7a8493;line-height:1.4}.budgetDashboardNumbers{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.budgetDashboardNumbers>div{border:1px solid #e7ebf0;background:#fff;border-radius:12px;padding:9px 10px}.budgetDashboardNumbers small{display:block;color:#8893a2;font-size:9px;text-transform:uppercase}.budgetDashboardNumbers strong{display:block;margin-top:4px;color:#172033;font-size:13px}.budgetDashboardActions{grid-column:1/-1;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-top:2px}.budgetDashboardActions button{border:1px solid #e1e6ed;background:#fff;border-radius:13px;padding:12px;display:flex;align-items:center;gap:10px;text-align:left;color:#172033}.budgetDashboardActions button:hover{border-color:#cbd4df;box-shadow:0 8px 20px rgba(15,23,42,.05);transform:translateY(-1px)}.budgetDashboardActions button>span{width:36px;height:36px;border-radius:10px;background:#f1f5f9;display:grid;place-items:center;font-weight:900}.budgetDashboardActions b{display:block;font-size:11px}.budgetDashboardActions small{display:block;margin-top:3px;color:#8a94a4;font-size:9.5px}.budgetDashboardActions .budgetPrimaryAction{background:#111827;color:#fff;border-color:#111827}.budgetDashboardActions .budgetPrimaryAction>span{background:rgba(255,255,255,.12)}.budgetDashboardActions .budgetPrimaryAction small{color:#aebdd1}
    @media(max-width:980px){.budgetUnifiedHero{align-items:flex-start;flex-direction:column}.budgetUnifiedStats{width:100%}.budgetDashboardHero{grid-template-columns:1fr}.budgetDashboardNumbers{grid-column:1}.budgetDashboardActions{grid-column:1}}
    @media(max-width:650px){.budgetUnifiedHero{padding:18px}.budgetUnifiedHeroMain{align-items:flex-start}.budgetHeroIcon{width:44px;height:44px}.budgetUnifiedStats{grid-template-columns:1fr 1fr}.budgetUnifiedStats>div:last-child{grid-column:1/-1}.budgetUnifiedTabs{grid-template-columns:1fr}.budgetUnifiedTabs button{justify-content:flex-start}.budgetDashboardNumbers{grid-template-columns:1fr 1fr}.budgetDashboardNumbers>div:last-child{grid-column:1/-1}.budgetDashboardActions{grid-template-columns:1fr}.budgetDashboardIntro{align-items:flex-start}}
  `;document.head.appendChild(s)}

  function monitorDashboard(){
    const host=$('dashboardToolGroups');if(!host)return;
    dashboardObserver?.disconnect();
    dashboardObserver=new MutationObserver(()=>{requestAnimationFrame(()=>{beautifyDashboardBudgetGroup();removePixPaymentButtons()})});
    dashboardObserver.observe(host,{childList:true,subtree:true});
    beautifyDashboardBudgetGroup();
  }

  function periodic(){installSidebar();ensureTab('orcamento','new');ensureTab('historico','history');if($('financeiro'))ensureTab('financeiro','receivables');removePixPaymentButtons();beautifyDashboardBudgetGroup();updateActiveNav()}

  function init(){installStyles();installSidebar();ensureTab('orcamento','new');ensureTab('historico','history');if($('financeiro'))ensureTab('financeiro','receivables');removePixPaymentButtons();monitorDashboard();setInterval(periodic,1800)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,1500));else setTimeout(init,1500);
})();
