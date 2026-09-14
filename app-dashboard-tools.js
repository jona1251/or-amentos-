(function(){
  const FEATURES=[
    {group:'Orçamentos e pagamentos',key:'approval',icon:'↗',label:'Aprovação por link',desc:'Envie o orçamento para o cliente aprovar ou recusar.',perm:'orcamentos',view:'historico',hint:'Escolha um orçamento e use o botão “Aprovação”.'},
    {group:'Orçamentos e pagamentos',key:'pix',icon:'▦',label:'PIX / QR Code',desc:'Gere o PIX do orçamento com valor e QR Code.',perm:'financeiro',view:'historico',hint:'Escolha um orçamento e use o botão “PIX”.'},
    {group:'Orçamentos e pagamentos',key:'payment',icon:'$',label:'Link de pagamento',desc:'Crie uma página de pagamento para o cliente.',perm:'financeiro',view:'historico',hint:'Escolha um orçamento e use o botão “Pagamento”.'},
    {group:'Orçamentos e pagamentos',key:'receivables',icon:'R$',label:'Contas a receber',desc:'Acompanhe cobranças, vencimentos e recebimentos.',perm:'financeiro',view:'financeiro'},
    {group:'Orçamentos e pagamentos',key:'signature',icon:'✎',label:'Assinatura digital',desc:'Gere links para assinatura de contratos.',perm:'contratos',view:'contrato',hint:'Abra um contrato salvo e use “Assinar”.'},

    {group:'Operações',key:'expenses',icon:'↘',label:'Despesas / Caixa',desc:'Registre gastos e acompanhe saídas.',perm:'operacoes',tab:'ops',heading:'Despesas e fluxo de caixa'},
    {group:'Operações',key:'agenda',icon:'□',label:'Agenda de serviços',desc:'Organize visitas, instalações e compromissos.',perm:'operacoes',tab:'ops',heading:'Agenda de serviços'},
    {group:'Operações',key:'os',icon:'✓',label:'Ordens de serviço',desc:'Checklist, fotos e assinatura do cliente.',perm:'operacoes',tab:'ops',heading:'Ordens de serviço'},
    {group:'Operações',key:'stock',icon:'▦',label:'Estoque',desc:'Entradas, saídas e alertas de estoque baixo.',perm:'operacoes',tab:'ops',heading:'Estoque'},
    {group:'Operações',key:'suppliers',icon:'♟',label:'Fornecedores',desc:'Cadastre fornecedores e dados de contato.',perm:'operacoes',tab:'ops',heading:'Fornecedores'},
    {group:'Operações',key:'purchases',icon:'▤',label:'Pedidos de compra',desc:'Registre reposições e acompanhe compras.',perm:'operacoes',tab:'ops',heading:'Pedidos de compra'},

    {group:'Comercial',key:'crm',icon:'◎',label:'CRM / Funil',desc:'Acompanhe oportunidades e etapas de venda.',perm:'crm',tab:'sales',heading:'CRM / Funil de clientes'},
    {group:'Comercial',key:'follow',icon:'↻',label:'Follow-ups',desc:'Organize retornos, cobranças e contatos.',perm:'crm',tab:'sales',heading:'Follow-ups e lembretes'},
    {group:'Comercial',key:'templates',icon:'▧',label:'Modelos',desc:'Textos prontos para orçamento e contrato.',perm:'crm',tab:'sales',heading:'Modelos'},
    {group:'Comercial',key:'loyalty',icon:'★',label:'Cupons / Fidelidade',desc:'Crie benefícios e ações para clientes.',perm:'crm',tab:'sales',heading:'Cupons e fidelidade'},
    {group:'Comercial',key:'commissions',icon:'%',label:'Comissões',desc:'Controle comissões por vendedor ou serviço.',perm:'crm',tab:'sales',heading:'Comissões'},
    {group:'Comercial',key:'tags',icon:'#',label:'Tags / Campos',desc:'Organize registros com categorias e campos extras.',perm:'crm',tab:'sales',heading:'Tags, categorias e campos personalizados'},

    {group:'Gestão',key:'search',icon:'⌕',label:'Busca global',desc:'Pesquise clientes, produtos e documentos.',perm:'relatorios',tab:'manage',heading:'Busca global'},
    {group:'Gestão',key:'reports',icon:'▥',label:'Relatórios / Excel',desc:'Exporte dados e gere relatórios gerenciais.',perm:'relatorios',tab:'manage',heading:'Relatórios e exportações'},
    {group:'Gestão',key:'backup',icon:'⬒',label:'Backups',desc:'Crie cópias dos dados do usuário.',perm:'relatorios',tab:'manage',heading:'Backup automático'},
    {group:'Gestão',key:'trash',icon:'♲',label:'Lixeira',desc:'Restaure registros removidos recentemente.',perm:'relatorios',tab:'manage',heading:'Lixeira'},
    {group:'Gestão',key:'brand',icon:'◇',label:'Multiempresa / Marca',desc:'Perfis de empresa, tema e identidade visual.',perm:'relatorios',tab:'manage',heading:'Multiempresa / White-label'},
    {group:'Gestão',key:'audit',icon:'◉',label:'Auditoria',desc:'Veja ações e visão consolidada dos usuários.',perm:'relatorios',tab:'manage',heading:'Auditoria e visão do administrador'},

    {group:'Inteligência',key:'ai',icon:'✦',label:'Assistente inteligente',desc:'Crie textos e mensagens para o atendimento.',perm:'relatorios',tab:'ai',heading:'Assistente inteligente'},
    {group:'Inteligência',key:'margin',icon:'△',label:'Margem e preço',desc:'Compare custo, venda e margem dos produtos.',perm:'custos',tab:'ai',heading:'Margem e preço'},
    {group:'Inteligência',key:'insights',icon:'◫',label:'Insights do negócio',desc:'Veja sugestões com base nos dados atuais.',perm:'relatorios',tab:'ai',heading:'Insights automáticos'},

    {group:'Segurança',key:'twofa',icon:'⊛',label:'Autenticação 2FA',desc:'Ative uma segunda etapa de autenticação.',perm:'seguranca',tab:'security',heading:'Autenticação em duas etapas'},
    {group:'Segurança',key:'sessions',icon:'▱',label:'Sessões / Dispositivos',desc:'Consulte acessos e encerre sessões.',perm:'seguranca',tab:'security',heading:'Sessões e dispositivos'},
    {group:'Segurança',key:'permissions',icon:'⌘',label:'Permissões de usuários',desc:'Controle o que cada usuário pode acessar.',perm:'usuarios',view:'usuarios',target:'userAccessControlCard'},
    {group:'Segurança',key:'security',icon:'◈',label:'Segurança / Auditoria',desc:'Rate limit, alertas de login e controles avançados.',perm:'seguranca',tab:'security',heading:'Segurança e auditoria'}
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

  function removeOldPremiumNavigation(){
    const selectors=['#premiumSidebarGroups','#premiumMobileMenuButton','#premiumMobileDrawer','#sidebarSearchBox','#coreSideLabel','#adminSideLabel','#sidebarBrandActions'];
    selectors.forEach(s=>document.querySelectorAll(s).forEach(x=>x.remove()));
    document.querySelectorAll('#nav [data-v="suite"],#nav [data-v="financeiro"],#nav [data-v="security"],#nav [data-v="seguranca"],#securityNav').forEach(x=>x.remove());
    document.getElementById('nav')?.classList.remove('navPremiumV2','navCompact');
  }

  function installDashboard(){
    const painel=$('painel');
    if(!painel||$('dashboardAdvancedTools'))return;
    const section=document.createElement('div');
    section.id='dashboardAdvancedTools';
    section.className='dashboardAdvancedTools';
    section.innerHTML=`
      <div class="advancedToolsHeader">
        <div>
          <span class="eyebrow">FERRAMENTAS DO SISTEMA</span>
          <h2>Recursos avançados</h2>
          <p>Todas as funções avançadas ficam centralizadas aqui no Painel principal.</p>
        </div>
        <div class="advancedSearch"><span>⌕</span><input id="dashboardToolSearch" type="search" placeholder="Buscar ferramenta..."><button type="button" id="dashboardToolClear">×</button></div>
      </div>
      <div id="dashboardToolGroups"></div>`;
    painel.appendChild(section);
    installStyles();
    renderTools();
    $('dashboardToolSearch')?.addEventListener('input',e=>renderTools(e.target.value));
    $('dashboardToolClear')?.addEventListener('click',()=>{const i=$('dashboardToolSearch');if(i){i.value='';renderTools('');i.focus()}});
  }

  function renderTools(query=''){
    const host=$('dashboardToolGroups');if(!host)return;
    const q=normalize(query);
    const groups=new Map();
    FEATURES.filter(f=>hasAccess(f.perm)).filter(f=>!q||normalize(f.label+' '+f.desc+' '+f.group).includes(q)).forEach(f=>{
      if(!groups.has(f.group))groups.set(f.group,[]);groups.get(f.group).push(f);
    });
    if(!groups.size){host.innerHTML='<div class="advancedEmpty">Nenhuma ferramenta encontrada para esta busca ou para as permissões deste usuário.</div>';return}
    host.innerHTML=[...groups.entries()].map(([group,items])=>`
      <section class="advancedToolGroup">
        <div class="advancedGroupHead"><h3>${group}</h3><span>${items.length} ferramenta${items.length===1?'':'s'}</span></div>
        <div class="advancedToolGrid">${items.map(f=>`
          <button type="button" class="advancedToolCard" onclick="openDashboardTool('${f.key}')">
            <span class="advancedToolIcon">${f.icon}</span>
            <span class="advancedToolText"><b>${f.label}</b><small>${f.desc}</small></span>
            <span class="advancedToolArrow">›</span>
          </button>`).join('')}</div>
      </section>`).join('');
  }
  window.refreshDashboardTools=()=>renderTools($('dashboardToolSearch')?.value||'');

  function findSuiteCard(heading){
    if(!heading)return null;
    const target=normalize(heading);
    const h=[...document.querySelectorAll('#suiteBody h3')].find(el=>normalize(el.textContent).includes(target)||target.includes(normalize(el.textContent)));
    return h?.closest('.suiteCard')||h?.parentElement||null;
  }

  function prepareInternalFeaturePage(item){
    const top=document.querySelector('#suite .suiteTop');
    const tabs=document.querySelector('#suite .suiteTabs');
    if(top)top.style.display='none';
    if(tabs)tabs.style.display='none';
    const title=$('pageTitle'),sub=$('pageSubtitle');
    if(title)title.textContent=item.label;
    if(sub)sub.textContent=item.desc;
  }

  function focusSuiteCard(item){
    if(!item.heading)return;
    let tries=0;
    const seek=()=>{
      const card=findSuiteCard(item.heading);
      if(card){
        document.querySelectorAll('#suiteBody .dashboardFeatureFocus').forEach(x=>x.classList.remove('dashboardFeatureFocus'));
        card.classList.add('dashboardFeatureFocus');
        card.scrollIntoView({behavior:'smooth',block:'start'});
        setTimeout(()=>card.classList.remove('dashboardFeatureFocus'),2200);
      }else if(++tries<10)setTimeout(seek,160);
    };
    setTimeout(seek,120);
  }

  function openInternal(item){
    internalOpen=true;
    try{
      if(typeof window.openSuite==='function')window.openSuite(item.tab||'overview');
      else{
        window.__dashboardToolBypass=true;
        window.__orcaOriginalGo?.('suite')||window.go?.('suite');
        window.suiteTab?.(item.tab||'overview');
      }
    }finally{
      setTimeout(()=>{internalOpen=false;window.__dashboardToolBypass=false},50);
    }
    setTimeout(()=>{prepareInternalFeaturePage(item);focusSuiteCard(item)},80);
  }

  window.openDashboardTool=function(key){
    const item=FEATURES.find(x=>x.key===key);if(!item)return;
    if(!hasAccess(item.perm)){window.toast?.('Seu usuário não tem acesso a esta função');return}
    if(item.view){
      window.go?.(item.view);
      if(item.view==='financeiro')window.premiumReloadFinance?.();
      if(item.target){let n=0;const seek=()=>{const el=$(item.target);if(el){el.scrollIntoView({behavior:'smooth',block:'start'});el.classList.add('dashboardFeatureFocus');setTimeout(()=>el.classList.remove('dashboardFeatureFocus'),2200)}else if(++n<10)setTimeout(seek,160)};setTimeout(seek,100)}
      if(item.hint)setTimeout(()=>window.toast?.(item.hint),180);
      return;
    }
    openInternal(item);
  };

  function guardSuiteAccess(){
    const oldGo=window.go;
    if(typeof oldGo==='function'&&!oldGo.__dashboardOnlyWrapped){
      const guarded=function(view){
        if(view==='suite'&&!internalOpen&&!window.__dashboardToolBypass){
          window.toast?.('As ferramentas avançadas ficam no Painel principal');
          return oldGo('painel');
        }
        return oldGo.apply(this,arguments);
      };
      guarded.__dashboardOnlyWrapped=true;
      window.go=guarded;
    }

    const oldOpen=window.openSuite;
    if(typeof oldOpen==='function'&&!oldOpen.__dashboardOnlyWrapped){
      const guardedOpen=function(tab){
        if(!internalOpen&&!window.__dashboardToolBypass){
          window.toast?.('Abra esta função pelo Painel principal');
          return window.go?.('painel');
        }
        return oldOpen.apply(this,arguments);
      };
      guardedOpen.__dashboardOnlyWrapped=true;
      window.openSuite=guardedOpen;
    }
  }

  function installStyles(){
    if($('dashboardAdvancedToolsStyles'))return;
    const style=document.createElement('style');style.id='dashboardAdvancedToolsStyles';style.textContent=`
      .dashboardAdvancedTools{margin-top:18px}.advancedToolsHeader{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;background:linear-gradient(135deg,#0f172a,#17243a);border-radius:20px 20px 0 0;padding:22px 24px;color:#fff}.advancedToolsHeader .eyebrow{background:rgba(255,255,255,.1);color:#dbe7f6}.advancedToolsHeader h2{margin:8px 0 5px;font-size:23px;letter-spacing:-.025em}.advancedToolsHeader p{margin:0;color:#aebdd1;font-size:12px}.advancedSearch{width:min(360px,100%);height:43px;display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:0 10px}.advancedSearch input{border:0!important;background:transparent!important;color:#fff!important;box-shadow:none!important;padding:8px 0}.advancedSearch input::placeholder{color:#9fb0c8}.advancedSearch button{border:0;background:transparent;color:#c8d3e3;font-size:20px}.advancedSearch span{color:#9fb0c8}.advancedToolGroup{background:#fff;border:1px solid #e5e7eb;border-top:0;padding:19px 21px}.advancedToolGroup:last-child{border-radius:0 0 20px 20px}.advancedGroupHead{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:11px}.advancedGroupHead h3{margin:0;font-size:14px}.advancedGroupHead span{font-size:10px;font-weight:850;color:#7a8493;background:#f3f5f8;padding:5px 8px;border-radius:999px}.advancedToolGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.advancedToolCard{border:1px solid #e5e9ef;background:#fff;border-radius:14px;padding:13px;text-align:left;display:grid;grid-template-columns:38px 1fr 16px;gap:11px;align-items:center;transition:.16s}.advancedToolCard:hover{transform:translateY(-1px);border-color:#cdd5e0;box-shadow:0 9px 24px rgba(15,23,42,.06)}.advancedToolIcon{width:38px;height:38px;border-radius:11px;background:#f3f6fa;color:#172033;display:grid;place-items:center;font-weight:900}.advancedToolText{min-width:0}.advancedToolText b{display:block;font-size:12px;color:#172033}.advancedToolText small{display:block;margin-top:4px;color:#7a8493;font-size:10px;line-height:1.35}.advancedToolArrow{font-size:22px;color:#a0a9b6;text-align:right}.advancedEmpty{padding:28px;background:#fff;border:1px solid #e5e7eb;border-radius:0 0 20px 20px;color:#7a8493;text-align:center}.dashboardFeatureFocus{outline:3px solid rgba(79,70,229,.18)!important;box-shadow:0 0 0 6px rgba(79,70,229,.06),0 12px 32px rgba(15,23,42,.08)!important}.view#suite .suiteTop,.view#suite .suiteTabs{display:none}.nav [data-v="suite"],.nav [data-v="financeiro"],.nav [data-v="security"],.nav [data-v="seguranca"],#securityNav{display:none!important}@media(max-width:980px){.advancedToolGrid{grid-template-columns:repeat(2,minmax(0,1fr))}.advancedToolsHeader{align-items:stretch;flex-direction:column}.advancedSearch{width:100%}}@media(max-width:620px){.advancedToolGrid{grid-template-columns:1fr}.advancedToolsHeader{padding:18px}.advancedToolGroup{padding:15px}.advancedToolCard{grid-template-columns:36px 1fr 14px}.advancedToolText small{font-size:10.5px}}
    `;document.head.appendChild(style);
  }

  function periodic(){removeOldPremiumNavigation();guardSuiteAccess();if(!$('dashboardAdvancedTools'))installDashboard();renderTools($('dashboardToolSearch')?.value||'')}

  function init(){
    if(installed)return;installed=true;
    removeOldPremiumNavigation();
    installDashboard();
    guardSuiteAccess();
    const nav=$('nav');if(nav)new MutationObserver(()=>removeOldPremiumNavigation()).observe(nav,{childList:true,subtree:true});
    setInterval(periodic,3000);
    window.addEventListener('online',()=>window.refreshDashboardTools?.());
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,1200));else setTimeout(init,1200);
})();
