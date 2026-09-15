(function(){
  const PRESETS=[
    {key:'completo',icon:'✓',title:'Operador completo',desc:'Acesso amplo aos módulos liberados para operadores.',tone:'full'},
    {key:'comercial',icon:'↗',title:'Comercial / Vendas',desc:'Atendimento, clientes, propostas e rotina comercial.',tone:'sales'},
    {key:'tecnico',icon:'⌁',title:'Técnico / Campo',desc:'Execução de serviços, operação e atividades em campo.',tone:'field'},
    {key:'financeiro',icon:'R$',title:'Financeiro',desc:'Recebimentos, despesas e acompanhamento financeiro.',tone:'money'},
    {key:'leitura',icon:'◉',title:'Consulta / Leitura',desc:'Perfil restrito para acompanhamento e consulta.',tone:'read'}
  ];
  const snapshots=new Map();
  let observer=null;
  let timer=0;

  function installStyles(){
    if(document.getElementById('quickProfilePrettyStyles'))return;
    const s=document.createElement('style');
    s.id='quickProfilePrettyStyles';
    s.textContent=`
      .accessPresetRow.quickProfileReady{display:block;margin:2px 0 18px;padding:17px;border:1px solid #e5e9f0;border-radius:18px;background:linear-gradient(180deg,#ffffff 0%,#f8fafc 100%)}
      .quickProfileHeader{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:13px}.quickProfileHeaderMain{display:flex;align-items:center;gap:11px;min-width:0}.quickProfileHeaderIcon{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:#111827;color:#fff;font-size:15px;font-weight:950;box-shadow:0 8px 20px rgba(15,23,42,.11)}.quickProfileHeader b{display:block;color:#172033;font-size:12.5px}.quickProfileHeader small{display:block;color:#7b8493;font-size:10px;line-height:1.4;margin-top:3px}.quickProfileTip{white-space:nowrap;background:#eef2ff;color:#4338ca;border:1px solid #e0e7ff;border-radius:999px;padding:6px 8px;font-size:8.5px;font-weight:900;letter-spacing:.03em}
      .quickProfileCards{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}.quickProfileCard{position:relative;border:1px solid #e4e8ef;background:#fff;border-radius:14px;padding:12px 10px;text-align:left;min-height:112px;cursor:pointer;transition:border-color .16s ease,box-shadow .16s ease,transform .16s ease,background .16s ease;color:#172033}.quickProfileCard:hover{border-color:#cfd6e1;box-shadow:0 9px 24px rgba(15,23,42,.055);transform:translateY(-1px)}.quickProfileCard:focus-visible{outline:3px solid rgba(99,102,241,.17);outline-offset:2px}.quickProfileCard.on{border-color:#a5b4fc;background:#f7f8ff;box-shadow:0 0 0 3px rgba(99,102,241,.08)}.quickProfileCard.on:after{content:'✓';position:absolute;right:8px;top:8px;width:18px;height:18px;border-radius:50%;display:grid;place-items:center;background:#4f46e5;color:#fff;font-size:9px;font-weight:950}.quickProfileCardIcon{width:31px;height:31px;border-radius:10px;display:grid;place-items:center;margin-bottom:9px;background:#f1f5f9;color:#334155;font-size:11px;font-weight:950}.quickProfileCard b{display:block;font-size:10.5px;line-height:1.25;padding-right:12px}.quickProfileCard small{display:block;color:#8490a0;font-size:8.8px;line-height:1.35;margin-top:5px}.quickProfileCard[data-tone="full"] .quickProfileCardIcon{background:#ecfdf3;color:#067647}.quickProfileCard[data-tone="sales"] .quickProfileCardIcon{background:#eef2ff;color:#4338ca}.quickProfileCard[data-tone="field"] .quickProfileCardIcon{background:#fff7ed;color:#9a3412}.quickProfileCard[data-tone="money"] .quickProfileCardIcon{background:#ecfeff;color:#0e7490}.quickProfileCard[data-tone="read"] .quickProfileCardIcon{background:#f8fafc;color:#475569}
      .quickProfileSummary{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-top:11px;padding:11px 12px;border:1px solid #e7ebf0;border-radius:13px;background:#fff}.quickProfileSummaryMain{min-width:0}.quickProfileSummaryMain>span{display:block;color:#475569;font-size:9.5px;font-weight:850}.quickProfileSummaryMain b{color:#172033}.quickProfileChips{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px}.quickProfileChip{display:inline-flex;padding:4px 6px;border-radius:999px;background:#f1f5f9;color:#475569;font-size:8px;font-weight:800}.quickProfileChip.more{background:#eef2ff;color:#4338ca}.quickProfileUndo{border:0;background:#fff;color:#4338ca;font-size:9px;font-weight:900;padding:5px 6px;border-radius:8px;white-space:nowrap}.quickProfileUndo:hover{background:#eef2ff}.quickProfileUndo:disabled{opacity:.35;cursor:default;background:transparent}
      .quickProfileFeedback{display:flex;align-items:center;gap:7px;min-height:16px;margin-top:9px;color:#667085;font-size:9.5px}.quickProfileFeedback i{width:6px;height:6px;border-radius:50%;background:#94a3b8;flex:0 0 auto}.quickProfileFeedback.applied{color:#067647}.quickProfileFeedback.applied i{background:#22c55e}.quickProfileFeedback.custom{color:#9a6700}.quickProfileFeedback.custom i{background:#f59e0b}.accessPresetRow.quickProfileReady>label,.accessPresetRow.quickProfileReady>.btn{display:none!important}
      @media(max-width:1100px){.quickProfileCards{grid-template-columns:repeat(3,minmax(0,1fr))}}
      @media(max-width:700px){.accessPresetRow.quickProfileReady{padding:13px}.quickProfileHeader{flex-direction:column}.quickProfileTip{white-space:normal}.quickProfileCards{grid-template-columns:1fr 1fr}.quickProfileCard{min-height:104px}.quickProfileSummary{flex-direction:column}.quickProfileUndo{align-self:flex-start}}
      @media(max-width:430px){.quickProfileCards{grid-template-columns:1fr}.quickProfileCard{min-height:auto;display:grid;grid-template-columns:34px 1fr;column-gap:9px}.quickProfileCardIcon{grid-row:1/3;margin:0}.quickProfileCard small{margin-top:3px}}
    `;
    document.head.appendChild(s);
  }

  function boxesFor(userId){return [...document.querySelectorAll(`[data-access-user-id="${userId}"]`)]}
  function stateFor(userId){const out={};boxesFor(userId).forEach(x=>out[x.dataset.accessPerm]=!!x.checked);return out}
  function applyState(userId,state){boxesFor(userId).forEach(x=>x.checked=state?.[x.dataset.accessPerm]!==false);window.updateAccessCounter?.(userId)}
  function labelsFor(userId){return boxesFor(userId).filter(x=>x.checked).map(x=>x.closest('.permissionToggle')?.querySelector('b')?.textContent?.trim()).filter(Boolean)}

  function updateSummary(row,userId){
    const all=boxesFor(userId),active=all.filter(x=>x.checked),labels=labelsFor(userId),summary=row.querySelector('.quickProfileSummaryMain'),chips=row.querySelector('.quickProfileChips');
    if(summary){const span=summary.querySelector(':scope > span');if(span)span.innerHTML=`<b>${active.length} de ${all.length}</b> módulos serão liberados para este usuário.`}
    if(chips){const shown=labels.slice(0,5);chips.innerHTML=shown.map(x=>`<span class="quickProfileChip">${x}</span>`).join('')+(labels.length>shown.length?`<span class="quickProfileChip more">+${labels.length-shown.length}</span>`:'')}
  }

  function setSelected(cards,key){cards.querySelectorAll('.quickProfileCard').forEach(x=>{const on=x.dataset.quickProfile===key;x.classList.toggle('on',on);x.setAttribute('aria-pressed',on?'true':'false')})}

  function enhanceRow(row){
    if(!row||row.classList.contains('quickProfileReady'))return;
    const select=row.querySelector('select[id^="accessPreset_"]');if(!select)return;
    const userId=select.id.replace('accessPreset_','');row.classList.add('quickProfileReady');
    const header=document.createElement('div');header.className='quickProfileHeader';header.innerHTML='<div class="quickProfileHeaderMain"><span class="quickProfileHeaderIcon">⌘</span><div><b>Perfil rápido</b><small>Escolha um perfil pronto e revise exatamente quais módulos serão liberados.</small></div></div><span class="quickProfileTip">Prévia antes de salvar</span>';
    const cards=document.createElement('div');cards.className='quickProfileCards';cards.innerHTML=PRESETS.map(p=>`<button type="button" class="quickProfileCard" data-quick-profile="${p.key}" data-tone="${p.tone}" aria-pressed="false"><span class="quickProfileCardIcon">${p.icon}</span><b>${p.title}</b><small>${p.desc}</small></button>`).join('');
    const summary=document.createElement('div');summary.className='quickProfileSummary';summary.innerHTML='<div class="quickProfileSummaryMain"><span>Revise os módulos abaixo.</span><div class="quickProfileChips"></div></div><button type="button" class="quickProfileUndo" disabled>Desfazer alteração</button>';
    const feedback=document.createElement('div');feedback.className='quickProfileFeedback';feedback.innerHTML='<i></i><span>Escolha um perfil ou personalize as permissões manualmente.</span>';
    row.prepend(header);row.insertBefore(cards,select.closest('label'));row.insertBefore(summary,select.closest('label'));row.appendChild(feedback);updateSummary(row,userId);

    cards.addEventListener('click',e=>{
      const btn=e.target.closest('[data-quick-profile]');if(!btn)return;
      snapshots.set(userId,stateFor(userId));
      const key=btn.dataset.quickProfile;select.value=key;setSelected(cards,key);
      try{window.applyAccessPreset?.(userId)}catch(_){}
      updateSummary(row,userId);summary.querySelector('.quickProfileUndo').disabled=false;
      feedback.className='quickProfileFeedback applied';feedback.innerHTML=`<i></i><span><b>${PRESETS.find(p=>p.key===key)?.title||'Perfil'}</b> aplicado como prévia. Confira os módulos e clique em “Salvar acesso”.</span>`;
    });

    summary.querySelector('.quickProfileUndo').addEventListener('click',()=>{
      const snap=snapshots.get(userId);if(!snap)return;applyState(userId,snap);snapshots.delete(userId);select.value='';setSelected(cards,'');updateSummary(row,userId);summary.querySelector('.quickProfileUndo').disabled=true;feedback.className='quickProfileFeedback';feedback.innerHTML='<i></i><span>Alteração desfeita. As permissões anteriores foram restauradas.</span>';
    });

    row.addEventListener('change',e=>{
      if(!e.target.matches('[data-access-perm]'))return;select.value='';setSelected(cards,'');updateSummary(row,userId);feedback.className='quickProfileFeedback custom';feedback.innerHTML='<i></i><span>Perfil personalizado: você alterou os módulos manualmente. Clique em “Salvar acesso” para confirmar.</span>';
    });
  }

  function enhance(){document.querySelectorAll('.accessPresetRow').forEach(enhanceRow)}
  function schedule(){clearTimeout(timer);timer=setTimeout(enhance,70)}
  function watch(){const host=document.getElementById('userAccessList');if(!host)return;observer?.disconnect();observer=new MutationObserver(schedule);observer.observe(host,{childList:true,subtree:true});enhance()}
  function init(){installStyles();watch();setTimeout(watch,900)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,1000));else setTimeout(init,1000);
})();
