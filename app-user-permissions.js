(function(){
  const MODULES=[
    ['dashboard','Painel','Visualizar o painel principal e indicadores.'],
    ['clientes','Clientes','Cadastrar, editar e consultar clientes.'],
    ['produtos','Produtos / Serviços','Acessar catálogo, preços e estoque.'],
    ['orcamentos','Orçamentos','Criar, editar, enviar e consultar orçamentos.'],
    ['contratos','Contratos','Gerar, editar e consultar contratos.'],
    ['financeiro','Financeiro','Contas a receber, cobranças e despesas.'],
    ['operacoes','Operações','Agenda, ordens de serviço, estoque e compras.'],
    ['crm','CRM / Comercial','Funil, follow-up, fidelidade, cupons e comissões.'],
    ['relatorios','Relatórios','Busca global, relatórios, exportações e backups.'],
    ['custos','Custos e margens','Visualizar custo de produtos e margem de lucro.'],
    ['configuracoes','Configurações','Alterar dados, logo e identidade da empresa.'],
    ['excluir','Excluir registros','Excluir clientes, produtos, orçamentos e outros registros.'],
    ['usuarios','Gerenciar usuários','Criar, editar, redefinir PIN e excluir usuários.'],
    ['seguranca','Segurança','Acessar sessões, 2FA, auditoria e painel de segurança.']
  ];
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const headers=()=>({'Content-Type':'application/json','x-orca-auth':window.auth?.pinHash||'','x-orca-user':window.auth?.login||'admin'});
  let accessData=null;

  async function req(options={}){
    const r=await fetch('/api/users?action=access_control',{...options,headers:{...headers(),...(options.headers||{})},cache:'no-store'});
    let b={};try{b=await r.json()}catch(_){}
    if(!r.ok){const e=new Error(b.error||('HTTP_'+r.status));e.status=r.status;throw e}return b;
  }

  function install(){
    const section=$('usuarios');if(!section||$('userAccessControlCard'))return;
    const card=document.createElement('div');card.className='card accessControlCard';card.id='userAccessControlCard';
    card.innerHTML=`<div class="sectionLead"><div><span class="eyebrow">Permissões por usuário</span><h3>Controle de acesso</h3><p>Perfis Operador podem ser limitados por módulo. Todo perfil Administrador possui acesso total automático.</p></div><button class="btn soft" onclick="reloadUserAccessControl()">↻ Atualizar</button></div><div class="accessInfo"><span>🔐</span><div><b>Todo perfil Administrador vê e usa todas as funções.</b><small>As permissões personalizadas abaixo são aplicadas somente aos usuários Operador.</small></div></div><div id="userAccessList" class="accessUserList"><span class="muted">Carregando permissões...</span></div>`;
    section.appendChild(card);installStyles();
    const nav=$('usersNav');if(nav)nav.addEventListener('click',()=>setTimeout(load,150));
    setTimeout(load,600);
  }

  function installStyles(){if($('userPermissionStyles'))return;const st=document.createElement('style');st.id='userPermissionStyles';st.textContent=`
    .accessControlCard{margin-top:18px}.accessInfo{display:flex;gap:11px;align-items:flex-start;background:#f8fafc;border:1px solid #e5e7eb;border-radius:14px;padding:13px 14px;margin-bottom:14px}.accessInfo>span{font-size:20px}.accessInfo b{display:block;font-size:12px}.accessInfo small{display:block;color:#7a8493;margin-top:4px;line-height:1.45}.accessUserList{display:grid;gap:12px}.accessUser{border:1px solid #e4e8ef;border-radius:16px;overflow:hidden;background:#fff}.accessUserHead{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 15px}.accessUserIdentity{display:flex;align-items:center;gap:11px;min-width:0}.accessUserAvatar{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:#eef2f7;color:#172033;font-weight:900}.accessUserIdentity b{display:block;font-size:13px}.accessUserIdentity small{display:block;color:#7a8493;margin-top:3px}.accessCount{font-size:10px;font-weight:900;padding:5px 8px;border-radius:999px;background:#eef2ff;color:#4338ca}.accessCount.full{background:#ecfdf3;color:#067647}.accessPanel{border-top:1px solid #edf0f4;padding:15px;background:#fbfcfe}.accessPanel.hide{display:none}.accessPresetRow{display:flex;align-items:end;gap:9px;flex-wrap:wrap;margin-bottom:13px}.accessPresetRow label{font-size:10px;font-weight:850}.accessPresetRow select{min-height:38px;border:1px solid #dbe1e8;border-radius:10px;padding:7px 9px;background:#fff}.permissionGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.permissionToggle{display:flex;align-items:flex-start;gap:10px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;padding:11px;cursor:pointer}.permissionToggle input{margin-top:3px;accent-color:#111827}.permissionToggle b{display:block;font-size:11px}.permissionToggle small{display:block;color:#7a8493;font-size:10px;line-height:1.35;margin-top:3px}.accessFooter{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-top:13px}.accessFooterLeft{display:flex;gap:7px;flex-wrap:wrap}.accessLocked{padding:13px 15px;border-top:1px solid #edf0f4;background:#f8fafc;color:#526071;font-size:11px}.accessLockBadge{font-size:9px;font-weight:900;background:#ecfdf3;color:#067647;padding:5px 7px;border-radius:999px}@media(max-width:720px){.permissionGrid{grid-template-columns:1fr}.accessUserHead{align-items:flex-start}.accessUserHead>.row{width:100%}.accessUserHead{flex-wrap:wrap}.accessUserHead .btn{flex:1}}
  `;document.head.appendChild(st)}

  async function load(){
    const host=$('userAccessList');if(!host)return;
    if((window.auth?.role||'')!=='admin'){host.innerHTML='<span class="muted">Somente perfis Administrador podem gerenciar permissões.</span>';return}
    host.innerHTML='<span class="muted">Carregando permissões...</span>';
    try{accessData=await req();render()}catch(e){host.innerHTML='<span class="muted">Não foi possível carregar as permissões. Verifique a conexão.</span>'}
  }
  window.reloadUserAccessControl=load;

  function countEnabled(p){return MODULES.filter(([k])=>p?.[k]!==false).length}
  function render(){const host=$('userAccessList');if(!host||!accessData)return;host.innerHTML=(accessData.users||[]).map(u=>{
    const p=u.permissions||{},count=countEnabled(p),full=count===MODULES.length;
    if(u.role==='admin'||u.adminFull){
      const badge=u.primaryAdmin?'Administrador principal':'Administrador';
      return `<div class="accessUser"><div class="accessUserHead"><div class="accessUserIdentity"><div class="accessUserAvatar">${esc((u.name||'A').charAt(0).toUpperCase())}</div><div><b>${esc(u.name)} <span class="accessLockBadge">${badge}</span></b><small>@${esc(u.login)} • acesso total permanente</small></div></div><span class="accessCount full">${MODULES.length}/${MODULES.length} módulos</span></div><div class="accessLocked">Este perfil é Administrador e, por regra do sistema, possui acesso total a todos os módulos, ações e ferramentas.</div></div>`;
    }
    return `<div class="accessUser" data-access-user="${u.id}"><div class="accessUserHead"><div class="accessUserIdentity"><div class="accessUserAvatar">${esc((u.name||'U').charAt(0).toUpperCase())}</div><div><b>${esc(u.name)} <span class="userRole">Operador</span></b><small>@${esc(u.login)}${u.email?' • '+esc(u.email):''}</small></div></div><div class="row"><span class="accessCount ${full?'full':''}" id="accessCount_${u.id}">${count}/${MODULES.length} módulos</span><button class="btn soft" onclick="toggleUserAccess('${u.id}')">Gerenciar acesso</button></div></div><div class="accessPanel hide" id="accessPanel_${u.id}"><div class="accessPresetRow"><label>Perfil rápido<br><select id="accessPreset_${u.id}"><option value="">Personalizado</option><option value="completo">Operador completo</option><option value="comercial">Comercial / Vendas</option><option value="tecnico">Técnico / Campo</option><option value="financeiro">Financeiro</option><option value="leitura">Consulta / Leitura</option></select></label><button class="btn soft" onclick="applyAccessPreset('${u.id}')">Aplicar perfil</button></div><div class="permissionGrid">${MODULES.map(([key,label,desc])=>`<label class="permissionToggle"><input type="checkbox" data-access-perm="${key}" data-access-user-id="${u.id}" ${p[key]!==false?'checked':''} onchange="updateAccessCounter('${u.id}')"><span><b>${label}</b><small>${desc}</small></span></label>`).join('')}</div><div class="accessFooter"><div class="accessFooterLeft"><button class="btn soft" onclick="setAllAccess('${u.id}',true)">Marcar todos</button><button class="btn soft" onclick="setAllAccess('${u.id}',false)">Desmarcar todos</button></div><button class="btn primary" onclick="saveUserAccess('${u.id}')">Salvar acesso</button></div></div></div>`;
  }).join('')||'<span class="muted">Nenhum usuário cadastrado.</span>'}

  window.toggleUserAccess=id=>$('accessPanel_'+id)?.classList.toggle('hide');
  window.updateAccessCounter=id=>{const boxes=[...document.querySelectorAll(`[data-access-user-id="${id}"]`)];const n=boxes.filter(x=>x.checked).length,el=$('accessCount_'+id);if(el){el.textContent=`${n}/${MODULES.length} módulos`;el.classList.toggle('full',n===MODULES.length)}};
  window.setAllAccess=(id,on)=>{document.querySelectorAll(`[data-access-user-id="${id}"]`).forEach(x=>x.checked=!!on);window.updateAccessCounter(id)};
  window.applyAccessPreset=id=>{const preset=$('accessPreset_'+id)?.value;if(!preset)return;const p=accessData?.presets?.[preset];if(!p)return;document.querySelectorAll(`[data-access-user-id="${id}"]`).forEach(x=>x.checked=p[x.dataset.accessPerm]!==false);window.updateAccessCounter(id)};
  window.saveUserAccess=async id=>{const boxes=[...document.querySelectorAll(`[data-access-user-id="${id}"]`)];const permissions={};boxes.forEach(x=>permissions[x.dataset.accessPerm]=x.checked);try{await req({method:'POST',body:JSON.stringify({mode:'save',userId:id,permissions})});window.toast?.('Permissões atualizadas');await load()}catch(e){if(e.message==='ADMIN_ALWAYS_FULL_ACCESS')window.toast?.('Administradores sempre possuem acesso total');else window.toast?.('Não foi possível salvar as permissões')}};

  const oldLoad=window.loadUsers;window.loadUsers=async function(...args){const r=typeof oldLoad==='function'?await oldLoad.apply(this,args):undefined;setTimeout(load,100);return r};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,900));else setTimeout(install,900);
})();
