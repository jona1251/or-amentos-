function applyLogoUI(){['sideLogo','loginLogo'].forEach(id=>{let el=$(id);if(!el)return;if(settings.companyLogo){el.innerHTML=`<img src="${settings.companyLogo}" alt="Logo">`;el.classList.add('hasImage')}else{el.textContent='OF';el.classList.remove('hasImage')}});let prev=$('logoPreview');if(prev){prev.innerHTML=settings.companyLogo?`<img src="${settings.companyLogo}" alt="Logo da empresa">`:`<span>${esc((settings.companyName||'OF').slice(0,2).toUpperCase())}</span>`}}
function handleLogo(input){let f=input.files&&input.files[0];if(!f)return;if(f.size>2*1024*1024){input.value='';return toast('A logo deve ter no máximo 2 MB')}let r=new FileReader();r.onload=async()=>{settings.companyLogo=r.result;await put('settings',settings);applyLogoUI();toast('Logo adicionada')};r.readAsDataURL(f)}
async function removeLogo(){settings.companyLogo='';await put('settings',settings);applyLogoUI();if($('logoInput'))$('logoInput').value='';toast('Logo removida')}
function fillSettings(){$('sName').value=settings.companyName||'';$('sDoc').value=settings.companyDoc||'';$('sOwner').value=settings.companyOwner||'';$('sPhone').value=settings.companyPhone||'';$('sEmail').value=settings.companyEmail||'';$('sCity').value=settings.companyCity||'';$('sAddress').value=settings.companyAddress||'';if($('sPix'))$('sPix').value=settings.pixKey||'';if($('sSlogan'))$('sSlogan').value=settings.companySlogan||'';applyLogoUI()}
async function saveSettings(){settings={...settings,companyName:$('sName').value.trim(),companyDoc:$('sDoc').value.trim(),companyOwner:$('sOwner').value.trim(),companyPhone:$('sPhone').value.trim(),companyEmail:$('sEmail').value.trim(),companyCity:$('sCity').value.trim(),companyAddress:$('sAddress').value.trim(),pixKey:$('sPix')?.value.trim()||'',companySlogan:$('sSlogan')?.value.trim()||''};await put('settings',settings);renderAll();applyLogoUI();toast('Configurações salvas')}
async function backup(){let data={version:2,exportedAt:new Date().toISOString(),settings,clients,products,budgets,contracts};let a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.download='orcafacil-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
async function restoreBackup(input){let f=input.files&&input.files[0];if(!f)return;try{let data=JSON.parse(await f.text());if(!confirm('Restaurar este backup? Os registros com o mesmo ID serão atualizados.')){input.value='';return}if(data.settings){settings={...settings,...data.settings,id:'main'};await put('settings',settings)}for(let [store,arr] of [['clients',data.clients],['products',data.products],['budgets',data.budgets],['contracts',data.contracts]])if(Array.isArray(arr))for(let item of arr)if(item&&item.id)await put(store,item);await refresh();fillSettings();toast('Backup restaurado com sucesso')}catch(e){toast('Arquivo de backup inválido')}finally{input.value=''}}
const PAGE_META={
 painel:['Painel','Visão geral da sua gestão comercial.'],
 produtos:['Produtos/Serviços','Cadastre seu catálogo para agilizar os orçamentos.'],
 clientes:['Clientes','Cadastre e gerencie seus clientes.'],
 orcamento:['Novo orçamento','Monte propostas profissionais em poucos passos.'],
 historico:['Histórico','Consulte e reutilize seus orçamentos anteriores.'],
 contrato:['Contrato','Gere contratos automaticamente a partir dos orçamentos.'],
 config:['Configurações','Empresa, numeração, acesso e backup.']
};
function updatePageMeta(v){let m=PAGE_META[v]||PAGE_META.painel;if($('pageTitle'))$('pageTitle').textContent=m[0];if($('pageSubtitle'))$('pageSubtitle').textContent=m[1]}
let deferredInstallPrompt=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;if($('installBtn'))$('installBtn').style.display='inline-flex'});
async function installPWA(){if(!deferredInstallPrompt)return toast('Use o menu do navegador para adicionar à tela inicial');deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;if($('installBtn'))$('installBtn').style.display='none'}
function syncAdminSide(){let n=auth?.name||'Administrador';if($('adminNameSide'))$('adminNameSide').textContent=n;if($('adminAvatar'))$('adminAvatar').textContent=(n[0]||'A').toUpperCase()}

init();
