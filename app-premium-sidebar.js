(function(){
  const FEATURES=[
    {group:'Orçamentos & pagamentos',key:'premium_approval',icon:'↗',label:'Aprovação por link',perm:'orcamentos',view:'historico',hint:'Escolha um orçamento e use o botão “Aprovação”.'},
    {group:'Orçamentos & pagamentos',key:'premium_pix',icon:'▦',label:'PIX / QR Code',perm:'financeiro',view:'historico',hint:'Escolha um orçamento e use o botão “PIX”.'},
    {group:'Orçamentos & pagamentos',key:'premium_payment',icon:'$',label:'Link de pagamento',perm:'financeiro',view:'historico',hint:'Escolha um orçamento e use o botão “Pagamento”.'},
    {group:'Orçamentos & pagamentos',key:'premium_receivables',icon:'R$',label:'Contas a receber',perm:'financeiro',view:'financeiro'},
    {group:'Orçamentos & pagamentos',key:'premium_signature',icon:'✎',label:'Assinatura digital',perm:'contratos',view:'contrato',hint:'Abra um contrato salvo e use “Assinar”.'},

    {group:'Operações',key:'premium_expenses',icon:'↘',label:'Despesas / Caixa',perm:'operacoes',tab:'ops',heading:'Despesas e fluxo de caixa'},
    {group:'Operações',key:'premium_agenda',icon:'□',label:'Agenda de serviços',perm:'operacoes',tab:'ops',heading:'Agenda de serviços'},
    {group:'Operações',key:'premium_os',icon:'✓',label:'Ordens de serviço',perm:'operacoes',tab:'ops',heading:'Ordens de serviço'},
    {group:'Operações',key:'premium_stock',icon:'▦',label:'Estoque',perm:'operacoes',tab:'ops',heading:'Estoque'},
    {group:'Operações',key:'premium_suppliers',icon:'♟',label:'Fornecedores',perm:'operacoes',tab:'ops',heading:'Fornecedores'},
    {group:'Operações',key:'premium_purchases',icon:'▤',label:'Pedidos de compra',perm:'operacoes',tab:'ops',heading:'Pedidos de compra'},

    {group:'Comercial',key:'premium_crm',icon:'◎',label:'CRM / Funil',perm:'crm',tab:'sales',heading:'CRM / Funil de clientes'},
    {group:'Comercial',key:'premium_follow',icon:'↻',label:'Follow-ups',perm:'crm',tab:'sales',heading:'Follow-ups e lembretes'},
    {group:'Comercial',key:'premium_templates',icon:'▧',label:'Modelos',perm:'crm',tab:'sales',heading:'Modelos'},
    {group:'Comercial',key:'premium_loyalty',icon:'★',label:'Cupons / Fidelidade',perm:'crm',tab:'sales',heading:'Cupons e fidelidade'},
    {group:'Comercial',key:'premium_commissions',icon:'%',label:'Comissões',perm:'crm',tab:'sales',heading:'Comissões'},
    {group:'Comercial',key:'premium_tags',icon:'#',label:'Tags / Campos',perm:'crm',tab:'sales',heading:'Tags, categorias e campos personalizados'},

    {group:'Gestão',key:'premium_search',icon:'⌕',label:'Busca global',perm:'relatorios',tab:'manage',heading:'Busca global'},
    {group:'Gestão',key:'premium_reports',icon:'▥',label:'Relatórios / Excel',perm:'relatorios',tab:'manage',heading:'Relatórios e exportações'},
    {group:'Gestão',key:'premium_backup',icon:'⬒',label:'Backups',perm:'relatorios',tab:'manage',heading:'Backup automático'},
    {group:'Gestão',key:'premium_trash',icon:'♲',label:'Lixeira',perm:'relatorios',tab:'manage',heading:'Lixeira'},
    {group:'Gestão',key:'premium_brand',icon:'◇',label:'Multiempresa / Marca',perm:'relatorios',tab:'manage',heading:'Multiempresa / White-label'},
    {group:'Gestão',key:'premium_audit',icon:'◉',label:'Auditoria',perm:'relatorios',tab:'manage',heading:'Auditoria e visão do administrador'},

    {group:'Inteligência',key:'premium_ai',icon:'✦',label:'Assistente inteligente',perm:'relatorios',tab:'ai',heading:'Assistente inteligente'},
    {group:'Inteligência',key:'premium_margin',icon:'△',label:'Margem e preço',perm:'custos',tab:'ai',heading:'Margem e preço'},
    {group:'Inteligência',key:'premium_insights',icon:'◫',label:'Insights do negócio',perm:'relatorios',tab:'ai',heading:'Insights automáticos'},

    {group:'Segurança',key:'premium_2fa',icon:'⊛',label:'Autenticação 2FA',perm:'seguranca',tab:'security',heading:'Autenticação em duas etapas'},
    {group:'Segurança',key:'premium_sessions',icon:'▱',label:'Sessões / Dispositivos',perm:'seguranca',tab:'security',heading:'Sessões e dispositivos'},
    {group:'Segurança',key:'premium_access',icon:'⌘',label:'Permissões de usuários',perm:'usuarios',view:'usuarios',target:'userAccessControlCard'},
    {group:'Segurança',key:'premium_security',icon:'◈',label:'Segurança / Auditoria',perm:'seguranca',tab:'security',heading:'Segurança e auditoria'}
  ];

  const GROUP_ICONS={
    'Orçamentos & pagamentos':'$','Operações':'▦','Comercial':'◎','Gestão':'▥','Inteligência':'✦','Segurança':'◈'
  };
  const GROUP_KEY='orcafacil_sidebar_groups_v2';
  const FAVORITES_KEY='orcafacil_sidebar_favorites_v2';
  const COMPACT_KEY='orcafacil_sidebar_compact_v2';
  const $=id=>document.getElementById(id);
  let activeKey='';
  let searchValue='';

  function hasAccess(permission){
    if(!permission)return true;
    if(typeof window.orcaHasAccess==='function')return window.orcaHasAccess(permission);
    return true;
  }

  function normalize(v){
    return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  }

  function groupedFeatures(){
    const map=new Map();
    FEATURES.forEach(item=>{
      if(!map.has(item.group))map.set(item.group,[]);
      map.get(item.group).push(item);
    });
    return map;
  }

  function readJSON(key,fallback){
    try{return JSON.parse(localStorage.getItem(key)||'')||fallback}catch(_){return fallback}
  }
  function writeJSON(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch(_){}}
  function collapsedGroups(){return readJSON(GROUP_KEY,{})}
  function favorites(){return readJSON(FAVORITES_KEY,['premium_receivables','premium_os','premium_crm','premium_reports'])}

  function install(){
    const nav=$('nav');
    if(!nav||$('premiumSidebarGroups'))return;

    nav.classList.add('navPremiumV2');
    organizeCoreMenu(nav);
    installSearch(nav);
    installPremiumHome(nav);
    installPremiumGroups(nav);
    installMobileLauncher(nav);
    installStyles();
    restoreCompact();
    applyPermissions();
    renderFavorites();
    updateGroupState();

    nav.addEventListener('click',e=>{
      const b=e.target.closest('button[data-v]');
      if(b&&!b.closest('#premiumSidebarGroups')&&b.dataset.v!=='suite')setActive('');
    });
  }

  function organizeCoreMenu(nav){
    const brand=nav.querySelector('.sideBrand');
    if(brand&&!$('sidebarBrandActions')){
      const actions=document.createElement('div');
      actions.id='sidebarBrandActions';actions.className='sidebarBrandActions';
      actions.innerHTML='<button type="button" class="sidebarIconBtn" title="Recolher menu" onclick="toggleSidebarCompact()"><span>⇤</span></button>';
      brand.appendChild(actions);
    }

    const painel=nav.querySelector('[data-v="painel"]');
    if(painel&&!$('coreSideLabel')){
      const label=document.createElement('div');
      label.id='coreSideLabel';label.className='premiumSideLabel coreSideLabel';label.textContent='Principal';
      nav.insertBefore(label,painel);
    }

    const config=nav.querySelector('[data-v="config"]');
    const users=nav.querySelector('[data-v="usuarios"]');
    if((users||config)&&!$('adminSideLabel')){
      const target=users||config;
      const label=document.createElement('div');
      label.id='adminSideLabel';label.className='premiumSideLabel adminSideLabel';label.textContent='Administração';
      nav.insertBefore(label,target);
    }
  }

  function installSearch(nav){
    if($('sidebarMenuSearch'))return;
    const brand=nav.querySelector('.sideBrand');
    if(!brand)return;
    const box=document.createElement('div');
    box.id='sidebarSearchBox';box.className='sidebarSearchBox';
    box.innerHTML='<span>⌕</span><input id="sidebarMenuSearch" type="search" autocomplete="off" placeholder="Buscar no menu..."><button id="sidebarSearchClear" type="button" title="Limpar busca">×</button>';
    brand.insertAdjacentElement('afterend',box);
    $('sidebarMenuSearch').addEventListener('input',e=>filterMenu(e.target.value));
    $('sidebarSearchClear').onclick=()=>{const i=$('sidebarMenuSearch');if(i){i.value='';filterMenu('');i.focus()}};
  }

  function installPremiumHome(nav){
    const suiteBtn=nav.querySelector('[data-v="suite"]');
    if(!suiteBtn)return;
    suiteBtn.classList.add('premiumHomeButton');
    suiteBtn.innerHTML='<span class="navIcon">◆</span><span class="navText"><b>Premium+</b><small>Central avançada</small></span><span class="premiumHomeBadge">PRO</span>';
    suiteBtn.title='Abrir visão geral Premium+';
    suiteBtn.onclick=()=>{
      setActive('');
      if(typeof window.openSuite==='function')window.openSuite('overview');
      else{window.go?.('suite');window.suiteTab?.('overview')}
    };
  }

  function installPremiumGroups(nav){
    const root=document.createElement('div');
    root.id='premiumSidebarGroups';root.className='premiumSidebarGroups';
    const groups=collapsedGroups();
    let html='<div class="premiumToolsHead"><span>Ferramentas Premium+</span><button type="button" onclick="toggleAllPremiumGroups()" title="Expandir/recolher grupos">▾</button></div><div id="premiumFavoriteBar" class="premiumFavoriteBar"></div>';

    for(const [group,items] of groupedFeatures()){
      const collapsed=groups[group]===true;
      html+=`<div class="premiumSideSection ${collapsed?'isCollapsed':''}" data-premium-group="${group}">`;
      html+=`<button type="button" class="premiumGroupToggle" onclick='togglePremiumGroup(${JSON.stringify(group)})'><span class="premiumGroupIcon">${GROUP_ICONS[group]||'•'}</span><span>${group}</span><span class="premiumGroupCount">${items.length}</span><span class="premiumChevron">⌄</span></button>`;
      html+='<div class="premiumGroupItems">';
      html+=items.map(item=>`<button type="button" class="premiumSideBtn" data-premium-key="${item.key}" data-premium-label="${item.label}" data-premium-permission="${item.perm||''}" onclick="openPremiumSide('${item.key}')"><span class="premiumSideIcon">${item.icon}</span><span class="premiumSideText">${item.label}</span><span class="premiumPin" role="button" title="Favoritar" onclick="event.stopPropagation();togglePremiumFavorite('${item.key}')">☆</span></button>`).join('');
      html+='</div></div>';
    }
    root.innerHTML=html;

    const adminLabel=$('adminSideLabel');
    const config=nav.querySelector('[data-v="config"]');
    nav.insertBefore(root,adminLabel||config||nav.querySelector('.sideSpacer'));
  }

  function installMobileLauncher(nav){
    if($('premiumMobileMenuButton'))return;
    const b=document.createElement('button');
    b.id='premiumMobileMenuButton';b.type='button';b.className='premiumMobileMenuButton';
    b.innerHTML='<span class="navIcon">☰</span><span class="navText">Menu</span>';
    b.onclick=()=>toggleMobileDrawer(true);
    const spacer=nav.querySelector('.sideSpacer');nav.insertBefore(b,spacer||null);

    const drawer=document.createElement('div');
    drawer.id='premiumMobileDrawer';drawer.className='premiumMobileDrawer hide';
    drawer.innerHTML=`<div class="premiumMobilePanel">
      <div class="premiumMobileHandle"></div>
      <div class="premiumMobileHead"><div><span class="eyebrow">NAVEGAÇÃO</span><h3>OrçaFácil Pro</h3><small>Todos os módulos em um só lugar</small></div><button type="button" onclick="closePremiumMobileMenu()">×</button></div>
      <div class="premiumMobileSearch"><span>⌕</span><input id="premiumMobileSearchInput" placeholder="Buscar função..."></div>
      <div id="premiumMobileContent"></div>
    </div>`;
    drawer.addEventListener('click',e=>{if(e.target===drawer)toggleMobileDrawer(false)});
    document.body.appendChild(drawer);
    $('premiumMobileSearchInput')?.addEventListener('input',e=>renderMobileDrawer(e.target.value));
    renderMobileDrawer('');
  }

  function coreMobileItems(){
    const items=[];
    document.querySelectorAll('#nav>button[data-v]').forEach(btn=>{
      if(btn.id==='premiumMobileMenuButton'||btn.dataset.v==='suite')return;
      if(getComputedStyle(btn).display==='none')return;
      items.push({view:btn.dataset.v,icon:btn.querySelector('.navIcon')?.textContent||'•',label:btn.querySelector('.navText')?.textContent?.trim()||btn.dataset.v});
    });
    return items;
  }

  function renderMobileDrawer(query=''){
    const host=$('premiumMobileContent');if(!host)return;
    const q=normalize(query);
    const core=coreMobileItems().filter(x=>!q||normalize(x.label).includes(q));
    let html='';
    if(core.length){
      html+='<div class="premiumMobileGroup"><b>Principal</b><div class="premiumMobileGrid">';
      html+=core.map(x=>`<button type="button" onclick="go('${x.view}');closePremiumMobileMenu()"><span>${x.icon}</span><small>${x.label}</small></button>`).join('');
      html+='</div></div>';
    }
    for(const [group,items] of groupedFeatures()){
      const visible=items.filter(x=>hasAccess(x.perm)&&(!q||normalize(x.label+' '+group).includes(q)));
      if(!visible.length)continue;
      html+=`<div class="premiumMobileGroup"><b>${group}</b><div class="premiumMobileGrid">${visible.map(item=>`<button type="button" onclick="openPremiumSide('${item.key}');closePremiumMobileMenu()"><span>${item.icon}</span><small>${item.label}</small></button>`).join('')}</div></div>`;
    }
    if(!html)html='<div class="premiumMenuEmpty">Nenhuma função encontrada.</div>';
    host.innerHTML=html;
  }

  function toggleMobileDrawer(on){
    const d=$('premiumMobileDrawer');if(!d)return;
    d.classList.toggle('hide',!on);
    document.body.classList.toggle('premiumDrawerOpen',!!on);
    if(on)setTimeout(()=>$('premiumMobileSearchInput')?.focus(),120);
  }
  window.closePremiumMobileMenu=()=>toggleMobileDrawer(false);

  window.togglePremiumGroup=function(group){
    const section=document.querySelector(`[data-premium-group="${CSS.escape(group)}"]`);
    if(!section)return;
    const next=!section.classList.contains('isCollapsed');
    section.classList.toggle('isCollapsed',next);
    const saved=collapsedGroups();saved[group]=next;writeJSON(GROUP_KEY,saved);
  };

  window.toggleAllPremiumGroups=function(){
    const sections=[...document.querySelectorAll('.premiumSideSection')].filter(x=>x.style.display!=='none');
    const shouldCollapse=sections.some(x=>!x.classList.contains('isCollapsed'));
    const saved=collapsedGroups();
    sections.forEach(section=>{section.classList.toggle('isCollapsed',shouldCollapse);saved[section.dataset.premiumGroup]=shouldCollapse});
    writeJSON(GROUP_KEY,saved);
  };

  window.togglePremiumFavorite=function(key){
    let list=favorites();
    if(list.includes(key))list=list.filter(x=>x!==key);
    else list=[key,...list].slice(0,6);
    writeJSON(FAVORITES_KEY,list);
    renderFavorites();updateFavoriteStars();
  };

  function renderFavorites(){
    const host=$('premiumFavoriteBar');if(!host)return;
    const list=favorites().map(key=>FEATURES.find(x=>x.key===key)).filter(x=>x&&hasAccess(x.perm));
    host.innerHTML=list.length?`<div class="premiumFavoriteLabel">Atalhos</div><div class="premiumFavoriteGrid">${list.map(item=>`<button type="button" title="${item.label}" onclick="openPremiumSide('${item.key}')"><span>${item.icon}</span><small>${item.label}</small></button>`).join('')}</div>`:'';
    updateFavoriteStars();
  }

  function updateFavoriteStars(){
    const fav=new Set(favorites());
    document.querySelectorAll('.premiumSideBtn').forEach(btn=>{
      const pin=btn.querySelector('.premiumPin');if(pin)pin.textContent=fav.has(btn.dataset.premiumKey)?'★':'☆';
      btn.classList.toggle('isFavorite',fav.has(btn.dataset.premiumKey));
    });
  }

  function filterMenu(value){
    searchValue=normalize(value);
    $('sidebarSearchBox')?.classList.toggle('hasValue',!!searchValue);
    const direct=[...document.querySelectorAll('#nav>button[data-v]')].filter(b=>b.id!=='premiumMobileMenuButton');
    direct.forEach(btn=>{
      const label=normalize(btn.textContent);
      btn.classList.toggle('menuSearchHidden',!!searchValue&&!label.includes(searchValue));
    });
    document.querySelectorAll('.premiumSideSection').forEach(section=>{
      let visible=0;
      section.querySelectorAll('.premiumSideBtn').forEach(btn=>{
        const match=!searchValue||normalize(btn.dataset.premiumLabel+' '+section.dataset.premiumGroup).includes(searchValue);
        const permitted=!btn.dataset.premiumPermission||hasAccess(btn.dataset.premiumPermission);
        btn.classList.toggle('menuSearchHidden',!(match&&permitted));
        if(match&&permitted)visible++;
      });
      section.classList.toggle('menuSearchHidden',visible===0);
      section.classList.toggle('searchExpanded',!!searchValue&&visible>0);
    });
    $('premiumFavoriteBar')?.classList.toggle('menuSearchHidden',!!searchValue);
    document.querySelectorAll('.premiumSideLabel').forEach(label=>label.classList.toggle('menuSearchHidden',!!searchValue));
  }

  window.toggleSidebarCompact=function(){
    const compact=!document.body.classList.contains('sidebarCompact');
    document.body.classList.toggle('sidebarCompact',compact);
    try{localStorage.setItem(COMPACT_KEY,compact?'1':'0')}catch(_){}
    const btn=$('sidebarBrandActions')?.querySelector('button');if(btn)btn.innerHTML=compact?'<span>⇥</span>':'<span>⇤</span>';
  };

  function restoreCompact(){
    let compact=false;try{compact=localStorage.getItem(COMPACT_KEY)==='1'}catch(_){}
    document.body.classList.toggle('sidebarCompact',compact);
    const btn=$('sidebarBrandActions')?.querySelector('button');if(btn)btn.innerHTML=compact?'<span>⇥</span>':'<span>⇤</span>';
  }

  function setActive(key){
    activeKey=key||'';
    document.querySelectorAll('[data-premium-key]').forEach(b=>b.classList.toggle('on',b.dataset.premiumKey===activeKey));
    if(activeKey){
      const btn=document.querySelector(`[data-premium-key="${activeKey}"]`);
      const section=btn?.closest('.premiumSideSection');
      section?.classList.remove('isCollapsed');
    }
  }

  function findCardByHeading(text){
    const target=normalize(text);
    const headings=[...document.querySelectorAll('#suiteBody h3')];
    const h=headings.find(el=>normalize(el.textContent).includes(target)||target.includes(normalize(el.textContent)));
    return h?.closest('.suiteCard')||h?.parentElement||null;
  }

  function focusCard(heading){
    if(!heading)return;
    let tries=0;
    const run=()=>{
      const card=findCardByHeading(heading);
      if(card){
        document.querySelectorAll('.premiumSidebarFocus').forEach(x=>x.classList.remove('premiumSidebarFocus'));
        card.classList.add('premiumSidebarFocus');
        card.scrollIntoView({behavior:'smooth',block:'start'});
        setTimeout(()=>card.classList.remove('premiumSidebarFocus'),2200);
        return;
      }
      if(++tries<10)setTimeout(run,160);
    };
    setTimeout(run,120);
  }

  function openStandardView(item){
    if(typeof window.go==='function')window.go(item.view);
    if(item.view==='financeiro')window.premiumReloadFinance?.();
    if(item.target){
      let tries=0;
      const seek=()=>{
        const el=$(item.target);
        if(el){
          el.scrollIntoView({behavior:'smooth',block:'start'});
          el.classList.add('premiumSidebarFocus');
          setTimeout(()=>el.classList.remove('premiumSidebarFocus'),2200);
        }else if(++tries<10)setTimeout(seek,160);
      };
      setTimeout(seek,120);
    }
    if(item.hint)setTimeout(()=>window.toast?.(item.hint),180);
  }

  window.openPremiumSide=function(key){
    const item=FEATURES.find(x=>x.key===key);if(!item)return;
    if(!hasAccess(item.perm)){window.toast?.('Seu usuário não tem acesso a esta função');return}
    setActive(key);
    if(item.view){openStandardView(item);return}
    if(typeof window.openSuite==='function')window.openSuite(item.tab||'overview');
    else{window.go?.('suite');window.suiteTab?.(item.tab||'overview')}
    if(item.heading)focusCard(item.heading);
    const suiteBtn=document.querySelector('#nav [data-v="suite"]');if(suiteBtn)suiteBtn.classList.remove('on');
  };

  function applyPermissions(){
    document.querySelectorAll('#premiumSidebarGroups [data-premium-permission]').forEach(b=>{
      const p=b.dataset.premiumPermission;
      b.style.display=!p||hasAccess(p)?'':'none';
    });
    document.querySelectorAll('#premiumSidebarGroups .premiumSideSection').forEach(section=>{
      const any=[...section.querySelectorAll('.premiumSideBtn')].some(b=>b.style.display!=='none');
      section.style.display=any?'':'none';
    });
    const root=$('premiumSidebarGroups');
    if(root){const any=[...root.querySelectorAll('.premiumSideBtn')].some(b=>b.style.display!=='none');root.style.display=any?'':'none'}
    const mobile=$('premiumMobileMenuButton');
    if(mobile){const any=FEATURES.some(x=>hasAccess(x.perm));mobile.style.display=any?'':'none'}
    renderFavorites();renderMobileDrawer($('premiumMobileSearchInput')?.value||'');
    if(searchValue)filterMenu(searchValue);
  }
  window.refreshPremiumSidebar=applyPermissions;

  function updateGroupState(){
    const saved=collapsedGroups();
    document.querySelectorAll('.premiumSideSection').forEach(section=>section.classList.toggle('isCollapsed',saved[section.dataset.premiumGroup]===true));
  }

  function installStyles(){
    if($('premiumSidebarStyles'))return;
    const st=document.createElement('style');st.id='premiumSidebarStyles';st.textContent=`
      @media(min-width:981px){
        .nav.navPremiumV2{width:286px;padding:18px 13px 16px;gap:4px;scrollbar-width:thin;scrollbar-color:#33445f transparent}
        .nav.navPremiumV2::-webkit-scrollbar{width:6px}.nav.navPremiumV2::-webkit-scrollbar-thumb{background:#33445f;border-radius:99px}
        .nav.navPremiumV2~*{}body:not(.sidebarCompact) .app{padding-left:326px}
        .nav .sideBrand{padding:7px 7px 16px;margin-bottom:4px;position:relative}.sidebarBrandActions{margin-left:auto}.sidebarIconBtn{width:30px;height:30px;border:0;border-radius:9px;background:rgba(255,255,255,.06);color:#aebdd1;display:grid;place-items:center}.sidebarIconBtn:hover{background:rgba(255,255,255,.1);color:#fff}
        .sidebarSearchBox{height:40px;margin:2px 3px 8px;padding:0 10px;border:1px solid rgba(255,255,255,.08);background:#111f32;border-radius:11px;display:flex;align-items:center;gap:8px;color:#7387a4;transition:.18s}.sidebarSearchBox:focus-within{border-color:#5b6f91;background:#14243a;box-shadow:0 0 0 3px rgba(127,146,178,.09)}.sidebarSearchBox input{border:0!important;box-shadow:none!important;background:transparent!important;color:#e8eef7!important;padding:0!important;height:36px;font-size:11.5px;min-width:0}.sidebarSearchBox input::placeholder{color:#71849f}.sidebarSearchBox>button{display:none;border:0;background:transparent;color:#8da0ba;font-size:18px;padding:0}.sidebarSearchBox.hasValue>button{display:block}
        .premiumSideLabel{padding:10px 11px 5px;color:#647b9b;font-size:8.5px;font-weight:950;letter-spacing:.12em;text-transform:uppercase}
        .nav.navPremiumV2>button[data-v]{min-height:42px;padding:10px 11px;border-radius:11px}.nav.navPremiumV2>button[data-v] .navText{font-size:12.3px}
        .premiumHomeButton{margin:5px 2px 8px!important;background:linear-gradient(135deg,rgba(99,102,241,.22),rgba(59,130,246,.09))!important;border:1px solid rgba(148,163,255,.18)!important;position:relative}.premiumHomeButton .navText{display:grid;gap:1px;line-height:1.1}.premiumHomeButton .navText b{font-size:12.5px}.premiumHomeButton .navText small{font-size:9px;color:#91a5c1;font-weight:650}.premiumHomeBadge{margin-left:auto;font-size:7px;font-weight:950;letter-spacing:.08em;background:#8b9cff;color:#0a1424;border-radius:999px;padding:4px 5px}
        .premiumSidebarGroups{display:grid;gap:5px;margin:1px 0 7px;padding:5px 0 8px;border-top:1px solid rgba(255,255,255,.07);border-bottom:1px solid rgba(255,255,255,.07)}
        .premiumToolsHead{display:flex;align-items:center;justify-content:space-between;padding:7px 8px 3px;color:#7f94b0;font-size:8.5px;font-weight:950;letter-spacing:.1em;text-transform:uppercase}.premiumToolsHead button{width:25px;height:25px;border:0;border-radius:7px;background:transparent;color:#7187a6}.premiumToolsHead button:hover{background:rgba(255,255,255,.06);color:#fff}
        .premiumFavoriteBar{padding:2px 5px 7px}.premiumFavoriteLabel{font-size:8px;color:#667c99;margin:0 4px 5px;text-transform:uppercase;letter-spacing:.08em;font-weight:900}.premiumFavoriteGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:5px}.premiumFavoriteGrid button{min-width:0;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.035);color:#c5d0df;border-radius:9px;padding:7px 3px;display:grid;place-items:center;gap:3px}.premiumFavoriteGrid button:hover{background:rgba(255,255,255,.075);color:#fff}.premiumFavoriteGrid button span{font-size:12px}.premiumFavoriteGrid button small{font-size:7.5px;max-width:52px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#8ea0b8}
        .premiumSideSection{display:grid;gap:1px}.premiumGroupToggle{width:100%;border:0;background:transparent;color:#8397b1;border-radius:9px;padding:8px 8px;display:flex;align-items:center;gap:8px;text-align:left;font-size:9.5px;font-weight:880}.premiumGroupToggle:hover{background:rgba(255,255,255,.035);color:#b7c5d8}.premiumGroupIcon{width:18px;height:18px;border-radius:6px;display:grid;place-items:center;background:rgba(255,255,255,.045);font-size:9px}.premiumGroupCount{margin-left:auto;font-size:8px;color:#647c9c;background:rgba(255,255,255,.04);padding:2px 5px;border-radius:999px}.premiumChevron{font-size:12px;transition:.18s}.premiumSideSection.isCollapsed .premiumChevron{transform:rotate(-90deg)}.premiumSideSection.isCollapsed .premiumGroupItems{display:none}.premiumSideSection.searchExpanded .premiumGroupItems{display:block!important}.premiumSideSection.searchExpanded .premiumChevron{transform:none!important}
        .premiumGroupItems{display:grid;gap:2px;padding:0 2px 2px 8px}.nav .premiumSideBtn{border:0;background:transparent;color:#aebdd1;border-radius:9px;padding:8px 8px;text-align:left;display:flex;align-items:center;gap:8px;width:100%;font-size:11px;font-weight:720;transition:.15s;white-space:normal;position:relative}.nav .premiumSideBtn:hover{background:rgba(255,255,255,.055);color:#fff}.nav .premiumSideBtn.on{background:#20344f;color:#fff;box-shadow:inset 3px 0 0 #8b9cff}.nav .premiumSideBtn.isFavorite .premiumSideText{color:#d6dfec}.premiumSideIcon{width:20px;height:20px;border-radius:6px;background:rgba(255,255,255,.035);display:grid;place-items:center;flex:0 0 20px;font-size:10px}.premiumSideText{min-width:0;flex:1}.premiumPin{opacity:0;color:#7e91aa;font-size:11px;padding:2px}.premiumSideBtn:hover .premiumPin,.premiumSideBtn.isFavorite .premiumPin{opacity:1}.premiumPin:hover{color:#f6c761}
        .menuSearchHidden{display:none!important}.premiumSidebarFocus{outline:3px solid rgba(79,70,229,.18)!important;box-shadow:0 0 0 6px rgba(79,70,229,.07),0 12px 34px rgba(15,23,42,.08)!important;transition:.25s}

        body.sidebarCompact .nav.navPremiumV2{width:78px;padding-left:9px;padding-right:9px;overflow-x:hidden}body.sidebarCompact .app{padding-left:112px}body.sidebarCompact .sideBrand>div:not(.logo),body.sidebarCompact .sidebarSearchBox,body.sidebarCompact .premiumSideLabel,body.sidebarCompact .premiumToolsHead>span,body.sidebarCompact .premiumFavoriteBar,body.sidebarCompact .premiumGroupToggle>span:not(.premiumGroupIcon),body.sidebarCompact .premiumSideText,body.sidebarCompact .premiumPin,body.sidebarCompact .premiumHomeBadge,body.sidebarCompact .sideFooter .adminMini>div,body.sidebarCompact .navText{display:none!important}body.sidebarCompact .sideBrand{justify-content:center;padding-left:0;padding-right:0}body.sidebarCompact .sidebarBrandActions{position:absolute;right:-3px;bottom:2px}body.sidebarCompact .sidebarIconBtn{width:22px;height:22px;font-size:10px}body.sidebarCompact .nav.navPremiumV2>button[data-v],body.sidebarCompact .nav .premiumSideBtn,body.sidebarCompact .premiumGroupToggle{justify-content:center;padding:9px}body.sidebarCompact .premiumGroupItems{padding-left:0}body.sidebarCompact .premiumSideSection.isCollapsed .premiumGroupItems{display:grid}body.sidebarCompact .premiumGroupCount,body.sidebarCompact .premiumChevron{display:none}body.sidebarCompact .premiumHomeButton{min-height:42px}body.sidebarCompact .premiumSideIcon,body.sidebarCompact .premiumGroupIcon{width:24px;height:24px;flex-basis:24px}body.sidebarCompact .sideFooter{padding-left:0;padding-right:0}body.sidebarCompact .sideLogout{font-size:0;text-align:center}body.sidebarCompact .sideLogout:first-letter{font-size:16px}
      }

      .premiumMobileMenuButton{display:none!important}.premiumMobileDrawer{position:fixed;inset:0;z-index:150000;background:rgba(7,14,27,.68);padding:14px;align-items:flex-end;justify-content:center;backdrop-filter:blur(5px)}.premiumMobileDrawer:not(.hide){display:flex}.premiumDrawerOpen{overflow:hidden}.premiumMobilePanel{width:min(100%,760px);max-height:88vh;overflow:auto;background:#fff;border-radius:26px 26px 18px 18px;padding:10px 16px 20px;box-shadow:0 -20px 70px rgba(0,0,0,.3)}.premiumMobileHandle{width:42px;height:4px;border-radius:99px;background:#d5dae2;margin:1px auto 10px}.premiumMobileHead{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;position:sticky;top:-10px;background:#fff;padding:8px 0 12px;z-index:3;border-bottom:1px solid #f0f2f5}.premiumMobileHead h3{margin:4px 0 2px}.premiumMobileHead small{color:#8993a2}.premiumMobileHead>button{width:38px;height:38px;border:0;border-radius:50%;background:#f1f5f9;font-size:22px}.premiumMobileSearch{display:flex;align-items:center;gap:8px;margin:12px 0 4px;padding:0 12px;height:44px;border:1px solid #e2e7ee;border-radius:13px;background:#f8fafc}.premiumMobileSearch input{border:0!important;box-shadow:none!important;background:transparent!important;padding:0!important}.premiumMobileGroup{margin-top:16px}.premiumMobileGroup>b{display:block;font-size:10px;color:#64748b;margin-bottom:8px;text-transform:uppercase;letter-spacing:.08em}.premiumMobileGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.premiumMobileGrid button{border:1px solid #e5e7eb;background:#fff;border-radius:14px;padding:12px 8px;display:grid;gap:6px;place-items:center;color:#172033;min-height:76px}.premiumMobileGrid button:active{background:#f8fafc}.premiumMobileGrid button span{font-size:19px}.premiumMobileGrid button small{font-size:9px;line-height:1.25;text-align:center}.premiumMenuEmpty{text-align:center;color:#8a94a4;padding:34px 12px}.premiumSidebarFocus{scroll-margin-top:24px}

      @media(max-width:980px){
        body.sidebarCompact .app{padding-left:24px}.nav.navPremiumV2 .premiumSidebarGroups,.nav.navPremiumV2 .sidebarSearchBox,.nav.navPremiumV2 .premiumSideLabel{display:none!important}.nav.navPremiumV2 .premiumHomeButton{display:none!important}.nav.navPremiumV2 #usersNav,.nav.navPremiumV2 [data-v="usuarios"],.nav.navPremiumV2 [data-v="config"],.nav.navPremiumV2 [data-v="produtos"],.nav.navPremiumV2 [data-v="historico"],.nav.navPremiumV2 [data-v="contrato"]{display:none!important}.nav.navPremiumV2 .premiumMobileMenuButton{display:flex!important;min-width:52px;justify-content:center;flex-direction:column;gap:3px;padding:9px 10px}.nav.navPremiumV2 .premiumMobileMenuButton .navText{display:block!important;font-size:9px}.sidebarBrandActions{display:none}.premiumMobileGrid{grid-template-columns:repeat(3,minmax(0,1fr))}
      }
      @media(max-width:520px){.premiumMobileGrid{grid-template-columns:repeat(2,minmax(0,1fr))}.premiumMobilePanel{padding-left:12px;padding-right:12px}.premiumMobileGrid button{min-height:72px}}
    `;
    document.head.appendChild(st);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,1200));
  else setTimeout(install,1200);
})();
