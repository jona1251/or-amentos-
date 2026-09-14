const crypto = require('crypto');
const QRCode = require('qrcode');
const { getSql, ensureCompany, authenticate, withRlsSql, send } = require('./_db');
const { ensureSessionTable } = require('./_session');
const { ensureSuiteSchema, generateTotpSecret, verifyTotp } = require('./_suite_schema');

const KINDS = new Set([
  'expense','appointment','work_order','supplier','purchase_order','budget_template','contract_template',
  'custom_field','tag','stock_movement','commission','coupon','crm_lead','follow_up','loyalty','favorite',
  'budget_version','sale','company_profile','theme','ai_draft','payment_config','reminder','checklist','attachment',
  'report_preset','category','trash_note','integration','automation','payment_link','signature_request'
]);

function localId(v){return String(v||'').trim().slice(0,120)}
function cleanKind(v){const k=String(v||'').trim();return KINDS.has(k)?k:null}
function safeDate(v){const s=String(v||'').trim();return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:null}
function json(v){return JSON.stringify(v||{})}
function reqInfo(req){return {ip:String(req.headers['x-forwarded-for']||req.headers['x-real-ip']||'').split(',')[0].trim().slice(0,120),userAgent:String(req.headers['user-agent']||'').slice(0,500)}}
function origin(req){const p=String(req.headers['x-forwarded-proto']||'https').split(',')[0].trim();const h=String(req.headers['x-forwarded-host']||req.headers.host||'').split(',')[0].trim();return h?`${p}://${h}`:''}

async function isPrimaryAdmin(sql, companyId, user){
  if(user.role!=='admin') return false;
  const rows=await sql`SELECT id FROM users WHERE company_id=${companyId} AND role='admin' ORDER BY created_at ASC LIMIT 1`;
  return String(rows[0]?.id||'')===String(user.id);
}

async function logActivity(sql, companyId, userId, entityKind, entityLocalId, action, details={}){
  try{await sql`INSERT INTO suite_activity(company_id,user_id,entity_kind,entity_local_id,action,details) VALUES(${companyId},${userId},${entityKind||null},${entityLocalId||null},${action},${json(details)}::jsonb)`}catch(_){}
}

async function getRecords(sql, companyId, userId, kind, includeDeleted=false){
  const rows = kind ? await sql`
    SELECT id,kind,local_id,title,status,amount,due_date,data,favorite,deleted_at,created_at,updated_at
    FROM business_records WHERE company_id=${companyId} AND owner_user_id=${userId} AND kind=${kind}
      AND (${includeDeleted}::boolean OR deleted_at IS NULL)
    ORDER BY favorite DESC, updated_at DESC LIMIT 1000
  ` : await sql`
    SELECT id,kind,local_id,title,status,amount,due_date,data,favorite,deleted_at,created_at,updated_at
    FROM business_records WHERE company_id=${companyId} AND owner_user_id=${userId}
      AND (${includeDeleted}::boolean OR deleted_at IS NULL)
    ORDER BY updated_at DESC LIMIT 2000
  `;
  return rows.map(r=>({id:r.id,kind:r.kind,localId:r.local_id,title:r.title||'',status:r.status||'',amount:Number(r.amount||0),dueDate:r.due_date||null,data:r.data||{},favorite:!!r.favorite,deletedAt:r.deleted_at||null,createdAt:r.created_at,updatedAt:r.updated_at}));
}

async function coreSummary(sql, companyId, userId){
  const [clients,products,budgets,contracts,records] = await Promise.all([
    sql`SELECT count(*)::int total FROM clients WHERE company_id=${companyId} AND owner_user_id=${userId}`,
    sql`SELECT count(*)::int total, COALESCE(sum(stock),0)::numeric stock FROM products WHERE company_id=${companyId} AND owner_user_id=${userId}`,
    sql`SELECT count(*)::int total, COALESCE(sum(total),0)::numeric value, count(*) FILTER (WHERE status='Aprovado')::int approved FROM budgets WHERE company_id=${companyId} AND owner_user_id=${userId}`,
    sql`SELECT count(*)::int total FROM contracts WHERE company_id=${companyId} AND owner_user_id=${userId}`,
    sql`SELECT kind,count(*)::int total,COALESCE(sum(amount),0)::numeric amount FROM business_records WHERE company_id=${companyId} AND owner_user_id=${userId} AND deleted_at IS NULL GROUP BY kind`
  ]);
  const byKind={};for(const r of records)byKind[r.kind]={total:Number(r.total||0),amount:Number(r.amount||0)};
  return {clients:Number(clients[0]?.total||0),products:Number(products[0]?.total||0),stock:Number(products[0]?.stock||0),budgets:Number(budgets[0]?.total||0),budgetValue:Number(budgets[0]?.value||0),approved:Number(budgets[0]?.approved||0),contracts:Number(contracts[0]?.total||0),byKind};
}

module.exports = async function handler(req,res){
  try{
    const adminSql=getSql();
    const company=await ensureCompany(adminSql);
    await ensureSuiteSchema(adminSql);
    const user=await authenticate(adminSql,req);
    if(!user)return send(res,401,{ok:false,error:'UNAUTHORIZED'});

    if(req.method==='GET'){
      const action=String(req.query?.action||'records');
      if(action==='records'){
        const kind=String(req.query?.kind||'').trim();if(kind&&!cleanKind(kind))return send(res,400,{ok:false,error:'INVALID_KIND'});
        const includeDeleted=String(req.query?.deleted||'')==='1';
        const records=await withRlsSql(company.id,user,sql=>getRecords(sql,company.id,user.id,kind||null,includeDeleted));
        return send(res,200,{ok:true,records});
      }
      if(action==='summary'){
        const summary=await withRlsSql(company.id,user,sql=>coreSummary(sql,company.id,user.id));
        return send(res,200,{ok:true,summary});
      }
      if(action==='activity'){
        const ownOnly=user.role!=='admin';
        const rows=await adminSql`
          SELECT a.id,a.entity_kind,a.entity_local_id,a.action,a.details,a.created_at,u.name,u.local_id
          FROM suite_activity a LEFT JOIN users u ON u.id=a.user_id
          WHERE a.company_id=${company.id} AND (${ownOnly}::boolean=false OR a.user_id=${user.id})
          ORDER BY a.created_at DESC LIMIT 250
        `;
        return send(res,200,{ok:true,events:rows.map(x=>({id:x.id,kind:x.entity_kind,localId:x.entity_local_id,action:x.action,details:x.details||{},createdAt:x.created_at,userName:x.name||'',login:x.local_id||''}))});
      }
      if(action==='permissions'){
        if(user.role!=='admin')return send(res,403,{ok:false,error:'ADMIN_ONLY'});
        const rows=await adminSql`
          SELECT u.id,u.name,u.local_id,u.role,COALESCE(p.permissions,'{}'::jsonb) permissions
          FROM users u LEFT JOIN user_permissions p ON p.company_id=u.company_id AND p.user_id=u.id
          WHERE u.company_id=${company.id} ORDER BY u.created_at
        `;
        return send(res,200,{ok:true,users:rows.map(x=>({id:x.id,name:x.name,login:x.local_id,role:x.role,permissions:x.permissions||{}}))});
      }
      if(action==='sessions'){
        await ensureSessionTable(adminSql);
        const primary=await isPrimaryAdmin(adminSql,company.id,user);
        const rows=await adminSql`
          SELECT s.id,s.user_id,s.created_at,s.last_seen_at,s.expires_at,s.ip,s.user_agent,s.device_name,u.name,u.local_id
          FROM user_sessions s JOIN users u ON u.id=s.user_id
          WHERE s.company_id=${company.id} AND (${primary}::boolean OR s.user_id=${user.id})
          ORDER BY s.last_seen_at DESC LIMIT 200
        `;
        return send(res,200,{ok:true,sessions:rows.map(x=>({id:x.id,userId:x.user_id,userName:x.name,login:x.local_id,createdAt:x.created_at,lastSeenAt:x.last_seen_at,expiresAt:x.expires_at,ip:x.ip||'',userAgent:x.user_agent||'',deviceName:x.device_name||''}))});
      }
      if(action==='security'){
        const rows=await adminSql`SELECT totp_enabled FROM user_security WHERE company_id=${company.id} AND user_id=${user.id} LIMIT 1`;
        return send(res,200,{ok:true,totpEnabled:!!rows[0]?.totp_enabled});
      }
      if(action==='backups'){
        const rows=await withRlsSql(company.id,user,sql=>sql`SELECT id,label,created_at FROM suite_backups WHERE company_id=${company.id} AND owner_user_id=${user.id} ORDER BY created_at DESC LIMIT 30`);
        return send(res,200,{ok:true,backups:rows.map(x=>({id:x.id,label:x.label||'',createdAt:x.created_at}))});
      }
      if(action==='search'){
        const q=String(req.query?.q||'').trim().toLowerCase().slice(0,80);if(q.length<2)return send(res,200,{ok:true,results:[]});
        const pattern=`%${q}%`;
        const results=await withRlsSql(company.id,user,async sql=>{
          const [c,p,b,ct,r]=await Promise.all([
            sql`SELECT local_id id,'client' kind,name title,coalesce(phone,'') subtitle FROM clients WHERE company_id=${company.id} AND owner_user_id=${user.id} AND (lower(name) LIKE ${pattern} OR lower(coalesce(document,'')) LIKE ${pattern} OR lower(coalesce(phone,'')) LIKE ${pattern}) LIMIT 20`,
            sql`SELECT local_id id,'product' kind,name title,coalesce(code,'') subtitle FROM products WHERE company_id=${company.id} AND owner_user_id=${user.id} AND (lower(name) LIKE ${pattern} OR lower(coalesce(code,'')) LIKE ${pattern} OR lower(coalesce(category,'')) LIKE ${pattern}) LIMIT 20`,
            sql`SELECT local_id id,'budget' kind,number title,status subtitle FROM budgets WHERE company_id=${company.id} AND owner_user_id=${user.id} AND (lower(number) LIKE ${pattern} OR lower(status) LIKE ${pattern}) LIMIT 20`,
            sql`SELECT local_id id,'contract' kind,number title,status subtitle FROM contracts WHERE company_id=${company.id} AND owner_user_id=${user.id} AND (lower(number) LIKE ${pattern} OR lower(status) LIKE ${pattern}) LIMIT 20`,
            sql`SELECT local_id id,kind,title,coalesce(status,'') subtitle FROM business_records WHERE company_id=${company.id} AND owner_user_id=${user.id} AND deleted_at IS NULL AND (lower(coalesce(title,'')) LIKE ${pattern} OR lower(data::text) LIKE ${pattern}) LIMIT 30`
          ]);return [...c,...p,...b,...ct,...r];
        });
        return send(res,200,{ok:true,results});
      }
      if(action==='admin_overview'){
        if(user.role!=='admin')return send(res,403,{ok:false,error:'ADMIN_ONLY'});
        const rows=await adminSql`
          SELECT u.id,u.name,u.local_id,u.role,
            (SELECT count(*) FROM clients c WHERE c.company_id=u.company_id AND c.owner_user_id=u.id) clients,
            (SELECT count(*) FROM budgets b WHERE b.company_id=u.company_id AND b.owner_user_id=u.id) budgets,
            (SELECT COALESCE(sum(b.total),0) FROM budgets b WHERE b.company_id=u.company_id AND b.owner_user_id=u.id) budget_value
          FROM users u WHERE u.company_id=${company.id} ORDER BY u.created_at
        `;
        return send(res,200,{ok:true,users:rows.map(x=>({...x,clients:Number(x.clients||0),budgets:Number(x.budgets||0),budget_value:Number(x.budget_value||0)}))});
      }
      return send(res,400,{ok:false,error:'INVALID_ACTION'});
    }

    if(req.method!=='POST')return send(res,405,{ok:false,error:'METHOD_NOT_ALLOWED'});
    const action=String(req.body?.action||'');

    if(action==='save_record'){
      const kind=cleanKind(req.body?.kind),id=localId(req.body?.localId)||crypto.randomUUID();
      if(!kind)return send(res,400,{ok:false,error:'INVALID_KIND'});
      const title=String(req.body?.title||'').slice(0,250),status=String(req.body?.status||'').slice(0,80);
      const amount=Number.isFinite(Number(req.body?.amount))?Number(req.body.amount):null,due=safeDate(req.body?.dueDate),data=req.body?.data&&typeof req.body.data==='object'?req.body.data:{};
      const favorite=!!req.body?.favorite;
      const row=await withRlsSql(company.id,user,async sql=>{
        const rows=await sql`INSERT INTO business_records(company_id,owner_user_id,kind,local_id,title,status,amount,due_date,data,favorite,deleted_at,updated_at)
          VALUES(${company.id},${user.id},${kind},${id},${title||null},${status||null},${amount},${due},${json(data)}::jsonb,${favorite},NULL,now())
          ON CONFLICT(company_id,owner_user_id,kind,local_id) DO UPDATE SET title=EXCLUDED.title,status=EXCLUDED.status,amount=EXCLUDED.amount,due_date=EXCLUDED.due_date,data=EXCLUDED.data,favorite=EXCLUDED.favorite,deleted_at=NULL,updated_at=now()
          RETURNING id,local_id,updated_at`;
        return rows[0];
      });
      await logActivity(adminSql,company.id,user.id,kind,id,'save',data);
      return send(res,200,{ok:true,record:{id:row.id,localId:row.local_id,updatedAt:row.updated_at}});
    }

    if(action==='delete_record'||action==='restore_record'||action==='purge_record'){
      const kind=cleanKind(req.body?.kind),id=localId(req.body?.localId);if(!kind||!id)return send(res,400,{ok:false,error:'INVALID_RECORD'});
      await withRlsSql(company.id,user,async sql=>{
        if(action==='delete_record')await sql`UPDATE business_records SET deleted_at=now(),updated_at=now() WHERE company_id=${company.id} AND owner_user_id=${user.id} AND kind=${kind} AND local_id=${id}`;
        if(action==='restore_record')await sql`UPDATE business_records SET deleted_at=NULL,updated_at=now() WHERE company_id=${company.id} AND owner_user_id=${user.id} AND kind=${kind} AND local_id=${id}`;
        if(action==='purge_record')await sql`DELETE FROM business_records WHERE company_id=${company.id} AND owner_user_id=${user.id} AND kind=${kind} AND local_id=${id}`;
      });
      await logActivity(adminSql,company.id,user.id,kind,id,action,{});return send(res,200,{ok:true});
    }

    if(action==='set_permissions'){
      if(user.role!=='admin')return send(res,403,{ok:false,error:'ADMIN_ONLY'});
      const target=String(req.body?.userId||''),permissions=req.body?.permissions&&typeof req.body.permissions==='object'?req.body.permissions:{};
      const exists=await adminSql`SELECT id FROM users WHERE company_id=${company.id} AND id::text=${target} LIMIT 1`;if(!exists.length)return send(res,404,{ok:false,error:'USER_NOT_FOUND'});
      await adminSql`INSERT INTO user_permissions(company_id,user_id,permissions,updated_at) VALUES(${company.id},${target},${json(permissions)}::jsonb,now()) ON CONFLICT(company_id,user_id) DO UPDATE SET permissions=EXCLUDED.permissions,updated_at=now()`;
      await logActivity(adminSql,company.id,user.id,'user',target,'permissions_update',permissions);return send(res,200,{ok:true});
    }

    if(action==='totp_setup'){
      const secret=generateTotpSecret();
      const recovery=Array.from({length:8},()=>crypto.randomBytes(4).toString('hex').toUpperCase());
      await adminSql`INSERT INTO user_security(company_id,user_id,totp_secret,totp_enabled,recovery_codes,updated_at) VALUES(${company.id},${user.id},${secret},false,${json(recovery)}::jsonb,now()) ON CONFLICT(company_id,user_id) DO UPDATE SET totp_secret=EXCLUDED.totp_secret,totp_enabled=false,recovery_codes=EXCLUDED.recovery_codes,updated_at=now()`;
      const issuer='OrcaFacil Pro';const account=String(user.local_id||user.name||'usuario');
      const uri=`otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&digits=6&period=30`;
      const qr=await QRCode.toDataURL(uri,{width:260,margin:1});
      return send(res,200,{ok:true,secret,uri,qr,recoveryCodes:recovery});
    }
    if(action==='totp_enable'){
      const code=String(req.body?.code||'');const rows=await adminSql`SELECT totp_secret FROM user_security WHERE company_id=${company.id} AND user_id=${user.id} LIMIT 1`;const secret=rows[0]?.totp_secret;
      if(!secret||!verifyTotp(secret,code))return send(res,400,{ok:false,error:'INVALID_2FA_CODE'});
      await adminSql`UPDATE user_security SET totp_enabled=true,updated_at=now() WHERE company_id=${company.id} AND user_id=${user.id}`;await logActivity(adminSql,company.id,user.id,'security',String(user.id),'totp_enabled',{});return send(res,200,{ok:true});
    }
    if(action==='totp_disable'){
      const code=String(req.body?.code||'');const rows=await adminSql`SELECT totp_secret,totp_enabled FROM user_security WHERE company_id=${company.id} AND user_id=${user.id} LIMIT 1`;if(rows[0]?.totp_enabled&& !verifyTotp(rows[0]?.totp_secret,code))return send(res,400,{ok:false,error:'INVALID_2FA_CODE'});
      await adminSql`UPDATE user_security SET totp_enabled=false,totp_secret=NULL,recovery_codes='[]'::jsonb,updated_at=now() WHERE company_id=${company.id} AND user_id=${user.id}`;return send(res,200,{ok:true});
    }

    if(action==='revoke_session'){
      await ensureSessionTable(adminSql);const id=String(req.body?.sessionId||'');const primary=await isPrimaryAdmin(adminSql,company.id,user);
      if(primary)await adminSql`DELETE FROM user_sessions WHERE company_id=${company.id} AND id::text=${id}`;else await adminSql`DELETE FROM user_sessions WHERE company_id=${company.id} AND user_id=${user.id} AND id::text=${id}`;
      return send(res,200,{ok:true});
    }

    if(action==='create_backup'){
      const snapshot=await withRlsSql(company.id,user,async sql=>{
        const [clients,products,budgets,contracts,records]=await Promise.all([
          sql`SELECT * FROM clients WHERE company_id=${company.id} AND owner_user_id=${user.id}`,
          sql`SELECT * FROM products WHERE company_id=${company.id} AND owner_user_id=${user.id}`,
          sql`SELECT * FROM budgets WHERE company_id=${company.id} AND owner_user_id=${user.id}`,
          sql`SELECT * FROM contracts WHERE company_id=${company.id} AND owner_user_id=${user.id}`,
          sql`SELECT * FROM business_records WHERE company_id=${company.id} AND owner_user_id=${user.id}`
        ]);return {version:1,createdAt:new Date().toISOString(),clients,products,budgets,contracts,records};
      });
      const label=String(req.body?.label||'Backup automático').slice(0,120);
      const rows=await withRlsSql(company.id,user,sql=>sql`INSERT INTO suite_backups(company_id,owner_user_id,label,snapshot) VALUES(${company.id},${user.id},${label},${json(snapshot)}::jsonb) RETURNING id,created_at`);
      return send(res,200,{ok:true,backup:{id:rows[0].id,createdAt:rows[0].created_at}});
    }

    if(action==='create_public_link'){
      const linkType=String(req.body?.linkType||'').trim();if(!['payment','signature'].includes(linkType))return send(res,400,{ok:false,error:'INVALID_LINK_TYPE'});
      const entityKind=String(req.body?.entityKind||'').slice(0,80),entityId=localId(req.body?.entityLocalId);if(!entityKind||!entityId)return send(res,400,{ok:false,error:'INVALID_ENTITY'});
      const token=crypto.randomBytes(24).toString('hex');const payload=req.body?.payload&&typeof req.body.payload==='object'?req.body.payload:{};
      await adminSql`INSERT INTO suite_public_links(token,company_id,owner_user_id,link_type,entity_kind,entity_local_id,payload,expires_at) VALUES(${token},${company.id},${user.id},${linkType},${entityKind},${entityId},${json(payload)}::jsonb,now()+interval '30 days')`;
      const path=linkType==='payment'?'/api/public-payment?token=':'/api/public-signature?token=';
      return send(res,200,{ok:true,token,url:`${origin(req)}${path}${encodeURIComponent(token)}`});
    }

    if(action==='expire_budgets'){
      const changed=await withRlsSql(company.id,user,async sql=>{
        const rows=await sql`UPDATE budgets SET status='Vencido',updated_at=now() WHERE company_id=${company.id} AND owner_user_id=${user.id} AND status IN ('Rascunho','Enviado','Visualizado') AND created_at + (valid_days||' days')::interval < now() RETURNING local_id`;
        return rows.map(x=>x.local_id);
      });
      return send(res,200,{ok:true,changed});
    }

    if(action==='admin_log'){
      if(user.role!=='admin')return send(res,403,{ok:false,error:'ADMIN_ONLY'});
      const info=reqInfo(req);await logActivity(adminSql,company.id,user.id,'admin',String(user.id),'admin_action',{...info,...(req.body?.details||{})});return send(res,200,{ok:true});
    }

    return send(res,400,{ok:false,error:'INVALID_ACTION'});
  }catch(err){
    console.error('suite',err);
    const missing=err?.message==='DATABASE_URL_NOT_CONFIGURED';
    return send(res,missing?503:500,{ok:false,error:missing?'DATABASE_NOT_CONNECTED':'SERVER_ERROR',detail:String(err?.message||'').slice(0,180)});
  }
};
