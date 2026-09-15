const { getSql, ensureCompany, authenticate, withRlsSql, send } = require('./_db');
const { getUserPermissions, requirePermission } = require('../lib/permissions');

const toNum = v => Number.isFinite(Number(v)) ? Number(v) : 0;
const iso = v => {
  const d = v ? new Date(v) : new Date();
  return Number.isFinite(d.getTime()) ? d : new Date();
};
const cleanId = v => String(v || '').trim().slice(0,160);
const cleanText = (v,max=4000) => String(v ?? '').slice(0,max);

function canAccess(access, key) {
  return !!access?.adminFull || !!access?.primary || access?.permissions?.[key] !== false;
}

async function ensureUserSettings(sql, companyId, userId) {
  let rows = await sql`SELECT * FROM user_settings WHERE company_id=${companyId} AND user_id=${userId} LIMIT 1`;
  if (!rows.length) {
    rows = await sql`
      INSERT INTO user_settings (company_id,user_id,company_name,budget_prefix,budget_seq,contract_prefix,contract_seq)
      VALUES (${companyId},${userId},'Minha empresa','ORC',1,'CTR',1)
      RETURNING *
    `;
  }
  return rows[0];
}

async function clientUuid(sql, companyId, userId, localId) {
  if (!localId) return null;
  const rows = await sql`SELECT id FROM clients WHERE company_id=${companyId} AND owner_user_id=${userId} AND local_id=${localId} LIMIT 1`;
  return rows[0]?.id || null;
}
async function productUuid(sql, companyId, userId, localId) {
  if (!localId) return null;
  const rows = await sql`SELECT id FROM products WHERE company_id=${companyId} AND owner_user_id=${userId} AND local_id=${localId} LIMIT 1`;
  return rows[0]?.id || null;
}
async function budgetUuid(sql, companyId, userId, localId) {
  if (!localId) return null;
  const rows = await sql`SELECT id FROM budgets WHERE company_id=${companyId} AND owner_user_id=${userId} AND local_id=${localId} LIMIT 1`;
  return rows[0]?.id || null;
}

async function saveSettings(sql, companyId, userId, r) {
  const rows = await sql`
    INSERT INTO user_settings (
      company_id,user_id,company_name,company_document,company_owner,company_phone,company_email,company_address,company_city,
      pix_key,logo_url,slogan,budget_prefix,budget_seq,contract_prefix,contract_seq,updated_at
    ) VALUES (
      ${companyId},${userId},${cleanText(r.companyName || 'Minha empresa',180)},${cleanText(r.companyDoc,80) || null},${cleanText(r.companyOwner,180) || null},${cleanText(r.companyPhone,80) || null},${cleanText(r.companyEmail,180) || null},${cleanText(r.companyAddress,500) || null},${cleanText(r.companyCity,180) || null},
      ${cleanText(r.pixKey,180) || null},${cleanText(r.companyLogo,300000) || null},${cleanText(r.companySlogan,240) || null},${cleanText(r.budgetPrefix || 'ORC',20)},${Math.max(1,Math.trunc(toNum(r.budgetSeq) || 1))},${cleanText(r.contractPrefix || 'CTR',20)},${Math.max(1,Math.trunc(toNum(r.contractSeq) || 1))},now()
    )
    ON CONFLICT (company_id,user_id) DO UPDATE SET
      company_name=EXCLUDED.company_name, company_document=EXCLUDED.company_document, company_owner=EXCLUDED.company_owner,
      company_phone=EXCLUDED.company_phone, company_email=EXCLUDED.company_email, company_address=EXCLUDED.company_address,
      company_city=EXCLUDED.company_city, pix_key=EXCLUDED.pix_key, logo_url=EXCLUDED.logo_url, slogan=EXCLUDED.slogan,
      budget_prefix=EXCLUDED.budget_prefix, budget_seq=EXCLUDED.budget_seq,
      contract_prefix=EXCLUDED.contract_prefix, contract_seq=EXCLUDED.contract_seq, updated_at=now()
    RETURNING user_id
  `;
  return rows[0];
}

async function saveSequenceSettings(sql, companyId, userId, r, { budget=false, contract=false }={}) {
  await ensureUserSettings(sql, companyId, userId);
  if (budget) {
    const seq = Math.max(1,Math.trunc(toNum(r.budgetSeq) || 1));
    await sql`UPDATE user_settings SET budget_seq=${seq},updated_at=now() WHERE company_id=${companyId} AND user_id=${userId}`;
  }
  if (contract) {
    const seq = Math.max(1,Math.trunc(toNum(r.contractSeq) || 1));
    await sql`UPDATE user_settings SET contract_seq=${seq},updated_at=now() WHERE company_id=${companyId} AND user_id=${userId}`;
  }
}

async function saveClient(sql, companyId, userId, r) {
  const id = cleanId(r.id);
  const rows = await sql`
    INSERT INTO clients (company_id, owner_user_id, local_id, name, document, phone, email, address, notes, created_at, updated_at)
    VALUES (${companyId}, ${userId}, ${id}, ${cleanText(r.name || 'Cliente',220)}, ${cleanText(r.doc,80) || null}, ${cleanText(r.phone,80) || null}, ${cleanText(r.email,180) || null}, ${cleanText(r.address,500) || null}, ${cleanText(r.notes,2000) || null}, ${iso(r.createdAt)}, ${iso(r.updatedAt)})
    ON CONFLICT (company_id, local_id) DO UPDATE SET
      name=EXCLUDED.name, document=EXCLUDED.document, phone=EXCLUDED.phone, email=EXCLUDED.email,
      address=EXCLUDED.address, notes=EXCLUDED.notes, updated_at=EXCLUDED.updated_at
    WHERE clients.owner_user_id=${userId}
    RETURNING id
  `;
  if (!rows.length) throw new Error('RECORD_OWNED_BY_ANOTHER_USER');
  return rows[0];
}

async function saveProduct(sql, companyId, userId, r, allowCosts=true) {
  const id = cleanId(r.id);
  let cost = r.cost == null ? null : Math.max(0,toNum(r.cost));
  if (!allowCosts) {
    const current = await sql`SELECT cost_price FROM products WHERE company_id=${companyId} AND owner_user_id=${userId} AND local_id=${id} LIMIT 1`;
    cost = current.length ? current[0].cost_price : null;
  }
  const stock = r.stock == null || r.stock === '' ? null : Math.max(0,toNum(r.stock));
  const rows = await sql`
    INSERT INTO products (company_id, owner_user_id, local_id, type, name, code, category, unit, sale_price, cost_price, stock, description, active, created_at, updated_at)
    VALUES (${companyId}, ${userId}, ${id}, ${cleanText(r.type || 'Produto',80)}, ${cleanText(r.name || 'Produto',220)}, ${cleanText(r.code,100) || null}, ${cleanText(r.category,120) || null}, ${cleanText(r.unit || 'un',40)}, ${Math.max(0,toNum(r.price))}, ${cost}, ${stock}, ${cleanText(r.description,3000) || null}, ${r.active !== false}, ${iso(r.createdAt)}, ${iso(r.updatedAt)})
    ON CONFLICT (company_id, local_id) DO UPDATE SET
      type=EXCLUDED.type, name=EXCLUDED.name, code=EXCLUDED.code, category=EXCLUDED.category, unit=EXCLUDED.unit,
      sale_price=EXCLUDED.sale_price, cost_price=EXCLUDED.cost_price, stock=EXCLUDED.stock,
      description=EXCLUDED.description, active=EXCLUDED.active, updated_at=EXCLUDED.updated_at
    WHERE products.owner_user_id=${userId}
    RETURNING id
  `;
  if (!rows.length) throw new Error('RECORD_OWNED_BY_ANOTHER_USER');
  return rows[0];
}

async function saveBudget(sql, companyId, userId, r) {
  let cId = await clientUuid(sql, companyId, userId, r.client?.id);
  if (!cId && r.client?.id) { await saveClient(sql, companyId, userId, r.client); cId = await clientUuid(sql, companyId, userId, r.client.id); }
  if (!cId) throw new Error('CLIENT_NOT_FOUND');
  const id = cleanId(r.id);
  const rows = await sql`
    INSERT INTO budgets (company_id, owner_user_id, local_id, client_id, number, status, valid_days, payment_method, deadline, warranty, execution_location, notes, subtotal, discount, total, created_at, updated_at)
    VALUES (${companyId}, ${userId}, ${id}, ${cId}, ${cleanText(r.number,80)}, ${cleanText(r.status || 'Rascunho',50)}, ${Math.max(1,Math.min(3650,Math.trunc(toNum(r.validDays) || 10)))}, ${cleanText(r.paymentMethod,180) || null}, ${cleanText(r.deadline,240) || null}, ${cleanText(r.warranty,240) || null}, ${cleanText(r.executionLocation,500) || null}, ${cleanText(r.notes,4000) || null}, ${Math.max(0,toNum(r.subtotal))}, ${Math.max(0,toNum(r.discount))}, ${Math.max(0,toNum(r.total))}, ${iso(r.createdAt)}, ${iso(r.updatedAt)})
    ON CONFLICT (company_id, local_id) DO UPDATE SET
      client_id=EXCLUDED.client_id, number=EXCLUDED.number, status=EXCLUDED.status, valid_days=EXCLUDED.valid_days,
      payment_method=EXCLUDED.payment_method, deadline=EXCLUDED.deadline, warranty=EXCLUDED.warranty,
      execution_location=EXCLUDED.execution_location, notes=EXCLUDED.notes, subtotal=EXCLUDED.subtotal,
      discount=EXCLUDED.discount, total=EXCLUDED.total, updated_at=EXCLUDED.updated_at
    WHERE budgets.owner_user_id=${userId}
    RETURNING id
  `;
  if (!rows.length) throw new Error('RECORD_OWNED_BY_ANOTHER_USER');
  const budgetId = rows[0].id;
  await sql`DELETE FROM budget_items WHERE budget_id=${budgetId}`;
  const items = Array.isArray(r.items) ? r.items.slice(0,500) : [];
  for (const item of items) {
    const pId = await productUuid(sql, companyId, userId, item.productId);
    const description = cleanText(item.description || 'Item',1000);
    const qty = Math.max(0,toNum(item.qty));
    const unit = Math.max(0,toNum(item.unit));
    if (!description || qty <= 0) continue;
    await sql`
      INSERT INTO budget_items (budget_id, local_id, product_id, description, quantity, unit_price)
      VALUES (${budgetId}, ${cleanId(item.id) || null}, ${pId}, ${description}, ${qty}, ${unit})
    `;
  }
  return { id: budgetId };
}

async function saveContract(sql, companyId, userId, r) {
  const bId = await budgetUuid(sql, companyId, userId, r.budgetId || r.budget?.id);
  if (!bId) throw new Error('BUDGET_NOT_FOUND');
  const b = await sql`SELECT client_id FROM budgets WHERE id=${bId} AND owner_user_id=${userId} LIMIT 1`;
  const cId = b[0]?.client_id;
  if (!cId) throw new Error('CLIENT_NOT_FOUND');
  const id = cleanId(r.id);
  const rows = await sql`
    INSERT INTO contracts (company_id, owner_user_id, local_id, budget_id, client_id, number, contract_type, forum_city, contract_term, additional_clauses, status, signed_at, created_at, updated_at)
    VALUES (${companyId}, ${userId}, ${id}, ${bId}, ${cId}, ${cleanText(r.number,80)}, ${cleanText(r.type || r.contractType || 'Prestação de Serviços',120)}, ${cleanText(r.forum || r.forumCity,180) || null}, ${cleanText(r.term || r.contractTerm,240) || null}, ${cleanText(r.clauses || r.additionalClauses,10000) || null}, ${cleanText(r.status || 'Rascunho',50)}, ${r.signedAt ? iso(r.signedAt) : null}, ${iso(r.createdAt)}, ${iso(r.updatedAt)})
    ON CONFLICT (company_id, local_id) DO UPDATE SET
      budget_id=EXCLUDED.budget_id, client_id=EXCLUDED.client_id, number=EXCLUDED.number,
      contract_type=EXCLUDED.contract_type, forum_city=EXCLUDED.forum_city, contract_term=EXCLUDED.contract_term,
      additional_clauses=EXCLUDED.additional_clauses, status=EXCLUDED.status, signed_at=EXCLUDED.signed_at, updated_at=EXCLUDED.updated_at
    WHERE contracts.owner_user_id=${userId}
    RETURNING id
  `;
  if (!rows.length) throw new Error('RECORD_OWNED_BY_ANOTHER_USER');
  return rows[0];
}

async function snapshot(sql, companyId, userId, access) {
  const s = await ensureUserSettings(sql, companyId, userId);
  const canClients = canAccess(access,'clientes');
  const canProducts = canAccess(access,'produtos');
  const canBudgets = canAccess(access,'orcamentos');
  const canContracts = canAccess(access,'contratos');
  const canCosts = canAccess(access,'custos');
  const needBudgets = canBudgets || canContracts;
  const needClients = canClients || needBudgets;
  const needProducts = canProducts || canBudgets;

  const clients = needClients ? await sql`SELECT * FROM clients WHERE company_id=${companyId} AND owner_user_id=${userId} ORDER BY updated_at` : [];
  const products = needProducts ? await sql`SELECT * FROM products WHERE company_id=${companyId} AND owner_user_id=${userId} ORDER BY updated_at` : [];
  const budgets = needBudgets ? await sql`
    SELECT b.*, c.local_id AS client_local_id, c.name AS client_name, c.document AS client_document,
      c.phone AS client_phone, c.email AS client_email, c.address AS client_address
    FROM budgets b JOIN clients c ON c.id=b.client_id
    WHERE b.company_id=${companyId} AND b.owner_user_id=${userId} AND c.owner_user_id=${userId}
    ORDER BY b.updated_at
  ` : [];

  const itemsByBudget = new Map();
  if (budgets.length) {
    const items = await sql`
      SELECT bi.*, p.local_id AS product_local_id
      FROM budget_items bi
      JOIN budgets b ON b.id=bi.budget_id
      LEFT JOIN products p ON p.id=bi.product_id AND p.owner_user_id=${userId}
      WHERE b.company_id=${companyId} AND b.owner_user_id=${userId}
      ORDER BY bi.budget_id, bi.id
    `;
    for (const item of items) {
      const key = String(item.budget_id);
      if (!itemsByBudget.has(key)) itemsByBudget.set(key,[]);
      itemsByBudget.get(key).push(item);
    }
  }

  const budgetRows = budgets.map(b => {
    const items = itemsByBudget.get(String(b.id)) || [];
    return {
      id:b.local_id, number:b.number, status:b.status, validDays:b.valid_days, paymentMethod:b.payment_method || '',
      deadline:b.deadline || '', warranty:b.warranty || '', executionLocation:b.execution_location || '', notes:b.notes || '',
      subtotal:Number(b.subtotal), discount:Number(b.discount), total:Number(b.total), createdAt:b.created_at, updatedAt:b.updated_at,
      client:{id:b.client_local_id,name:b.client_name,doc:b.client_document||'',phone:b.client_phone||'',email:b.client_email||'',address:b.client_address||''},
      items:items.map(i=>({id:i.local_id||undefined,productId:i.product_local_id||undefined,description:i.description,qty:Number(i.quantity),unit:Number(i.unit_price)}))
    };
  });

  const contracts = canContracts ? await sql`
    SELECT ct.*, b.local_id AS budget_local_id FROM contracts ct
    JOIN budgets b ON b.id=ct.budget_id
    WHERE ct.company_id=${companyId} AND ct.owner_user_id=${userId} AND b.owner_user_id=${userId}
    ORDER BY ct.updated_at
  ` : [];

  return {
    settings:[{id:'main',companyName:s.company_name||'',companyDoc:s.company_document||'',companyOwner:s.company_owner||'',companyPhone:s.company_phone||'',companyEmail:s.company_email||'',companyAddress:s.company_address||'',companyCity:s.company_city||'',companyLogo:s.logo_url||'',companySlogan:s.slogan||'',pixKey:s.pix_key||'',budgetPrefix:s.budget_prefix||'ORC',budgetSeq:s.budget_seq||1,contractPrefix:s.contract_prefix||'CTR',contractSeq:s.contract_seq||1}],
    clients:clients.map(x=>({id:x.local_id,name:x.name,doc:x.document||'',phone:x.phone||'',email:x.email||'',address:x.address||'',notes:x.notes||'',createdAt:x.created_at,updatedAt:x.updated_at})),
    products:products.map(x=>({id:x.local_id,type:x.type,name:x.name,code:x.code||'',category:x.category||'',unit:x.unit,price:Number(x.sale_price),cost:canCosts?(x.cost_price==null?0:Number(x.cost_price)):0,stock:x.stock==null?null:Number(x.stock),description:x.description||'',active:x.active,createdAt:x.created_at,updatedAt:x.updated_at})),
    budgets:budgetRows,
    contracts:contracts.map(x=>({id:x.local_id,budgetId:x.budget_local_id,number:x.number,type:x.contract_type,forum:x.forum_city||'',term:x.contract_term||'',clauses:x.additional_clauses||'',status:x.status,signedAt:x.signed_at,createdAt:x.created_at,updatedAt:x.updated_at}))
  };
}

module.exports = async function handler(req, res) {
  try {
    const adminSql = getSql();
    const company = await ensureCompany(adminSql);
    const user = await authenticate(adminSql, req);
    if (!user) return send(res, 401, { ok:false, error:'UNAUTHORIZED' });
    const access = await getUserPermissions(adminSql, company.id, user);

    if (req.method === 'GET') {
      const data = await withRlsSql(company.id, user, sql => snapshot(sql, company.id, user.id, access));
      return send(res, 200, { ok:true, data });
    }

    if (req.method === 'POST') {
      const store = String(req.body?.store || '');
      const record = req.body?.record || {};
      if (store !== 'settings' && !cleanId(record.id)) return send(res,400,{ok:false,error:'INVALID_RECORD_ID'});

      if (store === 'settings') {
        const canConfig = canAccess(access,'configuracoes');
        const canBudget = canAccess(access,'orcamentos');
        const canContract = canAccess(access,'contratos');
        if (!canConfig && !canBudget && !canContract) return send(res,403,{ok:false,error:'ACCESS_DENIED',permission:'configuracoes'});
        await withRlsSql(company.id,user,sql => canConfig
          ? saveSettings(sql,company.id,user.id,record)
          : saveSequenceSettings(sql,company.id,user.id,record,{budget:canBudget,contract:canContract}));
      } else if (store === 'clients') {
        await requirePermission(adminSql,company.id,user,'clientes');
        await withRlsSql(company.id,user,sql => saveClient(sql,company.id,user.id,record));
      } else if (store === 'products') {
        await requirePermission(adminSql,company.id,user,'produtos');
        await withRlsSql(company.id,user,sql => saveProduct(sql,company.id,user.id,record,canAccess(access,'custos')));
      } else if (store === 'budgets') {
        await requirePermission(adminSql,company.id,user,'orcamentos');
        await withRlsSql(company.id,user,sql => saveBudget(sql,company.id,user.id,record));
      } else if (store === 'contracts') {
        await requirePermission(adminSql,company.id,user,'contratos');
        await withRlsSql(company.id,user,sql => saveContract(sql,company.id,user.id,record));
      } else return send(res,400,{ok:false,error:'INVALID_STORE'});
      return send(res,200,{ok:true});
    }

    if (req.method === 'DELETE') {
      const store = String(req.query?.store || '');
      const id = cleanId(req.query?.id);
      const permissionByStore = {clients:'clientes',products:'produtos',budgets:'orcamentos',contracts:'contratos'};
      if (!permissionByStore[store] || !id) return send(res,400,{ok:false,error:'INVALID_DELETE'});
      await requirePermission(adminSql,company.id,user,permissionByStore[store]);
      await requirePermission(adminSql,company.id,user,'excluir');
      await withRlsSql(company.id,user,async sql => {
        if (store === 'clients') await sql`DELETE FROM clients WHERE company_id=${company.id} AND owner_user_id=${user.id} AND local_id=${id}`;
        if (store === 'products') await sql`DELETE FROM products WHERE company_id=${company.id} AND owner_user_id=${user.id} AND local_id=${id}`;
        if (store === 'budgets') await sql`DELETE FROM budgets WHERE company_id=${company.id} AND owner_user_id=${user.id} AND local_id=${id}`;
        if (store === 'contracts') await sql`DELETE FROM contracts WHERE company_id=${company.id} AND owner_user_id=${user.id} AND local_id=${id}`;
      });
      return send(res,200,{ok:true});
    }

    return send(res,405,{ok:false,error:'METHOD_NOT_ALLOWED'});
  } catch (err) {
    const missing = err?.message === 'DATABASE_URL_NOT_CONFIGURED';
    const denied = err?.message === 'ACCESS_DENIED' || err?.code === 'ACCESS_DENIED';
    const rls = ['RLS_CONTEXT_REQUIRED','42501'].includes(err?.code) || String(err?.message || '').includes('row-level security');
    console.error(err);
    return send(res, denied ? 403 : (missing ? 503 : 500), {
      ok:false,
      error:denied ? 'ACCESS_DENIED' : (missing ? 'DATABASE_NOT_CONNECTED' : (rls ? 'RLS_ACCESS_DENIED' : 'SERVER_ERROR')),
      ...(denied ? {permission:err.permission || null} : {})
    });
  }
};
