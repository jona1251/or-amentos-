(function(){
  const nav=document.getElementById('nav');
  const configButton=nav?.querySelector('[data-v="config"]');
  if(configButton && !document.getElementById('securityNav')){
    const btn=document.createElement('button');
    btn.id='securityNav';
    btn.dataset.v='seguranca';
    btn.innerHTML='<span class="navIcon">◈</span><span class="navText">Segurança</span>';
    configButton.parentNode.insertBefore(btn,configButton);
  }

  const app=document.querySelector('.app');
  if(app && !document.getElementById('seguranca')){
    const section=document.createElement('section');
    section.className='view';
    section.id='seguranca';
    section.innerHTML=`
      <div class="securityHero card">
        <div>
          <span class="eyebrow">Proteção de acesso</span>
          <h3>Segurança de login</h3>
          <p>Acompanhe tentativas recentes, bloqueios automáticos e libere acessos quando necessário.</p>
        </div>
        <div class="row securityHeroActions">
          <button class="btn soft" id="securityRefreshBtn" type="button">↻ Atualizar</button>
          <button class="btn soft" id="securityClearIpBtn" type="button">Liberar bloqueios de IP</button>
        </div>
      </div>
      <div class="grid4 securityMetrics">
        <div class="card metricCard"><div class="metricIcon">♟</div><div><small>Usuários</small><div class="tot" id="securityUsers">0</div></div></div>
        <div class="card metricCard"><div class="metricIcon">!</div><div><small>Tentativas na janela</small><div class="tot" id="securityAttempts">0</div></div></div>
        <div class="card metricCard"><div class="metricIcon">⊘</div><div><small>Usuários bloqueados</small><div class="tot" id="securityBlocked">0</div></div></div>
        <div class="card metricCard"><div class="metricIcon">IP</div><div><small>Bloqueios por IP</small><div class="tot" id="securityIpBlocked">0</div></div></div>
      </div>
      <div class="card securityPolicyCard">
        <div class="sectionLead">
          <div><span class="eyebrow">Política ativa</span><h3>Rate limiting</h3><p id="securityPolicyText">Carregando regras...</p></div>
          <span class="securityLiveBadge">● Proteção ativa</span>
        </div>
      </div>
      <div class="card">
        <div class="sectionLead">
          <div><span class="eyebrow">Monitoramento</span><h3>Usuários e tentativas</h3><p>Os contadores abaixo são mantidos no banco de dados.</p></div>
        </div>
        <div class="securityTableWrap">
          <table class="securityTable">
            <thead><tr><th>Usuário</th><th>Tentativas</th><th>Status</th><th>Última atividade</th><th></th></tr></thead>
            <tbody id="securityUsersBody"><tr><td colspan="5" class="muted">Carregando segurança...</td></tr></tbody>
          </table>
        </div>
      </div>`;
    app.appendChild(section);
  }

  const fmtDate=value=>{
    if(!value)return 'Sem tentativas recentes';
    try{return new Date(value).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}catch(_){return '—'}
  };
  const fmtTime=seconds=>{
    seconds=Math.max(0,Number(seconds||0));
    const m=Math.floor(seconds/60),s=seconds%60;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  };
  const make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el};
  function headers(){return {'Content-Type':'application/json','x-orca-auth':window.auth?.pinHash||'','x-orca-user':window.auth?.login||'admin'};}
  async function request(options={}){
    const res=await fetch('/api/security',{...options,headers:{...headers(),...(options.headers||{})}});
    let body={};try{body=await res.json()}catch(_){}
    if(!res.ok){const e=new Error(body.error||('HTTP_'+res.status));e.status=res.status;throw e}
    return body;
  }

  function applySecurityRole(){
    const isAdmin=(window.auth?.role||'admin')==='admin';
    const btn=document.getElementById('securityNav');
    if(btn)btn.style.display=isAdmin?'':'none';
    const view=document.getElementById('seguranca');
    if(!isAdmin && view?.classList.contains('on')) window.go?.('painel');
  }

  const previousApplyRoleUI=window.applyRoleUI;
  window.applyRoleUI=function(){
    const out=typeof previousApplyRoleUI==='function'?previousApplyRoleUI.apply(this,arguments):undefined;
    applySecurityRole();
    return out;
  };
  window.applySecurityRole=applySecurityRole;

  function renderUsers(users){
    const body=document.getElementById('securityUsersBody');
    if(!body)return;
    body.replaceChildren();
    if(!users?.length){
      const tr=make('tr');const td=make('td','muted','Nenhum usuário cadastrado.');td.colSpan=5;tr.append(td);body.append(tr);return;
    }
    users.forEach(u=>{
      const tr=make('tr');
      const userTd=make('td');
      const wrap=make('div','securityUserCell');
      wrap.append(make('div','securityUserAvatar',(u.name||'U').charAt(0).toUpperCase()));
      const meta=make('div');meta.append(make('b','',u.name||'Usuário'),make('small','',`@${u.login||''} • ${u.role==='admin'?'Administrador':'Operador'}`));wrap.append(meta);userTd.append(wrap);

      const attemptsTd=make('td');
      const attempts=make('div','securityAttemptsCount',`${u.attempts||0} / 5`);
      const remain=make('small','muted',u.blocked?'Limite atingido':`${u.attemptsRemaining??5} restantes`);
      attemptsTd.append(attempts,remain);

      const statusTd=make('td');
      const status=make('span','securityStatus '+(u.blocked?'blocked':u.attempts>0?'warning':'ok'));
      status.textContent=u.blocked?`Bloqueado ${fmtTime(u.retryAfter)}`:u.attempts>0?'Atenção':'Normal';
      statusTd.append(status);

      const activityTd=make('td','securityActivity',fmtDate(u.updatedAt));
      const actionTd=make('td');
      if(u.attempts>0 || u.blocked){
        const btn=make('button','btn soft securityUnlockBtn','Desbloquear');btn.type='button';btn.addEventListener('click',()=>window.unlockSecurityUser(u.id,u.name));actionTd.append(btn);
      }else actionTd.append(make('span','muted','—'));
      tr.append(userTd,attemptsTd,statusTd,activityTd,actionTd);body.append(tr);
    });
  }

  window.loadSecurityPanel=async function(){
    if((window.auth?.role||'admin')!=='admin')return;
    const body=document.getElementById('securityUsersBody');
    if(body)body.innerHTML='<tr><td colspan="5" class="muted">Atualizando segurança...</td></tr>';
    try{
      const r=await request({method:'GET'});
      document.getElementById('securityUsers').textContent=String(r.summary?.users||0);
      document.getElementById('securityAttempts').textContent=String(r.summary?.failedAttempts||0);
      document.getElementById('securityBlocked').textContent=String(r.summary?.blockedUsers||0);
      document.getElementById('securityIpBlocked').textContent=String(r.summary?.blockedIpBuckets||0);
      const p=r.policy||{};
      document.getElementById('securityPolicyText').textContent=`Até ${p.accountMaxAttempts||5} tentativas por usuário em ${(p.windowSeconds||900)/60} minutos. Ao atingir o limite, o acesso fica bloqueado por ${(p.blockSeconds||900)/60} minutos. Proteção adicional por IP: ${p.ipMaxAttempts||20} tentativas.`;
      renderUsers(r.users||[]);
    }catch(e){
      if(body)body.innerHTML='<tr><td colspan="5" class="muted">Não foi possível carregar os dados de segurança.</td></tr>';
      window.toast?.(e.message==='ADMIN_ONLY'?'Somente administradores podem acessar Segurança':'Falha ao carregar segurança');
    }
  };

  window.unlockSecurityUser=async function(userId,name){
    if(!confirm(`Desbloquear o login de ${name||'este usuário'} e zerar as tentativas?`))return;
    try{
      await request({method:'POST',body:JSON.stringify({action:'unlockUser',userId})});
      window.toast?.('Acesso desbloqueado e tentativas zeradas');
      await window.loadSecurityPanel();
    }catch(e){window.toast?.('Não foi possível desbloquear este usuário')}
  };

  window.clearSecurityIpBlocks=async function(){
    if(!confirm('Liberar todos os bloqueios de IP? Use esta opção apenas se usuários legítimos estiverem impedidos de entrar.'))return;
    try{
      await request({method:'POST',body:JSON.stringify({action:'clearIpBlocks'})});
      window.toast?.('Bloqueios de IP liberados');
      await window.loadSecurityPanel();
    }catch(e){window.toast?.('Não foi possível liberar os bloqueios de IP')}
  };

  document.getElementById('securityRefreshBtn')?.addEventListener('click',()=>window.loadSecurityPanel());
  document.getElementById('securityClearIpBtn')?.addEventListener('click',()=>window.clearSecurityIpBlocks());
  document.getElementById('securityNav')?.addEventListener('click',()=>window.go?.('seguranca'));

  const previousGo=window.go;
  if(typeof previousGo==='function'){
    window.go=function(v){
      const out=previousGo.apply(this,arguments);
      if(v==='seguranca'){
        const title=document.getElementById('pageTitle');if(title)title.textContent='Segurança';
        const sub=document.getElementById('pageSubtitle');if(sub)sub.textContent='Tentativas de login, bloqueios e proteção de acesso.';
        setTimeout(()=>window.loadSecurityPanel?.(),0);
      }
      return out;
    };
  }

  const style=document.createElement('style');
  style.textContent=`
    .securityHero{display:flex;align-items:center;justify-content:space-between;gap:18px}.securityHero h3{margin:4px 0 6px;font-size:23px}.securityHero p{margin:0;color:#7a8493;max-width:720px}.securityHeroActions{flex-wrap:wrap;justify-content:flex-end}.securityMetrics{margin-top:0}.securityPolicyCard{border-left:4px solid #172b46}.securityLiveBadge{display:inline-flex;align-items:center;gap:6px;background:#ecfdf3;color:#067647;border:1px solid #ccebdc;padding:7px 10px;border-radius:999px;font-size:10px;font-weight:900;white-space:nowrap}.securityTableWrap{overflow:auto}.securityTable{width:100%;border-collapse:collapse;min-width:760px}.securityTable th{text-align:left;color:#7a8493;font-size:10px;text-transform:uppercase;letter-spacing:.055em;padding:0 12px 11px;border-bottom:1px solid #e7eaf0}.securityTable td{padding:14px 12px;border-bottom:1px solid #eef1f5;vertical-align:middle;font-size:12px}.securityTable tr:last-child td{border-bottom:0}.securityUserCell{display:flex;align-items:center;gap:10px;min-width:190px}.securityUserCell b{display:block;color:#172033}.securityUserCell small{display:block;color:#8791a0;margin-top:3px}.securityUserAvatar{width:36px;height:36px;border-radius:50%;background:#eef2f7;display:grid;place-items:center;font-weight:900;color:#172033;flex:0 0 auto}.securityAttemptsCount{font-weight:900;color:#172033}.securityStatus{display:inline-flex;padding:6px 9px;border-radius:999px;font-size:10px;font-weight:900;white-space:nowrap}.securityStatus.ok{background:#ecfdf3;color:#067647}.securityStatus.warning{background:#fffbeb;color:#92400e}.securityStatus.blocked{background:#fff1f2;color:#b42318}.securityActivity{white-space:nowrap;color:#667085}.securityUnlockBtn{padding:8px 10px;font-size:10px}
    @media(max-width:760px){.securityHero{align-items:flex-start;flex-direction:column}.securityHeroActions{width:100%;justify-content:stretch}.securityHeroActions .btn{flex:1}.securityMetrics{grid-template-columns:repeat(2,minmax(0,1fr))}.securityPolicyCard .sectionLead{align-items:flex-start;flex-direction:column;gap:12px}}
    @media(max-width:480px){.securityMetrics{grid-template-columns:1fr 1fr}.securityMetrics .metricCard{padding:14px}.securityMetrics .tot{font-size:25px}}
  `;
  document.head.appendChild(style);

  applySecurityRole();
  setInterval(()=>{
    if(document.getElementById('seguranca')?.classList.contains('on') && (window.auth?.role||'admin')==='admin')window.loadSecurityPanel?.();
  },30000);
})();
