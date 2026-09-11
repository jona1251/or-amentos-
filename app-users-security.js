(function(){
  const safeError=code=>({LOGIN_TAKEN:'Este usuário de acesso já existe.',INVALID_LOGIN:'Informe um usuário válido.',ADMIN_ONLY:'Somente administradores podem gerenciar usuários.',CANNOT_DELETE_SELF:'Você não pode excluir o usuário conectado.',LAST_ADMIN:'É necessário manter pelo menos um administrador.',DATABASE_NOT_CONNECTED:'A nuvem ainda não está conectada.'})[code]||'Não foi possível concluir esta ação.';
  const headers=()=>({'Content-Type':'application/json','x-orca-auth':window.auth?.pinHash||'','x-orca-user':window.auth?.login||'admin'});
  async function request(url,options={}){const res=await fetch(url,{...options,headers:{...headers(),...(options.headers||{})}});let body={};try{body=await res.json()}catch(_){}if(!res.ok)throw new Error(body.error||('HTTP_'+res.status));return body}
  const make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!=null)el.textContent=text;return el};

  window.loadUsers=async function(){
    const list=document.getElementById('usersList');if(!list)return;
    if((window.auth?.role||'admin')!=='admin'){list.replaceChildren(make('span','muted','Somente administradores podem visualizar usuários.'));return}
    list.replaceChildren(make('span','muted','Carregando usuários...'));
    try{
      const r=await request('/api/users');window.__orcaUsers=r.users||[];
      const counter=document.getElementById('usersCount');if(counter)counter.textContent=String(window.__orcaUsers.length);
      list.replaceChildren();
      if(!window.__orcaUsers.length){list.append(make('span','muted','Nenhum usuário cadastrado.'));return}
      window.__orcaUsers.forEach(u=>{
        const current=String(u.id)===String(r.currentUserId);
        const row=make('div','userRow');
        const identity=make('div','userIdentity');
        identity.append(make('div','userAvatar',(u.name||'U').charAt(0).toUpperCase()));
        const meta=make('div','userMeta');
        const title=make('b','',u.name||'Usuário');
        title.append(make('span','userRole '+(u.role==='admin'?'admin':''),u.role==='admin'?'Administrador':'Operador'));
        if(current)title.append(make('span','userCurrent','Você'));
        meta.append(title,make('small','',`@${u.login||''}${u.email?' • '+u.email:''}`));
        identity.append(meta);row.append(identity);
        const actions=make('div','userActions');
        const pinBtn=make('button','btn soft','Novo PIN');pinBtn.type='button';pinBtn.addEventListener('click',()=>window.resetUserPin(u.id));actions.append(pinBtn);
        if(!current){const delBtn=make('button','btn danger','Excluir');delBtn.type='button';delBtn.addEventListener('click',()=>window.removeUser(u.id));actions.append(delBtn)}
        row.append(actions);list.append(row);
      });
    }catch(e){list.replaceChildren(make('span','muted','Não foi possível carregar os usuários. Verifique a conexão com a nuvem.'));window.toast?.(safeError(e.message))}
  };

  window.resetUserPin=async function(id){
    const u=(window.__orcaUsers||[]).find(x=>String(x.id)===String(id));const pin=prompt('Digite o novo PIN para '+(u?.name||'este usuário')+' (4 a 8 números):');
    if(pin===null)return;if(!/^[0-9]{4,8}$/.test(pin))return window.toast?.('O PIN deve ter de 4 a 8 números');
    try{await request('/api/users',{method:'PATCH',body:JSON.stringify({id,pinHash:await window.hash(pin)})});window.toast?.('PIN atualizado com sucesso')}catch(e){window.toast?.(safeError(e.message))}
  };

  window.removeUser=async function(id){
    const u=(window.__orcaUsers||[]).find(x=>String(x.id)===String(id));if(!confirm('Excluir o acesso de '+(u?.name||'este usuário')+'?'))return;
    try{await request('/api/users?id='+encodeURIComponent(id),{method:'DELETE'});await window.loadUsers();window.toast?.('Usuário excluído')}catch(e){window.toast?.(safeError(e.message))}
  };
})();
