const {getSql,ensureCompany,authenticate,send}=require('./_db');
const {DEFAULTS,ensurePermissionsTable,getPrimaryAdmin}=require('./_permissions');

const PRESETS={
  completo:{...DEFAULTS,usuarios:false,seguranca:false},
  comercial:{dashboard:true,clientes:true,produtos:true,orcamentos:true,contratos:true,financeiro:false,operacoes:false,crm:true,relatorios:true,custos:false,configuracoes:false,excluir:false,usuarios:false,seguranca:false},
  tecnico:{dashboard:true,clientes:true,produtos:true,orcamentos:false,contratos:false,financeiro:false,operacoes:true,crm:false,relatorios:false,custos:false,configuracoes:false,excluir:false,usuarios:false,seguranca:false},
  financeiro:{dashboard:true,clientes:true,produtos:false,orcamentos:true,contratos:false,financeiro:true,operacoes:false,crm:false,relatorios:true,custos:true,configuracoes:false,excluir:false,usuarios:false,seguranca:false},
  leitura:{dashboard:true,clientes:true,produtos:true,orcamentos:true,contratos:true,financeiro:true,operacoes:true,crm:true,relatorios:true,custos:false,configuracoes:false,excluir:false,usuarios:false,seguranca:false}
};

function sanitize(input){const out={};for(const key of Object.keys(DEFAULTS))out[key]=input?.[key]!==false;return out}

module.exports=async function handler(req,res){
  try{
    const sql=getSql(),company=await ensureCompany(sql);await ensurePermissionsTable(sql);const current=await authenticate(sql,req);if(!current)return send(res,401,{ok:false,error:'UNAUTHORIZED'});
    const primaryAdminId=await getPrimaryAdmin(sql,company.id);
    if(String(current.id)!==String(primaryAdminId))return send(res,403,{ok:false,error:'PRIMARY_ADMIN_ONLY'});

    if(req.method==='GET'){
      const rows=await sql`
        SELECT u.id,u.local_id,u.name,u.email,u.role,u.created_at,COALESCE(p.permissions,'{}'::jsonb) permissions
        FROM users u LEFT JOIN user_permissions p ON p.company_id=u.company_id AND p.user_id=u.id
        WHERE u.company_id=${company.id} ORDER BY u.created_at ASC
      `;
      return send(res,200,{ok:true,primaryAdminId,modules:Object.keys(DEFAULTS),presets:PRESETS,users:rows.map(u=>({id:u.id,login:u.local_id,name:u.name,email:u.email||'',role:u.role,createdAt:u.created_at,primaryAdmin:String(u.id)===String(primaryAdminId),permissions:String(u.id)===String(primaryAdminId)?Object.fromEntries(Object.keys(DEFAULTS).map(k=>[k,true])):{...DEFAULTS,...(u.permissions||{})}}))});
    }

    if(req.method!=='POST')return send(res,405,{ok:false,error:'METHOD_NOT_ALLOWED'});
    const action=String(req.body?.action||'save');const userId=String(req.body?.userId||'');
    const target=await sql`SELECT id,role,name,local_id FROM users WHERE company_id=${company.id} AND id::text=${userId} LIMIT 1`;
    if(!target.length)return send(res,404,{ok:false,error:'USER_NOT_FOUND'});
    if(String(userId)===String(primaryAdminId))return send(res,400,{ok:false,error:'PRIMARY_ADMIN_ALWAYS_FULL_ACCESS'});

    let permissions;
    if(action==='preset'){
      const preset=String(req.body?.preset||'');if(!PRESETS[preset])return send(res,400,{ok:false,error:'INVALID_PRESET'});permissions={...PRESETS[preset]};
    }else if(action==='save')permissions=sanitize(req.body?.permissions||{});
    else return send(res,400,{ok:false,error:'INVALID_ACTION'});

    await sql`INSERT INTO user_permissions(company_id,user_id,permissions,updated_at) VALUES(${company.id},${userId},${JSON.stringify(permissions)}::jsonb,now()) ON CONFLICT(company_id,user_id) DO UPDATE SET permissions=EXCLUDED.permissions,updated_at=now()`;
    try{await sql`INSERT INTO audit_log(company_id,user_id,entity_type,entity_id,action,details) VALUES(${company.id},${current.id},'user',${userId},'permissions_update',${JSON.stringify({targetLogin:target[0].local_id,permissions})}::jsonb)`}catch(_){}
    return send(res,200,{ok:true,userId,permissions});
  }catch(err){console.error('access-control',err);return send(res,500,{ok:false,error:'SERVER_ERROR'})}
};
