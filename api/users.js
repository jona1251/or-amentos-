const { getSql, ensureCompany, authenticate, send } = require('./_db');
const { DEFAULTS, ensurePermissionsTable, requirePermission, getPrimaryAdmin } = require('../lib/permissions');

const cleanLogin = value => String(value || '').trim().toLowerCase();
const validPinHash = value => /^[a-f0-9]{64}$/i.test(String(value || ''));
const validLogin = value => /^[a-z0-9._-]{3,30}$/.test(value);
const validEmail = value => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const PRESETS = {
  completo:{...DEFAULTS,usuarios:false,seguranca:false},
  comercial:{dashboard:true,clientes:true,produtos:true,orcamentos:true,contratos:true,financeiro:false,operacoes:false,crm:true,relatorios:true,custos:false,configuracoes:false,excluir:false,usuarios:false,seguranca:false},
  tecnico:{dashboard:true,clientes:true,produtos:true,orcamentos:false,contratos:false,financeiro:false,operacoes:true,crm:false,relatorios:false,custos:false,configuracoes:false,excluir:false,usuarios:false,seguranca:false},
  financeiro:{dashboard:true,clientes:true,produtos:false,orcamentos:true,contratos:false,financeiro:true,operacoes:false,crm:false,relatorios:true,custos:true,configuracoes:false,excluir:false,usuarios:false,seguranca:false},
  leitura:{dashboard:true,clientes:true,produtos:true,orcamentos:true,contratos:true,financeiro:true,operacoes:true,crm:true,relatorios:true,custos:false,configuracoes:false,excluir:false,usuarios:false,seguranca:false}
};

const allAccess = () => Object.fromEntries(Object.keys(DEFAULTS).map(k => [k,true]));
const sanitizePermissions = input => Object.fromEntries(Object.keys(DEFAULTS).map(k => [k,input?.[k] !== false]));

module.exports = async function handler(req, res) {
  try {
    const sql = getSql();
    const company = await ensureCompany(sql);
    const current = await authenticate(sql, req);
    if (!current) return send(res, 401, { ok:false, error:'UNAUTHORIZED' });
    if (current.role !== 'admin') return send(res, 403, { ok:false, error:'ADMIN_ONLY' });
    await requirePermission(sql, company.id, current, 'usuarios');

    const primaryAdminId = await getPrimaryAdmin(sql, company.id);
    const isPrimary = String(current.id) === String(primaryAdminId);

    if (String(req.query?.action || '') === 'access_control') {
      if (!isPrimary) return send(res, 403, {ok:false,error:'PRIMARY_ADMIN_ONLY'});
      await ensurePermissionsTable(sql);

      if (req.method === 'GET') {
        const rows = await sql`
          SELECT u.id,u.local_id,u.name,u.email,u.role,u.created_at,COALESCE(p.permissions,'{}'::jsonb) permissions
          FROM users u
          LEFT JOIN user_permissions p ON p.company_id=u.company_id AND p.user_id=u.id
          WHERE u.company_id=${company.id}
          ORDER BY u.created_at ASC
        `;
        return send(res,200,{
          ok:true,
          primaryAdminId,
          modules:Object.keys(DEFAULTS),
          presets:PRESETS,
          users:rows.map(u=>({
            id:u.id,login:u.local_id,name:u.name,email:u.email||'',role:u.role,createdAt:u.created_at,
            primaryAdmin:String(u.id)===String(primaryAdminId),
            permissions:String(u.id)===String(primaryAdminId)?allAccess():{...DEFAULTS,...(u.permissions||{})}
          }))
        });
      }

      if (req.method === 'POST') {
        const userId=String(req.body?.userId||'');
        const target=await sql`SELECT id,role,name,local_id FROM users WHERE company_id=${company.id} AND id::text=${userId} LIMIT 1`;
        if(!target.length)return send(res,404,{ok:false,error:'USER_NOT_FOUND'});
        if(String(userId)===String(primaryAdminId))return send(res,400,{ok:false,error:'PRIMARY_ADMIN_ALWAYS_FULL_ACCESS'});
        const mode=String(req.body?.mode||'save');
        let permissions;
        if(mode==='preset'){
          const preset=String(req.body?.preset||'');
          if(!PRESETS[preset])return send(res,400,{ok:false,error:'INVALID_PRESET'});
          permissions={...PRESETS[preset]};
        }else if(mode==='save') permissions=sanitizePermissions(req.body?.permissions||{});
        else return send(res,400,{ok:false,error:'INVALID_ACTION'});

        await sql`
          INSERT INTO user_permissions(company_id,user_id,permissions,updated_at)
          VALUES(${company.id},${userId},${JSON.stringify(permissions)}::jsonb,now())
          ON CONFLICT(company_id,user_id) DO UPDATE SET permissions=EXCLUDED.permissions,updated_at=now()
        `;
        try{
          await sql`
            INSERT INTO audit_log(company_id,user_id,entity_type,entity_id,action,details)
            VALUES(${company.id},${current.id},'user',${userId},'permissions_update',${JSON.stringify({targetLogin:target[0].local_id,permissions})}::jsonb)
          `;
        }catch(_){}
        return send(res,200,{ok:true,userId,permissions});
      }
      return send(res,405,{ok:false,error:'METHOD_NOT_ALLOWED'});
    }

    if (req.method === 'GET') {
      const rows = await sql`
        SELECT id, local_id, name, email, role, created_at
        FROM users WHERE company_id = ${company.id}
        ORDER BY created_at ASC
      `;
      return send(res, 200, {
        ok:true,
        users:rows.map(u=>({id:u.id, login:u.local_id, name:u.name, email:u.email || '', role:u.role, createdAt:u.created_at, primaryAdmin:String(u.id)===String(primaryAdminId)})),
        currentUserId:current.id,
        primaryAdminId
      });
    }

    if (req.method === 'POST') {
      const name = String(req.body?.name || '').trim();
      const login = cleanLogin(req.body?.login);
      const email = String(req.body?.email || '').trim() || null;
      const role = req.body?.role === 'admin' ? 'admin' : 'operador';
      const pinHash = String(req.body?.pinHash || '');
      if (!name) return send(res, 400, { ok:false, error:'NAME_REQUIRED' });
      if (!validLogin(login)) return send(res, 400, { ok:false, error:'INVALID_LOGIN' });
      if (!validEmail(email)) return send(res, 400, { ok:false, error:'INVALID_EMAIL' });
      if (!validPinHash(pinHash)) return send(res, 400, { ok:false, error:'INVALID_PIN_HASH' });
      const exists = await sql`SELECT id FROM users WHERE company_id=${company.id} AND lower(coalesce(local_id,''))=${login} LIMIT 1`;
      if (exists.length) return send(res, 409, { ok:false, error:'LOGIN_TAKEN' });
      const rows = await sql`
        INSERT INTO users (company_id, local_id, name, email, role, pin_hash)
        VALUES (${company.id}, ${login}, ${name}, ${email}, ${role}, ${pinHash})
        RETURNING id, local_id, name, email, role, created_at
      `;
      const u = rows[0];
      return send(res, 201, { ok:true, user:{id:u.id,login:u.local_id,name:u.name,email:u.email||'',role:u.role,createdAt:u.created_at} });
    }

    if (req.method === 'PATCH') {
      const id = String(req.body?.id || '').trim();
      if (!id) return send(res, 400, { ok:false, error:'USER_ID_REQUIRED' });
      const targetRows = await sql`
        SELECT id, local_id, name, email, role, pin_hash, created_at
        FROM users WHERE company_id=${company.id} AND id::text=${id} LIMIT 1
      `;
      if (!targetRows.length) return send(res, 404, { ok:false, error:'USER_NOT_FOUND' });
      const target = targetRows[0];
      if (String(target.id) === String(primaryAdminId) && !isPrimary) return send(res, 403, { ok:false, error:'PRIMARY_ADMIN_PROTECTED' });

      const name = req.body?.name === undefined ? target.name : String(req.body.name || '').trim();
      const login = req.body?.login === undefined ? String(target.local_id || '').toLowerCase() : cleanLogin(req.body.login);
      const email = req.body?.email === undefined ? (target.email || null) : (String(req.body.email || '').trim() || null);
      const role = req.body?.role === undefined ? target.role : (req.body.role === 'admin' ? 'admin' : 'operador');
      const pinHash = req.body?.pinHash ? String(req.body.pinHash) : target.pin_hash;

      if (!name) return send(res, 400, { ok:false, error:'NAME_REQUIRED' });
      if (!validLogin(login)) return send(res, 400, { ok:false, error:'INVALID_LOGIN' });
      if (!validEmail(email)) return send(res, 400, { ok:false, error:'INVALID_EMAIL' });
      if (!validPinHash(pinHash)) return send(res, 400, { ok:false, error:'INVALID_PIN_HASH' });

      if (login !== String(target.local_id || '').toLowerCase()) {
        const duplicate = await sql`
          SELECT id FROM users
          WHERE company_id=${company.id} AND lower(coalesce(local_id,''))=${login} AND id<>${target.id}
          LIMIT 1
        `;
        if (duplicate.length) return send(res, 409, { ok:false, error:'LOGIN_TAKEN' });
      }
      if (target.role === 'admin' && role !== 'admin') {
        const admins = await sql`SELECT count(*)::int AS total FROM users WHERE company_id=${company.id} AND role='admin'`;
        if (Number(admins[0]?.total || 0) <= 1) return send(res, 400, { ok:false, error:'LAST_ADMIN' });
      }
      const rows = await sql`
        UPDATE users SET name=${name}, local_id=${login}, email=${email}, role=${role}, pin_hash=${pinHash}
        WHERE company_id=${company.id} AND id=${target.id}
        RETURNING id, local_id, name, email, role, created_at
      `;
      const u = rows[0];
      return send(res, 200, {ok:true,user:{id:u.id,login:u.local_id,name:u.name,email:u.email||'',role:u.role,createdAt:u.created_at},currentUser:String(current.id)===String(u.id)});
    }

    if (req.method === 'DELETE') {
      const id = String(req.query?.id || '');
      if (!id) return send(res, 400, { ok:false, error:'USER_ID_REQUIRED' });
      if (String(current.id) === id) return send(res, 400, { ok:false, error:'CANNOT_DELETE_SELF' });
      if (String(primaryAdminId) === id) return send(res, 403, { ok:false, error:'PRIMARY_ADMIN_PROTECTED' });
      const target = await sql`SELECT id, role FROM users WHERE company_id=${company.id} AND id::text=${id} LIMIT 1`;
      if (!target.length) return send(res, 404, { ok:false, error:'USER_NOT_FOUND' });
      if (target[0].role === 'admin') {
        const admins = await sql`SELECT count(*)::int AS total FROM users WHERE company_id=${company.id} AND role='admin'`;
        if (Number(admins[0]?.total || 0) <= 1) return send(res, 400, { ok:false, error:'LAST_ADMIN' });
      }
      await sql`DELETE FROM users WHERE company_id=${company.id} AND id::text=${id}`;
      return send(res, 200, { ok:true });
    }

    return send(res, 405, { ok:false, error:'METHOD_NOT_ALLOWED' });
  } catch (err) {
    console.error(err);
    const missing = err?.message === 'DATABASE_URL_NOT_CONFIGURED';
    if (err?.message === 'ACCESS_DENIED' || err?.code === 'ACCESS_DENIED') return send(res, 403, {ok:false,error:'ACCESS_DENIED',permission:err.permission||'usuarios'});
    return send(res, missing ? 503 : 500, { ok:false, error:missing ? 'DATABASE_NOT_CONNECTED' : 'SERVER_ERROR' });
  }
};