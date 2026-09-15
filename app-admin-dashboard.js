(function(){
  const $=id=>document.getElementById(id);
  const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0));
  let refreshing=false;
  let timer=null;

  function isAdmin(){return String(window.auth?.role||'admin').toLowerCase()==='admin'}
  function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
  async function all(store){try{return await window.localAll?.(store)||[]}catch(_){return []}}
  function statusOf(b){return String(b?.status||'Rascunho').toLowerCase()}
  function greeting(){const h=new Date().getHours();return h<12?'Bom dia':h<18?'Boa tarde':'Boa noite'}
  function daysUntil(date){return Math.ceil((date.getTime()-Date.now())/86400000)}

  function installStyles(){
    if($('adminDashboardProStyles'))return;
    const s=document.createElement('style');s.id='adminDashboardProStyles';s.textContent=`
      .adminDashboardPro{margin-bottom:18px}.adminDashHero{position:relative;overflow:hidden;border-radius:22px;padding:22px 24px;background:linear-gradient(135deg,#0b1424 0%,#13233b 58%,#1d3150 100%);color:#fff;box-shadow:0 18px 48px rgba(15,23,42,.12)}.adminDashHero:before{content:"";position:absolute;width:260px;height:260px;border-radius:50%;right:-95px;top:-145px;background:rgba(99,102,241,.16)}.adminDashHero:after{content:"";position:absolute;width:180px;height:180px;border-radius:50%;left:38%;bottom:-150px;background:rgba(244,185,95,.09)}.adminDashHeroTop{position:relative;z-index:1;display:flex;align-items:flex-start;justify-content:space-between;gap:18px}.adminDashEyebrow{display:inline-flex;padding:5px 8px;border-radius:999px;background:rgba(255,255,255,.08);color:#c8d5e5;font-size:9px;font-weight:900;letter-spacing:.06em}.adminDashHero h2{margin:9px 0 5px;font-size:24px;letter-spacing:-.035em}.adminDashHero p{margin:0;color:#aebdd1;font-size:11px;line-height:1.5}.adminDashStatus{display:flex;align-items:center;gap:7px;white-space:nowrap;padding:7px 10px;border:1px solid rgba(255,255,255,.1);border-radius:999px;background:rgba(255,255,255,.06);font-size:9px;font-weight:850;color:#dbe6f3}.adminDashStatus i{width:7px;height:7px;border-radius:50%;background:#34d399;box-shadow:0 0 0 4px rgba(52,211,153,.09)}.adminDashStatus.local i{background:#f59e0b;box-shadow:0 0 0 4px rgba(245,158,11,.09)}
      .adminDashMetrics{position:relative;z-index:1;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin-top:18px}.adminDashMetric{padding:12px;border-radius:14px;background:rgba(255,255,255,.075);border:1px solid rgba(255,255,255,.08)}.adminDashMetric small{display:block;color:#9fb0c8;font-size:9px;text-transform:uppercase;letter-spacing:.04em}.adminDashMetric b{display:block;margin-top:5px;font-size:16px;letter-spacing:-.02em}.adminDashMetric.attention b{color:#fde68a}
      .adminDashBody{display:grid;grid-template-columns:1.05fr .95fr;gap:14px;margin-top:14px}.adminDashPanel{background:#fff;border:1px solid #e5e9f0;border-radius:18px;padding:17px 18px;box-shadow:0 8px 28px rgba(15,23,42,.04)}.adminDashPanelHead{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}.adminDashPanelHead h3{margin:0;font-size:14px;color:#172033}.adminDashPanelHead p{margin:4px 0 0;color:#8791a1;font-size:9.5px}.adminDashQuick{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.adminDashQuick button{border:1px solid #e5e9f0;background:#fff;border-radius:13px;padding:11px;display:flex;align-items:center;gap:10px;text-align:left;color:#172033;transition:.15s}.adminDashQuick button:hover{border-color:#cfd6df;box-shadow:0 7px 18px rgba(15,23,42,.045);transform:translateY(-1px)}.adminDashQuickIcon{width:34px;height:34px;border-radius:10px;background:#f1f5f9;display:grid;place-items:center;font-weight:950;flex:0 0 auto}.adminDashQuick b{display:block;font-size:10.5px}.adminDashQuick small{display:block;color:#8791a1;font-size:8.7px;margin-top:2px}.adminDashRecent{display:grid;gap:0}.adminDashRecentRow{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid #eef1f5}.adminDashRecentRow:last-child{border-bottom:0}.adminDashRecentRow b{display:block;font-size:10.5px;color:#172033}.adminDashRecentRow small{display:block;font-size:8.8px;color:#8791a1;margin-top:3px}.adminDashRecentValue{text-align:right}.adminDashRecentValue strong{display:block;font-size:10.5px;color:#172033}.adminDashPill{display:inline-flex;margin-top:4px;padding:4px 6px;border-radius:999px;background:#f1f5f9;color:#64748b;font-size:8px;font-weight:850}.adminDashPill.aprovado{background:#ecfdf3;color:#067647}.adminDashPill.enviado,.adminDashPill.visualizado{background:#eef2ff;color:#4338ca}.adminDashEmpty{padding:18px 0;text-align:center;color:#8791a1;font-size:10px}
      @media(max-width:900px){.adminDashMetrics{grid-template-columns:1fr 1fr}.adminDashBody{grid-template-columns:1fr}}
      @media(max-width:560px){.adminDashHero{padding:18px}.adminDashHeroTop{flex-direction:column}.adminDashMetrics{grid-template-columns:1fr 1fr}.adminDashQuick{grid-template-columns:1fr}.adminDashHero h2{font-size:21px}}
    `;document.head.appendChild(s);
  }

  function install(){
    const painel=$('painel');if(!painel||$('adminDashboardPro')||!isAdmin())return;
    const box=document.createElement('div');box.id='adminDashboardPro';box.className='adminDashboardPro';
    painel.insertBefore(box,painel.firstChild);installStyles();refresh();
  }

  async function refresh(){
    if(refreshing||!isAdmin())return;const painel=$('painel');if(!painel?.classList.contains('on'))return;
    refreshing=true;
    try{
      const [budgets,clients,contracts]=await Promise.all([all('budgets'),all('clients'),all('contracts')]);
      const approved=budgets.filter(b=>statusOf(b)==='aprovado');
      const awaiting=budgets.filter(b=>['enviado','visualizado'].includes(statusOf(b)));
      const totalApproved=approved.reduce((s,b)=>s+Number(b.total||0),0);
      const expiring=budgets.filter(b=>{
        if(['aprovado','recusado','concluído','concluido'].includes(statusOf(b)))return false;
        const created=new Date(b.createdAt||b.updatedAt||Date.now());const d=new Date(created.getTime()+Number(b.validDays||10)*86400000);const left=daysUntil(d);return left>=0&&left<=3;
      });
      const recent=[...budgets].sort((a,b)=>new Date(b.updatedAt||b.createdAt||0)-new Date(a.updatedAt||a.createdAt||0)).slice(0,5);
      const name=esc(window.auth?.name||'Administrador');const online=navigator.onLine!==false;
      const host=$('adminDashboardPro');if(!host)return;
      host.innerHTML=`
        <div class="adminDashHero">
          <div class="adminDashHeroTop"><div><span class="adminDashEyebrow">PAINEL ADMINISTRATIVO</span><h2>${greeting()}, ${name}.</h2><p>Resumo rápido do negócio e atalhos para as ações mais usadas.</p></div><span class="adminDashStatus ${online?'':'local'}"><i></i>${online?'Online':'Modo local'}</span></div>
          <div class="adminDashMetrics">
            <div class="adminDashMetric"><small>Aguardando cliente</small><b>${awaiting.length}</b></div>
            <div class="adminDashMetric"><small>Aprovados</small><b>${approved.length}</b></div>
            <div class="adminDashMetric"><small>Valor aprovado</small><b>${money(totalApproved)}</b></div>
            <div class="adminDashMetric attention"><small>Vencem em até 3 dias</small><b>${expiring.length}</b></div>
          </div>
        </div>
        <div class="adminDashBody">
          <div class="adminDashPanel"><div class="adminDashPanelHead"><div><h3>Ações administrativas</h3><p>Acesse rapidamente as rotinas mais importantes.</p></div></div><div class="adminDashQuick">
            <button type="button" onclick="window.openBudgetPayments?openBudgetPayments('new'):go('orcamento')"><span class="adminDashQuickIcon">＋</span><span><b>Novo orçamento</b><small>Criar proposta comercial</small></span></button>
            <button type="button" onclick="go('clientes')"><span class="adminDashQuickIcon">♟</span><span><b>Clientes</b><small>${clients.length} cadastrados</small></span></button>
            <button type="button" onclick="go('contrato')"><span class="adminDashQuickIcon">▣</span><span><b>Contratos</b><small>${contracts.length} cadastrados</small></span></button>
            <button type="button" onclick="go('usuarios')"><span class="adminDashQuickIcon">⌘</span><span><b>Usuários e acessos</b><small>Perfis e permissões</small></span></button>
          </div></div>
          <div class="adminDashPanel"><div class="adminDashPanelHead"><div><h3>Orçamentos recentes</h3><p>Últimas movimentações registradas.</p></div><button type="button" class="btn soft" onclick="window.openBudgetPayments?openBudgetPayments('history'):go('historico')">Ver todos</button></div><div class="adminDashRecent">${recent.length?recent.map(b=>`<div class="adminDashRecentRow"><div><b>${esc(b.number||'Orçamento')} — ${esc(b.client?.name||'Cliente')}</b><small>${new Date(b.updatedAt||b.createdAt||Date.now()).toLocaleDateString('pt-BR')}</small></div><div class="adminDashRecentValue"><strong>${money(b.total)}</strong><span class="adminDashPill ${statusOf(b)}">${esc(b.status||'Rascunho')}</span></div></div>`).join(''):'<div class="adminDashEmpty">Nenhum orçamento registrado ainda.</div>'}</div></div>
        </div>`;
    }finally{refreshing=false}
  }
  window.refreshAdminDashboard=refresh;

  function init(){install();timer=setInterval(()=>{if(!document.hidden){install();refresh()}},15000);window.addEventListener('online',refresh);window.addEventListener('offline',refresh);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,1200));else setTimeout(init,1200);
})();
