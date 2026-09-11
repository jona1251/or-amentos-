(function(){
  let receivables=[];
  let financeLoaded=false;
  const CACHE_PREFIX='orcafacil_premium_receivables_';

  function cacheKey(){return CACHE_PREFIX+String(window.auth?.login||'local').toLowerCase()}
  function today(){return new Date().toISOString().slice(0,10)}
  function inDays(days){const d=new Date();d.setDate(d.getDate()+days);return d.toISOString().slice(0,10)}
  function fmtDate(v){if(!v)return 'Sem vencimento';const [y,m,d]=String(v).slice(0,10).split('-');return y&&m&&d?`${d}/${m}/${y}`:String(v)}
  function displayStatus(r){return r.status==='Pendente'&&r.dueDate&&r.dueDate<today()?'Vencido':r.status}
  function phoneNumber(v){let n=String(v||'').replace(/\D/g,'');if(n.length===10||n.length===11)n='55'+n;return n}

  async function premiumApi(method='GET',body){
    const headers={'Content-Type':'application/json'};
    if(window.auth?.pinHash)headers['x-orca-auth']=window.auth.pinHash;
    if(window.auth?.login)headers['x-orca-user']=window.auth.login;
    const res=await fetch('/api/premium',{method,headers,body:body?JSON.stringify(body):undefined,cache:'no-store'});
    let data={};try{data=await res.json()}catch(_){}
    if(!res.ok){const err=new Error(data.error||('HTTP_'+res.status));err.status=res.status;throw err}
    return data;
  }

  function installUI(){
    const nav=document.getElementById('nav');
    if(nav&&!nav.querySelector('[data-v="financeiro"]')){
      const btn=document.createElement('button');
      btn.dataset.v='financeiro';
      btn.innerHTML='<span class="navIcon">R$</span><span class="navText">Financeiro</span>';
      const config=nav.querySelector('[data-v="config"]');
      nav.insertBefore(btn,config||nav.querySelector('.sideSpacer'));
      btn.onclick=()=>{go('financeiro');setFinanceMeta();loadReceivables()};
    }

    if(!document.getElementById('financeiro')){
      const section=document.createElement('section');
      section.className='view';section.id='financeiro';
      section.innerHTML=`
        <div class="grid4 premiumFinanceMetrics">
          <div class="card metricCard"><div class="metricIcon">$</div><div><small>A receber</small><div class="tot moneyMetric" id="finOpen">R$ 0,00</div></div></div>
          <div class="card metricCard"><div class="metricIcon">!</div><div><small>Vencido</small><div class="tot moneyMetric" id="finOverdue">R$ 0,00</div></div></div>
          <div class="card metricCard"><div class="metricIcon">✓</div><div><small>Recebido</small><div class="tot moneyMetric" id="finPaid">R$ 0,00</div></div></div>
          <div class="card metricCard highlight"><div class="metricIcon">▤</div><div><small>Cobranças</small><div class="tot" id="finCount">0</div></div></div>
        </div>
        <div class="card">
          <div class="sectionLead"><div><span class="eyebrow">Contas a receber</span><h3>Financeiro dos orçamentos</h3><p>Orçamentos aprovados por link entram automaticamente aqui. Você também pode adicionar uma cobrança pelo histórico.</p></div><button class="btn soft" onclick="premiumReloadFinance()">Atualizar</button></div>
          <div id="financeConnectionNote" class="premiumInfo hide"></div>
          <div class="list" id="receivableList"><span class="muted">Carregando...</span></div>
        </div>`;
      const config=document.getElementById('config');
      config?.parentNode?.insertBefore(section,config);
    }

    if(!document.getElementById('premiumModal')){
      const modal=document.createElement('div');modal.id='premiumModal';modal.className='premiumModal hide';
      modal.innerHTML='<div class="premiumModalBox"><button class="premiumModalClose" onclick="premiumCloseModal()">×</button><div id="premiumModalBody"></div></div>';
      document.body.appendChild(modal);
      modal.addEventListener('click',e=>{if(e.target===modal)premiumCloseModal()});
    }

    installStyles();
    watchBudgetHistory();
  }

  function setFinanceMeta(){
    const t=document.getElementById('pageTitle'),s=document.getElementById('pageSubtitle');
    if(t)t.textContent='Financeiro';if(s)s.textContent='Contas a receber e acompanhamento de pagamentos.';
  }

  function installStyles(){
    if(document.getElementById('premiumStyles'))return;
    const style=document.createElement('style');style.id='premiumStyles';style.textContent=`
      .premiumHistoryActions{display:flex;gap:7px;flex-wrap:wrap;margin-top:8px}.premiumMini{padding:7px 9px!important;font-size:11px!important}.premiumModal{position:fixed;inset:0;z-index:100000;background:rgba(8,15,29,.72);display:grid;place-items:center;padding:18px}.premiumModal.hide{display:none}.premiumModalBox{position:relative;width:min(94vw,560px);max-height:90vh;overflow:auto;background:#fff;border-radius:22px;padding:25px;box-shadow:0 30px 90px rgba(0,0,0,.3)}.premiumModalClose{position:absolute;right:14px;top:12px;width:34px;height:34px;border:0;border-radius:50%;background:#f1f5f9;font-size:22px;cursor:pointer}.premiumShareInput{width:100%;padding:12px;border:1px solid #dbe1e8;border-radius:12px;font-size:12px;margin:10px 0}.premiumQr{display:block;width:min(280px,80vw);height:auto;margin:12px auto;border-radius:14px}.premiumPixCode{font-size:10px;line-height:1.5;word-break:break-all;background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;padding:11px}.premiumInfo{padding:11px 13px;border-radius:12px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;font-size:12px;font-weight:800;margin-bottom:12px}.premiumInfo.hide{display:none}.receiveRow{display:grid;grid-template-columns:minmax(170px,1.4fr) 130px 130px 120px auto;gap:10px;align-items:center;width:100%}.receiveClient small{display:block}.receiveRow input,.receiveRow select{width:100%;min-height:38px;border:1px solid #dbe1e8;border-radius:10px;padding:8px;background:#fff}.receiveActions{display:flex;gap:6px;flex-wrap:wrap}.receiveStatus{display:inline-flex;padding:4px 8px;border-radius:999px;background:#f1f5f9;font-size:10px;font-weight:900;margin-left:6px}.receiveStatus[data-status="Pago"]{background:#ecfdf3;color:#067647}.receiveStatus[data-status="Vencido"]{background:#fff1f2;color:#b42318}.receiveStatus[data-status="Parcial"]{background:#fffbeb;color:#92400e}@media(max-width:900px){.receiveRow{grid-template-columns:1fr 1fr}.receiveClient{grid-column:1/-1}.receiveActions{grid-column:1/-1}}@media(max-width:560px){.premiumFinanceMetrics{grid-template-columns:1fr 1fr!important}.receiveRow{grid-template-columns:1fr}.receiveClient,.receiveActions{grid-column:auto}.premiumModalBox{padding:22px 16px}}
    `;document.head.appendChild(style);
  }

  function watchBudgetHistory(){
    const list=document.getElementById('budgetList');if(!list)return;
    const enhance=()=>{
      let source=[];try{source=budgets||[]}catch(_){source=[]}
      [...list.querySelectorAll('.historyItem')].forEach((row,i)=>{
        if(row.dataset.premium==='1')return;
        const b=source[i];if(!b)return;
        row.dataset.premium='1';
        const host=row.querySelector('.historyActions')||row;
        const extra=document.createElement('div');extra.className='premiumHistoryActions';
        extra.innerHTML=`<button class="btn soft premiumMini" onclick="premiumShareBudget('${b.id}')">🔗 Aprovação</button><button class="btn soft premiumMini" onclick="premiumShowPix('${b.id}')">▦ PIX</button><button class="btn soft premiumMini" onclick="premiumCreateReceivable('${b.id}')">R$ Receber</button>`;
        host.appendChild(extra);
      });
    };
    new MutationObserver(enhance).observe(list,{childList:true,subtree:true});
    setTimeout(enhance,100);
  }

  function showModal(html){const m=document.getElementById('premiumModal'),b=document.getElementById('premiumModalBody');if(!m||!b)return;b.innerHTML=html;m.classList.remove('hide')}
  window.premiumCloseModal=()=>document.getElementById('premiumModal')?.classList.add('hide');
  window.premiumCopy=async function(text,label='Copiado'){
    try{await navigator.clipboard.writeText(text);window.toast?.(label)}catch(_){prompt('Copie o conteúdo abaixo:',text)}
  };

  window.premiumShareBudget=async function(id){
    if(navigator.onLine===false)return window.toast?.('Sem internet. O link de aprovação precisa da nuvem.');
    try{
      const r=await premiumApi('POST',{action:'share_budget',budgetId:id});
      const b=(typeof budgets!=='undefined'?budgets.find(x=>x.id===id):null);
      const whatsapp=b?.client?.phone?`https://wa.me/${phoneNumber(b.client.phone)}?text=${encodeURIComponent(`Olá ${b.client.name||''}! Segue seu orçamento ${r.budgetNumber||''} para visualizar e aprovar: ${r.url}`)}`:'';
      showModal(`<span class="eyebrow">Aprovação online</span><h2>Link do orçamento ${esc(r.budgetNumber||'')}</h2><p class="muted">O cliente pode visualizar, aprovar ou recusar. Ao aprovar, uma conta a receber é criada automaticamente.</p><input class="premiumShareInput" value="${esc(r.url)}" readonly onclick="this.select()"><div class="row"><button class="btn primary" onclick='premiumCopy(${JSON.stringify(r.url)},"Link copiado")'>Copiar link</button>${whatsapp?`<button class="btn green" onclick='window.open(${JSON.stringify(whatsapp)},"_blank")'>WhatsApp</button>`:''}</div>`);
    }catch(e){console.warn(e);window.toast?.(e.message==='UNAUTHORIZED'?'Entre novamente para gerar o link':'Não foi possível gerar o link')}
  };

  window.premiumShowPix=async function(id){
    if(navigator.onLine===false)return window.toast?.('Sem internet. Abra o PIX quando voltar a ficar online.');
    try{
      const r=await premiumApi('POST',{action:'pix',budgetId:id});
      showModal(`<span class="eyebrow">PIX</span><h2>${esc(r.budgetNumber||'Orçamento')} • ${money(r.amount)}</h2><img class="premiumQr" src="${r.qr}" alt="QR Code PIX"><div class="premiumPixCode" id="premiumPixPayload">${esc(r.payload)}</div><div class="row" style="margin-top:12px"><button class="btn primary" onclick='premiumCopy(${JSON.stringify(r.payload)},"PIX copiado")'>Copiar PIX</button></div>`);
    }catch(e){console.warn(e);window.toast?.(e.message==='PIX_NOT_CONFIGURED'?'Cadastre sua chave PIX em Configurações':'Não foi possível gerar o PIX')}
  };

  window.premiumCreateReceivable=async function(id){
    if(navigator.onLine===false)return window.toast?.('Sem internet. A cobrança será criada quando estiver online.');
    const due=prompt('Data de vencimento (AAAA-MM-DD):',inDays(7));if(due===null)return;
    if(due&&!/^\d{4}-\d{2}-\d{2}$/.test(due))return window.toast?.('Use a data no formato AAAA-MM-DD');
    try{await premiumApi('POST',{action:'create_receivable',budgetId:id,dueDate:due||null});window.toast?.('Conta a receber criada');go('financeiro');setFinanceMeta();await loadReceivables(true)}catch(e){console.warn(e);window.toast?.('Não foi possível criar a cobrança')}
  };

  async function loadReceivables(force=false){
    if(financeLoaded&&!force)return renderFinance();
    const note=document.getElementById('financeConnectionNote');
    try{
      const r=await premiumApi('GET');receivables=Array.isArray(r.receivables)?r.receivables:[];financeLoaded=true;
      try{localStorage.setItem(cacheKey(),JSON.stringify(receivables))}catch(_){}
      note?.classList.add('hide');
    }catch(e){
      console.warn(e);let cached=[];try{cached=JSON.parse(localStorage.getItem(cacheKey())||'[]')}catch(_){}
      receivables=Array.isArray(cached)?cached:[];financeLoaded=true;
      if(note){note.textContent=receivables.length?'Modo local: exibindo a última cópia do financeiro salva neste dispositivo.':'Modo local: conecte-se para carregar suas contas a receber.';note.classList.remove('hide')}
    }
    renderFinance();
  }
  window.premiumReloadFinance=()=>loadReceivables(true);

  function renderFinance(){
    const open=receivables.filter(r=>!['Pago','Cancelado'].includes(r.status)).reduce((s,r)=>s+Math.max(0,r.amount-r.paidAmount),0);
    const overdue=receivables.filter(r=>displayStatus(r)==='Vencido').reduce((s,r)=>s+Math.max(0,r.amount-r.paidAmount),0);
    const paid=receivables.reduce((s,r)=>s+(r.paidAmount||0),0);
    if(document.getElementById('finOpen'))document.getElementById('finOpen').textContent=money(open);
    if(document.getElementById('finOverdue'))document.getElementById('finOverdue').textContent=money(overdue);
    if(document.getElementById('finPaid'))document.getElementById('finPaid').textContent=money(paid);
    if(document.getElementById('finCount'))document.getElementById('finCount').textContent=receivables.length;
    const host=document.getElementById('receivableList');if(!host)return;
    if(!receivables.length){host.innerHTML='<span class="muted">Nenhuma conta a receber. Aprove um orçamento por link ou use o botão “R$ Receber” no histórico.</span>';return}
    host.innerHTML=receivables.map(r=>{
      const st=displayStatus(r);const remain=Math.max(0,r.amount-r.paidAmount);
      return `<div class="item"><div class="receiveRow"><div class="receiveClient"><b>${esc(r.budgetNumber||'Orçamento')} — ${esc(r.clientName||'Cliente')}</b><span class="receiveStatus" data-status="${esc(st)}">${esc(st)}</span><small>${money(r.amount)} • Restante: ${money(remain)}${r.dueDate?' • Vence '+fmtDate(r.dueDate):''}</small></div><label><small>Vencimento</small><input type="date" id="due_${r.id}" value="${esc(r.dueDate||'')}"></label><label><small>Recebido</small><input type="number" min="0" step="0.01" id="paid_${r.id}" value="${Number(r.paidAmount||0)}"></label><label><small>Status</small><select id="status_${r.id}"><option ${r.status==='Pendente'?'selected':''}>Pendente</option><option ${r.status==='Parcial'?'selected':''}>Parcial</option><option ${r.status==='Pago'?'selected':''}>Pago</option><option ${r.status==='Cancelado'?'selected':''}>Cancelado</option></select></label><div class="receiveActions"><button class="btn primary premiumMini" onclick="premiumSaveReceivable('${r.id}')">Salvar</button><button class="btn green premiumMini" onclick="premiumMarkPaid('${r.id}',${Number(r.amount||0)})">Pago</button>${r.clientPhone?`<button class="btn soft premiumMini" onclick="premiumChargeWhatsApp('${r.id}')">WhatsApp</button>`:''}</div></div></div>`;
    }).join('');
  }

  window.premiumSaveReceivable=async function(id){
    const r=receivables.find(x=>x.id===id);if(!r)return;
    const dueDate=document.getElementById('due_'+id)?.value||null;
    const paidAmount=Number(document.getElementById('paid_'+id)?.value||0);
    const status=document.getElementById('status_'+id)?.value||'Pendente';
    try{await premiumApi('POST',{action:'update_receivable',id,dueDate,paidAmount,status,notes:r.notes||''});window.toast?.('Financeiro atualizado');await loadReceivables(true)}catch(e){console.warn(e);window.toast?.('Não foi possível atualizar')}
  };
  window.premiumMarkPaid=async function(id,amount){
    const dueDate=document.getElementById('due_'+id)?.value||null;
    try{await premiumApi('POST',{action:'update_receivable',id,dueDate,paidAmount:amount,status:'Pago'});window.toast?.('Pagamento marcado como recebido');await loadReceivables(true)}catch(e){console.warn(e);window.toast?.('Não foi possível atualizar')}
  };
  window.premiumChargeWhatsApp=function(id){
    const r=receivables.find(x=>x.id===id);if(!r||!r.clientPhone)return;
    const remaining=Math.max(0,r.amount-r.paidAmount);const text=`Olá ${r.clientName||''}! Passando para lembrar do pagamento referente ao orçamento ${r.budgetNumber||''}, no valor pendente de ${money(remaining)}${r.dueDate?`, com vencimento em ${fmtDate(r.dueDate)}`:''}.`;
    window.open(`https://wa.me/${phoneNumber(r.clientPhone)}?text=${encodeURIComponent(text)}`,'_blank');
  };

  installUI();
  window.addEventListener('online',()=>{if(document.getElementById('financeiro')?.classList.contains('on'))loadReceivables(true)});
})();
