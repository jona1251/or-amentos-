(function(){
  const FEATURES=[
    {group:'Premium+',key:'premium_home',icon:'◆',label:'Visão Premium+',perm:'dashboard',tab:'overview',title:'Visão geral'},
    {group:'Orçamentos & pagamentos',key:'premium_approval',icon:'🔗',label:'Aprovação por link',perm:'orcamentos',view:'historico',hint:'Escolha um orçamento e use o botão “Aprovação”.'},
    {group:'Orçamentos & pagamentos',key:'premium_pix',icon:'▦',label:'PIX / QR Code',perm:'financeiro',view:'historico',hint:'Escolha um orçamento e use o botão “PIX”.'},
    {group:'Orçamentos & pagamentos',key:'premium_payment',icon:'💳',label:'Link de pagamento',perm:'financeiro',view:'historico',hint:'Escolha um orçamento e use o botão “Pagamento”.'},
    {group:'Orçamentos & pagamentos',key:'premium_receivables',icon:'R$',label:'Contas a receber',perm:'financeiro',view:'financeiro'},
    {group:'Orçamentos & pagamentos',key:'premium_signature',icon:'✍',label:'Assinatura digital',perm:'contratos',view:'contrato',hint:'Abra um contrato salvo e use “Assinar”.'},

    {group:'Operações',key:'premium_expenses',icon:'↘',label:'Despesas / Caixa',perm:'operacoes',tab:'ops',heading:'Despesas e fluxo de caixa'},
    {group:'Operações',key:'premium_agenda',icon:'▣',label:'Agenda de serviços',perm:'operacoes',tab:'ops',heading:'Agenda de serviços'},
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
    {group:'Segurança',key:'premium_access',icon:'🔐',label:'Permissões de usuários',perm:'usuarios',view:'usuarios',target:'userAccessControlCard'},
    {group:'Segurança',key:'premium_security',icon:'盾',label:'Segurança / Auditoria',perm:'seguranca',tab:'security',heading:'Segurança e auditoria'}
  ];

  const $=id=>document.getElementById(id);
  let activeKey='';

  function hasAccess(permission){
    if(!permission)return true;
    if(typeof window.orcaHasAccess==='function')return window.orcaHasAccess(permission);
    return true;
  }

  function groupedFeatures(){
    const map=new Map();
    FEATURES.forEach(item=>{if(!map.has(item.group))map.set(item.group,[]);map.get(item.group).push(item)});
    return map;
  }

  function install(){
    const nav=$('nav');if(!nav||$('premiumSidebarGroups'))return;
    const suiteBtn=nav.querySelector('[data-v="suite"]');
    if(suiteBtn){
      suiteBtn.innerHTML='<span class="navIcon">◆</span><span class="navText">Premium+</span>';
      suiteBtn.title='Visão geral Premium+';
    }

    const root=document.createElement('div');root.id='premiumSidebarGroups';root.className='premiumSidebarGroups';
    let html='';
    for(const [group,items] of groupedFeatures()){
      html+=`<div class="premiumSideSection" data-premium-group="${group}"><div class="premiumSideLabel">${group}</div>`;
      html+=items.map(item=>`<button type="button" class="premiumSideBtn" data-premium-key="${item.key}" data-premium-permission="${item.perm||''}" onclick="openPremiumSide('${item.key}')"><span class="premiumSideIcon">${item.icon}</span><span>${item.label}</span></button>`).join('');
      html+='</div>';
    }
    root.innerHTML=html;
    const config=nav.querySelector('[data-v="config"]');
    nav.insertBefore(root,config||nav.querySelector('.sideSpacer'));
    installMobileLauncher(nav);
    installStyles();
    applyPermissions();

    nav.addEventListener('click',e=>{
      const b=e.target.closest('button[data-v]');
      if(b&&!b.closest('#premiumSidebarGroups')&&b.dataset.v!=='suite')setActive('');
    });
  }

  function installMobileLauncher(nav){
    if($('premiumMobileMenuButton'))return;
    const b=document.createElement('button');
    b.id='premiumMobileMenuButton';b.type='button';b.className='premiumMobileMenuButton';
    b.innerHTML='<span class="navIcon">◆</span><span class="navText">Premium+</span>';
    b.onclick=()=>toggleMobileDrawer(true);
    const config=nav.querySelector('[data-v="config"]');nav.insertBefore(b,config||nav.querySelector('.sideSpacer'));

    const drawer=document.createElement('div');drawer.id='premiumMobileDrawer';drawer.className='premiumMobileDrawer hide';
    drawer.innerHTML='<div class="premiumMobilePanel"><div class="premiumMobileHead"><div><span class="eyebrow">PREMIUM+</span><h3>Todos os recursos</h3></div><button type="button" onclick="closePremiumMobileMenu()">×</button></div><div id="premiumMobileContent"></div></div>';
    drawer.addEventListener('click',e=>{if(e.target===drawer)toggleMobileDrawer(false)});
    document.body.appendChild(drawer);
    renderMobileDrawer();
  }

  function renderMobileDrawer(){
    const host=$('premiumMobileContent');if(!host)return;
    let html='';
    for(const [group,items] of groupedFeatures()){
      const visible=items.filter(x=>hasAccess(x.perm));if(!visible.length)continue;
      html+=`<div class="premiumMobileGroup"><b>${group}</b><div class="premiumMobileGrid">${visible.map(item=>`<button type="button" onclick="openPremiumSide('${item.key}');closePremiumMobileMenu()"><span>${item.icon}</span><small>${item.label}</small></button>`).join('')}</div></div>`;
    }
    host.innerHTML=html;
  }

  function toggleMobileDrawer(on){const d=$('premiumMobileDrawer');if(d)d.classList.toggle('hide',!on)}
  window.closePremiumMobileMenu=()=>toggleMobileDrawer(false);

  function setActive(key){
    activeKey=key||'';
    document.querySelectorAll('[data-premium-key]').forEach(b=>b.classList.toggle('on',b.dataset.premiumKey===activeKey));
  }

  function normalize(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()}
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
      if(++tries<8)setTimeout(run,180);
    };
    setTimeout(run,120);
  }

  function openStandardView(item){
    if(typeof window.go==='function')window.go(item.view);
    if(item.view==='financeiro')window.premiumReloadFinance?.();
    if(item.target){
      let tries=0;const seek=()=>{const el=$(item.target);if(el){el.scrollIntoView({behavior:'smooth',block:'start'});el.classList.add('premiumSidebarFocus');setTimeout(()=>el.classList.remove('premiumSidebarFocus'),2200)}else if(++tries<8)setTimeout(seek,180)};setTimeout(seek,120);
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
      const p=b.dataset.premiumPermission;b.style.display=!p||hasAccess(p)?'':'none';
    });
    document.querySelectorAll('#premiumSidebarGroups .premiumSideSection').forEach(section=>{
      const any=[...section.querySelectorAll('.premiumSideBtn')].some(b=>b.style.display!=='none');section.style.display=any?'':'none';
    });
    const groups=$('premiumSidebarGroups');if(groups){const any=[...groups.querySelectorAll('.premiumSideBtn')].some(b=>b.style.display!=='none');groups.style.display=any?'':'none'}
    const mobile=$('premiumMobileMenuButton');if(mobile){const any=FEATURES.some(x=>hasAccess(x.perm));mobile.style.display=any?'':'none'}
    renderMobileDrawer();
  }
  window.refreshPremiumSidebar=applyPermissions;

  function installStyles(){
    if($('premiumSidebarStyles'))return;
    const st=document.createElement('style');st.id='premiumSidebarStyles';st.textContent=`
      .premiumSidebarGroups{display:grid;gap:8px;margin:4px 0 7px;padding:8px 0 10px;border-top:1px solid rgba(255,255,255,.08);border-bottom:1px solid rgba(255,255,255,.08)}
      .premiumSideSection{display:grid;gap:3px}.premiumSideLabel{padding:8px 12px 4px;color:#7085a3;font-size:9px;font-weight:950;letter-spacing:.09em;text-transform:uppercase}
      .nav .premiumSideBtn{border:0;background:transparent;color:#aebdd1;border-radius:10px;padding:9px 11px;text-align:left;display:flex;align-items:center;gap:10px;width:100%;font-size:11.5px;font-weight:760;transition:.15s;white-space:normal}
      .nav .premiumSideBtn:hover{background:rgba(255,255,255,.055);color:#fff}.nav .premiumSideBtn.on{background:#21344f;color:#fff;box-shadow:inset 3px 0 0 #8b9cff}
      .premiumSideIcon{width:18px;text-align:center;flex:0 0 18px;font-size:12px}.premiumSidebarFocus{outline:3px solid rgba(79,70,229,.18)!important;box-shadow:0 0 0 6px rgba(79,70,229,.07),0 12px 34px rgba(15,23,42,.08)!important;transition:.25s}
      .premiumMobileMenuButton{display:none!important}.premiumMobileDrawer{position:fixed;inset:0;z-index:150000;background:rgba(7,14,27,.66);padding:14px;align-items:flex-end;justify-content:center}.premiumMobileDrawer:not(.hide){display:flex}.premiumMobilePanel{width:min(100%,720px);max-height:86vh;overflow:auto;background:#fff;border-radius:24px 24px 18px 18px;padding:18px;box-shadow:0 -20px 70px rgba(0,0,0,.28)}
      .premiumMobileHead{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;position:sticky;top:-18px;background:#fff;padding:4px 0 12px;z-index:2}.premiumMobileHead h3{margin:5px 0 0}.premiumMobileHead>button{width:38px;height:38px;border:0;border-radius:50%;background:#f1f5f9;font-size:22px}
      .premiumMobileGroup{margin-top:14px}.premiumMobileGroup>b{display:block;font-size:11px;color:#64748b;margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em}.premiumMobileGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.premiumMobileGrid button{border:1px solid #e5e7eb;background:#fff;border-radius:14px;padding:12px 8px;display:grid;gap:6px;place-items:center;color:#172033}.premiumMobileGrid button span{font-size:19px}.premiumMobileGrid button small{font-size:10px;font-weight:800;text-align:center;line-height:1.25}
      @media(max-width:980px){.premiumSidebarGroups{display:none!important}.nav #premiumMobileMenuButton{display:flex!important;border:0;background:transparent;color:#c8d3e3;border-radius:12px;padding:10px 11px;min-width:48px;justify-content:center;flex-direction:column;gap:3px;font-weight:700}.nav #premiumMobileMenuButton:hover{background:rgba(255,255,255,.055);color:#fff}.nav [data-v="suite"]{display:none!important}}
      @media(max-width:540px){.premiumMobileGrid{grid-template-columns:repeat(2,minmax(0,1fr))}.premiumMobilePanel{padding:16px 13px}}
    `;document.head.appendChild(st);
  }

  function refreshLoop(){applyPermissions();if(activeKey){const b=document.querySelector(`[data-premium-key="${activeKey}"]`);if(b&&b.style.display==='none')setActive('')}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,1000));else setTimeout(install,1000);
  setInterval(refreshLoop,3000);
})();
