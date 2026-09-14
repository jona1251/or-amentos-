(function(){
  const FEATURES=[
    {group:'Documentos',key:'signature',icon:'✎',label:'Assinatura digital',desc:'Links para assinatura de contratos.',perm:'contratos',view:'contrato',hint:'Abra um contrato salvo e use “Assinar”.'},

    {group:'Operações',key:'expenses',icon:'↘',label:'Despesas / Caixa',desc:'Registre gastos e acompanhe saídas.',perm:'operacoes',tab:'ops',heading:'Despesas e fluxo de caixa'},
    {group:'Operações',key:'agenda',icon:'□',label:'Agenda de serviços',desc:'Visitas, instalações e compromissos.',perm:'operacoes',tab:'ops',heading:'Agenda de serviços'},
    {group:'Operações',key:'os',icon:'✓',label:'Ordens de serviço',desc:'Checklist, fotos e assinatura.',perm:'operacoes',tab:'ops',heading:'Ordens de serviço'},
    {group:'Operações',key:'stock',icon:'▦',label:'Estoque',desc:'Entradas, saídas e alertas.',perm:'operacoes',tab:'ops',heading:'Estoque'},
    {group:'Operações',key:'suppliers',icon:'♟',label:'Fornecedores',desc:'Contatos e condições de compra.',perm:'operacoes',tab:'ops',heading:'Fornecedores'},
    {group:'Operações',key:'purchases',icon:'▤',label:'Pedidos de compra',desc:'Reposições e compras.',perm:'operacoes',tab:'ops',heading:'Pedidos de compra'},

    {group:'Comercial',key:'crm',icon:'◎',label:'CRM / Funil',desc:'Oportunidades e etapas de venda.',perm:'crm',tab:'sales',heading:'CRM / Funil de clientes'},
    {group:'Comercial',key:'follow',icon:'↻',label:'Follow-ups',desc:'Retornos, cobranças e contatos.',perm:'crm',tab:'sales',heading:'Follow-ups e lembretes'},
    {group:'Comercial',key:'templates',icon:'▧',label:'Modelos',desc:'Textos prontos para documentos.',perm:'crm',tab:'sales',heading:'Modelos'},
    {group:'Comercial',key:'loyalty',icon:'★',label:'Cupons / Fidelidade',desc:'Benefícios para clientes.',perm:'crm',tab:'sales',heading:'Cupons e fidelidade'},
    {group:'Comercial',key:'commissions',icon:'%',label:'Comissões',desc:'Comissões por vendedor ou serviço.',perm:'crm',tab:'sales',heading:'Comissões'},
    {group:'Comercial',key:'tags',icon:'#',label:'Tags / Campos',desc:'Categorias e campos personalizados.',perm:'crm',tab:'sales',heading:'Tags, categorias e campos personalizados'},

    {group:'Gestão',key:'search',icon:'⌕',label:'Busca global',desc:'Pesquise clientes, produtos e documentos.',perm:'relatorios',tab:'manage',heading:'Busca global'},
    {group:'Gestão',key:'reports',icon:'▥',label:'Relatórios / Excel',desc:'Relatórios e exportações.',perm:'relatorios',tab:'manage',heading:'Relatórios e exportações'},
    {group:'Gestão',key:'backup',icon:'⬒',label:'Backups',desc:'Cópias dos dados do usuário.',perm:'relatorios',tab:'manage',heading:'Backup automático'},
    {group:'Gestão',key:'trash',icon:'♲',label:'Lixeira',desc:'Restaure registros removidos.',perm:'relatorios',tab:'manage',heading:'Lixeira'},
    {group:'Gestão',key:'brand',icon:'◇',label:'Multiempresa / Marca',desc:'Perfis, tema e identidade visual.',perm:'relatorios',tab:'manage',heading:'Multiempresa / White-label'},
    {group:'Gestão',key:'audit',icon:'◉',label:'Auditoria',desc:'Ações e visão dos usuários.',perm:'relatorios',tab:'manage',heading:'Auditoria e visão do administrador'},

    {group:'Inteligência',key:'ai',icon:'✦',label:'Assistente inteligente',desc:'Textos e mensagens para atendimento.',perm:'relatorios',tab:'ai',heading:'Assistente inteligente'},
    {group:'Inteligência',key:'margin',icon:'△',label:'Margem e preço',desc:'Custos, venda e margem.',perm:'custos',tab:'ai',heading:'Margem e preço'},
    {group:'Inteligência',key:'insights',icon:'◫',label:'Insights do negócio',desc:'Sugestões com base nos dados.',perm:'relatorios',tab:'ai',heading:'Insights automáticos'},

    {group:'Segurança',key:'twofa',icon:'⊛',label:'Autenticação 2FA',desc:'Segunda etapa de autenticação.',perm:'seguranca',tab:'security',heading:'Autenticação em duas etapas'},
    {group:'Segurança',key:'sessions',icon:'▱',label:'Sessões / Dispositivos',desc:'Acessos e encerramento de sessões.',perm:'seguranca',tab:'security',heading:'Sessões e dispositivos'},
    {group:'Segurança',key:'permissions',icon:'⌘',label:'Permissões de usuários',desc:'Controle de acesso por usuário.',perm:'usuarios',view:'usuarios',target:'userAccessControlCard'},
    {group:'Segurança',key:'security',icon:'◈',label:'Segurança / Auditoria',desc:'Alertas, sessões e auditoria.',perm:'seguranca',tab:'security',heading:'Segurança e auditoria'}
  ];

  const $=id=>document.getElementById(id);
  const normalize=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  let internalOpen=false;
  let installed=false;

  function hasAccess(permission){
    if(!permission)return true;
    if(typeof window.orcaHasAccess==='function')return window.orcaHasAccess(permission);
    return true;
  }

  function grouped(query=''){
    const q=normalize(query),map=new Map();
    FEATURES.filter(f=>hasAccess(f.perm)).filter(f=>!q||normalize(f.label+' '+f.desc+' '+f.group).includes(q)).forEach(f=>{
      if(!map.has(f.group))map.set(f.group,[]);map.get(f.group).push(f);
    });
    return map;
  }

  function removeOldPremiumNavigation(){
    ['#premiumSidebarGroups','#premiumMobileMenuButton','#premiumMobileDrawer','#sidebarSearchBox','#coreSideLabel','#adminSideLabel','#sidebarBrandActions','#dashboardAdvancedTools'].forEach(s=>document.querySelectorAll(s).forEach(x=>x.remove()));
    document.querySelectorAll('#nav [data-v="suite"],#nav [data-v="financeiro"],#nav [data-v="security"],#nav [data-v="seguranca"],#securityNav').forEach(x=>x.remove());
    document.getElementById('nav')?.classList.remove('navPremiumV2','navCompact');
  }

  function installSidebar(){
    const nav=$('nav');if(!nav)return;
    let root=$('systemToolsSidebar');
    if(!root){
      root=document.createElement('div');root.id='systemToolsSidebar';root.className='systemToolsSidebar';
      const config=nav.querySelector('[data-v="config"]');
      nav.insertBefore(root,config||nav.querySelector('.sideSpacer')||null);
    }
    renderSidebar();installStyles();
  }

  function renderSidebar(query=''){
    const root=$('systemToolsSidebar');if(!root)return;
    const groups=grouped(query);
    root.innerHTML=`<div class="systemToolsHead"><div><span>FERRAMENTAS DO SISTEMA</span><small>Recursos avançados</small></div><button type="button" id="systemToolsToggle" title="Recolher ferramentas">⌃</button></div><div class="systemToolsSearch"><span>⌕</span><input id="systemToolsSearchInput" type="search" placeholder="Buscar ferramenta..." value="${String(query).replace(/"/g,'&quot;')}"></div><div id="systemToolsContent">${groups.size?[...groups.entries()].map(([group,items])=>`<div class="systemToolGroup"><div class="systemToolGroupTitle">${group}</div>${items.map(f=>`<button type="button" class="systemToolButton" data-tool-key="${f.key}" onclick="openSystemTool('${f.key}')"><span class="systemToolIcon">${f.icon}</span><span class="systemToolLabel"><b>${f.label}</b><small>${f.desc}</small></span><span class="systemToolArrow">›</span></button>`).join('')}</div>`).join(''):'<div class="systemToolsEmpty">Nenhuma ferramenta disponível.</div>'}</div>`;
    const input=$('systemToolsSearchInput');if(input)input.oninput=e=>renderSidebar(e.target.value);
    const toggle=$('systemToolsToggle');if(toggle)toggle.onclick=()=>{root.classList.toggle('collapsed');toggle.textContent=root.classList.contains('collapsed')?'⌄':'⌃';try{localStorage.setItem('orca_system_tools_collapsed',root.classList.contains('collapsed')?'1':'0')}catch(_){}};
    try{if(localStorage.getItem('orca_system_tools_collapsed')==='1'){root.classList.add('collapsed');if(toggle)toggle.textContent='⌄'}}catch(_){}
  }
  window.refreshSystemToolsSidebar=()=>renderSidebar($('systemToolsSearchInput')?.value||'');

  function findSuiteCard(heading){
    const target=normalize(heading);if(!target)return null;
    const h=[...document.querySelectorAll('#suiteBody h3')].find(el=>normalize(el.textContent).includes(target)||target.includes(normalize(el.textContent)));
    return h?.closest('.suiteCard')||h?.parentElement||null;
  }

  function prepareInternalPage(item){
    const top=document.querySelector('#suite .suiteTop'),tabs=document.querySelector('#suite .suiteTabs');
    if(top)top.style.display='none';if(tabs)tabs.style.display='none';
    if($('pageTitle'))$('pageTitle').textContent=item.label;
    if($('pageSubtitle'))$('pageSubtitle').textContent=item.desc;
  }

  function focusSuiteCard(item){
    if(!item.heading)return;let tries=0;
    const seek=()=>{const card=findSuiteCard(item.heading);if(card){card.classList.add('systemToolFocus');card.scrollIntoView({behavior:'smooth',block:'start'});setTimeout(()=>card.classList.remove('systemToolFocus'),2000)}else if(++tries<10)setTimeout(seek,160)};
    setTimeout(seek,120);
  }

  function openInternal(item){
    internalOpen=true;window.__systemToolBypass=true;
    try{
      if(typeof window.openSuite==='function')window.openSuite(item.tab||'overview');
      else{window.__orcaOriginalGo?.('suite')||window.go?.('suite');window.suiteTab?.(item.tab||'overview')}
    }finally{setTimeout(()=>{internalOpen=false;window.__systemToolBypass=false},80)}
    setTimeout(()=>{prepareInternalPage(item);focusSuiteCard(item)},100);
  }

  window.openSystemTool=function(key){
    const item=FEATURES.find(f=>f.key===key);if(!item)return;
    if(!hasAccess(item.perm))return window.toast?.('Seu usuário não tem acesso a esta função');
    document.querySelectorAll('.systemToolButton').forEach(b=>b.classList.toggle('on',b.dataset.toolKey===key));
    if(item.view){
      window.go?.(item.view);
      if(item.target){let n=0;const seek=()=>{const el=$(item.target);if(el){el.scrollIntoView({behavior:'smooth',block:'start'});el.classList.add('systemToolFocus');setTimeout(()=>el.classList.remove('systemToolFocus'),2000)}else if(++n<10)setTimeout(seek,160)};setTimeout(seek,100)}
      if(item.hint)setTimeout(()=>window.toast?.(item.hint),180);
      return;
    }
    openInternal(item);
  };
  window.openDashboardTool=window.openSystemTool;

  function guardSuiteAccess(){
    const oldGo=window.go;
    if(typeof oldGo==='function'&&!oldGo.__systemToolsWrapped){
      const guarded=function(view){
        if(view==='suite'&&!internalOpen&&!window.__systemToolBypass){window.toast?.('Abra esta função em Ferramentas do Sistema');return oldGo('painel')}
        return oldGo.apply(this,arguments);
      };
      guarded.__systemToolsWrapped=true;window.go=guarded;
    }
    const oldOpen=window.openSuite;
    if(typeof oldOpen==='function'&&!oldOpen.__systemToolsWrapped){
      const guardedOpen=function(){
        if(!internalOpen&&!window.__systemToolBypass){window.toast?.('Abra esta função em Ferramentas do Sistema');return window.go?.('painel')}
        return oldOpen.apply(this,arguments);
      };
      guardedOpen.__systemToolsWrapped=true;window.openSuite=guardedOpen;
    }
  }

  function installStyles(){
    if($('systemToolsSidebarStyles'))return;
    const style=document.createElement('style');style.id='systemToolsSidebarStyles';style.textContent=`
      .systemToolsSidebar{margin:8px 0 10px;padding:10px 8px;border-top:1px solid rgba(255,255,255,.08);border-bottom:1px solid rgba(255,255,255,.08)}
      .systemToolsHead{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:3px 4px 8px}.systemToolsHead span{display:block;color:#dce6f3;font-size:9px;font-weight:950;letter-spacing:.08em}.systemToolsHead small{display:block;color:#7085a3;font-size:9px;margin-top:3px}.systemToolsHead button{width:27px;height:27px;border:0;border-radius:8px;background:rgba(255,255,255,.055);color:#aebdd1;cursor:pointer}
      .systemToolsSearch{height:34px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.045);border-radius:9px;display:flex;align-items:center;gap:7px;padding:0 9px;margin-bottom:9px}.systemToolsSearch span{color:#7085a3}.systemToolsSearch input{width:100%;min-width:0;border:0!important;background:transparent!important;color:#fff!important;font-size:10px!important;padding:6px 0!important;box-shadow:none!important}.systemToolsSearch input::placeholder{color:#7085a3}
      .systemToolGroup{display:grid;gap:3px;margin-top:7px}.systemToolGroupTitle{padding:6px 6px 3px;color:#7085a3;font-size:8.5px;font-weight:950;letter-spacing:.07em;text-transform:uppercase}.systemToolButton{border:0;background:transparent;color:#aebdd1;border-radius:9px;padding:8px 7px;display:grid;grid-template-columns:22px 1fr 10px;gap:7px;align-items:center;text-align:left;width:100%;cursor:pointer}.systemToolButton:hover{background:rgba(255,255,255,.055);color:#fff}.systemToolButton.on{background:#21344f;color:#fff;box-shadow:inset 3px 0 0 #8b9cff}.systemToolIcon{width:22px;text-align:center;font-size:11px}.systemToolLabel b{display:block;font-size:10.5px}.systemToolLabel small{display:none;color:#8294ad;font-size:8.5px;line-height:1.3;margin-top:2px}.systemToolArrow{color:#60738f}.systemToolsEmpty{padding:12px;color:#7085a3;font-size:10px;text-align:center}.systemToolsSidebar.collapsed .systemToolsSearch,.systemToolsSidebar.collapsed #systemToolsContent{display:none}.systemToolFocus{outline:3px solid rgba(79,70,229,.18)!important;box-shadow:0 0 0 6px rgba(79,70,229,.06),0 12px 32px rgba(15,23,42,.08)!important}.view#suite .suiteTop,.view#suite .suiteTabs{display:none}.nav [data-v="suite"],.nav [data-v="financeiro"],.nav [data-v="security"],.nav [data-v="seguranca"],#securityNav{display:none!important}
      @media(min-width:1180px){.systemToolButton:hover .systemToolLabel small{display:block}}
      @media(max-width:700px){.systemToolsSidebar{display:none!important}}
    `;document.head.appendChild(style);
  }

  function periodic(){
    removeOldPremiumNavigation();
    guardSuiteAccess();
    if(!$('systemToolsSidebar'))installSidebar();
  }

  function init(){
    if(installed)return;installed=true;
    removeOldPremiumNavigation();installSidebar();guardSuiteAccess();
    const nav=$('nav');if(nav)new MutationObserver(()=>{removeOldPremiumNavigation();if(!$('systemToolsSidebar'))installSidebar()}).observe(nav,{childList:true,subtree:true});
    setInterval(periodic,3000);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,1200));else setTimeout(init,1200);
})();
